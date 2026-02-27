# Robin.dev — Design Tokens

**Sprint 4 · Carlo Ferrero · Febbraio 2026**

---

## Principio

I token sono definiti come CSS variables in `globals.css` e mappati
in `tailwind.config.ts`. shadcn/ui usa le stesse CSS variables
→ i componenti shadcn rispettano automaticamente i token.

Nessun colore hex raw nel codice. Solo classi Tailwind semantiche.

---

## Brand Color

**Scelta: Violet**

- Non è il solito blu SaaS (Salesforce, Intercom, Notion)
- È il colore dominante dei dev tool premium (Linear, Raycast, Loom)
- Funziona bene sia su sfondo chiaro che scuro
- Trasmette: tecnico, preciso, affidabile

```
Violet scale:
50   → #f5f3ff    (quasi bianco, per hover su sfondo chiaro)
100  → #ede9fe
200  → #ddd6fe
300  → #c4b5fd
400  → #a78bfa
500  → #8b5cf6    (brand principale su sfondo chiaro)
600  → #7c3aed    (interazioni, link attivi)
700  → #6d28d9
800  → #5b21b6
900  → #4c1d95
950  → #2e1065    (brand principale su sfondo scuro)
```

**Token CSS:**
- `--brand`: il colore primario brand (500 su light, 400 su dark)
- `--brand-foreground`: testo su sfondo brand (sempre bianco)

---

## Palette completa

### Brand

| Token Tailwind | Light | Dark | Uso |
|---|---|---|---|
| `brand.500` | #8b5cf6 | — | Brand su sfondo chiaro |
| `brand.400` | — | #a78bfa | Brand su sfondo scuro |
| `brand.600` | #7c3aed | — | Hover state |

### Stati

