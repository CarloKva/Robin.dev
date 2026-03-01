import type { TaskType } from "@robin/shared-types";

export type QualityScore = "poor" | "fair" | "good";

// Keywords that signal quality descriptions per task type
const TYPE_KEYWORDS: Record<string, string[]> = {
  bug: ["attuale", "atteso", "steps", "riprodur", "comportamento", "expected", "actual"],
  feature: ["dovrebbe", "quando", "per", "criteri", "accettazione", "should", "criteria"],
  docs: ["sezione", "pagina", "aggiornare", "aggiungere", "section", "update"],
  refactor: ["attuale", "miglioramento", "performance", "leggibilità", "improvement"],
  chore: ["configurar", "aggiornare", "install", "setup", "configure"],
};

/**
 * Scores the quality of a task description.
 * Returns 'poor' | 'fair' | 'good' based on length and type-specific keywords.
 *
 * Not blocking — the submit button is always enabled regardless of score.
 */
export function descriptionQualityScore(
  description: string,
  type: TaskType
): QualityScore {
  const text = description.trim();
  const len = text.length;

  if (len < 50) return "poor";

  const keywords = TYPE_KEYWORDS[type] ?? [];
  const hasKeyword = keywords.some((kw) =>
    text.toLowerCase().includes(kw.toLowerCase())
  );

  if (len >= 150 && hasKeyword) return "good";
  if (len >= 150 || (len >= 50 && hasKeyword)) return "fair";
  return "fair";
}

export const qualitySuggestions: Record<TaskType, string> = {
  bug: 'Includi: comportamento attuale, comportamento atteso, e passi per riprodurre il bug.',
  feature: 'Includi: cosa dovrebbe fare la feature, quando viene usata, e criteri di accettazione.',
  docs: 'Specifica quale sezione aggiornare, cosa aggiungere o modificare, e il pubblico di riferimento.',
  refactor: 'Descrivi il codice attuale, cosa vuoi migliorare e quali performance o metriche ti aspetti.',
  chore: 'Specifica cosa configurare/aggiornare, la versione target e eventuali dipendenze.',
  accessibility: 'Descrivi la barriera di accessibilità, i componenti coinvolti e il criterio WCAG di riferimento.',
  security: 'Descrivi la vulnerabilità, l\'impatto potenziale e il fix proposto.',
};
