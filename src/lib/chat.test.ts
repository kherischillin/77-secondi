import { describe, expect, it } from 'vitest';
import { parseChatInput, parseDice, rollDice, splitSpeech, timeAgo } from './chat';

describe('dialoghi evidenziati', () => {
	it('separa narrazione e dialogo con «»', () => {
		expect(splitSpeech('Si volta. «Chi va là?» Stringe la spada.')).toEqual([
			{ text: 'Si volta. ', speech: false },
			{ text: '«Chi va là?»', speech: true },
			{ text: ' Stringe la spada.', speech: false }
		]);
	});

	it('riconosce anche "", “” e <>', () => {
		expect(splitSpeech('"Ciao" e <Addio>').filter((s) => s.speech).map((s) => s.text)).toEqual([
			'"Ciao"',
			'<Addio>'
		]);
		expect(splitSpeech('“Sì”')[0].speech).toBe(true);
	});

	it('lascia normale un’apertura senza chiusura', () => {
		expect(splitSpeech('3 < 5 e basta')).toEqual([{ text: '3 < 5 e basta', speech: false }]);
	});
});

describe('dadi', () => {
	it('interpreta le espressioni comuni', () => {
		expect(parseDice('#d20')).toEqual({ count: 1, faces: 20, modifier: 0 });
		expect(parseDice('2d6')).toEqual({ count: 2, faces: 6, modifier: 0 });
		expect(parseDice('#3d6+2')).toEqual({ count: 3, faces: 6, modifier: 2 });
		expect(parseDice('#1d100 - 5')).toEqual({ count: 1, faces: 100, modifier: -5 });
	});

	it('rifiuta tiri assurdi', () => {
		expect(parseDice('#0d6')).toBeNull();
		expect(parseDice('#99d6')).toBeNull();
		expect(parseDice('#2d1')).toBeNull();
		expect(parseDice('#2d99999')).toBeNull();
		expect(parseDice('#ciao')).toBeNull();
	});

	it('somma i risultati e il modificatore', () => {
		const values = [4, 6];
		const result = rollDice({ count: 2, faces: 6, modifier: 1 }, () => values.shift()!);
		expect(result).toMatchObject({ rolls: [4, 6], total: 11, expression: '2d6+1' });
	});
});

describe('interpretazione dell’input', () => {
	it('azione di default con tag pulito', () => {
		expect(parseChatInput({ text: '  Entra nella locanda. ', kind: 'action', tag: '[tavolo verde]' })).toEqual({
			kind: 'action',
			body: 'Entra nella locanda.',
			tag: 'TAVOLO VERDE'
		});
	});

	it('sussurro con @Nome@ vince sul tipo scelto', () => {
		expect(parseChatInput({ text: '@Mara@ ci vediamo fuori', kind: 'action' })).toEqual({
			kind: 'whisper',
			recipient: 'Mara',
			body: 'ci vediamo fuori'
		});
	});

	it('sussurro dal menu richiede un destinatario', () => {
		expect(parseChatInput({ text: 'psst', kind: 'whisper' })).toHaveProperty('error');
		expect(parseChatInput({ text: 'psst', kind: 'whisper', recipient: 'Mara' })).toMatchObject({
			kind: 'whisper',
			recipient: 'Mara'
		});
	});

	it('dadi con #', () => {
		expect(parseChatInput({ text: '#2d6', kind: 'action' })).toMatchObject({ kind: 'dice' });
		expect(parseChatInput({ text: '#2x6', kind: 'action' })).toHaveProperty('error');
	});

	it('PNG richiede il nome', () => {
		expect(parseChatInput({ text: 'Benvenuti!', kind: 'npc' })).toHaveProperty('error');
		expect(parseChatInput({ text: 'Benvenuti!', kind: 'npc', npcName: 'Oste' })).toMatchObject({
			kind: 'npc',
			npcName: 'Oste'
		});
	});

	it('rifiuta messaggi vuoti o troppo lunghi', () => {
		expect(parseChatInput({ text: '   ', kind: 'action' })).toHaveProperty('error');
		expect(parseChatInput({ text: 'a'.repeat(4001), kind: 'action' })).toHaveProperty('error');
	});
});

describe('turnazione', () => {
	it('descrive il tempo trascorso', () => {
		const now = Date.parse('2026-01-01T12:00:00Z');
		expect(timeAgo('2026-01-01T11:59:50Z', now)).toBe('adesso');
		expect(timeAgo('2026-01-01T11:55:00Z', now)).toBe('5 min fa');
		expect(timeAgo('2026-01-01T09:00:00Z', now)).toBe('3 h fa');
		expect(timeAgo(null, now)).toBe('non ha ancora scritto');
	});
});