| Token | Colore base | Uso |
|---|---|---|
| `state.success` | emerald-500 (#10b981) | Task completata, PR mergeata |
| `state.warning` | amber-500 (#f59e0b) | Task bloccata, attenzione |
| `state.error` | red-500 (#ef4444) | Task failed, errori |
| `state.info` | sky-500 (#0ea5e9) | Task in_progress, info neutral |

### Superfici (sfondo chiaro / dark mode)

| Token | Light | Dark | Uso |
|---|---|---|---|
| `surface.base` | white (#ffffff) | neutral-950 (#0a0a0a) | Background pagina |
| `surface.raised` | neutral-50 (#fafafa) | neutral-900 (#171717) | Card, sidebar |
| `surface.overlay` | neutral-100 (#f5f5f5) | neutral-800 (#262626) | Dropdown, modal overlay |
| `surface.border` | neutral-200 (#e5e5e5) | neutral-800 (#262626) | Bordi |

### Testo

| Token | Light | Dark | Uso |
|---|---|---|---|
| `text.primary` | neutral-900 (#171717) | neutral-50 (#fafafa) | Testo principale |
| `text.secondary` | neutral-600 (#525252) | neutral-400 (#a3a3a3) | Label, subtitle |
| `text.muted` | neutral-400 (#a3a3a3) | neutral-600 (#525252) | Placeholder, hint |
| `text.disabled` | neutral-300 (#d4d4d4) | neutral-700 (#404040) | Testo disabilitato |

---

## Tipografia

**Font family:** `Inter` (variabile) — importato da Google Fonts o next/font.

Fallback: `ui-sans-serif, system-ui, sans-serif`

### Scale

| Nome | Size | Weight | Line-height | Uso |
|---|---|---|---|---|
| `text-xs` | 12px | 400 | 16px | Label, badge, hint |
| `text-sm` | 14px | 400/500 | 20px | Body, form label |
| `text-base` | 16px | 400 | 24px | Testo corrente |
| `text-lg` | 18px | 500/600 | 28px | Subtitle sezione |
| `text-xl` | 20px | 600 | 28px | Titolo card |
| `text-2xl` | 24px | 700 | 32px | Titolo pagina |
| `text-3xl` | 30px | 700 | 36px | Numero metrica (dashboard tile) |
| `text-4xl` | 36px | 800 | 40px | — (non usato in questo sprint) |

### Weight scale

| Nome Tailwind | Peso | Uso |
|---|---|---|
| `font-normal` | 400 | Body text |
| `font-medium` | 500 | Label, badge |
| `font-semibold` | 600 | Titoli card, link attivi |
| `font-bold` | 700 | Titoli pagina, numeri metrica |
| `font-extrabold` | 800 | — (riservato a casi speciali) |

---

## Spacing

Tailwind default scale è sufficiente. Convenzioni d'uso:

| Contesto | Spacing | Classi |
|---|---|---|
| Padding interno card | 16px-24px | `p-4` / `p-6` |
| Gap tra card | 16px | `gap-4` |
| Gap tra sezioni | 24px-32px | `gap-6` / `gap-8` |
| Padding pagina (main) | 24px | `p-6` |
| Altezza header | 56px | `h-14` |
| Larghezza sidebar | 240px | `w-60` |
| Padding sidebar item | 8px 12px | `py-2 px-3` |

---

## Border radius

Tutti tramite CSS variable `--radius` già definita.

| Token | Valore | Uso |
|---|---|---|
| `rounded-sm` | `calc(var(--radius) - 4px)` | Badge, chip piccoli |
| `rounded-md` | `calc(var(--radius) - 2px)` | Input, button |
| `rounded-lg` | `var(--radius)` (= 0.5rem = 8px) | Card, dialog |
| `rounded-xl` | 12px | Modal, pannelli |
| `rounded-full` | 9999px | Avatar, dot indicator |

---

## Componenti critici — Specifiche

### TaskCard (lista task)

```
Altezza: auto (min 72px)
Padding: py-4 px-4
Bordo sinistro: 3px solid [colore status]
  - in_progress: brand.500
  - blocked/failed: state.error
  - completed: state.success
  - altri: surface.border
Background su hover: surface.raised
Cursor: pointer
```

**Badge status:**
| Status | BG | Testo |
|---|---|---|
| pending | neutral-100 | neutral-600 |
| queued | sky-100 | sky-700 |
| in_progress | violet-100 | violet-700 |
| review_pending | amber-100 | amber-700 |
| approved | emerald-100 | emerald-700 |
| rejected | red-100 | red-700 |
| completed | emerald-100 | emerald-800 |
| failed | red-100 | red-800 |
| cancelled | neutral-100 | neutral-500 |

**Badge priorità:**
| Priorità | Colore |
|---|---|
| critical | red-600 |
| high | orange-500 |
| medium | amber-400 |
| low | neutral-400 |

### AgentStatusBadge

```
Dimensioni: h-8 auto (compact per header)
Dot size: w-2 h-2
Font: text-sm font-medium
```

| Status | Dot | Testo |
|---|---|---|
| idle | neutral-400 | "Agente pronto" |
| busy | emerald-500 (pulse) | "Lavora su: [titolo task troncato]" |
| error | red-500 | "Errore agente" |
| offline | zinc-400 | "Realtime offline" |

### PRCard (task detail)

```
Card: rounded-lg border surface.border p-4
Header: PR #42 [stato badge] branch
Body: titolo PR, commit, file, additions/deletions
Footer: [Apri su GitHub ↗]
```

| Stato PR | Badge |
|---|---|
| open | emerald-500 bg + "Open" |
| merged | violet-500 bg + "Merged" |
| closed | neutral-500 bg + "Closed" |
| draft | neutral-400 bg + "Draft" |

### MetricsTile (dashboard + metrics page)

```
Card: rounded-xl border surface.border p-6
Numero: text-3xl font-bold text.primary
Label: text-sm font-medium text.secondary
Trend: text-sm con ↑ (emerald) o ↓ (red) + delta
Tooltip: shadcn/ui Tooltip sul label
```

Tile "Richiedono attenzione":
- Se count > 0: border-l-4 border-state.warning, bg-amber-50 (light) / amber-950/20 (dark)

### TaskCreationForm

```
Layout desktop: 2 colonne (form 50% / preview 50%)
Layout mobile: colonna singola (form prima, preview collassata)

Input text: h-10 rounded-md border
Textarea: min-h-32 resize-y rounded-md border
Select: h-10 rounded-md
Submit button: h-10 min-w-32 bg-brand text-white
  → hover: bg-brand-600
  → disabled: opacity-50 cursor-not-allowed

Qualità descrizione:
  poor: bg-red-200 (barra) + testo red-600
  fair: bg-amber-200 + testo amber-600
  good: bg-emerald-200 + testo emerald-600
```

### Skeleton Loader

Usare `shadcn/ui Skeleton`. Dimensioni identiche al componente reale.
- MetricsTile skeleton: h-32 w-full rounded-xl
- TaskCard skeleton: h-18 w-full rounded-lg
- Timeline entry skeleton: h-12 w-full

---

## Allineamento shadcn/ui → design token

Le CSS variables shadcn usano la stessa notazione HSL.
Nel `globals.css` aggiornare le variabili per allinearsi alla palette:

```css
/* Light mode */
:root {
  --background: 0 0% 100%;           /* surface.base white */
  --foreground: 0 0% 9%;             /* text.primary neutral-900 */
  --primary: 262 80% 63%;            /* brand.500 violet */
  --primary-foreground: 0 0% 100%;   /* white on brand */
  --muted: 0 0% 96%;                 /* surface.raised neutral-50 */
  --muted-foreground: 0 0% 32%;      /* text.secondary neutral-600 */
  --border: 0 0% 90%;                /* surface.border neutral-200 */
  --accent: 262 80% 63%;             /* brand violet per hover */
  --destructive: 0 84% 60%;          /* state.error red-500 */
}

/* Dark mode */
.dark {
  --background: 0 0% 4%;             /* surface.base neutral-950 */
  --foreground: 0 0% 98%;            /* text.primary neutral-50 */
  --primary: 262 70% 70%;            /* brand.400 violet chiaro */
  --primary-foreground: 0 0% 9%;     /* dark on brand */
  --muted: 0 0% 9%;                  /* surface.raised neutral-900 */
  --muted-foreground: 0 0% 64%;      /* text.secondary neutral-400 */
  --border: 0 0% 15%;                /* surface.border neutral-800 */
  --accent: 262 70% 70%;             /* brand violet chiaro per hover */
  --destructive: 0 63% 31%;          /* state.error red scuro */
}
```

---

## Regole di utilizzo

1. **Mai hex raw nel codice** — usare sempre classi Tailwind semantiche
2. **Mai classi hardcoded per status** — mappare sempre via oggetto costante
3. **Dark mode via Tailwind `dark:` prefix** — non CSS manual
4. **Skeleton loader per ogni async fetch** — nessuna pagina bianca
5. **Animazioni: solo `animate-pulse` e `animate-spin`** — niente più

---

*Robin.dev · Design Tokens v1.0 · Sprint 4 · Carlo Ferrero · Febbraio 2026*
