import { createRoute, useRouter } from '@tanstack/react-router';

import { useState } from 'react';

import { Btn } from '@/components/primitives/Btn';
import { RobinLogoTile } from '@/components/primitives/RobinLogoTile';
import { startSignIn } from '@/lib/auth/session';
import { commitDesktopSession } from '@/lib/session/SessionContext';
import { Route as RootRoute } from './__root';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/sign-in',
  component: SignInPage,
});

function SignInPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-popover p-8 shadow-popover">
        <div className="flex flex-col items-center gap-4 text-center">
          <RobinLogoTile size={56} />
          <h1 className="text-xl font-semibold tracking-tight">Robin.dev</h1>
          <p className="text-sm text-ink3">
            Sign in with your Robin account to start watching your engineers.
          </p>
          <Btn
            variant="primary"
            size="lg"
            full
            disabled={busy}
            onClick={() => {
              setBusy(true);
              startSignIn()
                .then((session) => {
                  commitDesktopSession(session);
                  void router.navigate({ to: '/popover/inbox', replace: true }).catch(console.error);
                })
                .catch((err) => {
                  console.error('[sign-in] failed', err);
                  alert(`Sign-in failed: ${err?.message ?? err}`);
                })
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'Waiting for browser…' : 'Sign in with browser'}
          </Btn>
          <p className="mt-2 text-2xs text-ink4">
            {busy
              ? "We're checking in with the server every couple of seconds. You can close the browser tab once it says \"Returning to Robin\"."
              : "We'll open your default browser. After signing in you'll come back here automatically."}
          </p>
        </div>
      </div>
    </div>
  );
}
