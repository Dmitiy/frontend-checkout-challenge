import { Checkout } from './components/Checkout';
import { Result } from './components/Result';
import { Shell } from './components/Shell';
import { Shop } from './components/Shop';
import { useCheckout } from './hooks/useCheckout';

export default function App() {
  const checkout = useCheckout();

  if (checkout.loading) {
    return (
      <Shell>
        <div className="state">
          <span className="spinner" />
          Загружаем магазин
        </div>
      </Shell>
    );
  }

  return (
    <Shell cart={checkout.cart} onCart={() => checkout.setStage('shop')}>
      {checkout.error && (
        <div className="alert error" role="alert">
          {checkout.error}
          <button onClick={() => checkout.setError('')} aria-label="Закрыть">
            ×
          </button>
        </div>
      )}
      {checkout.stage === 'shop' && (
        <Shop
          products={checkout.products}
          cart={checkout.cart}
          busy={checkout.busy}
          onChange={checkout.changeItem}
          onCheckout={checkout.openCheckout}
        />
      )}
      {checkout.stage === 'checkout' && checkout.options && (
        <Checkout
          form={checkout.form}
          options={checkout.options}
          quote={checkout.quote}
          busy={checkout.busy}
          onChange={checkout.updateForm}
          onQuote={checkout.makeQuote}
          onOrder={checkout.createOrder}
          onBack={() => checkout.setStage('shop')}
        />
      )}
      {checkout.stage === 'success' && checkout.order && (
        <Result
          order={checkout.order}
          payment={checkout.payment}
          sandbox={checkout.sandbox}
          busy={checkout.busy}
          onRetry={() => checkout.startPayment()}
          selectedScenario={checkout.selectedScenario}
          onSelectScenario={checkout.setSelectedScenario}
          onSimulate={checkout.simulate}
        />
      )}
    </Shell>
  );
}
