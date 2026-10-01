import { useRoute } from './router';
import { BottomNav } from './components/BottomNav';
import { Home } from './screens/Home';
import { Sell } from './screens/Sell';
import { Receive } from './screens/Receive';
import { StockTake } from './screens/StockTake';
import { Products } from './screens/Products';
import { ProductDetail } from './screens/ProductDetail';
import { Labels } from './screens/Labels';
import { Reports } from './screens/Reports';
import { Settings } from './screens/Settings';

const routes = [
  { path: '/', component: Home },
  { path: '/sell', component: Sell },
  { path: '/receive', component: Receive },
  { path: '/stock-take', component: StockTake },
  { path: '/products', component: Products },
  { path: '/products/:id', component: ProductDetail },
  { path: '/labels', component: Labels },
  { path: '/reports', component: Reports },
  { path: '/settings', component: Settings },
];

export function App() {
  const match = useRoute(routes);
  const Screen = match?.Component ?? Home;
  return (
    <>
      <Screen {...(match?.params ?? {})} />
      <BottomNav />
    </>
  );
}
