"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableFieldProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
  multiline?: boolean;
  className?: string;
}

/**
 * Inline-editable text field.
 * Click to switch to edit mode. Blur or Enter (for single-line) / Ctrl+Enter
 * (for multiline) saves. Escape cancels. Disabled when task is in progress.
 */
export function EditableField({
  value,
  onSave,
  disabled = false,
  multiline = false,
  className,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync draft if value changes externally (e.g. Realtime update while viewing)
  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      // Move cursor to end
      if (inputRef.current) {
        const len = (inputRef.current as HTMLInputElement).value.length;
        (inputRef.current as HTMLInputElement).setSelectionRange(len, len);
      }
    }
  }, [isEditing]);

  async function save() {
    if (draft.trim() === value.trim()) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(draft.trim());
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  }

  function cancel() {
    setDraft(value);
    setIsEditing(false);
  }

  if (!isEditing) {
    return (
      <div
        className={cn(
          "group relative",
          !disabled && "cursor-pointer"
        )}
        onClick={() => !disabled && setIsEditing(true)}
        title={disabled ? "Non modificabile mentre l'agente lavora" : "Click per modificare"}
      >
        <span className={cn("block", className)}>{value}</span>
        {!disabled && (
          <Pencil className="absolute -right-5 top-0.5 h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>
    );
  }

  const sharedProps = {
    value: draft,
    disabled: isSaving,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => setDraft(e.target.value),
    onBlur: save,
    onKeyDown: (
      e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
      if (!multiline && e.key === "Enter") {
        e.preventDefault();
        void save();
      }
      if (multiline && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void save();
      }
    },
    className: cn(
      "w-full rounded-md border border-primary/60 bg-background px-2 py-1 text-sm",
      "focus:outline-none focus:ring-2 focus:ring-ring",
      "disabled:opacity-50",
      className
    ),
  };

  if (multiline) {
    return (
      <textarea
        ref={inputRef as React.Ref<HTMLTextAreaElement>}
        rows={4}
        {...sharedProps}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.Ref<HTMLInputElement>}
      type="text"
      {...sharedProps}
    />
  );
}
