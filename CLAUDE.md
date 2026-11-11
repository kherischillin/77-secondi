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
- Nessun modulo server deve leggere variabili d'ambiente o aprire il DB al momento dell'import: `npm run build` (anche in Docker) importa i moduli senza DATABASE_URL. `db` è un proxy pigro.
- Tempo reale: Server-Sent Events (`/gioco/luogo/[id]/eventi`) + hub in memoria (`src/lib/server/realtime.ts`). I messaggi si inviano con form action `?/invia`. La visibilità (sussurri, nascosti) si applica sia nello storico sia negli eventi.
- Design della chat basato sulle linee guida "Play by chat" salvate nel Project: niente tipo fuori gioco, Master/PNG con permesso, tag di posizione, turnazione nei presenti.
- Immagini: `saveImage()` controlla i magic bytes, nomi casuali, servite da `/media/[name]`. In Docker stanno nel volume `immagini`.
- Sistema di gioco **ibrido** (scelta del proprietario): descrittivo nel gioco libero, numerico solo nelle quest. Prove e dadi liberi sono validati sul server in base alla quest attiva (`getActiveQuest`); `rules.diceOutsideQuest` decide i dadi fuori quest.
- Regole numeriche in `src/lib/rules.ts` (pure, testate) + impostazioni sotto la chiave `rules` nella tabella settings (`getRules`/`updateRules`). Caratteristiche e abilità sono righe del DB, mai colonne fisse.
- PX: registro `xp_awards` (anche negativi) + `characters.xp_spent`. Nessuno assegna PX ai propri personaggi; `claimXpAward` impedisce la doppia assegnazione di una quest.
- Gli oggetti sono rimandati alla fase dell'economia (mercato, inventario).
- Social: permessi di bacheche e gerarchia di gilda sono funzioni pure in `src/lib/social.ts` (`boardAccess`, `canActOnMember`, `canAssignRank`), usate sia dal server sia dall'interfaccia. Una bacheca/discussione/missiva non accessibile risponde 404, non 403.
- Missive tra personaggi (non account), con `onGame` sulla conversazione. Bacheche ON GAME firmate dal personaggio attivo, OFF GAME dall'account.
- Gilde create dallo staff (`guilds.manage`) con gradi predefiniti e bacheca di gilda; il livello del grado decide la gerarchia.

## Verifiche prima di consegnare
`npm run check`, `npm test`, `npm run build`, e una prova reale dei flussi nel browser.

## Roadmap
1. ✅ Fondamenta: account, personaggi, sessioni, ruoli/permessi, gestione.
2. ✅ Mondo e chat in tempo reale (mappe, luoghi, SSE, tipi di intervento, dadi, presenti, moderazione).
3. ✅ Scheda e regole (sistema ibrido, caratteristiche e abilità dinamiche, quest, prove, PX). Oggetti spostati alla fase 6.
4. ✅ Social (missive ON/OFF, bacheche con sezioni e visibilità, gilde con gradi e candidature).
5. Strumenti master (esiti, giocate, moderazione).
6. Economia ed extra (oggetti e inventario, banca, mercato, stanze private, meteo).
7. Importatore da GDRCD, documentazione, temi.
