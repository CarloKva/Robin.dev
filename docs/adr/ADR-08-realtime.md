# ADR-08 — Real-time: Supabase Realtime postgres_changes

**Data:** 2026-02-26
**Status:** Accepted
**Spike:** spike-09-realtime.md

---

## Contesto

Il dashboard deve mostrare nuovi `task_events` in tempo reale senza che l'utente
ricarichi la pagina. Serve una strategia con latenza bassa, reconnect automatico
e compatibilità con l'infrastruttura esistente (Supabase, Clerk, Vercel).

---

## Decisione

1. **Supabase Realtime `postgres_changes` INSERT su `task_events`.**
   Filtro per `task_id=eq.{id}` per ricevere solo gli eventi del task corrente.

2. **SSR per il caricamento iniziale, Realtime per aggiornamenti incrementali.**
   Il Server Component fetcha gli eventi storici; il Client Component li riceve
   come prop e li estende via hook.

3. **Deduplicazione lato client.**
   Il hook controlla se `payload.new.id` è già presente nello state prima di appendere.

4. **Autenticazione via JWT Clerk.**
   Prima di sottoscrivere il canale, il hook chiama `supabase.realtime.setAuth(token)`
   con il token Clerk. Così le RLS policy vengono rispettate anche sui canali Realtime.

5. **Reconnect automatico.**
   Gestito dall'SDK Supabase — nessuna logica custom.

6. **Fallback: badge `isOffline`.**
   Se il canale va in errore, il badge mostra "Offline". Nessun polling di fallback (YAGNI).

---

## Prerequisiti DB

```sql
-- Aggiunto in migration 0004
ALTER PUBLICATION supabase_realtime ADD TABLE task_events;
```

---

## Conseguenze

**Positive:**
- Latenza < 1s dalla INSERT al frontend
- Reconnect automatico senza codice aggiuntivo
- Compatibile con Vercel (WebSocket via Supabase, non da Next.js)
- RLS rispettata sul canale Realtime

**Negative:**
- Richiede un client browser Supabase separato dal client server
- Se il JWT Clerk scade durante una sessione lunga, il canale va in errore
  (workaround futuro: refresh token + re-subscribe)

---

## Alternative scartate

- **Polling:** carico inutile sul DB, latenza proporzionale all'intervallo
- **SSE da Next.js:** gestione manuale, conflitti con Edge Runtime Vercel
