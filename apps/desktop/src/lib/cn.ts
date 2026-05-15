/**
 * Tiny `clsx` wrapper to keep imports terse.
 *
 * We don't pull in `tailwind-merge` here — primitives are small enough that
 * conflicting Tailwind classes are caught at review time, and the merge cost
 * adds up across the popover's many cards.
 */
import clsx from 'clsx';
import type { ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(...inputs);
}
