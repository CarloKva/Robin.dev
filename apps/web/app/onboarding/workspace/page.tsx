"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

const SlugSchema = z
  .string()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9-]+$/);

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

export default function WorkspaceOnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) {
      setSlug(generateSlug(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    setSlugEdited(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (name.trim().length < 2) {
      setError("Workspace name must be at least 2 characters.");
      return;
    }
    if (!SlugSchema.safeParse(slug).success) {
      setError("Slug must be 2-50 characters, lowercase letters, numbers, and hyphens only.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push("/backlog");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Create your workspace</h1>
          <p className="mt-2 text-muted-foreground">
            A workspace organises your projects and team members.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField label="Workspace name" htmlFor="name">
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Inc."
              disabled={isSubmitting}
              required
            />
          </FormField>

          <FormField
            label="URL slug"
            htmlFor="slug"
            helper="Lowercase letters, numbers, and hyphens only."
          >
            <div className="flex h-11 items-center rounded-xl border border-[#D1D1D6] bg-white px-3.5 text-sm transition-colors focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/20 dark:bg-[#1C1C1E]">
              <span className="select-none text-[#8E8E93]">robin.dev/</span>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="acme-inc"
                className="flex-1 bg-transparent text-[#1C1C1E] outline-none placeholder:text-[#8E8E93] dark:text-white"
                disabled={isSubmitting}
                required
              />
            </div>
          </FormField>

          {error && (
            <p className="rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/10 px-3.5 py-2.5 text-sm text-[#FF3B30]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
