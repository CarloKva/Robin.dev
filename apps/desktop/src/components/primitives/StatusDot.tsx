import { statusConfig } from '@/lib/status';
import type { StatusTone } from '@/lib/status';

interface StatusDotProps {
  kind?: string;
  size?: number;
  pulse?: boolean;
  className?: string;
}

const toneVar: Record<StatusTone, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  info: 'var(--info)',
  neutral: 'var(--neutral)',
  danger: 'var(--danger)',
};

export function StatusDot({ kind, size = 8, pulse, className }: StatusDotProps) {
  const cfg = statusConfig(kind);
  const colour = toneVar[cfg.tone];
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size + 6,
        height: size + 6,
        position: 'relative',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {pulse ? (
        <span
          className="animate-robin-pulse"
          style={{
            position: 'absolute',
            inset: 0,
            margin: 'auto',
            width: size + 4,
            height: size + 4,
            borderRadius: '50%',
            background: colour,
            opacity: 0.3,
          }}
        />
      ) : null}
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: colour,
        }}
      />
    </span>
  );
}
