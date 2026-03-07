"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  helper?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, htmlFor, error, helper, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-[#1C1C1E] dark:text-white mb-1.5"
        >
          {label}
        </label>
      )}
      {children}
      {error && (
        <p className="animate-in fade-in text-xs text-[#FF3B30]">{error}</p>
      )}
      {!error && helper && (
        <p className="text-xs text-[#8E8E93]">{helper}</p>
      )}
    </div>
  );
}
