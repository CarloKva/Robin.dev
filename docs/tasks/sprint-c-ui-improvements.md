# Sprint C — UI Improvements

**Data:** 2026-03-06
**Tipo:** feat
**Priorità:** high

---

## Obiettivo

Questa task raggruppa sei miglioramenti UI/UX al gestionale Robin.dev. Ogni punto è indipendente dagli altri ma vanno tutti implementati nella stessa PR.

---

## Contesto tecnico

- Stack: Next.js 15 App Router, React 19, TypeScript strict (`exactOptionalPropertyTypes: true`), Tailwind CSS, shadcn/ui
- File principali coinvolti:
  - `apps/web/app/(dashboard)/context/ContextPageClient.tsx`
  - `apps/web/components/context/ContextDocCard.tsx`
  - `apps/web/components/context/ContextDocEditor.tsx`
  - `apps/web/app/(dashboard)/tasks/new/TaskCreationForm.tsx`
  - `apps/web/components/backlog/BacklogJiraView.tsx`
  - `apps/web/components/backlog/CreateTaskDrawer.tsx`
  - `apps/web/app/(dashboard)/reports/ReportsClient.tsx`
  - `apps/web/app/(dashboard)/reports/page.tsx`
  - `apps/web/lib/db/reports.ts`

---

## Punto 1 — /context: Vista tabella al posto delle card

### Situazione attuale

