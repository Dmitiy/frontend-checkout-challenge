import { useEffect, useState } from 'react';
import type {
  Cart,
  Customer,
  Delivery,
  Order,
  Payment,
  Product,
  Quote,
  Scenario,
} from '@checkout/contracts';
import { newKey, request } from '../api';
import type { CheckoutOptions, FormState, Sandbox, Session, Stage } from '../types/checkout';
import { errorText } from '../utils/errors';
import { storage } from '../utils/storage';

const initialForm: FormState = {
  name: '',
  email: '',
  phone: '',
  delivery: 'pickup',
  pickupPointId: 'point-center',
  city: 'Учебный',
  street: '',
  house: '',
  apartment: '',
  paymentMethod: 'card',
};

export function useCheckout() {
  const [stage, setStage] = useState<Stage>('shop');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    name: storage.get('name') ?? '',
    email: storage.get('email') ?? '',
    phone: storage.get('phone') ?? '',
  }));
  const [token, setToken] = useState<string | null>(storage.get('token'));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshCart = async (activeToken = token) => {
    if (!activeToken) return;
    setCart(await request<Cart>('/api/cart', activeToken));
  };

  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        const catalog = await request<Product[]>('/api/products', null);
        const storedToken = token;
        let session: Session;
        if (storedToken) {
          try {
            session = {
              id: storage.get('sessionId') ?? '',
              token: storedToken,
              cart: await request<Cart>('/api/cart', storedToken),
            };
          } catch {
            session = await request<Session>('/api/sessions', null, { method: 'POST', body: {} });
          }
        } else {
          session = await request<Session>('/api/sessions', null, { method: 'POST', body: {} });
        }
        if (!active) return;
        setProducts(catalog);
        setToken(session.token);
        setCart(session.cart);
        storage.set('token', session.token);
        storage.set('sessionId', session.id);
        await restoreOrder(session.token);
      } catch (cause) {
        if (active) setError(errorText(cause));
      } finally {
        if (active) setLoading(false);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, []);

  const restoreOrder = async (sessionToken: string) => {
    const orderId = storage.get('orderId');
    if (!orderId) return;
    try {
      const restoredOrder = await request<Order>(`/api/orders/${orderId}`, sessionToken);
      setOrder(restoredOrder);
      setStage('success');
      if (restoredOrder.paymentMethod !== 'card') return;
      const paymentId = storage.get('paymentId');
      const restoredPayment = paymentId
        ? await request<Payment>(`/api/payments/${paymentId}`, sessionToken).catch(() => null)
        : null;
      if (restoredPayment) {
        setPayment(restoredPayment);
      } else {
        const payments = await request<Payment[]>(
          `/api/orders/${restoredOrder.id}/payments`,
          sessionToken,
        );
        const latestPayment = payments[0];
        if (latestPayment) {
          setPayment(latestPayment);
          storage.set('paymentId', latestPayment.id);
        }
      }
      setSandbox(await request<Sandbox>('/api/sandbox', null));
    } catch {
      storage.remove('orderId');
    }
  };

  useEffect(() => {
    if (!token || !payment || !order || !['pending', 'processing'].includes(payment.status)) return;
    const controller = new AbortController();
    let stale = false;
    const poll = async () => {
      try {
        const next = await request<Payment>(`/api/payments/${payment.id}`, token, {
          signal: controller.signal,
        });
        if (stale) return;
        setPayment(next);
        if (['succeeded', 'failed', 'cancelled'].includes(next.status)) {
          const latest = await request<Order>(`/api/orders/${order.id}`, token, {
            signal: controller.signal,
          });
          if (!stale) setOrder(latest);
        } else {
          window.setTimeout(poll, 700);
        }
      } catch (cause) {
        if (!stale && !controller.signal.aborted) setError(errorText(cause));
      }
    };
    const timer = window.setTimeout(poll, 700);
    return () => {
      stale = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [payment?.id, payment?.status, order?.id, token]);

  const changeItem = async (productId: string, quantity: number) => {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      if (quantity === 0) {
        await request(`/api/cart/items/${productId}`, token, { method: 'DELETE' });
      } else {
        await request(`/api/cart/items/${productId}`, token, {
          method: 'PUT',
          body: { quantity },
        });
      }
      await refreshCart();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const openCheckout = async () => {
    if (!cart?.items.length || !token) return;
    setBusy(true);
    setError('');
    try {
      const [nextOptions, nextSandbox] = await Promise.all([
        request<CheckoutOptions>('/api/checkout/options', token),
        request<Sandbox>('/api/sandbox', null),
      ]);
      setOptions(nextOptions);
      setSandbox(nextSandbox);
      setStage('checkout');
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const delivery: Delivery =
    form.delivery === 'pickup'
      ? { method: 'pickup', pickupPointId: form.pickupPointId }
      : {
          method: 'courier',
          address: {
            city: form.city,
            street: form.street,
            house: form.house,
            apartment: form.apartment || undefined,
          },
        };

  const updateForm = (patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setQuote(null);
  };

  const makeQuote = async () => {
    if (!token || !cart) return;
    setBusy(true);
    setError('');
    try {
      setQuote(
        await request<Quote>('/api/quotes', token, {
          method: 'POST',
          body: { cartVersion: cart.version, delivery },
        }),
      );
    } catch (cause) {
      await refreshCart();
      setQuote(null);
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const createOrder = async () => {
    if (!token || !quote) return;
    setBusy(true);
    setError('');
    try {
      const customer: Customer = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      };
      storage.set('name', customer.name);
      storage.set('email', customer.email);
      storage.set('phone', customer.phone);
      const orderKey =
        storage.get('orderQuoteId') === quote.id ? (storage.get('orderKey') ?? newKey()) : newKey();
      storage.set('orderKey', orderKey);
      storage.set('orderQuoteId', quote.id);
      storage.remove('paymentKey');
      const next = await request<Order>('/api/orders', token, {
        method: 'POST',
        body: { quoteId: quote.id, customer, paymentMethod: form.paymentMethod },
        idempotencyKey: orderKey,
      });
      storage.set('orderId', next.id);
      setOrder(next);
      setQuote(null);
      setStage('success');
      if (next.paymentMethod === 'card') await startPayment(next);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const startPayment = async (nextOrder = order) => {
    if (!token || !nextOrder) return;
    setBusy(true);
    setError('');
    try {
      const paymentKey =
        payment && ['pending', 'processing'].includes(payment.status)
          ? (storage.get('paymentKey') ?? newKey())
          : newKey();
      storage.set('paymentKey', paymentKey);
      const next = await request<Payment>(`/api/orders/${nextOrder.id}/payments`, token, {
        method: 'POST',
        body: {},
        idempotencyKey: paymentKey,
      });
      storage.set('paymentId', next.id);
      setPayment(next);
      setSelectedScenario(null);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const simulate = async (requestedScenario?: Scenario) => {
    if (!token || !payment) return;
    const scenario = requestedScenario ?? selectedScenario;
    if (!scenario) return;
    setBusy(true);
    setError('');
    try {
      const simulation = await request<{ status: Payment['status'] }>(
        `/api/payments/${payment.id}/simulations`,
        token,
        { method: 'POST', body: { scenario } },
      );
      setPayment((current) => (current ? { ...current, status: simulation.status } : current));
      if (['succeeded', 'failed', 'cancelled'].includes(simulation.status) && order) {
        setOrder(await request<Order>(`/api/orders/${order.id}`, token));
      }
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  return {
    stage,
    products,
    cart,
    options,
    sandbox,
    quote,
    order,
    payment,
    selectedScenario,
    form,
    busy,
    loading,
    error,
    setError,
    setStage,
    setSelectedScenario,
    changeItem,
    openCheckout,
    updateForm,
    makeQuote,
    createOrder,
    startPayment,
    simulate,
  };
}
