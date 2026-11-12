# Guida per lo staff

Tutto quello che serve per configurare e gestire il gioco. Le voci tra **grassetti** si trovano in **Gestione → Pannello di controllo**, nella barra in alto (il menu Gestione compare solo a chi ha i permessi; i Master vi trovano lo **Spazio Master**).

## La barra in alto
- **[Nome del personaggio]** porta alla sua scheda (da lì: inventario, equipaggiamento, giocate, esiti), poi **Missive, Mappa, Presenti, Bacheche**.
- **Uffici**: gilde, banca, mercato, stanze private, archivio delle giocate pubbliche, e le pagine Guida, Regolamento, Ambientazione.
- **Impostazioni**: il mio account (creare ed eliminare personaggi, email), temi, notifiche.
- **Gestione**: Spazio Master e Pannello di controllo, solo per chi ha i permessi.
- **Esci**: cambia personaggio, oppure esci dal gioco.
- Dopo l'accesso si sceglie sempre il personaggio (con uno solo si entra direttamente). Lo staff può usare Gestione anche senza aver scelto un personaggio.
- Su telefono la barra si raccoglie nel pulsante ☰.

## Primi passi

1. **Registrati per primo**: il primo account diventa Amministratore.
2. **Gestione → Impostazioni**: nome del gioco, sottotitolo, tema grafico, numero di personaggi per account, iscrizioni aperte o chiuse.
3. **Gestione → Pagine**: completa il **Regolamento** (ci sono già le scelte da dichiarare: turnazione, pensieri, background, metagame) e scrivi l'**Ambientazione**. La **Guida al gioco** è già pronta.
4. **Gestione → Mappe e luoghi**: crea la prima mappa, scegli il clima, aggiungi i luoghi (vedi sotto).
5. **Gestione → Regole di gioco**: controlla caratteristiche, abilità, punti iniziali e costi in PX (ci sono già 6 caratteristiche e 10 abilità di esempio).
6. **Gestione → Economia** e **Oggetti e mercato**: nome della valuta, denaro iniziale, oggetti in vendita.
7. **Gestione → Ruoli** e **Account**: dai il ruolo Master e Moderatore alle persone di fiducia.

Se arrivi da un vecchio GDRCD, prima di tutto questo leggi [Importare da GDRCD](importare-da-gdrcd.md).

## Ruoli e permessi

Ogni ruolo è un insieme di permessi scelti da un elenco; un account può avere più ruoli. Ruoli predefiniti:

| Ruolo | A cosa serve |
|---|---|
| Amministratore | Tutto. Non si può cancellare e ha sempre tutti i permessi, anche quelli futuri. |
| Moderatore | Account, moderazione di chat e bacheche, segnalazioni, registro attività. |
| Master | Interventi da Master e PNG, quest, PX, esiti, revisione delle giocate, consegna di oggetti. |
| Giocatore | Ruolo base di ogni iscritto. |

Regole anti-abuso, sempre attive: nessuno può dare permessi che non ha, né agire su chi ha più poteri; resta sempre almeno un Amministratore; **nessuno può dare PX, denaro od oggetti ai propri personaggi**.

## Mondo

- **Mappe**: immagine (PNG, JPG, WEBP, GIF fino a 5 MB), descrizione, **clima** per il meteo automatico. La mappa "di partenza" è quella in cui arriva chi entra in gioco.
- **Luoghi**: nella pagina del luogo clicca sull'immagine della mappa nel punto in cui deve comparire. Un luogo può essere una chat oppure un **collegamento** a un'altra mappa (es. "Porta Nord"). Togli "Visibile ai giocatori" per prepararlo con calma.
- **Distretti**: una mappa può essere un distretto di un'altra (es. Watson dentro Night City). Apri la mappa del distretto, nel riquadro **Distretto** scegli la mappa madre e disegna l'area trascinando sull'immagine, poi salva. Sulla mappa madre l'area diventa cliccabile: la mappa zooma e si apre il distretto. Se il distretto non ha un'immagine propria mostra il pezzo ingrandito dell'immagine della madre, e i suoi luoghi si posizionano su quel pezzo. Il numero accanto al nome indica quanti personaggi ci sono dentro (le stanze private non contano).
  La zona si può disegnare come rettangolo (trascinando) o come **forma libera** (cliccando i vertici lungo il confine): la forma è l'area cliccabile, il rettangolo che la contiene è quello che si vede aprendo il distretto. Per creare molti distretti insieme c'è **Importa distretti** (elenco JSON con nome e vertici).
