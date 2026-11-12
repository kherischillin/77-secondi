import { describe, expect, it } from 'vitest';
import { isLegacyHash, verifyLegacyPassword } from './legacy-password.ts';

// Hash generati con includes/PasswordHash.php di GDRCD (PasswordHash(8, true)).
const VECTORS: [string, string][] = [
	['segreto123', '$P$BLQQ84bfb2VKcIy0bsSpsieJxZlH970'],
	['Àccentata €', '$P$BEpELJv0AfyCeWmhPc2KRXtwOAX9lM1'],
	['x', '$P$Bhwisal1ovZR/oJKhhtLe4DParF2vw0']
];

describe('password importate da GDRCD', () => {
	it('riconosce i formati', () => {
		expect(isLegacyHash('$P$BLQQ84bfb2VKcIy0bsSpsieJxZlH970')).toBe(true);
		expect(isLegacyHash('5f4dcc3b5aa765d61d8327deb882cf99')).toBe(true);
		expect(isLegacyHash('$argon2id$v=19$m=19456,t=2,p=1$abc')).toBe(false);
	});
	it('phpass: password giusta', () => {
		for (const [pw, hash] of VECTORS) expect(verifyLegacyPassword(hash, pw)).toBe(true);
	});
	it('phpass: password sbagliata', () => {
		for (const [pw, hash] of VECTORS) expect(verifyLegacyPassword(hash, pw + '!')).toBe(false);
		expect(verifyLegacyPassword('$P$Bcorrotto', 'x')).toBe(false);
	});
	it('md5 delle versioni più vecchie', () => {
		expect(verifyLegacyPassword('5f4dcc3b5aa765d61d8327deb882cf99', 'password')).toBe(true);
		expect(verifyLegacyPassword('5F4DCC3B5AA765D61D8327DEB882CF99', 'password')).toBe(true);
		expect(verifyLegacyPassword('5f4dcc3b5aa765d61d8327deb882cf99', 'Password')).toBe(false);
	});
});
