# Importare da GDRCD

L'importatore porta nel nuovo gioco i dati di un sito **GDRCD 5.x**. Si usa da **Gestione → Importa da GDRCD** (permesso "Importare i dati da un vecchio gioco GDRCD", che l'Amministratore ha già).

## 1. Esporta il vecchio database

1. Nel pannello del vecchio hosting apri **phpMyAdmin** e seleziona il database di GDRCD.
2. Clicca **Esporta**, formato **SQL**, metodo **Rapido**, e scarica il file.
3. Se il file supera i 60 MB, scegli il metodo **Personalizzato** e togli la tabella `chat` (la cronologia della chat non viene importata comunque). Puoi anche comprimere il file in `.gz`.

Vanno bene anche i file prodotti da `mysqldump` o Adminer.

## 2. Prepara il nuovo gioco

- Fai una [copia di sicurezza](guida-staff.md#copie-di-sicurezza).
- L'ideale è importare in un gioco appena installato, dove ci sei solo tu come Amministratore. Puoi importare anche in un gioco già avviato: i personaggi con un nome già presente vengono saltati, così come le gilde con lo stesso nome.

## 3. Anteprima e importazione

1. Carica il file.
2. Controlla i **nomi delle 6 caratteristiche** (car0…car5): devono essere quelli del vecchio `config.inc.php` (`$PARAMETERS['names']['stats']`). Se nel nuovo gioco esiste già una caratteristica con lo stesso nome, viene riusata.
3. Controlla i **PX per rango** (`px_x_rank` nel vecchio `config.inc.php`, di solito 10): servono a calcolare i PX già spesi in abilità, come faceva GDRCD.
4. Clicca **Analizza**: l'importazione viene eseguita per intero e poi annullata, e vedi esattamente cosa verrà importato e gli avvisi.
5. Clicca **Conferma e importa**. Tutto avviene in un'unica operazione: se qualcosa va storto non viene salvato nulla.

## Cosa viene importato

| GDRCD | Nuovo gioco |
|---|---|
| `personaggio` | Un account e un personaggio per ogni riga: nome, cognome, descrizione (aspetto), affetti (carattere), storia (background), caratteristiche, PX, contanti e banca, data di iscrizione, esilio (diventa una sospensione). |
| Password (`pass`) | La vecchia password funziona: al primo accesso viene convertita in Argon2. |
| `permessi` | 2 = Master, 3 = Moderatore, 4 = Amministratore. |
| `abilita`, `clgpersonaggioabilita` | Abilità (legate alla caratteristica) e ranghi. |
| `mappa_click`, `mappa` | Mappe e luoghi, con la posizione convertita in percentuale, stanze private e costo. |
| `gilda`, `ruolo`, `clgpersonaggioruolo` | Gilde, gradi (il capo in cima, poi per stipendio) con stipendi, membri con il grado più alto. |
| `oggetto`, `codtipooggetto`, `mercato`, `clgpersonaggiooggetto` | Catalogo (con bonus alle caratteristiche e posizione), mercato con le scorte, inventari (gli oggetti "in mano/addosso" risultano indossati). |
| `araldo`, `messaggioaraldo` | Bacheche, discussioni e risposte (in evidenza e chiuse comprese). |
| `messaggi` | Missive, raggruppate in conversazioni per coppia di personaggi e tipo ON/OFF; segnate come già lette. |
| `regolamento`, `ambientazione` | Sostituiscono le pagine Regolamento e Ambientazione (se l'opzione è attiva). |

I testi vengono ripuliti dall'HTML (gli a capo restano) e i caratteri accentati "rovinati" (es. `Ã¨` al posto di `è`) vengono corretti.

## Cosa non viene importato

- **Email**: GDRCD le salvava cifrate, quindi non si possono recuperare. Al primo accesso a ogni giocatore viene chiesto di aggiungere la propria email.
- **Immagini** di mappe, luoghi, oggetti, avatar: erano file sul vecchio server o link esterni. Ricarica le immagini di mappe e luoghi da Gestione → Mappe e luoghi e controlla la posizione dei luoghi.
- **Razze**: non esistono nel nuovo gioco. Le bacheche riservate a una razza diventano visibili solo allo staff.
- **"Lavori"** (ruoli senza gilda): puoi ricrearli come gilde con stipendio.
- Cronologia della **chat**, esiti, diari, mostrine, log.

## Come entrano i giocatori

Con il **nome del personaggio** (oppure il nome utente mostrato nel resoconto, se il nome conteneva spazi o accenti) e la **vecchia password**. Se un account non aveva una password valida, l'Amministratore può sistemarlo da Gestione → Account.
