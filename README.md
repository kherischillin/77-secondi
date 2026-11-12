# GDR Online

Motore per giochi di ruolo testuali online, ricostruito da zero in chiave moderna prendendo come riferimento [GDRCD](https://github.com/GDRCD/GDRCD).

**Stato:** fasi 1-4 completate. Ci sono account e personaggi, accesso sicuro, ruoli e permessi, pannello di gestione, mappe con luoghi, chat in tempo reale, scheda del personaggio, regole di gioco, quest, punti esperienza, missive, bacheche e gilde.

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

## Missive, bacheche e gilde

- **Missive** (menu in alto): messaggi privati tra personaggi, marcati **ON game** (tra personaggi) o **OFF game** (tra giocatori). Il numero di quelle non lette compare accanto a "Missive" e nel titolo della scheda del browser.
- **Bacheche**: le **ON GAME** si scrivono come personaggio, le **OFF GAME** come giocatore. Al primo avvio ci sono "Annunci dello staff", "Piazza dei giocatori", "Cronache del mondo" e "Sala dello staff". Si gestiscono da **Gestione → Bacheche**.
- **Gilde**: lo staff le crea da **Gestione → Gilde** (nascono con i gradi Capo, Ufficiale, Membro, Recluta e con una bacheca riservata). I giocatori entrano dalla pagina della gilda; i capi accettano le candidature e gestiscono chi sta sotto di loro.

## Cosa c'è nella fase 3

- **Scheda del personaggio** pubblica, con presta-volto e sezioni descrittive; modifica da parte del proprietario o dello staff.
- **Regole come dati**: caratteristiche e abilità configurabili, con limiti, collegamenti e ordine.
- **Distribuzione iniziale** dei punti con contatori in tempo reale; **avanzamento** spendendo PX con costi crescenti.
- **Quest** avviate e chiuse dal Master, con avviso in diretta, prove calcolate dal server, dadi liberi solo in quest.
- **Punti esperienza**: assegnati a fine quest o singolarmente dallo staff, con motivo e storico; nessuno può assegnarli a sé stesso e i PX di una quest si assegnano una volta sola.
- **Strumenti dello staff** sulla scheda: correzione dei valori e azzeramento della distribuzione.

## Cosa c'è nella fase 4

- **Missive** a conversazione, con ON/OFF game, avviso delle non lette aggiornato ogni 30 secondi, archivio.
- **Bacheche** con sezioni ON/OFF, visibilità tutti/gilda/staff, discussioni riservate allo staff (o ai capi per le bacheche di gilda), novità evidenziate, modifica dei propri messaggi, moderazione (nascondi, chiudi, metti in evidenza, elimina).
- **Gilde** con simbolo, statuto, gradi configurabili, ingresso libero/su candidatura/su invito, gerarchia rispettata (si agisce solo su chi sta sotto), bacheca di gilda automatica, gilde visibili nella scheda, limite di gilde per personaggio.

## Cosa c'è nella fase 5 (strumenti master)

- **Esiti** (menu in alto): il giocatore chiede ai Master di raccontare cosa succede fuori dalla chat (un'indagine, un viaggio, un lavoro). Il primo Master che risponde se ne occupa; può aggiungere una **prova** sul personaggio con difficoltà (riuscita/fallita calcolata dal server). Il numero di risposte non lette compare accanto a "Esiti". Un Master non può arbitrare gli esiti dei propri personaggi.
- **Giocate**: in ogni luogo c'è "Registra la giocata". Salva una copia permanente della chat (tutta la quest, oppure le ultime ore), **senza sussurri né messaggi nascosti**, con l'elenco dei partecipanti. Si può scaricare in HTML, rendere pubblica (compare nella scheda dei partecipanti) e **inviare ai Master**, che la rivedono, lasciano una nota e assegnano PX a ciascun partecipante.
- **Spazio Master** (link "Master" in alto, con il numero di cose da fare): esiti da assegnare, seguiti da te, aperti e chiusi; giocate da rivedere.
- **Segnalazioni**: il pulsante "Segnala" compare sui messaggi in chat, nelle bacheche, nelle missive e nelle schede. Lo staff le trova in **Gestione → Segnalazioni** (il numero compare accanto a "Gestione"), con una copia del testo com'era al momento della segnalazione; le prende in carico e le chiude scrivendo com'è stata gestita.

> **Se avevi già avviato il gioco prima di questo aggiornamento:** i ruoli esistenti non ricevono da soli i nuovi permessi. Vai in **Gestione → Ruoli** e aggiungi al ruolo **Master** i permessi "Rispondere alle richieste di esito" e "Rivedere le giocate registrate e leggerle tutte", e al ruolo **Moderatore** "Gestire le segnalazioni dei giocatori". L'Amministratore li ha già tutti.

## Cosa c'è nella fase 6 (economia ed extra)

- **Denaro**: ogni personaggio ha contanti (in tasca) e un conto in banca. Nome della valuta, denaro iniziale, percentuale di rivendita e frequenza degli stipendi si scelgono in **Gestione → Economia**.
- **Banca** (barra di gioco → Banca): deposito, prelievo, bonifici ad altri personaggi con causale, storico di tutti i movimenti.
- **Stipendi**: lo staff assegna uno stipendio ai gradi di gilda (Gestione → Economia); i membri lo ritirano in banca una volta per periodo.
- **Oggetti** (Gestione → Oggetti e mercato): catalogo con immagine, categoria, posizione in cui si indossano, prezzo, pezzi disponibili e **bonus nelle quest** (anche malus). Al primo avvio ci sono 5 oggetti di esempio.
- **Inventario**: indossare e togliere, cedere oggetti ad altri personaggi. Ciò che si indossa compare nella scheda (è la parte che si vede in gioco) e i suoi bonus entrano nelle prove **solo in quest**, come vuole il sistema ibrido.
- **Mercato**: compra (in contanti) e rivendi, con filtri per categoria e pezzi che si esauriscono.
- **Usa un oggetto** in chat: compare come riga speciale con la tua azione; i consumabili (es. Medikit) si esauriscono.
- **Stanze private**: in Gestione → Mappe, su un luogo spunta "Stanza privata" e scegli costo orario e ore massime. Chi la prenota invita gli altri per nome, può ritirare l'invito (chi è dentro viene fatto uscire subito), prolungare o liberare la stanza. Gli altri non entrano né leggono, nei Presenti compare solo "In una stanza privata", e chi prenota dopo non legge le giocate precedenti.
- **Meteo**: in Gestione → Mappe scegli il clima di ogni mappa (temperato, mediterraneo, continentale, arido, tropicale, polare). Il meteo cambia da solo ogni 3 ore, segue stagioni e ora del giorno ed è uguale per tutti; c'è anche la fase lunare. Lo staff può imporre un meteo speciale per qualche ora (es. "Pioggia acida").
- Tutti i passaggi di denaro e di oggetti sono a prova di "doppio clic": due richieste simultanee non possono spendere due volte lo stesso denaro, superare i pezzi disponibili o ritirare due volte lo stipendio. Nessuno può darsi denaro od oggetti da solo.

> **Se avevi già avviato il gioco prima di questo aggiornamento:** al ruolo **Master** aggiungi da **Gestione → Ruoli** il permesso "Consegnare oggetti ai personaggi". I personaggi già esistenti partono con 0 contanti: puoi dare loro del denaro da Gestione → Economia.

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
      messages.ts         missive
      boards.ts           bacheche
      guilds.ts           gilde
    chat.ts               regole della chat condivise (comandi, dadi, dialoghi)
    rules.ts              regole numeriche (punti, costi, prove)
    social.ts             regole di bacheche e gilde (chi legge, chi scrive, gerarchia)
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
