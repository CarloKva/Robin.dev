"use client";

import { useEffect } from "react";

/**
 * Fires `callback` when a specific key is pressed, but only when
 * the user is NOT focused on an input, textarea, or contenteditable element.
 *
 * @param key - The key to listen for (e.g. "n", "Escape")
 * @param callback - Function to call when the shortcut fires
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void
): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore when user is typing in a field
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Ignore if modifier keys are held (Ctrl+N, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === key) {
        e.preventDefault();
        callback();
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, callback]);
}