- **Night City (77 Secondi)**: nella mappa "Night City", dopo aver caricato come immagine il file `night-city.webp`, il pulsante **Crea distretti e luoghi** crea i 24 distretti con la loro forma e i 156 luoghi della legenda, già posizionati e con una breve descrizione (testi originali, modificabili dalla pagina del luogo o della mappa). Rilanciandolo si aggiornano solo le descrizioni ancora vuote o automatiche: quelle scritte dallo staff restano. Se un distretto esiste già con lo stesso nome (o si chiama "Watson") viene aggiornato; i luoghi esistenti non si duplicano, quindi si può rilanciare. Con più di 8 luoghi, sulla mappa del distretto i nomi compaiono passandoci sopra.
- **Stanze private**: su un luogo spunta "Stanza privata", scegli costo orario (0 = gratis) e ore massime. Chi prenota invita gli altri per nome; gli altri non entrano né leggono, e chi prenota dopo non legge le giocate precedenti. I moderatori possono sempre entrare.
- **Meteo**: cambia da solo ogni 3 ore secondo clima, stagione e ora del giorno, uguale per tutti, con la fase lunare. Nella pagina della mappa puoi imporre un **meteo speciale** per qualche ora (es. "Tempesta di sabbia").

## Regole di gioco (sistema ibrido)

