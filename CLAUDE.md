# Note per lo sviluppo

Il proprietario del progetto non programma: tutto il codice lo scrive Claude. Spiegazioni e istruzioni per lui in italiano semplice, passo passo; usa Windows e avvia il gioco con Docker Desktop.

## Stack e convenzioni
- SvelteKit 3 (Svelte 5 runes), TypeScript, adapter-node. PostgreSQL 16 + Drizzle ORM. Zod 4 per la validazione.
- In SvelteKit 3 gli import della libreria usano i subpath `#lib/...` **con estensione esplicita** (`#lib/server/guards.ts`, `#lib/server/db/index.ts`). I tipi degli hook si importano da `@sveltejs/kit/hooks`.
- Variabili d'ambiente lette da `process.env` in `src/lib/server/env.ts` (carica `.env` in sviluppo).
- Testi dell'interfaccia, nomi delle route e messaggi in italiano. Codice e identificatori in inglese.
- Ogni pagina protetta chiama `requireUser` / `requireCapability` / `requireCharacter` (src/lib/server/guards.ts) sia nel `load` sia in ogni action.
- Nuovi permessi: aggiungerli in `src/lib/permissions.ts`; il ruolo di sistema (Amministratore) li riceve da solo all'avvio.
- Regola anti-abuso: non si concedono permessi che non si hanno, non si agisce su chi ha più poteri (src/lib/server/admin-rules.ts).
- Azioni rilevanti: scrivere nel registro con `audit()` e aggiungere l'etichetta in `AUDIT_LABELS`.
- Schema DB: modificare `src/lib/server/db/schema.ts`, poi `npm run db:generate`. Le migrazioni si applicano all'avvio.

## Verifiche prima di consegnare
`npm run check`, `npm test`, `npm run build`, e una prova reale dei flussi nel browser.

## Roadmap
1. ✅ Fondamenta: account, personaggi, sessioni, ruoli/permessi, gestione.
2. Mondo e chat in tempo reale (mappe, luoghi, WebSocket, tipi di intervento, dadi, presenti).
3. Scheda e regole (statistiche dinamiche, abilità, oggetti, PX).
4. Social (messaggi privati, bacheche, gilde).
5. Strumenti master (esiti, giocate, moderazione).
6. Economia ed extra (banca, mercato, stanze private, meteo).
7. Importatore da GDRCD, documentazione, temi.
