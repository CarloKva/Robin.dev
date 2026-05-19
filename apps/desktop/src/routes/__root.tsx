import { Outlet, createRootRoute, redirect } from '@tanstack/react-router';

import { SessionProvider } from '@/lib/session/SessionContext';

export const Route = createRootRoute({
  component: RootComponent,
  beforeLoad: ({ location }) => {
    // The Tauri popover loads `/popover/inbox` directly; only browser dev
    // ever lands on `/`. Redirect there so the renderer doesn't surface the
    // bare layout-less root.
    if (location.pathname === '/') {
      throw redirect({ to: '/popover/inbox' });
    }
  },
});

function RootComponent() {
  return (
    <SessionProvider>
      <Outlet />
    </SessionProvider>
  );
}
