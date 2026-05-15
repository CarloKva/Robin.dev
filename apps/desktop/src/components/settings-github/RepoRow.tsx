import { useState } from 'react';
import { Lock } from 'lucide-react';

import { Toggle } from '@/components/primitives/Toggle';
import { disableRepo, enableRepo, type RemoteRepo } from '@/lib/api/github';

interface RepoRowProps {
  repo: RemoteRepo;
  onChange: () => void;
}

export function RepoRow({ repo, onChange }: RepoRowProps) {
  const [busy, setBusy] = useState(false);

  return (
    <li className="flex items-center justify-between gap-3 border-t border-divider px-4 py-2.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-mono text-xs text-ink">{repo.full_name}</span>
          {repo.private ? <Lock size={10} className="text-ink3" /> : null}
        </div>
        <p className="text-2xs text-ink3">default: {repo.default_branch}</p>
      </div>
      <Toggle
        checked={repo.enabled}
        disabled={busy}
        label={repo.enabled ? 'Disable repo' : 'Enable repo'}
        onChange={async () => {
          setBusy(true);
          if (repo.enabled && repo.workspace_repo_id) {
            await disableRepo(repo.workspace_repo_id).catch(() => undefined);
          } else {
            await enableRepo(repo.id, repo.full_name).catch(() => undefined);
          }
          setBusy(false);
          onChange();
        }}
      />
    </li>
  );
}
