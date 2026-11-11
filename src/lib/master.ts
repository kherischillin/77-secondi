/**
 * Logica degli strumenti per i Master (esiti, giocate, segnalazioni).
 * Funzioni pure, testate, usate dal server e dall'interfaccia.
 */
import { z } from 'zod';
import { splitSpeech, type ChatMessageView } from './chat.ts';
import type { CheckResult } from './rules.ts';

// ---------------------------------------------------------------------------
// Esiti
// ---------------------------------------------------------------------------

export type EsitoCheck = CheckResult & { difficulty: number | null; outcome: 'success' | 'failure' | null };

/** Confronta il totale con la difficoltà scelta dal Master (se c'è). */
export function judgeCheck(check: CheckResult, difficulty: number | null): EsitoCheck {
	return {
		...check,
		difficulty,
		outcome: difficulty === null ? null : check.total >= difficulty ? 'success' : 'failure'
	};
}

export const newEsitoSchema = z.object({
	title: z.string().trim().min(3, 'Dai un titolo alla richiesta (almeno 3 caratteri).').max(120, 'Titolo troppo lungo.'),
	body: z.string().trim().min(10, 'Descrivi cosa fa il personaggio (almeno 10 caratteri).').max(10000, 'Testo troppo lungo.'),
	offNote: z.string().trim().max(3000, 'Note troppo lunghe.')
});

export const esitoReplySchema = z
	.object({
		body: z.string().trim().max(10000, 'Testo troppo lungo.'),
		offNote: z.string().trim().max(3000, 'Note troppo lunghe.')
	})
	.refine((v) => v.body.length > 0 || v.offNote.length > 0, { message: 'Scrivi qualcosa: un racconto o una nota.' });

// ---------------------------------------------------------------------------
// Giocate
// ---------------------------------------------------------------------------

/** Tipi di messaggio che entrano in una giocata: niente sussurri (privati) né messaggi di sistema... */
const KEPT: ChatMessageView['kind'][] = ['action', 'master', 'npc', 'dice', 'check', 'system'];

/** Messaggi da salvare: esclusi i sussurri (sono privati) e i messaggi nascosti dai moderatori. */
export function giocataMessages(messages: ChatMessageView[]): ChatMessageView[] {
	return messages.filter((m) => KEPT.includes(m.kind) && !m.hidden);
}

/** Partecipanti: chi ha scritto azioni, prove o dadi; i Master sono elencati a parte. */
export function giocataParticipants(messages: ChatMessageView[]) {
	const players = new Map<number, string>();
	const masters = new Map<number, string>();
	for (const m of messages) {
		if (!m.characterId || !m.characterName) continue;
		if (m.kind === 'action' || m.kind === 'check' || m.kind === 'dice') players.set(m.characterId, m.characterName);
		else if (m.kind === 'master' || m.kind === 'npc') masters.set(m.characterId, m.characterName);
	}
	for (const id of players.keys()) masters.delete(id);
	return {
		players: [...players].map(([id, name]) => ({ id, name })),
		masters: [...masters].map(([id, name]) => ({ id, name }))
	};
}

export const giocataSchema = z.object({
	title: z.string().trim().min(3, 'Dai un titolo alla giocata (almeno 3 caratteri).').max(120),
	isPublic: z.boolean()
});

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function lineHtml(m: ChatMessageView): string {
	const time = new Date(m.createdAt).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
	const tag = m.tag ? `<span class="tag">[${escapeHtml(m.tag)}]</span> ` : '';
	const body = splitSpeech(m.body)
		.map((s) => (s.speech ? `<q>${escapeHtml(s.text)}</q>` : escapeHtml(s.text)))
		.join('');
	let who: string;
	switch (m.kind) {
		case 'master':
			who = '<strong class="master">MASTER</strong>';
			break;
		case 'npc':
			who = `<strong>${escapeHtml(m.npcName ?? 'PNG')}</strong> <small>(PNG)</small>`;
			break;
		case 'system':
			who = '<strong class="system">QUEST</strong>';
			break;
		default:
			who = `<strong>${escapeHtml(m.characterName ?? 'Qualcuno')}</strong>`;
	}
	return `<div class="line ${m.kind}"><span class="time">${time}</span> ${tag}${who}: <span class="body">${body}</span></div>`;
}

/** Pagina HTML autonoma della giocata, da scaricare e conservare. Tutto il testo è "escapato". */
export function renderGiocataHtml(g: { title: string; locationName: string; fromAt: string; toAt: string; messages: ChatMessageView[]; siteName: string }) {
	const date = (d: string) => new Date(d).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' });
	return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(g.title)}</title>
<style>
body{font-family:Georgia,serif;max-width:820px;margin:2rem auto;padding:0 1rem;background:#f7f2e8;color:#2a241c;line-height:1.6}
h1{margin-bottom:.2rem}.meta{color:#6b5f4f;margin-top:0}
.line{padding:.4rem .6rem;border-left:3px solid transparent;margin:.2rem 0;white-space:pre-wrap}
.time{color:#8a7d6b;font-size:.85em}.tag{color:#6a4c93;font-weight:bold}
q{quotes:none;font-style:italic;color:#7a4b12}
.master{color:#a02c2c}.line.master{border-color:#a02c2c;background:#f3e2df}
.line.npc{border-color:#4f7a48}.line.system{border-color:#6a4c93;text-align:center;background:#ece6f3}
.line.check,.line.dice{border-color:#b8862e}
</style></head><body>
<h1>${escapeHtml(g.title)}</h1>
<p class="meta">${escapeHtml(g.locationName)} · dal ${date(g.fromAt)} al ${date(g.toAt)} · ${escapeHtml(g.siteName)}</p>
${g.messages.map(lineHtml).join('\n')}
</body></html>`;
}

// ---------------------------------------------------------------------------
// Segnalazioni
// ---------------------------------------------------------------------------

export const REPORT_TARGETS = ['chat_message', 'board_post', 'private_message', 'character'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
	chat_message: 'Messaggio in chat',
	board_post: 'Messaggio in bacheca',
	private_message: 'Missiva',
	character: 'Scheda del personaggio'
};

export const reportSchema = z.object({
	targetType: z.enum(REPORT_TARGETS),
	targetId: z.coerce.number().int().positive(),
	reason: z.string().trim().min(5, 'Spiega in breve il motivo (almeno 5 caratteri).').max(1000, 'Motivo troppo lungo.')
});

export const REPORT_STATUS_LABELS = { open: 'Da gestire', in_progress: 'In gestione', closed: 'Chiusa' } as const;
