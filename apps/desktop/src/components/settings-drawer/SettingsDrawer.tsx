import { useEffect, useState } from 'react';
import {
  Bell,
  Brain,
  CreditCard,
  Github,
  LogOut,
  Puzzle,
  ShieldAlert,
  Users,
  Building2,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/lib/session/SessionContext';
import { SettingsCard } from './SettingsCard';
import { TagPill } from './TagPill';

interface SettingsDrawerProps {
  workspaceId: string | null;
  onOpenGithub: () => void;
}

interface WorkspaceSummary {
  name: string;
  memberCount: number;
  repoEnabled: number;
  notifyEmail: boolean;
  notifySlack: boolean;
  notifyDesktop: boolean;
}

export function SettingsDrawer({ workspaceId, onOpenGithub }: SettingsDrawerProps) {
  const { connection } = useSession();
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!workspaceId) return;
    // Wait for the realtime/auth session to be applied before issuing queries —
    // otherwise PostgREST may answer with the anon role and RLS-gated counts
    // come back as null → "0 members" / "0 repos enabled" false readings.
    if (connection !== 'connected') return;

    async function load() {
      const [ws, members, repos, settings] = await Promise.all([
        supabase().from('workspaces').select('name').eq('id', workspaceId).maybeSingle(),
        supabase()
          .from('workspace_members')
          .select('user_id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId),
        supabase()
          .from('repositories')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('is_enabled', true),
        supabase()
          .from('workspace_settings')
          .select('notify_email, notify_slack_webhook, notify_native_desktop')
          .eq('workspace_id', workspaceId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const wsData = ws.data as { name?: string } | null;
      const settingsData = settings.data as {
        notify_email?: string | null;
        notify_slack_webhook?: string | null;
        notify_native_desktop?: boolean | null;
      } | null;
      setSummary({
        name: wsData?.name ?? 'Workspace',
        memberCount: members.count ?? 0,
        repoEnabled: repos.count ?? 0,
        notifyEmail: Boolean(settingsData?.notify_email),
        notifySlack: Boolean(settingsData?.notify_slack_webhook),
        notifyDesktop: Boolean(settingsData?.notify_native_desktop),
      });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, connection]);

  const handleSignOut = () => {
    window.dispatchEvent(new CustomEvent('robin:sign-out'));
  };

  return (
    <div className="grid gap-2 px-3 py-2">
      <SettingsCard
        icon={<Building2 size={14} />}
        title="Workspace"
        subtitle={
          summary
            ? `${summary.name} · ${formatMembers(summary.memberCount)}`
            : 'Loading…'
        }
        disabled
      >
        <div className="flex gap-1">
          <TagPill>Read-only in v1</TagPill>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={<Github size={14} />}
        title="GitHub"
        subtitle={summary ? `${summary.repoEnabled} repos enabled` : 'Loading…'}
        onOpen={onOpenGithub}
      />

      <SettingsCard
        icon={<Users size={14} />}
        title="Team"
        subtitle="Hire and manage your engineers — coming in v2"
        disabled
      >
        <TagPill tone="info">v2</TagPill>
      </SettingsCard>

      <SettingsCard
        icon={<Brain size={14} />}
        title="Brains"
        subtitle="Per-agent brain overrides and subscriptions — coming in v2"
        disabled
      >
        <TagPill tone="info">v2</TagPill>
      </SettingsCard>

      <SettingsCard
        icon={<Puzzle size={14} />}
        title="Capabilities"
        subtitle="Marketplace of skill packs — coming in v2"
        disabled
      >
        <TagPill tone="info">v2</TagPill>
      </SettingsCard>

      <SettingsCard
        icon={<Bell size={14} />}
        title="Notifications"
        subtitle={summary ? notificationsSubtitle(summary) : 'Loading…'}
        cta="external"
        onOpen={() => {
          const base = import.meta.env['VITE_API_BASE_URL'] ?? 'https://app.robin.dev';
          window.open(`${base}/settings`, '_blank', 'noopener,noreferrer');
        }}
      />

      <SettingsCard
        icon={<CreditCard size={14} />}
        title="Billing"
        subtitle="Plans and invoices — coming in v2"
        disabled
      >
        <TagPill tone="info">v2</TagPill>
      </SettingsCard>

      <SettingsCard
        icon={<LogOut size={14} />}
        title="Sign out"
        subtitle="End this session on this device"
        onOpen={handleSignOut}
      />

      <SettingsCard
        icon={<ShieldAlert size={14} />}
        title="Delete workspace"
        subtitle="Permanently remove this workspace — coming in v2"
        disabled
      >
        <TagPill tone="warning">careful</TagPill>
      </SettingsCard>
    </div>
  );
}

function formatMembers(n: number): string {
  if (n === 1) return '1 member';
  return `${n} members`;
}

function notificationsSubtitle(s: WorkspaceSummary): string {
  return [
    `Email ${s.notifyEmail ? 'on' : 'off'}`,
    `Slack ${s.notifySlack ? 'on' : 'off'}`,
    `Desktop ${s.notifyDesktop ? 'on' : 'off'}`,
  ].join(' · ');
}
