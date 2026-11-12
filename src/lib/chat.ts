import type { CheckResult } from './rules.ts';

/**
 * Logica della chat condivisa tra server e browser.
 * Nessun accesso al database qui: solo regole, così si possono testare facilmente.
 */

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_TAG_LENGTH = 40;
export const MAX_NPC_NAME_LENGTH = 40;

export type MessageKind = 'action' | 'whisper' | 'master' | 'npc' | 'dice' | 'check' | 'system' | 'item';

/** Tipi che il giocatore può scegliere dal menu. */
export type ChosenKind = 'action' | 'whisper' | 'master' | 'npc';

export const KIND_LABELS: Record<MessageKind, string> = {
	action: 'Azione',
	whisper: 'Sussurro',
	master: 'Master',
	npc: 'PNG',
	dice: 'Dado',
	check: 'Prova',
	system: 'Sistema',
	item: 'Oggetto'
};

/** Messaggio così come arriva al browser. */
export type ChatMessageView = {
	id: number;
	kind: MessageKind;
	characterId: number | null;
	characterName: string | null;
	/** Avatar del personaggio (assente nelle vecchie giocate salvate). */
	characterAvatar?: string | null;
	recipientName: string | null;
	recipientCharacterId: number | null;
	npcName: string | null;
	tag: string | null;
	body: string;
	meta: {
		dice?: DiceResult;
		check?: CheckResult;
		/** Oggetto usato o mostrato in chat. */
		item?: { id: number; name: string; description: string; consumed: boolean };
	} | null;
	questId: number | null;
	createdAt: string;
	hidden: boolean;
};

// ---------------------------------------------------------------------------
// Dialoghi evidenziati
// ---------------------------------------------------------------------------

export type Segment = { text: string; speech: boolean };

const SPEECH_PAIRS: Record<string, string> = { '«': '»', '"': '"', '“': '”', '<': '>' };

/**
 * Divide il testo in parti narrative e parti di dialogo.
 * Sono dialogo le parti tra «», "", “” o <> (le convenzioni più diffuse nei GDR).
 * Un'apertura senza chiusura resta testo normale.
 */
export function splitSpeech(text: string): Segment[] {
	const segments: Segment[] = [];
	let buffer = '';
	let i = 0;
	while (i < text.length) {
		const close = SPEECH_PAIRS[text[i]];
		if (close) {
			const end = text.indexOf(close, i + 1);
			if (end > i + 1) {
				if (buffer) segments.push({ text: buffer, speech: false });
				buffer = '';
				segments.push({ text: text.slice(i, end + 1), speech: true });
				i = end + 1;
				continue;
			}
		}
		buffer += text[i];
		i++;
	}
	if (buffer) segments.push({ text: buffer, speech: false });
	return segments;
}

// ---------------------------------------------------------------------------
// Dadi
// ---------------------------------------------------------------------------

export type DiceRoll = { count: number; faces: number; modifier: number };
export type DiceResult = DiceRoll & { rolls: number[]; total: number; expression: string };

export const MAX_DICE = 20;
export const MAX_FACES = 1000;

/** Riconosce espressioni come "d20", "2d6", "3d6+2", "1d100-5" (con o senza # davanti). */
export function parseDice(input: string): DiceRoll | null {
	const m = /^#?\s*(\d{0,2})\s*d\s*(\d{1,4})\s*(?:([+-])\s*(\d{1,3}))?\s*$/i.exec(input.trim());
	if (!m) return null;
	const count = m[1] ? Number(m[1]) : 1;
	const faces = Number(m[2]);
	const modifier = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0;
	if (count < 1 || count > MAX_DICE || faces < 2 || faces > MAX_FACES) return null;
	return { count, faces, modifier };
}

export function formatDiceExpression(roll: DiceRoll): string {
	const mod = roll.modifier ? (roll.modifier > 0 ? `+${roll.modifier}` : `${roll.modifier}`) : '';
	return `${roll.count}d${roll.faces}${mod}`;
}

