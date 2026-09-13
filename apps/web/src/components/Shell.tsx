import type { ReactNode } from 'react';
import type { Cart } from '@checkout/contracts';
import { money } from '../utils/format';

export function Shell({
  children,
  cart,
  onCart,
}: {
  children: ReactNode;
  cart?: Cart | null;
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
