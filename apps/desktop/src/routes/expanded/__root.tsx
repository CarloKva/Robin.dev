import { Outlet, createRoute } from '@tanstack/react-router';

import { SessionProvider } from '@/lib/session/SessionContext';
import { Route as RootRoute } from '../__root';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/expanded',
  component: ExpandedLayout,
});

function ExpandedLayout() {
  return (
    <SessionProvider>
      <Outlet />
    </SessionProvider>
  );
}
