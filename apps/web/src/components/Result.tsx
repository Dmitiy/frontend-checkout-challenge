import type { Order, Payment, Scenario } from '@checkout/contracts';
import type { Sandbox } from '../types/checkout';
import { money } from '../utils/format';

export function Result({
  order,
  payment,
  sandbox,
  busy,
  onRetry,
  selectedScenario,
  onSelectScenario,
  onSimulate,
}: {
  order: Order;
  payment: Payment | null;
  sandbox: Sandbox | null;
  busy: boolean;
  onRetry: () => void;
  selectedScenario: Scenario | null;
  onSelectScenario: (scenario: Scenario) => void;
  onSimulate: (scenario?: Scenario) => void;
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
          ) : !payment ? (
            <>
              <div className="statusIcon failed">!</div>
              <h2>Оплата ещё не запущена</h2>
              <p>Заказ сохранён. Запустите тестовую платёжную попытку.</p>
              <button className="primary full" disabled={busy} onClick={onRetry}>
                Запустить оплату
              </button>
            </>
          ) : waiting ? (
            <WaitingPayment
              sandbox={sandbox}
              busy={busy}
              selectedScenario={selectedScenario}
              onSelectScenario={onSelectScenario}
              onSimulate={onSimulate}
            />
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

function WaitingPayment({
  sandbox,
  busy,
  selectedScenario,
  onSelectScenario,
  onSimulate,
}: {
  sandbox: Sandbox | null;
  busy: boolean;
  selectedScenario: Scenario | null;
  onSelectScenario: (scenario: Scenario) => void;
  onSimulate: (scenario?: Scenario) => void;
}) {
  return (
    <>
      <div className="statusIcon waiting">
        <span className="spinner" />
      </div>
      <h2>Ожидаем оплату</h2>
      <p>Выберите тестовый сценарий оплаты. Настоящие реквизиты не нужны.</p>
      {sandbox?.cards.map((card) => (
        <label
          className={`cardOption ${selectedScenario === card.scenario ? 'selected' : ''}`}
          key={card.id}
        >
          <input
            type="radio"
            name="test-card"
            checked={selectedScenario === card.scenario}
            onChange={() => onSelectScenario(card.scenario)}
          />
          <span>{card.maskedNumber}</span>
          <b>{card.title}</b>
        </label>
      ))}
      <button
        className="primary full"
        disabled={busy || !selectedScenario}
        onClick={() => onSimulate()}
      >
        Оплатить
      </button>
      <button className="secondary full" disabled={busy} onClick={() => onSimulate('cancel')}>
        Отменить оплату
      </button>
    </>
  );
}
