import { CloudOff, RefreshCw } from 'lucide-react';

import { Btn } from '@/components/primitives/Btn';
import { applySession } from '@/lib/supabase/client';
import { loadSession } from '@/lib/auth/session';

/**
 * Light-theme port of `_v1-dark/view-disconnected.jsx`. Sits over the last
 * rendered popover view; the underlying snapshot stays visible (slightly
 * faded) so the popover doesn't feel empty when reconnecting.
 */
export function DisconnectedOverlay() {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-popover/85 px-6 text-center backdrop-blur-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning">
        <CloudOff size={20} />
      </span>
      <h2 className="text-base font-semibold text-ink">Lost connection</h2>
      <p className="max-w-[260px] text-sm text-ink3">
        Showing the last view we had. We&rsquo;ll resume live updates as soon as we can reach the network.
      </p>
      <Btn
        variant="secondary"
        size="sm"
        icon={<RefreshCw size={12} />}
        onClick={async () => {
          const session = await loadSession();
          await applySession(session);
        }}
      >
        Retry now
      </Btn>
    </div>
  );
}