/** Tira i dadi con il generatore di numeri casuali indicato (sul server: crypto). */
export function rollDice(roll: DiceRoll, random: (min: number, max: number) => number): DiceResult {
	const rolls = Array.from({ length: roll.count }, () => random(1, roll.faces));
	const total = rolls.reduce((a, b) => a + b, 0) + roll.modifier;
	return { ...roll, rolls, total, expression: formatDiceExpression(roll) };
}

// ---------------------------------------------------------------------------
// Interpretazione di ciò che scrive il giocatore
// ---------------------------------------------------------------------------

export type ChatInput = {
	text: string;
	kind: ChosenKind;
	tag?: string;
	npcName?: string;
	/** Destinatario scelto dal menu (per il tipo Sussurro). */
	recipient?: string;
};

export type ParsedMessage =
	| { kind: 'action' | 'master'; body: string; tag: string | null }
	| { kind: 'npc'; body: string; tag: string | null; npcName: string }
	| { kind: 'whisper'; body: string; recipient: string }
	| { kind: 'dice'; roll: DiceRoll; tag: string | null };

export type ParseError = { error: string };

function cleanTag(tag: string | undefined): string | null {
	const t = (tag ?? '').replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
	return t ? t.slice(0, MAX_TAG_LENGTH) : null;
}

/**
 * Trasforma l'input del giocatore in un messaggio, applicando le scorciatoie:
 *   @Nome@ testo  → sussurro a Nome
 *   #2d6          → tiro di dadi
 * I permessi (Master, PNG) si controllano dopo, sul server.
 */
export function parseChatInput(input: ChatInput): ParsedMessage | ParseError {
	const text = input.text.replace(/\r\n/g, '\n').trim();
	if (!text) return { error: 'Scrivi qualcosa prima di inviare.' };
	if (text.length > MAX_MESSAGE_LENGTH) {
		return { error: `Il messaggio è troppo lungo (massimo ${MAX_MESSAGE_LENGTH} caratteri).` };
	}
	const tag = cleanTag(input.tag);

	// Dadi
	if (text.startsWith('#')) {
		const roll = parseDice(text);
		if (!roll) {
			return {
				error: `Tiro non valido. Esempi: #d20, #2d6, #3d6+2 (al massimo ${MAX_DICE} dadi da ${MAX_FACES} facce).`
			};
		}
		return { kind: 'dice', roll, tag };
	}

	// Sussurro con la sintassi @Nome@
	const whisper = /^@([^@\n]{1,60})@\s*([\s\S]*)$/.exec(text);
	if (whisper) {
		const body = whisper[2].trim();
		if (!body) return { error: 'Il sussurro è vuoto.' };
		return { kind: 'whisper', recipient: whisper[1].trim(), body };
	}

	switch (input.kind) {
		case 'whisper': {
			const recipient = (input.recipient ?? '').trim();
			if (!recipient) return { error: 'Scegli a chi sussurrare, oppure scrivi @Nome@ prima del testo.' };
			return { kind: 'whisper', recipient, body: text };
		}
		case 'npc': {
			const npcName = (input.npcName ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NPC_NAME_LENGTH);
			if (!npcName) return { error: 'Indica il nome del PNG.' };
			return { kind: 'npc', npcName, body: text, tag };
		}
		case 'master':
			return { kind: 'master', body: text, tag };
		default:
			return { kind: 'action', body: text, tag };
	}
}

/** "3 min fa", "adesso", "2 h fa": per la turnazione. */
export function timeAgo(from: string | Date | null, now = Date.now()): string {
	if (!from) return 'non ha ancora scritto';
	const seconds = Math.max(0, Math.round((now - new Date(from).getTime()) / 1000));
	if (seconds < 45) return 'adesso';
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes} min fa`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours} h fa`;
	return `${Math.round(hours / 24)} g fa`;
}
