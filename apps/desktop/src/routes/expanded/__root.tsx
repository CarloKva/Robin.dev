import { Outlet, createRoute } from '@tanstack/react-router';

import { Route as RootRoute } from '../__root';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/expanded',
  component: ExpandedLayout,
});

function ExpandedLayout() {
  return <Outlet />;
}
