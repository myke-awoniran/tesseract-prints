import type { ReactElement } from 'react';
import type { Role } from '@tesseract/shared';
import { matchPath, useRouter, type RouteParams } from './lib/router';
import Home from './pages/Home';
import Express from './pages/Express';
import Track from './pages/Track';
import PaymentReturn from './pages/PaymentReturn';
import NotFound from './pages/NotFound';
import Login from './pages/console/Login';
import { ConsoleLayout } from './pages/console/ConsoleLayout';
import Overview from './pages/console/Overview';
import Orders from './pages/console/Orders';
import NewOrder from './pages/console/NewOrder';
import OrderDetail from './pages/console/OrderDetail';
import Queue from './pages/console/Queue';
import Settings from './pages/console/Settings';

const CLIENT: readonly Role[] = ['owner', 'admin', 'member'];

interface Route {
  path: string;
  render: (params: RouteParams) => ReactElement;
}

const ROUTES: Route[] = [
  { path: '/', render: () => <Home /> },
  { path: '/express', render: () => <Express /> },
  { path: '/track/:ref', render: (p) => <Track params={p} /> },
  { path: '/pay/return', render: () => <PaymentReturn /> },
  { path: '/console/login', render: () => <Login /> },
  { path: '/console', render: () => <ConsoleLayout roles={CLIENT}><Overview /></ConsoleLayout> },
  { path: '/console/orders', render: () => <ConsoleLayout roles={CLIENT}><Orders /></ConsoleLayout> },
  { path: '/console/orders/new', render: () => <ConsoleLayout roles={CLIENT}><NewOrder /></ConsoleLayout> },
  { path: '/console/orders/:ref', render: (p) => <ConsoleLayout roles={CLIENT}><OrderDetail params={p} /></ConsoleLayout> },
  { path: '/console/queue', render: () => <ConsoleLayout roles={['operator']}><Queue /></ConsoleLayout> },
  { path: '/console/settings', render: () => <ConsoleLayout roles={CLIENT}><Settings /></ConsoleLayout> }
];

export default function App() {
  const { path } = useRouter();
  for (const route of ROUTES) {
    const params = matchPath(route.path, path);
    if (params) return route.render(params);
  }
  return <NotFound />;
}
