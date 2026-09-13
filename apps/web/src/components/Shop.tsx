import type { Cart, Product } from '@checkout/contracts';
import { money } from '../utils/format';

export function Shop({
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
