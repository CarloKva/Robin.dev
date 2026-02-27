# Spike 09 — Supabase Realtime per Task Events

**Sprint:** 3
**Status:** ✅ Complete
**Decision:** → ADR-08

---

## Obiettivo

Scegliere la strategia per propagare nuovi `task_events` al frontend in tempo reale
senza polling.

---

## Opzioni analizzate

### Opzione A — Polling HTTP

Il client effettua fetch ogni N secondi su `/api/tasks/[id]/events`.

**Pro:** Semplicissimo, nessun package aggiuntivo
**Contro:** Latenza pari all'intervallo di polling, load sul DB, spreco di risorse quando nulla cambia. YAGNI contrario.

### Opzione B — Server-Sent Events (SSE)

Route handler Next.js che mantiene la connessione aperta e spinge eventi.

**Pro:** Unidirezionale (perfetto per log), nessuna libreria client
**Contro:** Richiede gestione manuale della connessione nel route handler, riconnessione manuale, conflitto con Edge Runtime di Vercel.

### Opzione C — Supabase Realtime `postgres_changes` (SCELTA)

Supabase espone WebSocket via Realtime. Con `postgres_changes` si ascolta INSERT su
`task_events` filtrati per `task_id`.

**Pro:**
- Libreria built-in (`@supabase/supabase-js` già installato)
- Riconnessione automatica gestita dall'SDK
- Filtro lato server: solo gli eventi del task specifico arrivano al client
- RLS applicato anche sul canale Realtime

**Contro:**
- Richiede `ALTER PUBLICATION supabase_realtime ADD TABLE task_events` nel DB
- Richiede client browser separato dal client server

---

## Pattern implementativo

```typescript
// SSR: carica eventi storici
const initialEvents = await getTaskTimeline(taskId); // Server Component

// Client: aggiorna incrementalmente
function useTaskEventsFeed(taskId: string, initial: TaskEvent[]) {
  const [events, setEvents] = useState(initial);

  useEffect(() => {
    const channel = supabase
      .channel(`task-events-${taskId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'task_events',
        filter: `task_id=eq.${taskId}`,
      }, (payload) => {
        setEvents(prev => {
          // Deduplication: ignora se ID già presente
          if (prev.some(e => e.id === payload.new.id)) return prev;
          return [...prev, payload.new as TaskEvent];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [taskId]);

  return events;
}
```

---

## Autenticazione Realtime con Clerk

Il client browser Supabase necessita del JWT Clerk per rispettare RLS sul canale Realtime.

```typescript
// Nel hook: aggiorna il token prima di sottoscrivere
const { getToken } = useAuth();
const token = await getToken({ template: "supabase" });
await supabase.realtime.setAuth(token);
```

Alternativa: rendere la publication senza RLS e filtrare solo per workspace_id (meno sicuro).
Scelta: usare JWT Clerk per rispettare le policy RLS esistenti.

---

## Fallback

Se il WebSocket non è disponibile (rete, Vercel timeout), il badge mostra `isOffline`.
Nessun polling di fallback (YAGNI). L'utente può ricaricare la pagina.

---

## Decisione

→ Opzione C — Supabase Realtime `postgres_changes`. Vedi ADR-08.
