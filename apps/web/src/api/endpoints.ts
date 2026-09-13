const api = (path: string) => `/api/${path}`;

export const endpoints = {
  products: api('products'),
  sessions: api('sessions'),
  cart: api('cart'),
  sandbox: api('sandbox'),
  checkoutOptions: api('checkout/options'),
  quotes: api('quotes'),
  orders: api('orders'),
  cartItem: (productId: string) => api(`cart/items/${productId}`),
  order: (orderId: string) => api(`orders/${orderId}`),
  orderPayments: (orderId: string) => api(`orders/${orderId}/payments`),
  payment: (paymentId: string) => api(`payments/${paymentId}`),
  paymentSimulations: (paymentId: string) => api(`payments/${paymentId}/simulations`),
} as const;
