import { useEffect, useState, type ReactNode } from 'react';
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
import { ApiFailure, newKey, request } from './api';

type CheckoutOptions = {
  cart: Cart;
  deliveryMethods: {
    id: 'pickup' | 'courier';
    title: string;
    price: number;
    freeFrom: number | null;
    pickupPoints: { id: string; title: string; address: string }[];
  }[];
  paymentMethods: { id: 'card' | 'cash_on_delivery'; title: string }[];
};
type Sandbox = {
  cards: { id: string; title: string; maskedNumber: string; scenario: Scenario }[];
  settlementDelayMs: number;
};
type Session = { id: string; token: string; cart: Cart };
type Stage = 'shop' | 'checkout' | 'success';
type FormState = Customer & {
  delivery: 'pickup' | 'courier';
  pickupPointId: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  paymentMethod: 'card' | 'cash_on_delivery';
};

const saved = (key: string) => localStorage.getItem(`checkout:${key}`);
const money = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value / 100);
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

function errorText(error: unknown) {
  if (error instanceof ApiFailure) return error.message;
  return 'Не удалось выполнить действие. Попробуйте ещё раз.';
}

export default function App() {
  const [stage, setStage] = useState<Stage>('shop');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    name: saved('name') ?? '',
    email: saved('email') ?? '',
    phone: saved('phone') ?? '',
  }));
  const [token, setToken] = useState<string | null>(saved('token'));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshCart = async (activeToken = token) => {
    if (!activeToken) return;
    setCart(await request<Cart>('/api/cart', activeToken));
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const catalog = await request<Product[]>('/api/products', null);
        let sessionToken = token;
        let session: Session;
        if (sessionToken) {
          try {
            session = {
              id: saved('sessionId') ?? '',
              token: sessionToken,
              cart: await request<Cart>('/api/cart', sessionToken),
            };
          } catch {
            sessionToken = null;
            session = await request<Session>('/api/sessions', null, { method: 'POST', body: {} });
          }
        } else
          session = await request<Session>('/api/sessions', null, { method: 'POST', body: {} });
        if (!active) return;
        setProducts(catalog);
        setToken(session.token);
        setCart(session.cart);
        localStorage.setItem('checkout:token', session.token);
        localStorage.setItem('checkout:sessionId', session.id);
        const orderId = saved('orderId');
        if (orderId) {
          try {
            const restoredOrder = await request<Order>(`/api/orders/${orderId}`, session.token);
            setOrder(restoredOrder);
            setStage('success');
            const restoredPaymentId = saved('paymentId');
            if (restoredPaymentId) {
              try {
                setPayment(
                  await request<Payment>(`/api/payments/${restoredPaymentId}`, session.token),
                );
              } catch {
                localStorage.removeItem('checkout:paymentId');
              }
            }
            if (restoredOrder.paymentMethod === 'card')
              setSandbox(await request<Sandbox>('/api/sandbox', null));
          } catch {
            localStorage.removeItem('checkout:orderId');
          }
        }
      } catch (cause) {
        if (active) setError(errorText(cause));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
        } else window.setTimeout(poll, 700);
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
      if (quantity === 0)
        await request(`/api/cart/items/${productId}`, token, { method: 'DELETE' });
      else
        await request(`/api/cart/items/${productId}`, token, { method: 'PUT', body: { quantity } });
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
  const makeQuote = async () => {
    if (!token || !cart) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setQuote(
        await request<Quote>('/api/quotes', token, {
          method: 'POST',
          body: { cartVersion: cart.version, delivery },
        }),
      );
    } catch (cause) {
      await refreshCart();
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
      localStorage.setItem('checkout:name', customer.name);
      localStorage.setItem('checkout:email', customer.email);
      localStorage.setItem('checkout:phone', customer.phone);
      const orderKey = saved('orderKey') ?? newKey();
      localStorage.setItem('checkout:orderKey', orderKey);
      const next = await request<Order>('/api/orders', token, {
        method: 'POST',
        body: { quoteId: quote.id, customer, paymentMethod: form.paymentMethod },
        idempotencyKey: orderKey,
      });
      localStorage.setItem('checkout:orderId', next.id);
      setOrder(next);
      setQuote(null);
      setStage('success');
      if (next.paymentMethod === 'cash_on_delivery') return;
      await startPayment(next);
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
      const next = await request<Payment>(`/api/orders/${nextOrder.id}/payments`, token, {
        method: 'POST',
        body: {},
        idempotencyKey: newKey(),
      });
      localStorage.setItem('checkout:paymentId', next.id);
      setPayment(next);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };
  const simulate = async (scenario: Scenario) => {
    if (!token || !payment) return;
    setBusy(true);
    setError('');
    try {
      const simulation = await request<{ status: Payment['status'] }>(
        `/api/payments/${payment.id}/simulations`,
        token,
        { method: 'POST', body: { scenario } },
      );
      setPayment((current) => (current ? { ...current, status: simulation.status } : current));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const updateForm = (patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setQuote(null);
  };
  if (loading)
    return (
      <Shell>
        <div className="state">
          <span className="spinner" />
          Загружаем магазин
        </div>
      </Shell>
    );
  return (
    <Shell cart={cart} stage={stage} onCart={() => setStage('shop')}>
      {error && (
        <div className="alert error" role="alert">
          {error}
          <button onClick={() => setError('')} aria-label="Закрыть">
            ×
          </button>
        </div>
      )}
      {notice && <div className="alert success">{notice}</div>}
      {stage === 'shop' && (
        <Shop
          products={products}
          cart={cart}
          busy={busy}
          onChange={changeItem}
          onCheckout={openCheckout}
        />
      )}
      {stage === 'checkout' && options && (
        <Checkout
          form={form}
          options={options}
          quote={quote}
          busy={busy}
          onChange={updateForm}
          onQuote={makeQuote}
          onOrder={createOrder}
          onBack={() => setStage('shop')}
        />
      )}
      {stage === 'success' && order && (
        <Result
          order={order}
          payment={payment}
          sandbox={sandbox}
          busy={busy}
          onRetry={() => startPayment()}
          onSimulate={simulate}
        />
      )}
    </Shell>
  );
}

function Shell({
  children,
  cart,
  onCart,
}: {
  children: ReactNode;
  cart?: Cart | null;
  stage?: Stage;
  onCart?: () => void;
}) {
  return (
    <main>
      <header>
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onCart?.();
          }}
        >
          Тихий предмет <small>магазин вещей для дома</small>
        </a>
        <button className="cartButton" onClick={onCart} disabled={!cart}>
          <span>Корзина</span>
          <b>{cart?.quantity ?? 0}</b>
          <strong>{money(cart?.subtotal ?? 0)}</strong>
        </button>
      </header>
      <div className="content">{children}</div>
      <footer>Тестовый магазин · цены указаны в рублях</footer>
    </main>
  );
}
function Shop({
  products,
  cart,
  busy,
  onChange,
  onCheckout,
}: {
  products: Product[];
  cart: Cart | null;
  busy: boolean;
  onChange: (id: string, quantity: number) => void;
  onCheckout: () => void;
}) {
  return (
    <>
      <section className="intro">
        <p className="eyebrow">Коллекция 01 / 2026</p>
        <h1>
          Вещи, которые
          <br />
          <em>остаются.</em>
        </h1>
        <p>Небольшие предметы для спокойного дома. Выберите то, что пригодится сегодня.</p>
      </section>
      <div className="sectionHead">
        <h2>Каталог</h2>
        <span>{products.length} позиции</span>
      </div>
      <div className="products">
        {products.map((product, index) => (
          <article className={`product ${product.stock === 0 ? 'sold' : ''}`} key={product.id}>
            <div className={`productImage image${index + 1}`}>
              <span>{String(index + 1).padStart(2, '0')}</span>
            </div>
            <div className="productInfo">
              <div>
                <h3>{product.title}</h3>
                <p>{product.description}</p>
              </div>
              <strong>{money(product.price)}</strong>
            </div>
            <div className="productAction">
              {product.stock === 0 ? (
                <span className="muted">Нет в наличии</span>
              ) : (
                <Quantity
                  item={cart?.items.find((item) => item.productId === product.id)}
                  stock={product.stock}
                  busy={busy}
                  onChange={(quantity) => onChange(product.id, quantity)}
                />
              )}
            </div>
          </article>
        ))}
      </div>
      <aside className="cartBar">
        <div>
          <span>В вашей корзине</span>
          <strong>
            {cart?.quantity ?? 0} {cart?.quantity === 1 ? 'товар' : 'товаров'} ·{' '}
            {money(cart?.subtotal ?? 0)}
          </strong>
        </div>
        <button className="primary" disabled={!cart?.items.length || busy} onClick={onCheckout}>
          Перейти к оформлению <span>→</span>
        </button>
      </aside>
    </>
  );
}
function Quantity({
  item,
  stock,
  busy,
  onChange,
}: {
  item?: Cart['items'][number];
  stock: number;
  busy: boolean;
  onChange: (quantity: number) => void;
}) {
  const quantity = item?.quantity ?? 0;
  return (
    <div className="quantity">
      <button
        aria-label="Уменьшить количество"
        disabled={busy || quantity === 0}
        onClick={() => onChange(quantity - 1)}
      >
        −
      </button>
      <span>{quantity || 'Добавить'}</span>
      <button
        aria-label="Увеличить количество"
        disabled={busy || quantity >= stock}
        onClick={() => onChange(quantity + 1)}
      >
        +
      </button>
    </div>
  );
}

