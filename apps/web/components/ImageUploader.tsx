"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILES = 3;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

interface ImageUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled: boolean | undefined;
}

export function ImageUploader({ files, onChange, disabled }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // Build object URLs for previews
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [files]);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      const newErrors: string[] = [];
      const valid: File[] = [];

      for (const file of list) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          newErrors.push(`"${file.name}" — tipo non supportato (PNG, JPEG o WEBP).`);
          continue;
        }
        if (file.size > MAX_SIZE_BYTES) {
          newErrors.push(`"${file.name}" — supera il limite di 5MB.`);
          continue;
        }
        valid.push(file);
      }

      const combined = [...files, ...valid];
      if (combined.length > MAX_FILES) {
        newErrors.push(`Puoi allegare al massimo ${MAX_FILES} immagini.`);
        const allowed = MAX_FILES - files.length;
        valid.splice(allowed);
      }

      setErrors(newErrors);
      if (valid.length > 0) {
        onChange([...files, ...valid]);
      }
    },
    [files, onChange]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    // Reset input so same file can be re-selected after removal
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    onChange(next);
    setErrors([]);
  }

  const canAddMore = files.length < MAX_FILES;

  return (
    <div className="space-y-2">
      {/* Drop zone — only show if more files can be added */}
      {canAddMore && (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Trascina le immagini qui o clicca per sfogliare"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/40",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          {/* Upload icon */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className="text-muted-foreground"
          >
            <path
              d="M10 13V4M10 4L7 7M10 4L13 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3 13v3a1 1 0 001 1h12a1 1 0 001-1v-3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-xs text-muted-foreground">
            Trascina qui o{" "}
            <span className="font-medium text-primary underline underline-offset-2">
              sfoglia
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            PNG, JPEG, WEBP · max {MAX_FILES} file · max 5MB cad.
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled}
        aria-hidden="true"
      />

      {/* Thumbnail grid */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previews[i]}
                alt={file.name}
                className="h-16 w-16 rounded-md border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                disabled={disabled}
                aria-label={`Rimuovi ${file.name}`}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Inline errors */}
      {errors.length > 0 && (
        <ul className="space-y-0.5">
          {errors.map((err, i) => (
            <li key={i} className="text-xs text-destructive">
              {err}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
