import { asc, eq } from 'drizzle-orm';
import { db, schema } from './db/index.ts';

/** Pagine informative modificabili dallo staff (Guida, Regolamento, Ambientazione...). */

export async function listPages() {
	return db.select().from(schema.pages).orderBy(asc(schema.pages.sortOrder), asc(schema.pages.title));
}

export async function getPageBySlug(slug: string) {
	const [p] = await db.select().from(schema.pages).where(eq(schema.pages.slug, slug));
	return p ?? null;
}

export async function getPage(id: number) {
	if (!Number.isInteger(id) || id <= 0) return null;
	const [p] = await db.select().from(schema.pages).where(eq(schema.pages.id, id));
	return p ?? null;
}

/** Link in fondo a ogni pagina (solo quelle visibili a chi guarda). */
export async function footerPages(loggedIn: boolean) {
	const rows = await db
		.select({ slug: schema.pages.slug, title: schema.pages.title, isPublic: schema.pages.isPublic })
		.from(schema.pages)
		.where(eq(schema.pages.inFooter, true))
		.orderBy(asc(schema.pages.sortOrder), asc(schema.pages.title));
	return rows.filter((r) => loggedIn || r.isPublic).map(({ slug, title }) => ({ slug, title }));
}

const GUIDA = `Benvenuto! Questa è una land di **gioco di ruolo testuale** (play by chat): si scrive insieme una storia, ognuno interpretando il proprio personaggio, nei luoghi del mondo di gioco.

# Primi passi
1. Crea il tuo account e poi il tuo **personaggio** (puoi averne più di uno).
2. Completa la **scheda**: dati anagrafici, presta-volto (con un link a un'immagine), aspetto, carattere, storia e uno spazio OFF Game tutto tuo. L'aspetto è ciò che gli altri vedono in gioco. Puoi scrivere testo semplice o personalizzare le sezioni con HTML e CSS (niente JavaScript).
3. Distribuisci i punti iniziali di caratteristiche e abilità (servono solo nelle quest).
4. Dalla **mappa** entra in un luogo e comincia a giocare.

# ON GAME e OFF GAME
- **ON GAME** è ciò che accade ai personaggi nel mondo di gioco.
- **OFF GAME** è ciò che riguarda i giocatori (organizzazione, domande, chiacchiere).
- Quello che sai tu come giocatore non lo sa automaticamente il tuo personaggio: usarlo in gioco si chiama *metagame* ed è scorretto.

# Scrivere in chat
Ogni intervento descrive cosa fa il personaggio, **in terza persona**. I dialoghi vanno tra «virgolette» o "doppi apici" e vengono evidenziati.
- Descrivi il **tentativo**, mai l'esito sugli altri: "Bran prova a colpire Selene", non "Bran colpisce Selene" (niente azioni auto-conclusive).
- Rispetta la **turnazione**: nell'elenco dei presenti vedi chi ha scritto e quando.
- Un **tag di posizione** (es. TAVOLO VERDE) indica dove si trova il personaggio dentro il luogo.
- **Sussurro**: \`@Nome@ testo\` manda un messaggio privato a chi è presente.
- **Dadi** (solo nelle quest, se non diversamente stabilito): \`#2d6\`, \`#1d20+3\`.

# Gioco libero e quest
Il sistema è **ibrido**:
- nel gioco libero si gioca **descrittivo**, senza numeri;
- durante una **quest**, guidata da un Master, valgono le regole numeriche: le **prove** si tirano dal pannello sotto la chat e sommano dado, caratteristica, abilità e bonus degli oggetti indossati.
Le stringhe del Master sono vincolanti. Alla fine della quest il Master assegna i **punti esperienza**, che si spendono nella scheda per migliorare il personaggio.

# Esiti e giocate
- **Esiti**: per ciò che il personaggio fa fuori dalla chat (un'indagine, un viaggio, un lavoro) chiedi a un Master di raccontarne il risultato.
- **Giocate**: in ogni luogo puoi registrare una giocata (senza sussurri), scaricarla, renderla pubblica o inviarla ai Master per la revisione.

# Missive, bacheche e gilde
- **Missive**: messaggi privati tra personaggi, segnati ON o OFF game.
- **Bacheche**: le ON GAME si scrivono come personaggio, le OFF GAME come giocatore.
- **Gilde**: gruppi organizzati con gradi, statuto e una bacheca riservata.

# Denaro, oggetti e stanze private
- **Banca**: contanti, conto, bonifici e stipendi di gilda.
- **Mercato** e **Inventario**: compra, rivendi, indossa (ciò che indossi si vede nella scheda) e usa gli oggetti anche in chat.
- **Stanze private**: si prenotano a ore e si invitano altri personaggi.

# Segnalazioni
Se qualcosa non va, usa il pulsante **Segnala** su un messaggio, un post o una scheda: lo staff lo riceve con una copia del testo.`;

const REGOLAMENTO = `Questo è il regolamento della land. Lo staff lo deve completare: qui sotto ci sono le scelte che ogni gioco di ruolo dovrebbe dichiarare in modo esplicito.

# Comportamento
- Rispetto per tutti, in gioco e fuori.
- Niente contenuti offensivi, discriminatori o espliciti fuori dalle regole della land.
- Lo staff può nascondere messaggi, sospendere account e decidere sui casi non previsti.

# Scelte di gioco
- **Sistema di gioco**: ibrido, descrittivo nel gioco libero e numerico nelle quest.
- **Turnazione**: (da scegliere) rigida per presenza in chat, oppure per gruppi che interagiscono tra loro.
- **Pensieri nelle azioni**: (da scegliere) ammessi, richiesti oppure da limitare.
- **Background**: (da scegliere) pubblico, oppure "in scuro", visibile solo al giocatore e allo staff.
- **Metagame**: è vietato usare in gioco informazioni ottenute fuori dal gioco. Le conoscenze comuni della gilda si considerano note a tutti i membri.
- **Morte dei personaggi**: va costruita in gioco e decisa dal Master, mai imposta da un altro giocatore.

# Comportamenti vietati
- **Power play**: azioni auto-conclusive, personaggi invincibili, cavilli per non perdere mai.
- **Player killing**: giocare solo per eliminare altri personaggi.
- **Metaplay**: portare in gioco informazioni non ottenute giocando.

# Sanzioni
Avvertimento, nascondimento dei messaggi, sospensione temporanea o definitiva dell'account (esilio).`;

const AMBIENTAZIONE = `Qui lo staff racconta il mondo di gioco: storia, luoghi, società, tecnologia o magia, popoli e conflitti.

# Il mondo
(Da scrivere.)

# Luoghi principali
(Da scrivere.)

# Fazioni e gilde
(Da scrivere.)`;

/** Al primo avvio crea Guida, Regolamento e Ambientazione (una volta sola). */
export async function seedPages() {
	const [done] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'pagesSeeded'));
	if (done) return;
	await db
		.insert(schema.pages)
		.values([
			{ slug: 'guida', title: 'Guida al gioco', body: GUIDA, sortOrder: 1 },
			{ slug: 'regolamento', title: 'Regolamento', body: REGOLAMENTO, sortOrder: 2 },
			{ slug: 'ambientazione', title: 'Ambientazione', body: AMBIENTAZIONE, sortOrder: 3 }
		])
		.onConflictDoNothing();
	await db.insert(schema.settings).values({ key: 'pagesSeeded', value: true }).onConflictDoNothing();
}
