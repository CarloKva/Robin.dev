import { createRoute } from '@tanstack/react-router';

import { Btn } from '@/components/primitives/Btn';
import { RobinLogoTile } from '@/components/primitives/RobinLogoTile';
import { startSignIn } from '@/lib/auth/session';
import { Route as RootRoute } from './__root';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/sign-in',
  component: SignInPage,
});

function SignInPage() {
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
            onClick={() => {
              void startSignIn();
            }}
          >
            Sign in with browser
          </Btn>
          <p className="mt-2 text-2xs text-ink4">
            We&rsquo;ll open your default browser. After signing in you&rsquo;ll be redirected back here.
          </p>
        </div>
      </div>
    </div>
  );
}
