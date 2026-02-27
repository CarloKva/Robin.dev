# ADR-07 — Event Schema: EventPayloadMap + TypeScript Projections

**Data:** 2026-02-26
**Status:** Accepted
**Spike:** spike-08-event-schema.md

---

## Contesto

`task_events` è la sorgente di verità per ogni azione avvenuta su un task.
Ogni riga ha un campo `payload JSONB` il cui contenuto varia per `event_type`.
Serve type-safety end-to-end e una strategia per calcolare lo stato corrente del task.

---

## Decisione

1. **Nessun campo `version` nel payload.** Il discriminatore è `event_type`.
   Gli eventi passati rimangono immutabili; nuovi event type vengono aggiunti
   come nuove enum, non come nuove versioni dello stesso tipo.

2. **`EventPayloadMap` — discriminated union TypeScript.**
   Mapping statico `event_type → payload shape` che il compilatore usa per narrowing
   automatico. Zero runtime overhead.

3. **Proiezioni in TypeScript, non in PostgreSQL.**
   `getTaskProjectedState()` riduce l'array di eventi in memoria con `Array.reduce()`.
   Testabile con unit test puri, nessuna stored procedure da mantenere.

4. **Indice GIN su payload solo per `agent.pr.opened`.**
   `pr_url` è l'unico campo payload usato in query dirette. Un GIN globale sarebbe
   sproporzionato rispetto all'utilizzo.

---

## Conseguenze

**Positive:**
- Il compilatore TypeScript cattura payload malformati a compile-time
- Le proiezioni si testano con `vitest` o `jest` senza bisogno di DB
- Lo schema DB rimane semplice (nessuna funzione PostgreSQL aggiuntiva)
- Aggiungere un nuovo event type = solo aggiungere alla union in `shared-types`

**Negative:**
- Le proiezioni non sono accessibili via SQL (tradeoff accettato)
- Se il volume di eventi per task cresce molto (>10k), il reduce in-memory
  potrebbe essere lento (non previsto nell'orizzonte corrente)

---

## Alternative scartate

- **Campo `version`:** overhead cognitivo senza benefici concreti con eventi immutabili
- **Proiezioni PostgreSQL:** logica business nel DB, difficile da testare
- **GIN su tutto il payload:** costo indice sproporzionato