`ContextPageClient.tsx` renderizza i documenti in una griglia di card (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`). Il componente `ContextDocCard.tsx` gestisce il rendering di ogni card.

### Modifica richiesta

Sostituire la griglia di card con una tabella HTML standard (non usare librerie di data table esterne). La tabella deve avere le seguenti colonne:

| Colonna | Contenuto |
|---------|-----------|
| Titolo | `doc.title` — link/pulsante che apre il drawer |
| Sorgente | `doc.source_path ? doc.source_repo_full_name + "/" + doc.source_path : "Manuale"` |
| Aggiornato | `doc.updated_at` formattato `DD MMM YYYY` |
| Azioni | Pulsanti "Modifica" ed "Elimina" |

Stile tabella: `w-full text-sm`, righe con `border-b border-border`, header con `text-xs text-muted-foreground uppercase tracking-wide`, hover sulle righe con `hover:bg-muted/40`.

Il componente `ContextDocCard.tsx` non è più necessario per la griglia — può essere eliminato o tenuto come fallback. Il comportamento di delete con conferma inline (`confirmDelete` state) va replicato nella colonna Azioni della tabella.

---

## Punto 2 — /context: "Modifica" apre vista read-only con rendering markdown

### Situazione attuale

`ContextDocEditor.tsx` è un drawer laterale che mostra un `<input>` per il titolo e una `<textarea>` per il contenuto markdown. Il contenuto non viene renderizzato come markdown — è testo grezzo.

### Modifica richiesta

Il drawer `ContextDocEditor.tsx` deve avere **due modalità**:

1. **Modalità view** (default quando si clicca "Modifica" su un documento esistente):
   - Titolo mostrato come testo `<h2>` non editabile
   - Contenuto renderizzato come markdown usando `ReactMarkdown` (già installato nel progetto — usato in `TaskCreationForm.tsx`)
   - Pulsante "Modifica" in alto a destra nel drawer per passare alla modalità edit
   - Pulsante "Chiudi" per chiudere il drawer

2. **Modalità edit** (default per "Nuovo documento", raggiungibile da view tramite pulsante):
   - Comportamento identico all'attuale: `<input>` titolo + `<textarea>` contenuto + pulsante "Salva"
   - Pulsante "Annulla modifiche" per tornare alla modalità view (solo se era già un documento esistente)

La `ContextPageClient.tsx` deve passare al drawer una prop `initialMode: "view" | "edit"`:
- Click su "Modifica" da tabella → `initialMode="view"`
- Click su "+ Nuovo documento" → `initialMode="edit"` (doc = null)

Usa `ReactMarkdown` con le stesse classi prose già usate in `TaskCreationForm.tsx`:
```tsx
<div className="prose prose-sm dark:prose-invert max-w-none">
  <ReactMarkdown>{content}</ReactMarkdown>
</div>
```

---

## Punto 3 — Componente Select custom (white background, no HTML5 native)

### Situazione attuale

In tutto il codebase sono presenti `<select>` HTML5 nativi che usano il rendering del browser (appearance dipendente dall'OS). I file principali che li usano:

- `apps/web/app/(dashboard)/tasks/new/TaskCreationForm.tsx` — repository, agente, tipo, priorità
- `apps/web/components/backlog/BacklogJiraView.tsx` — filtro tipo
- `apps/web/components/backlog/CreateTaskDrawer.tsx` — verifica se presenti
- `apps/web/components/backlog/InlineSelect.tsx` — verifica se presente

### Modifica richiesta

Creare un componente `CustomSelect` in `apps/web/components/ui/CustomSelect.tsx`.

**API del componente:**

```tsx
interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}
```

**Comportamento:**
- Trigger: `<button>` con aspetto identico agli input del form (bordo, padding, testo sm) + icona `ChevronDown` da Lucide a destra
- Dropdown: `position: absolute`, `z-index: 50`, `background: white` (`bg-white dark:bg-zinc-900`), `border border-border`, `rounded-md`, `shadow-lg`, max-height `240px` con `overflow-y-auto`
- Ogni opzione: `px-3 py-2 text-sm cursor-pointer hover:bg-accent`, opzione selezionata con `bg-primary/10 font-medium`
- Chiusura: click fuori (usa `useEffect` + `mousedown` listener sul `document`), ESC key, selezione opzione
- Accessibilità: `role="listbox"`, `aria-expanded`, `aria-selected` sulle opzioni

**Sostituzione nei file esistenti:**

Dopo aver creato il componente, sostituire i `<select>` nativi in:
- `TaskCreationForm.tsx` — tutti e quattro i select (repository, agente, tipo, priorità). Nota: il select "agente" e "repository" usano `react-hook-form` con `register()` — per questi usare `Controller` di react-hook-form oppure gestire il valore con `watch` + `setValue`.
- `BacklogJiraView.tsx` — il select filtro tipo
- `CreateTaskDrawer.tsx` — qualsiasi select presente
- `InlineSelect.tsx` — valutare se refactorare o sostituire con `CustomSelect`

**Nota su `exactOptionalPropertyTypes`:** La prop `className` deve essere dichiarata `className?: string` e usata con `...(className !== undefined && { className })` o condizionalmente.

---

## Punto 4 — Sprint: nome editabile alla creazione

### Situazione attuale

`BacklogJiraView.tsx`, funzione `handleCreateSprint()`:

```typescript
async function handleCreateSprint() {
  setCreatingSprint(true);
  try {
    const res = await fetch("/api/sprints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),  // ← nessun nome passato
    });
    if (res.ok) refresh();
  } finally {
    setCreatingSprint(false);
  }
}
```

Il pulsante "Crea sprint" esegue immediatamente la creazione senza chiedere il nome.

### Modifica richiesta

Prima di chiamare l'API, mostrare un **inline input** (non un modale separato) che permette all'utente di inserire il nome dello sprint.

**UX:**
1. Click su "Crea sprint" → nell'area sprint (sopra il backlog) appare un piccolo form inline con:
   - `<input type="text">` pre-valorizzato con un nome di default (es. `"Sprint W${weekNumber}"` basato sulla data corrente)
   - Pulsante "Crea" (conferma) + pulsante "Annulla" (X)
2. L'utente può modificare il nome o lasciare il default
3. Click su "Crea" → chiama `POST /api/sprints` con body `{ name: sprintName }`
4. Click su "Annulla" o ESC → nasconde il form inline senza creare niente

Stato da aggiungere in `BacklogJiraView`:
```typescript
const [showSprintNameInput, setShowSprintNameInput] = useState(false);
const [newSprintName, setNewSprintName] = useState("");
```

Helper per il nome di default:
```typescript
function defaultSprintName(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `Sprint W${week}`;
}
```

**Sprint name editabile dopo la creazione:** nella sezione header di ogni sprint in stato `planning`, aggiungere un pulsante matita accanto al nome che permette l'editing inline (input + invio per salvare via `PATCH /api/sprints/:id`). Verificare se questa route esiste già, altrimenti crearla.

---

## Punto 5 — Task Creation: multiselect documenti di contesto

### Situazione attuale

`TaskCreationForm.tsx` non ha un campo per selezionare documenti di contesto. Il form invia `title`, `description`, `type`, `priority`, `repository_id`, `preferred_agent_id`.

### Modifica richiesta

Aggiungere un campo **"Contesto aggiuntivo"** nel form di creazione task che permette di selezionare uno o più documenti dalla tabella `context_documents` del workspace.

**Schema Zod da aggiornare:**

```typescript
const schema = z.object({
  // ... campi esistenti ...
  context_document_ids: z.array(z.string().uuid()).default([]),
});
```

**Componente multiselect:**

Creare `apps/web/components/ui/MultiSelectDocs.tsx`:

```tsx
interface MultiSelectDocsProps {
  docs: ContextDocument[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}
```

UX del multiselect:
- Trigger button: mostra "Nessun documento selezionato" oppure `"{n} documento/i selezionato/i"`
- Dropdown (stesso stile di `CustomSelect`): lista di documenti con checkbox a sinistra
- Ogni voce: `doc.title` + badge piccolo con sorgente (`Manuale` o nome repo)
- Selezione multipla: click su una voce toglie/aggiunge, non chiude il dropdown
- Chiusura: click fuori o pulsante "Chiudi" in fondo al dropdown
- Se `docs` è vuoto: mostrare "Nessun documento disponibile" con link a `/context`

**Dove mostrare il campo:**
Nel `FormPanel`, dopo il campo "Descrizione" e prima degli errori server. Label: "Contesto aggiuntivo (opzionale)".

**Fetch dei documenti:**
La `page.tsx` di `/tasks/new` deve fetchare i documenti di contesto e passarli come prop a `TaskCreationForm`. Aggiungere query in `lib/db/context.ts` (verificare se esiste già `getContextDocsForWorkspace` o simile).

**API route `POST /api/tasks`:**
Il body già viene inviato al route handler — verificare che `context_document_ids` venga passato e salvato. Se la tabella tasks non ha questa colonna, aggiungere una migration `0008_task_context_documents.sql` che crea una tabella di join `task_context_documents(task_id uuid, context_document_id uuid, PRIMARY KEY(task_id, context_document_id))` con FK verso `tasks` e `context_documents`. Il route handler `POST /api/tasks` deve inserire le righe di join dopo la creazione della task.

**Non modificare** il campo `description` o il formato TASK.md per ora — i documenti di contesto sono metadati aggiuntivi, non vengono interpolati nella descrizione in questa fase.

---

## Punto 6 — /reports: Tabella task filtrabile

### Situazione attuale

`ReportsClient.tsx` mostra solo grafici (BarChart velocità sprint, LineChart cycle time, PieChart distribuzione tipi, BarChart per repository). Non c'è una lista delle task.

`lib/db/reports.ts` già espone `ReportTask` con almeno i campi: `id`, `title`, `type`, `status`, `sprint_id`, `repository_id`.

### Modifica richiesta

Aggiungere una sezione "Task" in fondo alla pagina `/reports`, dopo i grafici. La sezione contiene:

1. **Filtri** (riga orizzontale sopra la tabella):
   - Select "Tipo" — opzioni: Tutti, Bug, Feature, Refactor, Chore, Docs, Accessibility, Security
   - Select "Sprint" — opzioni: Tutti + lista sprint (usa `sprints` già disponibile come prop)
   - Select "Agente" — opzioni: Tutti + lista agenti (vedi sotto)
   - Tutti i select devono usare il componente `CustomSelect` creato al Punto 3

2. **Tabella**:

| Colonna | Campo |
|---------|-------|
| Titolo | `task.title` — link a `/tasks/{task.id}` |
| Tipo | `task.type` con badge colorato (riusa `TYPE_COLORS` già definiti in `ReportsClient.tsx`) |
| Status | `task.status` con `STATUS_LABELS` da `lib/task-constants.ts` |
| Sprint | Nome dello sprint se assegnato |
| Agente | Nome dell'agente se assegnato |
| Creata | `task.created_at` formattato |

Stile tabella: identico alla tabella del Punto 1 (`w-full text-sm`, `border-b border-border`, ecc.).

3. **Dati agente:**
   - Aggiungere `agent_id` e `agent_name` a `ReportTask` in `lib/db/reports.ts`
   - La query in `lib/db/reports.ts` deve fare join con `agents` per recuperare il nome
   - La pagina `reports/page.tsx` deve passare la lista agenti distinti a `ReportsClient`

4. **Stato filtri:**
   I filtri sono gestiti in `useState` locale dentro `ReportsClient` — nessun URL param necessario. Il filtering è client-side (i dati sono già tutti in memoria come prop `tasks`).

5. **Paginazione:** non necessaria per ora. Se ci sono più di 100 task, mostrare le prime 100 con nota "Mostrando le prime 100 task. Usa i filtri per restringere.".

---

## Ordine di implementazione consigliato

1. **Punto 3** (CustomSelect) — è una dependency degli altri punti che richiedono select
2. **Punto 1** (tabella /context) — refactor semplice, nessuna dipendenza
3. **Punto 2** (drawer view/edit) — estende il Punto 1
4. **Punto 4** (sprint name) — isolato in BacklogJiraView
5. **Punto 5** (multiselect contesto) — richiede Punto 3 e potenzialmente una migration
6. **Punto 6** (tabella /reports) — richiede Punto 3

---

## Regole implementazione

- Compilare dopo ogni singola modifica — nessun TypeScript error aperto
- Mai toccare file `.env`
- Mai modificare migration già applicate
- `exactOptionalPropertyTypes: true` — rispettare le regole sui tipi opzionali
- Tutti i `<select>` nativi nel progetto vanno sostituiti con `CustomSelect` — fare un grep per `<select` prima di chiudere la PR
- Aprire PR al termine verso `main` con nome branch `feat/sprint-c-ui-improvements`
