import { useState } from 'react';

import { Btn } from '@/components/primitives/Btn';
import { Toggle } from '@/components/primitives/Toggle';
import { BranchTag } from '@/components/primitives/BranchTag';
import type { WorkspaceEnvironment } from '@robin/shared-types';
import { deleteEnvironment, updateEnvironment } from '@/lib/api/environments';

interface EnvironmentCardProps {
  environment: WorkspaceEnvironment;
  onChange: () => void;
}

export function EnvironmentCard({ environment, onChange }: EnvironmentCardProps) {
  const [autoMerge, setAutoMerge] = useState(environment.auto_merge);
  const [busy, setBusy] = useState(false);

  return (
    <article className="rounded-xl border border-divider bg-popover p-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink3">
            {environment.environment_type === 'production' ? 'Production' : 'Staging'}
          </p>
          <BranchTag branch={environment.target_branch} size="md" />
        </div>
        <Btn
          variant="danger"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await deleteEnvironment(environment.id).catch(() => undefined);
            setBusy(false);
            onChange();
          }}
        >
          Remove
        </Btn>
      </header>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-ink2">Auto-merge approved PRs</span>
        <Toggle
          checked={autoMerge}
          label="Auto-merge"
          onChange={async (next) => {
            setAutoMerge(next);
            setBusy(true);
            await updateEnvironment(environment.id, { auto_merge: next }).catch(() => undefined);
            setBusy(false);
          }}
        />
      </div>
    </article>
  );
}
