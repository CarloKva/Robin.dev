import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface FooterSlotContextValue {
  left: ReactNode;
  setLeft: (node: ReactNode) => void;
}

const FooterSlotContext = createContext<FooterSlotContextValue | null>(null);

export function PopoverFooterSlotProvider({ children }: { children: ReactNode }) {
  const [left, setLeft] = useState<ReactNode>(null);
  return (
    <FooterSlotContext.Provider value={{ left, setLeft }}>
      {children}
    </FooterSlotContext.Provider>
  );
}

export function usePopoverFooterSlot(): FooterSlotContextValue {
  const ctx = useContext(FooterSlotContext);
  if (!ctx) throw new Error('usePopoverFooterSlot must be used inside PopoverFooterSlotProvider');
  return ctx;
}

/** Register a node in the popover footer's left slot for the lifetime of the caller. */
export function usePopoverFooterLeft(node: ReactNode): void {
  const { setLeft } = usePopoverFooterSlot();
  useEffect(() => {
    setLeft(node);
    return () => setLeft(null);
  }, [node, setLeft]);
}
