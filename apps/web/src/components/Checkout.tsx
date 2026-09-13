import type { Quote } from '@checkout/contracts';
import type { CheckoutOptions, FormState } from '../types/checkout';
import { money } from '../utils/format';

export function Checkout({
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
