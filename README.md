# GDR Online

Motore per giochi di ruolo testuali online, ricostruito da zero in chiave moderna prendendo come riferimento [GDRCD](https://github.com/GDRCD/GDRCD).

**Stato:** fasi 1, 2 e 3 completate. Ci sono account e personaggi, accesso sicuro, ruoli e permessi, pannello di gestione, mappe con luoghi, chat in tempo reale, scheda del personaggio, regole di gioco, quest e punti esperienza.

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

## Preparare il mondo (la prima volta)

1. Accedi con l'account Amministratore e vai su **Gestione → Mappe e luoghi**.
2. Crea una mappa: dai un nome e carica un'immagine (PNG, JPG, WEBP o GIF, fino a 5 MB). La prima mappa diventa quella di partenza.
3. Nella pagina della mappa scrivi il nome di un luogo e clicca **Aggiungi luogo**.
4. Nella pagina del luogo **clicca sulla mappa** nel punto in cui deve comparire, scrivi la descrizione e salva.
5. Per collegare due mappe crea un luogo di tipo **Collegamento a un'altra mappa** (es. "Porta Nord").
6. Ora da **Il mio account → Gioca** entri nella mappa e da lì nei luoghi.

## Come si scrive in chat

| Cosa | Come |
|---|---|
| Azione (normale) | Scrivi in terza persona. I dialoghi tra «virgolette» (o "", <>) vengono evidenziati. |
| Tag di posizione | Campo "Tag", es. `TAVOLO VERDE`: compare come [TAVOLO VERDE] davanti al messaggio. |
| Sussurro | Scrivi `@Nome@ testo`, oppure scegli "Sussurro" e il destinatario. Lo vedete solo voi due. |
| Dadi | `#d20`, `#2d6`, `#3d6+2`: li tira il server, nessuno può barare. |
| Master | Tipo "Master": la stringa compare in evidenza. Serve il permesso "Intervenire in chat come Master". |
| PNG | Tipo "PNG" con il nome del personaggio non giocante. Serve il permesso relativo. |
| Moderazione | Chi ha il permesso vede "Nascondi" su ogni messaggio: sparisce subito per tutti. |

Invio manda il messaggio, Maiusc+Invio va a capo. Accanto alla chat c'è l'elenco dei presenti con il tempo dall'ultima azione di ognuno, utile per la turnazione.

## Sistema di gioco ibrido

- **Gioco libero (descrittivo)**: si scrive e basta. I tiri di dado sono disattivati (si possono riattivare in **Gestione → Regole di gioco**).
- **Quest (numerico)**: un Master entra in un luogo e clicca **Avvia una quest**. Tutti vedono l'avviso e compare il pannello **Prova**: si sceglie un'abilità o una caratteristica e il server tira il dado sommando caratteristica e rango.
- **Fine quest**: il Master clicca **Termina quest** e arriva alla pagina dei punti esperienza, con l'elenco dei partecipanti. Il Master e i suoi personaggi sono esclusi.
- **Scheda**: ogni personaggio ha aspetto, carattere, background (pubblico o riservato, a scelta del gioco) e presta-volto. Alla prima apertura il giocatore distribuisce i punti iniziali; poi migliora spendendo PX.
- **Regole**: caratteristiche, abilità, punti iniziali, costi in PX e dado delle quest si cambiano da **Gestione → Regole di gioco**. Al primo avvio ci sono 6 caratteristiche e 10 abilità di esempio.

---

## Cosa c'è nella fase 1

- **Account separati dai personaggi**: un account può avere più personaggi (il limite si imposta dal pannello).
- **Accesso sicuro**: password con Argon2id, sessioni con token cifrati, blocco dopo troppi tentativi sbagliati, protezione dai form inviati da altri siti.
- **Ruoli e permessi**: ogni ruolo è un insieme di permessi scelti da un elenco. Ruoli predefiniti: Amministratore, Moderatore, Master, Giocatore. Se ne possono creare altri.
- **Regole anti-abuso**: nessuno può concedere permessi che non ha, né agire su chi ha più poteri di lui; resta sempre almeno un Amministratore.
- **Pannello di gestione**: panoramica, account (ricerca, ruoli, sospensione), ruoli, impostazioni del sito, registro attività.
- **Registro attività**: accessi, iscrizioni, modifiche amministrative, con data e indirizzo IP.

## Cosa c'è nella fase 2

- **Mappe e luoghi** gestiti dal pannello, con immagini caricate e posizionamento dei luoghi con un clic. Luoghi nascondibili, collegamenti tra mappe, mappa di partenza.
- **Chat in tempo reale**: i messaggi arrivano a tutti all'istante, con riconnessione automatica e recupero dei messaggi persi.
- **Tipi di intervento** pensati sulle linee guida del play by chat: azione con dialoghi evidenziati, tag di posizione, sussurri privati, Master, PNG, dadi.
- **Presenti**: nel luogo (con l'ultima azione di ognuno) e in tutto il gioco; sulla mappa si vede quanti sono in ogni luogo.
- **Moderazione**: messaggi nascosti in diretta, tracciati nel registro attività.
- **Sicurezza**: le immagini caricate sono controllate nel contenuto, i permessi di Master e PNG sono verificati sul server, limite anti-spam sui messaggi.

## Cosa c'è nella fase 3

- **Scheda del personaggio** pubblica, con presta-volto e sezioni descrittive; modifica da parte del proprietario o dello staff.
- **Regole come dati**: caratteristiche e abilità configurabili, con limiti, collegamenti e ordine.
- **Distribuzione iniziale** dei punti con contatori in tempo reale; **avanzamento** spendendo PX con costi crescenti.
- **Quest** avviate e chiuse dal Master, con avviso in diretta, prove calcolate dal server, dadi liberi solo in quest.
- **Punti esperienza**: assegnati a fine quest o singolarmente dallo staff, con motivo e storico; nessuno può assegnarli a sé stesso e i PX di una quest si assegnano una volta sola.
- **Strumenti dello staff** sulla scheda: correzione dei valori e azzeramento della distribuzione.

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
      chat-service.ts     invio e lettura dei messaggi, visibilità dei sussurri
      realtime.ts         smistamento in tempo reale (Server-Sent Events)
      presence.ts         chi è dove
      world.ts            mappe e luoghi
      uploads.ts          immagini caricate
      sheet.ts            scheda, distribuzione, avanzamento, PX
      quests.ts           quest e partecipanti
    chat.ts               regole della chat condivise (comandi, dadi, dialoghi)
    rules.ts              regole numeriche (punti, costi, prove)
    components/           MapCanvas, ChatRoom, ChatLine
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
