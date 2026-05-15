/**
 * Unified status taxonomy used across agents and tasks. Ports
 * `STATUS_CONFIG` from popover-chrome.jsx.
 *
 * `tone` maps onto a CSS-variable family (`--success`, `--warning`, …) so
 * primitives can colour themselves without hard-coding the palette.
 */

export type StatusKind =
  | 'working'
  | 'focused'
  | 'needs_input'
  | 'available'
  | 'onboarding'
  | 'off'
  | 'in_progress'
  | 'blocked'
  | 'review'
  | 'queued'
  | 'done';

export type StatusTone = 'success' | 'warning' | 'info' | 'neutral' | 'danger';

interface StatusConfig {
  tone: StatusTone;
  label: string;
}

export const STATUS_CONFIG: Record<StatusKind, StatusConfig> = {
  working: { tone: 'success', label: 'Working' },
  focused: { tone: 'info', label: 'Focused' },
  needs_input: { tone: 'warning', label: 'Needs you' },
  available: { tone: 'neutral', label: 'Available' },
  onboarding: { tone: 'info', label: 'Onboarding' },
  off: { tone: 'neutral', label: 'Off' },
  in_progress: { tone: 'success', label: 'In progress' },
  blocked: { tone: 'warning', label: 'Needs you' },
  review: { tone: 'info', label: 'In review' },
  queued: { tone: 'neutral', label: 'Queued' },
  done: { tone: 'neutral', label: 'Done' },
};

export function statusConfig(kind: string | undefined): StatusConfig {
  if (kind && kind in STATUS_CONFIG) {
    return STATUS_CONFIG[kind as StatusKind];
  }
  return { tone: 'neutral', label: kind ?? 'Unknown' };
}
