import { describe, expect, it } from 'vitest';
import { giocataMessages, giocataParticipants, judgeCheck, renderGiocataHtml, reportSchema } from './master';
import type { ChatMessageView } from './chat';

const msg = (over: Partial<ChatMessageView>): ChatMessageView => ({
	id: 1,
	kind: 'action',
	characterId: 1,
	characterName: 'Selene',
	recipientName: null,
	recipientCharacterId: null,
	npcName: null,
	tag: null,
	body: 'testo',
	meta: null,
	createdAt: '2026-01-01T20:00:00Z',
	hidden: false,
	questId: null,
	...over
});

describe('prove degli esiti', () => {
	const check = { die: 20, roll: 10, stat: { name: 'Destrezza', value: 5 }, skill: null, total: 15, natural: null };
	it('successo se il totale raggiunge la difficoltà', () => {
		expect(judgeCheck(check, 15).outcome).toBe('success');
		expect(judgeCheck(check, 16).outcome).toBe('failure');
	});
	it('senza difficoltà non c’è giudizio', () => {
		expect(judgeCheck(check, null).outcome).toBeNull();
	});
});

describe('giocate', () => {
	const messages = [
		msg({ id: 1, characterId: 1, characterName: 'Selene' }),
		msg({ id: 2, kind: 'whisper', characterId: 2, characterName: 'Bran', body: 'segreto' }),
		msg({ id: 3, kind: 'master', characterId: 3, characterName: 'Aldric' }),
		msg({ id: 4, characterId: 2, characterName: 'Bran', hidden: true }),
		msg({ id: 5, kind: 'check', characterId: 2, characterName: 'Bran' }),
		msg({ id: 6, kind: 'npc', characterId: 3, characterName: 'Aldric', npcName: 'Oste' })
	];

	it('esclude sussurri e messaggi nascosti', () => {
		expect(giocataMessages(messages).map((m) => m.id)).toEqual([1, 3, 5, 6]);
	});

	it('distingue giocatori e Master', () => {
		expect(giocataParticipants(giocataMessages(messages))).toEqual({
			players: [
				{ id: 1, name: 'Selene' },
				{ id: 2, name: 'Bran' }
			],
			masters: [{ id: 3, name: 'Aldric' }]
		});
	});

	it('chi gioca e fa anche il PNG resta tra i giocatori', () => {
		const p = giocataParticipants([msg({ id: 1, characterId: 1 }), msg({ id: 2, kind: 'npc', characterId: 1 })]);
		expect(p.masters).toEqual([]);
	});

	it('l’HTML esportato non esegue codice inserito nei messaggi', () => {
		const html = renderGiocataHtml({
			title: '<script>alert(1)</script>',
			locationName: 'Locanda',
			fromAt: '2026-01-01T20:00:00Z',
			toAt: '2026-01-01T21:00:00Z',
			siteName: 'GDR',
			messages: [msg({ body: '«Ciao» <img src=x onerror=alert(1)>' })]
		});
		expect(html).not.toContain('<script>alert');
		expect(html).not.toContain('<img');
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('<q>«Ciao»</q>');
	});
});

describe('segnalazioni', () => {
	it('valida tipo e motivo', () => {
		expect(reportSchema.safeParse({ targetType: 'chat_message', targetId: '5', reason: 'Linguaggio offensivo' }).success).toBe(true);
		expect(reportSchema.safeParse({ targetType: 'chat_message', targetId: '5', reason: 'no' }).success).toBe(false);
		expect(reportSchema.safeParse({ targetType: 'utenti', targetId: '5', reason: 'motivo valido' }).success).toBe(false);
	});
});