- Nel **gioco libero** si scrive e basta: i dadi sono disattivati (si possono riattivare in Regole di gioco).
- Durante una **quest** valgono i numeri: un Master entra in un luogo e clicca **Avvia una quest**; compare il pannello **Prova**. La prova somma dado, caratteristica, rango dell'abilità e bonus degli oggetti indossati.
- **Fine quest**: il Master clicca **Termina quest** e assegna i PX ai partecipanti (lui e i suoi personaggi sono esclusi; i PX di una quest si assegnano una volta sola).
- **Caratteristiche e abilità** si creano e modificano in Regole di gioco, con valori minimi e massimi; ogni abilità può essere legata a una caratteristica.
- Dalla **scheda** di un personaggio lo staff può correggere i valori, azzerare la distribuzione iniziale, assegnare PX, consegnare o togliere oggetti.
- Il **presta-volto** si collega con un link `https://` e solo dai siti scelti in **Gestione → Impostazioni** (all'inizio: Imgur, ImgBB, Postimages, Catbox, Pinterest, X/Twitter, Wikimedia, Unsplash). Lì si sceglie anche la misura del riquadro (di base 350 × 500 px): l'immagine lo riempie senza deformarsi, tagliando i bordi se ha proporzioni diverse. Se togli un sito dall'elenco, le immagini già collegate da lì non vengono più mostrate.
- Il giocatore deve usare **tutti** i punti iniziali prima di confermare la distribuzione. Finché il personaggio non ha ricevuto né speso PX può rifarla da solo; dopo serve lo staff con «Azzera la distribuzione».
- Ogni personaggio può avere un **avatar** quadrato (link, stessi siti del presta-volto), mostrato accanto al nome in bacheca, in chat, nei presenti e sulla mappa; senza avatar compare l'iniziale del nome.
- Le sezioni **Aspetto, Carattere, Background e OFF Game** della scheda accettano testo semplice oppure HTML e CSS. Funzionano anche i codici tipici dei GDR: linguette fatte con `<input type="radio">`/`checkbox` e `<label>`, tag inventati come `<j>` o `<k>` da colorare con il CSS, impaginazioni con `position: absolute`. Sono mostrate in riquadri isolati: lo stile di un giocatore vale solo nel suo riquadro e JavaScript non viene mai eseguito (script e attributi come `onclick` vengono tolti al salvataggio). Immagini e caratteri esterni si caricano solo da indirizzi `https://`, quindi i siti che li ospitano vedono l'indirizzo IP di chi apre la scheda.

## Strumenti dei Master (link "Master" in alto)

- **Esiti**: i giocatori chiedono il racconto di ciò che il personaggio fa fuori dalla chat. Il primo Master che risponde se ne occupa; può aggiungere una prova con difficoltà. Un Master non risponde agli esiti dei propri personaggi.
- **Giocate**: i giocatori registrano un tratto di chat (senza sussurri) e lo inviano ai Master, che lo rivedono, lasciano una nota e assegnano PX.
  - La registrazione parte dal **primo messaggio del personaggio** nella sua scena (la sua serie di messaggi più recente, senza pause oltre le 2 ore) e si può anticipare al massimo di **3 ore**, per includere l'apertura scritta da altri. Finisce un'ora dopo l'ultimo messaggio del personaggio. Durante o dopo una quest si può registrare anche tutta la quest.
- **Chat**: chi entra in un luogo vede solo i messaggi delle **ultime 3 ore**. Moderatori e amministratori vedono il pulsante «Carica messaggi precedenti» e possono risalire oltre.
  - I messaggi più vecchi di **30 giorni** si cancellano dal database (controllo ogni ora), tranne quelli delle quest ancora in corso. Le giocate registrate sono copie a parte e restano.
  - Ore visibili e giorni si cambiano in **Gestione → Impostazioni**, sezione *Chat* (0 giorni = mai).

## Social

- **Bacheche**: sezioni ON GAME e OFF GAME, in entrambe si scrive come personaggio (con il suo avatar); visibili a tutti, ai membri di una gilda o solo allo staff; si può riservare l'apertura di discussioni allo staff. Moderazione: nascondi, chiudi, metti in evidenza, elimina.
- **Gilde**: le crea lo staff (nascono con 4 gradi e una bacheca riservata). Ingresso libero, su candidatura o su invito. Il **livello** del grado decide la gerarchia: i capi agiscono solo su chi sta sotto.
- **Missive**: messaggi privati tra personaggi, ON o OFF game. Lo staff non le legge, salvo i singoli messaggi segnalati.
  - Ogni personaggio può **archiviarle** (fino a un massimo, di base 50) o **eliminarle** (una alla volta o selezionandone più insieme). Eliminare toglie la missiva solo a chi la elimina: se l'altro risponde, la conversazione ricompare con i soli messaggi nuovi.
  - Le missive **lette e non archiviate** si cancellano da sole dopo un certo numero di giorni dall'ultima lettura (di base 7). Quelle non lette o archiviate non si cancellano mai da sole.
  - Quando tutti i partecipanti hanno eliminato una conversazione, i messaggi vengono cancellati davvero dal database. Il controllo gira ogni ora.
  - Massimo dell'archivio e giorni si cambiano in **Gestione → Impostazioni**, sezione *Missive* (0 giorni = mai).

## Economia

- **Economia**: nome della valuta, denaro iniziale, percentuale di rivendita al mercato, ogni quante ore si ritira lo stipendio; **stipendi** dei gradi di gilda; **correzioni** del denaro di un personaggio (premi, multe) con motivo; consultazione dei movimenti di un personaggio.
- **Oggetti e mercato**: catalogo con immagine, categoria, dove si indossa, prezzo, pezzi disponibili (vuoto = illimitati), consumabile o no, bonus/malus nelle quest. Un oggetto che qualcuno possiede non si elimina: si **archivia**.
- Tutti i passaggi di denaro e oggetti sono protetti dal "doppio clic" e restano nei movimenti e nel registro attività.

## Pagine e temi

- **Pagine**: testo con formattazione semplice (`# Titolo`, `**grassetto**`, `*corsivo*`, `- elenco`, `[link](/pagine/guida)`), con anteprima. Si sceglie se mostrarle in fondo al sito e se sono leggibili senza account. L'HTML scritto a mano non viene eseguito.
- **Temi**: Taverna (scuro e caldo), Pergamena (chiaro), Neon (cyberpunk), Notte (blu). Il tema del sito si sceglie in Impostazioni; ogni giocatore può sceglierne un altro dal proprio account. Chi conosce il CSS può aggiungere regole nel campo **CSS personalizzato**.

## Moderazione

- In chat: "Nascondi" su ogni messaggio, effetto immediato per tutti.
- **Segnalazioni** (numero accanto a "Gestione"): ogni segnalazione ha una copia del testo com'era. Prendila in carico, poi chiudila scrivendo com'è stata gestita.
- **Account**: sospensione con data di fine e motivo.
- **Registro attività**: accessi, iscrizioni, modifiche dello staff, movimenti importanti, con data e indirizzo IP.

## Copie di sicurezza

Falle prima di ogni aggiornamento importante e prima di un'importazione. Dalla cartella del progetto (GitHub Desktop → Repository → Open in Command Prompt), con il gioco acceso:

```
docker compose exec db pg_dump -U gdr -d gdr -Fc -f /tmp/copia.dump
docker compose cp db:/tmp/copia.dump copia-gdr.dump
docker compose cp app:/app/uploads copia-immagini
```

Nella cartella del progetto compaiono il file `copia-gdr.dump` (il database) e la cartella `copia-immagini`. Conservali altrove (chiavetta, cloud).

Per **ripristinare** una copia (sostituisce tutti i dati attuali):

```
docker compose cp copia-gdr.dump db:/tmp/copia.dump
docker compose exec db pg_restore -U gdr -d gdr --clean --if-exists /tmp/copia.dump
docker compose cp copia-immagini/. app:/app/uploads
docker compose restart app
```

## Mettere il gioco online

Per aprirlo al pubblico serve un server (VPS) con Docker e un nome di dominio.

1. Sul server: copia il progetto e, in `docker-compose.yml`, cambia `ORIGIN` con l'indirizzo pubblico (es. `https://miogdr.it`) e le password del database (`POSTGRES_PASSWORD` e la stessa password dentro `DATABASE_URL`).
2. Metti davanti al gioco un server web con **HTTPS** (per esempio Caddy, che ottiene il certificato da solo) che inoltri le richieste alla porta 3000.
3. Avvia con `docker compose up -d --build` e programma una copia di sicurezza automatica ogni giorno.
