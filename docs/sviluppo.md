# Guida per sviluppatori

Stack: **SvelteKit 3** (Svelte 5 con runes) + TypeScript, adapter-node, **PostgreSQL 16** con **Drizzle ORM**, Zod 4 per la validazione, Vitest per i test, Docker per l'esecuzione.

## Avvio in sviluppo

Serve Node 22 e un PostgreSQL.

```
cp .env.example .env      # imposta DATABASE_URL
npm install
npm run dev               # http://localhost:5173
npm test                  # test automatici (logica pura)
npm run test:db           # test con un vero database (serve TEST_DATABASE_URL, vedi sotto)
npm run check             # controllo dei tipi
npm run build             # build di produzione (deve funzionare anche senza .env)
```

Le migrazioni in `drizzle/` si applicano da sole all'avvio. Dopo aver cambiato `src/lib/server/db/schema.ts` esegui `npm run db:generate`.

## Struttura

```
src/
  hooks.server.ts            avvio (migrazioni, dati iniziali), sessione e tema a ogni richiesta
  lib/
    permissions.ts           catalogo dei permessi (i nuovi vanno aggiunti qui)
    chat.ts                  sintassi della chat: comandi, dadi, dialoghi
    rules.ts                 regole numeriche: punti, costi, prove
    social.ts                bacheche e gilde: chi legge, chi scrive, gerarchia
    master.ts                esiti, giocate, segnalazioni
    economy.ts               valuta, oggetti, posizioni, bonus, stipendi
    weather.ts               meteo deterministico e fasi lunari
    markup.ts                formattazione sicura delle pagine
    themes.ts                elenco dei temi (i colori sono in app.css)
    components/              MapCanvas, ChatRoom, ChatLine, ReportButton, ItemForm, EconomyNav…
    server/
      db/schema.ts           schema del database
      auth/                  password (Argon2 + vecchi hash GDRCD) e sessioni
      guards.ts              requireUser / requireCapability / requireCharacter
      admin-rules.ts         regole anti-abuso del pannello
      chat-service.ts        invio e lettura dei messaggi, visibilità
      realtime.ts            canali in tempo reale (Server-Sent Events)
      presence.ts, world.ts, sheet.ts, quests.ts, messages.ts, boards.ts, guilds.ts,
      esiti.ts, giocate.ts, reports.ts, money.ts, items.ts, rooms.ts, pages.ts
      import/                importatore da GDRCD (lettore di dump SQL + mappatura)
  routes/                    pagine (gioco/, scheda/, bacheche/, gestione/, …)
drizzle/                     migrazioni SQL
docs/                        guide
```

## Convenzioni

- Import interni con i subpath `#lib/...` **con estensione esplicita** (`#lib/server/guards.ts`). I tipi degli hook si importano da `@sveltejs/kit/hooks`.
- Nessun modulo server legge le variabili d'ambiente o apre il database al momento dell'import: `db` è un proxy pigro e `env` usa dei getter. La build gira senza `DATABASE_URL`.
- Niente "parameter properties" di TypeScript (`constructor(readonly x)`): si dichiarano i campi esplicitamente.
- Ogni pagina protetta chiama `requireUser` / `requireCapability` / `requireCharacter` sia nel `load` sia in ogni action.
- Contenuti non accessibili (bacheche, discussioni, missive, giocate, esiti) rispondono **404**, non 403.
- Le azioni rilevanti scrivono nel registro con `audit()` e hanno un'etichetta in `AUDIT_LABELS`.
- La logica che si può testare senza database sta in moduli puri in `src/lib/` con i loro `*.test.ts`.
- Ciò che dipende dal database (denaro, stipendi, mercato, account, sessioni, permessi) ha i test in `src/tests/*.db.test.ts`. Usano un vero PostgreSQL e provano anche le richieste simultanee (doppia spesa, doppio stipendio, ultimo pezzo in negozio). Si lanciano con `TEST_DATABASE_URL=postgres://gdr:gdr@localhost:5432/gdr_test npm run test:db`: **ogni file svuota quel database**, quindi il nome deve contenere `test` (altrimenti i test si rifiutano di partire) e non va mai usato quello del gioco. Senza la variabile si saltano. Gli strumenti comuni (`freshDatabase`, `makeUser`, `makeCharacter`, `outcomes`) sono in `src/tests/db.ts`. Su GitHub girano da soli a ogni modifica (`.github/workflows/ci.yml`).
- Denaro e oggetti si muovono solo con aggiornamenti condizionati dentro transazioni (`move()` in `money.ts`, `items.ts`), con vincoli CHECK nel database: niente saldi negativi né doppie spese.
- Testi dell'interfaccia in italiano; codice e identificatori in inglese.
- I colori dei componenti usano le variabili di `app.css` (`--accent`, `--c-master`, `--c-positive`…), così funzionano con tutti i temi.

## Sicurezza

- Password con Argon2id; gli hash phpass/MD5 importati da GDRCD si verificano una volta e si riscrivono.
- Sessioni con token casuali, salvati solo come hash SHA-256.
- Protezione CSRF di SvelteKit (`ORIGIN` deve essere l'indirizzo pubblico).
- Content-Security-Policy su tutte le pagine (`csp` in `vite.config.ts`): si eseguono solo gli script del sito. Chi aggiunge script o risorse da altri siti deve aggiornare lì l'elenco.
- Immagini controllate dai "magic bytes", salvate con nomi casuali, servite da `/media/[nome]`.
- Il testo degli utenti è sempre neutralizzato; le pagine dello staff passano da `renderMarkup`.
- Limiti di frequenza su accesso, messaggi in chat, bonifici e segnalazioni. Sono per indirizzo IP (`clientIp` → `getClientAddress`): dietro un reverse proxy servono `ADDRESS_HEADER` e `XFF_DEPTH` (commentati in `docker-compose.yml`), altrimenti tutti i giocatori condividono l'indirizzo del proxy.

## Verifiche prima di consegnare

`npm run check`, `npm test`, `npm run test:db`, `npm run build` senza `.env`, e una prova reale dei flussi nel browser.
