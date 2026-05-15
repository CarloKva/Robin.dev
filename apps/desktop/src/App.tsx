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
      navigate: (opts) => router.navigate(opts as Parameters<typeof router.navigate>[0]),
    }).then((cleanup) => {
      off = cleanup;
    });
    return () => off?.();
  }, []);

  return <RouterProvider router={router} />;
}
