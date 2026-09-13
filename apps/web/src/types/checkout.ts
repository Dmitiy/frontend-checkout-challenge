import type { Cart, Customer, Payment, Scenario } from '@checkout/contracts';

export type CheckoutOptions = {
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

export type Sandbox = {
  cards: { id: string; title: string; maskedNumber: string; scenario: Scenario }[];
  settlementDelayMs: number;
};

export type Session = { id: string; token: string; cart: Cart };
export type Stage = 'shop' | 'checkout' | 'success';

export type FormState = Customer & {
  delivery: 'pickup' | 'courier';
  pickupPointId: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  paymentMethod: 'card' | 'cash_on_delivery';
};
