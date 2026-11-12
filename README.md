# GDR Online

Motore per **giochi di ruolo testuali online** (play by chat), ricostruito da zero in chiave moderna prendendo come riferimento [GDRCD](https://github.com/GDRCD/GDRCD).

**Stato:** tutte e 7 le fasi previste sono completate.

## Cosa c'è

- **Account e personaggi**: un account, più personaggi; accesso sicuro; ruoli e permessi configurabili; regole anti-abuso per lo staff.
- **Mondo**: mappe con luoghi cliccabili, collegamenti tra mappe, **meteo** automatico per clima e stagione con fasi lunari, **stanze private** prenotabili.
- **Chat in tempo reale**: azioni con dialoghi evidenziati, tag di posizione, sussurri, Master e PNG, dadi, presenti con turnazione, uso degli oggetti, moderazione in diretta.
- **Sistema ibrido**: descrittivo nel gioco libero, numerico nelle **quest** (prove calcolate dal server con caratteristiche, abilità e oggetti). Caratteristiche e abilità sono configurabili; si cresce con i **punti esperienza**.
- **Strumenti dei Master**: quest, **esiti** con prove, **giocate** registrate e revisionate con PX, segnalazioni allo staff.
- **Social**: missive ON/OFF game, bacheche con sezioni e visibilità, **gilde** con gradi, candidature e stipendi.
- **Economia**: contanti e **banca** (bonifici, stipendi), **mercato** con scorte, catalogo di **oggetti** con bonus, inventario ed equipaggiamento visibile nella scheda.
- **Pagine** modificabili dallo staff (Guida, Regolamento, Ambientazione), 4 **temi grafici** (più CSS personalizzato), scelta del tema per ogni giocatore.
- **Importatore da GDRCD**: porta nel nuovo gioco account (con le vecchie password), personaggi, schede, mappe, gilde, oggetti, bacheche, missive e regolamento.

## Guide

- [Guida per lo staff](docs/guida-staff.md): configurare il gioco, gestire mondo, regole, Master, economia, moderazione, copie di sicurezza, messa online.
- [Importare da GDRCD](docs/importare-da-gdrcd.md): come portare qui un vecchio gioco.
- [Guida per sviluppatori](docs/sviluppo.md): struttura del codice e convenzioni.
- Per i giocatori c'è la pagina **Guida al gioco** dentro il sito (link in fondo a ogni pagina).

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

**Il primo account che crei diventa automaticamente Amministratore.** Registrati subito tu, poi segui i "Primi passi" della [guida per lo staff](docs/guida-staff.md).

### Uso quotidiano

| Cosa vuoi fare | Come |
|---|---|
| Spegnere il gioco | Nella finestra del comando premi `Ctrl + C` |
| Riaccenderlo | `docker compose up` |
| Scaricare gli aggiornamenti | In GitHub Desktop clicca **Fetch origin** e poi **Pull origin**, quindi `docker compose up -d --build` |
| Fare una copia di sicurezza | Vedi [Copie di sicurezza](docs/guida-staff.md#copie-di-sicurezza) |
| Ricominciare da zero (**cancella tutti i dati!**) | `docker compose down -v` |

I dati (account, personaggi, immagini, impostazioni) restano salvati anche se spegni il gioco o il PC.

### Dopo un aggiornamento

Le novità del database si applicano da sole all'avvio. I **ruoli già esistenti** però non ricevono da soli i permessi nuovi (solo l'Amministratore li ha sempre tutti). Se avevi installato il gioco prima di una di queste fasi, aggiungi da **Gestione → Ruoli**:

| Ruolo | Permessi da aggiungere |
|---|---|
| Master | Assegnare punti esperienza · Rispondere alle richieste di esito · Rivedere le giocate registrate e leggerle tutte · Consegnare oggetti ai personaggi |
| Moderatore | Moderare le bacheche · Gestire le segnalazioni dei giocatori |

Gli altri permessi nuovi (pagine, economia, oggetti, importazione) sono pensati per l'Amministratore, che li ha già.

---

## Per sviluppatori

Stack: SvelteKit 3 + TypeScript, PostgreSQL 16, Drizzle ORM, Docker. Dettagli in [docs/sviluppo.md](docs/sviluppo.md).

```
cp .env.example .env      # imposta DATABASE_URL
npm install
npm run dev               # http://localhost:5173
npm test                  # test automatici
npm run check             # controllo dei tipi
```