function Checkout({
  form,
  options,
  quote,
  busy,
  onChange,
  onQuote,
  onOrder,
  onBack,
}: {
  form: FormState;
  options: CheckoutOptions;
  quote: Quote | null;
  busy: boolean;
  onChange: (patch: Partial<FormState>) => void;
  onQuote: () => void;
  onOrder: () => void;
  onBack: () => void;
}) {
  return (
    <section className="checkout">
      <button className="back" onClick={onBack}>
        ← Вернуться в каталог
      </button>
      <div className="sectionHead">
        <div>
          <p className="eyebrow">Шаг 02 / оформление</p>
          <h1 className="pageTitle">Данные заказа</h1>
        </div>
        <span>Все поля обязательны, кроме квартиры</span>
      </div>
      <div className="checkoutGrid">
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            void onQuote();
          }}
        >
          <fieldset>
            <legend>Контактные данные</legend>
            <label>
              Имя
              <input
                required
                minLength={2}
                value={form.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="Анна Петрова"
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => onChange({ email: e.target.value })}
                placeholder="anna@example.com"
              />
            </label>
            <label>
              Телефон
              <input
                required
                pattern="^\+[1-9]\d{9,14}$"
                value={form.phone}
                onChange={(e) => onChange({ phone: e.target.value })}
                placeholder="+79990000000"
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>Доставка</legend>
            <div className="choiceGrid">
              {options.deliveryMethods.map((method) => (
                <label
                  className={`choice ${form.delivery === method.id ? 'selected' : ''}`}
                  key={method.id}
                >
                  <input
                    type="radio"
                    name="delivery"
                    checked={form.delivery === method.id}
                    onChange={() => onChange({ delivery: method.id })}
                  />
                  <span>
                    <b>{method.title}</b>
                    <small>
                      {method.price
                        ? `${money(method.price)} · бесплатно от ${money(method.freeFrom ?? 0)}`
                        : 'Бесплатно'}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            {form.delivery === 'pickup' ? (
              <label>
                Пункт выдачи
                <select
                  value={form.pickupPointId}
                  onChange={(e) => onChange({ pickupPointId: e.target.value })}
                >
                  {options.deliveryMethods
                    .find((method) => method.id === 'pickup')
                    ?.pickupPoints.map((point) => (
                      <option value={point.id} key={point.id}>
                        {point.title} · {point.address}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <div className="address">
                <label>
                  Город
                  <input
                    required
                    value={form.city}
                    onChange={(e) => onChange({ city: e.target.value })}
                  />
                </label>
                <label>
                  Улица
                  <input
                    required
                    value={form.street}
                    onChange={(e) => onChange({ street: e.target.value })}
                    placeholder="Примерная"
                  />
                </label>
                <label>
                  Дом
                  <input
                    required
                    value={form.house}
                    onChange={(e) => onChange({ house: e.target.value })}
                    placeholder="10"
                  />
                </label>
                <label>
                  Квартира
                  <input
                    value={form.apartment}
                    onChange={(e) => onChange({ apartment: e.target.value })}
                  />
                </label>
              </div>
            )}
          </fieldset>
          <fieldset>
            <legend>Оплата</legend>
            {options.paymentMethods.map((method) => (
              <label
                className={`choice payment ${form.paymentMethod === method.id ? 'selected' : ''}`}
                key={method.id}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={form.paymentMethod === method.id}
                  onChange={() => onChange({ paymentMethod: method.id })}
                />
                <span>
                  <b>{method.title}</b>
                  <small>
                    {method.id === 'card'
                      ? 'Выбор тестовой карты без ввода реквизитов'
                      : 'Расчёт после получения'}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          <button className="primary full" type="submit" disabled={busy}>
            {busy ? 'Считаем…' : 'Рассчитать заказ'}
          </button>
        </form>
        <QuotePanel quote={quote} busy={busy} onOrder={onOrder} />
      </div>
    </section>
  );
}
function QuotePanel({
  quote,
  busy,
  onOrder,
}: {
  quote: Quote | null;
  busy: boolean;
  onOrder: () => void;
}) {
  return (
    <aside className="summary">
      <p className="eyebrow">Ваш заказ</p>
      {quote ? (
        <>
          <div className="summaryRows">
            <span>
              Товары <b>{money(quote.subtotal)}</b>
            </span>
            <span>
              Доставка <b>{quote.shipping ? money(quote.shipping) : 'Бесплатно'}</b>
            </span>
          </div>
          <div className="total">
            <span>Итого</span>
            <strong>{money(quote.total)}</strong>
          </div>
          <p className="hint">Расчёт действителен 10 минут.</p>
          <button className="primary full" disabled={busy} onClick={onOrder}>
            Подтвердить заказ <span>→</span>
          </button>
        </>
      ) : (
        <div className="emptySummary">
          Заполните данные и нажмите «Рассчитать заказ», чтобы получить стоимость от сервера.
        </div>
      )}
    </aside>
  );
}
function Result({
  order,
  payment,
  sandbox,
  busy,
  onRetry,
  onSimulate,
}: {
  order: Order;
  payment: Payment | null;
  sandbox: Sandbox | null;
  busy: boolean;
  onRetry: () => void;
  onSimulate: (scenario: Scenario) => void;
}) {
  const waiting = payment && ['pending', 'processing'].includes(payment.status);
  const failed = payment?.status === 'failed';
  const cancelled = payment?.status === 'cancelled';
  return (
    <section className="result">
      <p className="eyebrow">Заказ подтверждён</p>
      <h1 className="pageTitle">Спасибо за заказ.</h1>
      <div className="resultLayout">
        <div className="receipt">
          <div className="receiptTop">
            <span>Номер заказа</span>
            <strong>{order.number}</strong>
          </div>
          <div className="receiptLines">
            {order.items.map((item) => (
              <span key={item.productId}>
                <span>
                  {item.title} × {item.quantity}
                </span>
                <b>{money(item.lineTotal)}</b>
              </span>
            ))}
          </div>
          <div className="receiptLines">
            <span>
              <span>{order.delivery.method === 'pickup' ? 'Самовывоз' : 'Курьер'}</span>
              <b>{order.shipping ? money(order.shipping) : 'Бесплатно'}</b>
            </span>
          </div>
          <div className="total">
            <span>Итого</span>
            <strong>{money(order.total)}</strong>
          </div>
        </div>
        <div className="paymentState">
          {order.paymentMethod === 'cash_on_delivery' ? (
            <>
              <div className="statusIcon">✓</div>
              <h2>Оплата при получении</h2>
              <p>Заказ оформлен. Оплатите его наличными при получении.</p>
            </>
          ) : waiting ? (
            <>
              <div className="statusIcon waiting">
                <span className="spinner" />
              </div>
              <h2>Ожидаем оплату</h2>
              <p>Выберите тестовый сценарий оплаты. Настоящие реквизиты не нужны.</p>
              {sandbox?.cards.map((card) => (
                <button
                  className="cardOption"
                  disabled={busy}
                  key={card.id}
                  onClick={() => onSimulate(card.scenario)}
                >
                  <span>{card.maskedNumber}</span>
                  <b>{card.title}</b>
                </button>
              ))}
            </>
          ) : failed || cancelled ? (
            <>
              <div className="statusIcon failed">{cancelled ? '×' : '!'}</div>
              <h2>{cancelled ? 'Оплата отменена' : 'Банк отказал в оплате'}</h2>
              <p>Заказ сохранён. Можно повторить оплату с новой попыткой.</p>
              <button className="primary full" disabled={busy} onClick={onRetry}>
                Повторить оплату
              </button>
            </>
          ) : (
            <>
              <div className="statusIcon">✓</div>
              <h2>Оплата прошла</h2>
              <p>Заказ подтверждён сервером. Мы уже собираем его.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
