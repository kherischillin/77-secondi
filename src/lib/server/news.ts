import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from './db/index.ts';
import { renderMarkup } from '../markup.ts';
import { sortNews, type NewsForm } from '../home.ts';

/** News della pagina iniziale. */

export async function listNews(opts: { publishedOnly: boolean; limit?: number }) {
	const rows = await db
		.select()
		.from(schema.news)
		.where(opts.publishedOnly ? eq(schema.news.isPublished, true) : undefined)
		.orderBy(desc(schema.news.isPinned), desc(schema.news.createdAt), desc(schema.news.id))
		.limit(opts.limit ?? 500);
	return sortNews(rows);
}

/** Per la pagina pubblica: testo già reso sicuro da renderMarkup. */
export function toNewsView(n: typeof schema.news.$inferSelect) {
	return { id: n.id, title: n.title, summary: n.summary, html: n.body ? renderMarkup(n.body) : '', isPinned: n.isPinned, createdAt: n.createdAt.toISOString() };
}

export async function getNews(id: number) {
	if (!Number.isInteger(id) || id <= 0) return null;
	const [n] = await db.select().from(schema.news).where(eq(schema.news.id, id));
	return n ?? null;
}

export async function createNews(data: NewsForm, authorUserId: number | null) {
	const [n] = await db.insert(schema.news).values({ ...data, authorUserId }).returning();
	return n;
}

export async function updateNews(id: number, data: NewsForm) {
	const [n] = await db.update(schema.news).set({ ...data, updatedAt: new Date() }).where(eq(schema.news.id, id)).returning();
	return n ?? null;
}

export async function deleteNews(id: number) {
	const [n] = await db.delete(schema.news).where(and(eq(schema.news.id, id))).returning();
	return n ?? null;
}

/** Al primo avvio: qualche news iniziale, perché il pannello non sia vuoto (una volta sola). */
export async function seedNews() {
	const [done] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'newsSeeded'));
	if (done) return;
	const [any] = await db.select({ id: schema.news.id }).from(schema.news).limit(1);
	if (!any) {
		const items: (NewsForm & { createdAt: Date })[] = [
			{
				title: 'Le gilde aprono le candidature',
				summary: 'Residui, Aldecaldos, Maelstrom e il Programma di rientro Arasaka cercano Portatori.',
				body: 'Dalla pagina **Gilde** (menu Uffici) puoi leggere la storia di ogni fazione e candidarti. Chi entra in una gilda lascia il lavoro libero e riceve lo stipendio del suo grado.',
				isPublished: true,
				isPinned: false,
				createdAt: new Date(Date.now() - 2 * 3600_000)
			},
			{
				title: 'Night City si allarga: undici distretti',
				summary: 'Da Watson alle Badlands, ogni distretto ha i suoi luoghi da esplorare.',
				body: 'Dalla **Mappa** clicca un distretto per entrarci: i luoghi hanno il nome accanto al puntino e l’elenco a fianco si può cercare per nome.',
				isPublished: true,
				isPinned: false,
				createdAt: new Date(Date.now() - 3600_000)
			},
			{
				title: 'Il Settantasette apre le porte',
				summary: 'Benvenuti, Portatori: il gioco è aperto.',
				body: 'Prima di iscriverti leggi la **Guida** e il **Regolamento** (in fondo alla pagina). Per qualsiasi dubbio scrivi allo staff con una missiva OFF game.',
				isPublished: true,
				isPinned: true,
				createdAt: new Date()
			}
		];
		await db.insert(schema.news).values(items);
	}
	await db.insert(schema.settings).values({ key: 'newsSeeded', value: true }).onConflictDoNothing();
}
