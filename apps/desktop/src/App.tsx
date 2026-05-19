import { useEffect } from 'react';
import { RouterProvider, createRouter } from '@tanstack/react-router';

import { installDeepLinkRouter } from '@/lib/router/deeplink';
import { routeTree } from './routeTree';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  useEffect(() => {
    let off: (() => void) | undefined;
    void installDeepLinkRouter({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate: (opts) => router.navigate(opts as any),
    }).then((cleanup) => {
      off = cleanup;
    });
    return () => off?.();
  }, []);

  return <RouterProvider router={router} />;
}
