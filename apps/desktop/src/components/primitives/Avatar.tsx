import { useState } from 'react';

import { cn } from '@/lib/cn';
import { StatusDot } from './StatusDot';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizePx: Record<AvatarSize, number> = { xs: 22, sm: 28, md: 36, lg: 48, xl: 72 };

interface AvatarProps {
  name: string;
  hue?: number;
  src?: string;
  size?: AvatarSize;
  status?: string;
  className?: string;
}

function initialsFor(name: string): string {
  const tokens = name.trim().split(/\s+/).slice(0, 2);
  return tokens.map((t) => t.charAt(0)?.toUpperCase() ?? '').join('') || '?';
}

function gradientFor(hue: number): string {
  const next = (hue + 22) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 62%, 56%), hsl(${next}, 70%, 46%))`;
}

export function Avatar({ name, hue = 16, src, size = 'md', status, className }: AvatarProps) {
  const px = sizePx[size];
  const [imageOk, setImageOk] = useState(Boolean(src));

  return (
    <span
      className={cn('relative inline-flex shrink-0 overflow-visible select-none', className)}
      style={{ width: px, height: px }}
    >
      <span
        className="flex h-full w-full items-center justify-center rounded-full text-white"
        style={{
          background: gradientFor(hue),
          fontSize: Math.round(px * 0.4),
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}
        aria-hidden="true"
      >
        {imageOk && src ? (
          <img
            src={src}
            alt=""
            className="h-full w-full rounded-full object-cover"
            onError={() => setImageOk(false)}
          />
        ) : (
          initialsFor(name)
        )}
      </span>
      {status ? (
        <span className="absolute -bottom-0.5 -right-0.5">
          <StatusDot kind={status} size={Math.max(8, Math.round(px * 0.22))} pulse={status === 'working'} />
        </span>
      ) : null}
    </span>
  );
}

interface AvatarStackProps {
  people: Array<{ id: string; name: string; hue?: number; src?: string }>;
  size?: AvatarSize;
  max?: number;
}

export function AvatarStack({ people, size = 'sm', max = 4 }: AvatarStackProps) {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;
  return (
    <span className="inline-flex items-center -space-x-2">
      {visible.map((p) => (
        <span key={p.id} className="ring-2 ring-popover rounded-full">
          <Avatar {...p} size={size} />
        </span>
      ))}
      {overflow > 0 ? (
        <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full border border-border bg-panel px-1.5 text-2xs font-medium text-ink3 ring-2 ring-popover">
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}
