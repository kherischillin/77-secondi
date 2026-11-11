# GDR Online

Motore per giochi di ruolo testuali online, ricostruito da zero in chiave moderna prendendo come riferimento [GDRCD](https://github.com/GDRCD/GDRCD).

**Stato:** fase 1 completata. Ci sono account e personaggi, accesso sicuro, ruoli e permessi, e il pannello di gestione. Mappe e chat arrivano nella fase 2.

---

## Provarlo sul tuo PC Windows

Serve installare due programmi, una volta sola.

### 1. Installa Docker Desktop

Docker fa girare il sito e il database in "contenitori" già pronti, senza installare altro.

1. Scarica **Docker Desktop per Windows** da https://www.docker.com/products/docker-desktop/
2. Avvia l'installazione e lascia le opzioni predefinite (compresa "Use WSL 2").
3. Riavvia il PC se te lo chiede.
4. Apri Docker Desktop e aspetta che in basso a sinistra compaia **"Engine running"** (pallino verde). Se chiede di creare un account puoi saltare.

### 2. Installa GitHub Desktop e scarica il progetto

1. Scarica **GitHub Desktop** da https://desktop.github.com/ e accedi con il tuo account GitHub.
2. Menu **File → Clone repository**, scegli `kherischillin/gdr-online` e clicca **Clone**.
3. Annota la cartella in cui l'ha salvato (di solito `Documenti\GitHub\gdr-online`).

### 3. Avvia il gioco

1. In GitHub Desktop: menu **Repository → Open in Command Prompt** (oppure "Open in PowerShell").
2. Scrivi questo comando e premi Invio:

   ```
   docker compose up --build
   ```

3. La prima volta ci mette qualche minuto. Quando compare la riga **`Listening on http://0.0.0.0:3000`** è pronto.
4. Apri il browser su **http://localhost:3000**

**Il primo account che crei diventa automaticamente Amministratore.** Registrati subito tu.

### Uso quotidiano

| Cosa vuoi fare | Come |
|---|---|
| Spegnere il gioco | Nella finestra del comando premi `Ctrl + C` |
| Riaccenderlo | `docker compose up` |
| Scaricare gli aggiornamenti | In GitHub Desktop clicca **Fetch origin** e poi **Pull origin**, quindi `docker compose up --build` |
| Ricominciare da zero (**cancella tutti i dati!**) | `docker compose down -v` |

I dati (account, personaggi, impostazioni) restano salvati anche se spegni il gioco o il PC.

---

## Cosa c'è nella fase 1

- **Account separati dai personaggi**: un account può avere più personaggi (il limite si imposta dal pannello).
- **Accesso sicuro**: password con Argon2id, sessioni con token cifrati, blocco dopo troppi tentativi sbagliati, protezione dai form inviati da altri siti.
- **Ruoli e permessi**: ogni ruolo è un insieme di permessi scelti da un elenco. Ruoli predefiniti: Amministratore, Moderatore, Master, Giocatore. Se ne possono creare altri.
- **Regole anti-abuso**: nessuno può concedere permessi che non ha, né agire su chi ha più poteri di lui; resta sempre almeno un Amministratore.
- **Pannello di gestione**: panoramica, account (ricerca, ruoli, sospensione), ruoli, impostazioni del sito, registro attività.
- **Registro attività**: accessi, iscrizioni, modifiche amministrative, con data e indirizzo IP.

---

## Per sviluppatori

Stack: SvelteKit 3 + TypeScript, PostgreSQL 16, Drizzle ORM, Docker.

```
src/
  hooks.server.ts         avvio (migrazioni) e riconoscimento della sessione a ogni richiesta
  lib/
    permissions.ts        catalogo dei permessi
    validation.ts         regole di validazione dei form
    server/
      db/schema.ts        schema del database
      auth/               password e sessioni
      guards.ts           requireUser / requireCapability / requireCharacter
      admin-rules.ts      regole anti-abuso del pannello
  routes/                 pagine (accesso, registrazione, account, gioco, gestione/…)
drizzle/                  migrazioni SQL, applicate automaticamente all'avvio
```

Sviluppo senza Docker (serve Node 22 e un PostgreSQL):

```
cp .env.example .env      # imposta DATABASE_URL
npm install
npm run dev               # http://localhost:5173
npm test                  # test automatici
npm run check             # controllo dei tipi
```

Dopo aver modificato `src/lib/server/db/schema.ts`: `npm run db:generate` crea la nuova migrazione.

In produzione il sito deve stare dietro HTTPS e `ORIGIN` deve essere l'indirizzo pubblico (es. `https://miogdr.it`).
