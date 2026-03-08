"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// ─── Context ────────────────────────────────────────────────────────────────

const AppDialogContext = React.createContext<{ onClose: () => void }>({
  onClose: () => undefined,
});

// ─── Root ───────────────────────────────────────────────────────────────────

interface AppDialogRootProps {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

function AppDialogRoot({
  onClose,
  children,
  className,
  maxWidth = "max-w-[480px]",
}: AppDialogRootProps) {
  // Escape key
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Body scroll lock
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <AppDialogContext.Provider value={{ onClose }}>
      <div className="fixed inset-0 z-50">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        {/* Content */}
        <div
          className="absolute inset-0 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <div
            className={cn(
              "relative z-10 w-full bg-background border border-border shadow-lg rounded-xl flex flex-col max-h-[90vh]",
              maxWidth,
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      </div>
    </AppDialogContext.Provider>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function AppDialogHeader({
  title,
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}) {
  const { onClose } = React.useContext(AppDialogContext);
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
      {title ? (
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      ) : (
        children
      )}
      <Button
        variant="ghost"
        size="icon"
        className="w-7 h-7"
        onClick={onClose}
        aria-label="Chiudi"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ─── Body ────────────────────────────────────────────────────────────────────

function AppDialogBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-4 overflow-y-auto flex-1", className)}>
      {children}
    </div>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function AppDialogFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export const AppDialog = Object.assign(AppDialogRoot, {
  Header: AppDialogHeader,
  Body: AppDialogBody,
  Footer: AppDialogFooter,
});
