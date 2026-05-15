import type { ReactNode } from 'react';

interface PopoverFooterProps {
  left?: ReactNode;
  right?: ReactNode;
}

export function PopoverFooter({ left, right }: PopoverFooterProps) {
  return (
    <footer className="flex items-center justify-between border-t border-divider px-3 py-2 text-2xs text-ink3">
      <span>{left}</span>
      <span>{right}</span>
    </footer>
  );
}
