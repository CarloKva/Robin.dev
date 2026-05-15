import { Github, Plug, Unplug } from 'lucide-react';
import { useState } from 'react';

import { Btn } from '@/components/primitives/Btn';
import { disconnect, openConnectFlow, type GitHubConnection } from '@/lib/api/github';

interface ConnectionCardProps {
  connection: GitHubConnection | null;
  onChange: () => void;
}

export function ConnectionCard({ connection, onChange }: ConnectionCardProps) {
  const [busy, setBusy] = useState(false);

  return (
    <section className="rounded-2xl border border-divider bg-popover p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-popover">
            <Github size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">GitHub</h2>
            <p className="text-xs text-ink3">
              {connection?.connected
                ? `Connected as ${connection.account_login ?? 'unknown'}`
                : 'Not connected'}
            </p>
          </div>
        </div>
        {connection?.connected ? (
          <Btn
            variant="danger"
            size="sm"
            icon={<Unplug size={12} />}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await disconnect().catch(() => undefined);
              setBusy(false);
              onChange();
            }}
          >
            Disconnect
          </Btn>
        ) : (
          <Btn
            variant="primary"
            size="sm"
            icon={<Plug size={12} />}
            onClick={() => {
              openConnectFlow();
            }}
          >
            Connect GitHub
          </Btn>
        )}
      </div>
    </section>
  );
}
