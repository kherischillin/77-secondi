import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Password importate da GDRCD.
 *
 * GDRCD salva le password con phpass (formato "$P$..." portabile, basato su MD5 ripetuto);
 * le installazioni molto vecchie usavano un semplice MD5. Al primo accesso riuscito
 * la password viene riscritta con Argon2id e il vecchio formato sparisce.
 */

const ITOA64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Codifica base64 "alla phpass" (ordine dei caratteri e dei bit diverso dal base64 standard). */
function encode64(input: Buffer, count: number): string {
	let output = '';
	let i = 0;
	do {
		let value = input[i++];
		output += ITOA64[value & 0x3f];
		if (i < count) value |= input[i] << 8;
		output += ITOA64[(value >> 6) & 0x3f];
		if (i++ >= count) break;
		if (i < count) value |= input[i] << 16;
		output += ITOA64[(value >> 12) & 0x3f];
		if (i++ >= count) break;
		output += ITOA64[(value >> 18) & 0x3f];
	} while (i < count);
	return output;
}

const md5 = (data: Buffer) => createHash('md5').update(data).digest();

/** Ricalcola un hash phpass portabile con la stessa impostazione (sale e numero di giri). */
export function phpassCrypt(password: string, setting: string): string | null {
	const id = setting.slice(0, 3);
	if (id !== '$P$' && id !== '$H$') return null;
	const countLog2 = ITOA64.indexOf(setting[3]);
	if (countLog2 < 7 || countLog2 > 30) return null;
	const salt = setting.slice(4, 12);
	if (salt.length !== 8) return null;
	const pw = Buffer.from(password, 'utf8');
	let hash = md5(Buffer.concat([Buffer.from(salt, 'binary'), pw]));
	for (let count = 1 << countLog2; count > 0; count--) {
		hash = md5(Buffer.concat([hash, pw]));
	}
	return setting.slice(0, 12) + encode64(hash, 16);
}

function sameString(a: string, b: string) {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

/** È un hash nel formato di GDRCD (da riscrivere con Argon2 al primo accesso)? */
export function isLegacyHash(stored: string): boolean {
	return /^\$[PH]\$/.test(stored) || /^[a-f0-9]{32}$/i.test(stored);
}

export function verifyLegacyPassword(stored: string, password: string): boolean {
	if (/^\$[PH]\$/.test(stored)) {
		const computed = phpassCrypt(password, stored);
		return computed !== null && sameString(computed, stored);
	}
	if (/^[a-f0-9]{32}$/i.test(stored)) {
		return sameString(createHash('md5').update(password, 'utf8').digest('hex'), stored.toLowerCase());
	}
	return false;
}
