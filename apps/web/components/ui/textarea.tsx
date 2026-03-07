import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-[100px] w-full resize-y rounded-xl border bg-white px-3.5 py-2.5 text-sm text-[#1C1C1E] outline-none transition-colors",
          "placeholder:text-[#8E8E93]",
          "dark:bg-[#1C1C1E] dark:text-white",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-[#FF3B30] ring-2 ring-[#FF3B30]/20"
            : "border-[#D1D1D6] focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
