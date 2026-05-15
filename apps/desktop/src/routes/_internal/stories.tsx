import { createRoute } from '@tanstack/react-router';

import { Avatar, AvatarStack } from '@/components/primitives/Avatar';
import { BranchTag } from '@/components/primitives/BranchTag';
import { BrainChip } from '@/components/primitives/BrainChip';
import { Btn } from '@/components/primitives/Btn';
import { ChatBubble } from '@/components/primitives/ChatBubble';
import { ChatComposer } from '@/components/primitives/ChatComposer';
import { IconBtn } from '@/components/primitives/IconBtn';
import { Kbd } from '@/components/primitives/Kbd';
import { LiveDot, LiveLabel } from '@/components/primitives/LiveDot';
import { PriorityDot } from '@/components/primitives/PriorityDot';
import { RepoChip } from '@/components/primitives/RepoChip';
import { RobinGlyph } from '@/components/primitives/RobinGlyph';
import { RobinLogoTile } from '@/components/primitives/RobinLogoTile';
import { SectionHeader } from '@/components/primitives/SectionHeader';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { StatusDot } from '@/components/primitives/StatusDot';
import { TabStrip } from '@/components/primitives/TabStrip';
import { Toggle } from '@/components/primitives/Toggle';
import { Route as RootRoute } from '../__root';
import { useState } from 'react';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/_internal/stories',
  component: StoriesPage,
});

const STATUSES = [
  'working',
  'focused',
  'needs_input',
  'available',
  'onboarding',
  'off',
  'in_progress',
  'blocked',
  'review',
  'queued',
  'done',
] as const;

function StoriesPage() {
  const [tab, setTab] = useState('one');
  const [toggle, setToggle] = useState(true);
  return (
    <div className="min-h-screen bg-bg p-8">
      <div className="mx-auto grid max-w-5xl gap-8">
        <header className="flex items-center gap-3">
          <RobinLogoTile size={40} />
          <div>
            <h1 className="text-xl font-semibold">Robin.dev — DS stories</h1>
            <p className="text-sm text-ink3">
              Internal-only route. Compare side-by-side with the design canvas.
            </p>
          </div>
        </header>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-2">
            <Btn variant="primary">Primary</Btn>
            <Btn variant="secondary">Secondary</Btn>
            <Btn variant="ghost">Ghost</Btn>
            <Btn variant="danger">Danger</Btn>
            <Btn variant="success">Success</Btn>
            <Btn variant="successSoft">Success soft</Btn>
            <Btn variant="warning">Warning</Btn>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Btn size="sm">sm</Btn>
            <Btn size="md">md</Btn>
            <Btn size="lg">lg</Btn>
            <Btn full>Full width</Btn>
          </div>
        </Section>

        <Section title="Icons + Kbd">
          <div className="flex items-center gap-3">
            <IconBtn label="Settings">
              <RobinGlyph size={14} />
            </IconBtn>
            <IconBtn label="Active" active>
              <RobinGlyph size={14} />
            </IconBtn>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
            <Kbd>@</Kbd>
          </div>
        </Section>

        <Section title="Status">
          <div className="flex flex-wrap items-center gap-3">
            {STATUSES.map((s) => (
              <div key={s} className="flex items-center gap-2">
                <StatusDot kind={s} pulse={s === 'working'} />
                <StatusBadge kind={s} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Live / Avatars">
          <div className="flex items-center gap-4">
            <LiveDot />
            <LiveLabel />
            <LiveLabel>streaming</LiveLabel>
            <Avatar name="Aria Lin" hue={6} size="md" status="working" />
            <Avatar name="Mira Chen" hue={210} size="lg" status="needs_input" />
            <AvatarStack
              people={[
                { id: '1', name: 'Aria Lin', hue: 6 },
                { id: '2', name: 'Mira Chen', hue: 210 },
                { id: '3', name: 'Oliver West', hue: 130 },
                { id: '4', name: 'Yuki Tan', hue: 280 },
                { id: '5', name: 'Ben Lo', hue: 50 },
              ]}
            />
          </div>
        </Section>

        <Section title="Chips">
          <div className="flex items-center gap-2">
            <RepoChip owner="robin" name="web" />
            <RepoChip owner="robin" name="orchestrator" size="md" />
            <BranchTag branch="feat/desktop-shell" />
            <BrainChip brain="claude-opus-4.7" />
            <BrainChip brain="claude-sonnet-4.6" />
            <BrainChip brain="claude-haiku-4.5" />
            <PriorityDot priority="urgent" />
            <PriorityDot priority="high" />
            <PriorityDot priority="medium" />
            <PriorityDot priority="low" />
          </div>
        </Section>

        <Section title="Tabs / Toggle">
          <div className="overflow-hidden rounded-xl border border-border bg-popover">
            <TabStrip
              tabs={[
                { id: 'one', label: 'Inbox', count: 6, urgent: true },
                { id: 'two', label: 'In progress', count: 2 },
                { id: 'three', label: 'History' },
              ]}
              active={tab}
              onSelect={setTab}
            />
            <div className="px-4 py-6 text-sm text-ink3">Active tab: {tab}</div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Toggle checked={toggle} onChange={setToggle} label="Sample toggle" />
            <span className="text-sm text-ink2">{toggle ? 'On' : 'Off'}</span>
          </div>
        </Section>

        <Section title="Chat">
          <div className="grid max-w-md gap-3">
            <ChatBubble role="user">Move the dashboard footer up by 8px.</ChatBubble>
            <ChatBubble role="robin">
              On it. I&rsquo;ll route this to Aria — she just wrapped her last task.
            </ChatBubble>
            <ChatBubble role="agent" agentName="Aria Lin" agentHue={6}>
              Looking at this now. Opening a PR in ~10 minutes.
            </ChatBubble>
            <ChatComposer onSend={(v) => alert(v)} agentHue={6} placeholder="Reply to Aria…" />
          </div>
        </Section>

        <Section title="Section header">
          <SectionHeader right={<span>3 items</span>}>Today</SectionHeader>
          <SectionHeader accent>Live</SectionHeader>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-popover p-5 shadow-card">
      <h2 className="mb-3 text-2xs font-semibold uppercase tracking-[0.1em] text-ink3">{title}</h2>
      {children}
    </section>
  );
}
