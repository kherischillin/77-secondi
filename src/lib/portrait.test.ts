import { describe, expect, it } from 'vitest';
import { checkPortraitUrl, hostAllowed, isPortraitLink, parseHostList } from './portrait.ts';
import { profileRows, readProfile } from './profile.ts';

const hosts = ['i.imgur.com', '*.example.it'];

describe('presta-volto da link', () => {
	it('accetta solo HTTPS dai siti ammessi', () => {
		expect(checkPortraitUrl('https://i.imgur.com/abc.png', hosts)).toEqual({ ok: true, url: 'https://i.imgur.com/abc.png' });
		expect(checkPortraitUrl('http://i.imgur.com/abc.png', hosts).ok).toBe(false);
		expect(checkPortraitUrl('https://evil.com/abc.png', hosts).ok).toBe(false);
		expect(checkPortraitUrl('javascript:alert(1)', hosts).ok).toBe(false);
		expect(checkPortraitUrl('non è un link', hosts).ok).toBe(false);
	});
	it('rifiuta credenziali, porte e trucchi sul nome del sito', () => {
		expect(checkPortraitUrl('https://user:pw@i.imgur.com/a.png', hosts).ok).toBe(false);
		expect(checkPortraitUrl('https://i.imgur.com:8443/a.png', hosts).ok).toBe(false);
		expect(checkPortraitUrl('https://i.imgur.com.evil.com/a.png', hosts).ok).toBe(false);
		expect(checkPortraitUrl('https://evil.com/?https://i.imgur.com/a.png', hosts).ok).toBe(false);
	});
	it('*.sito ammette i sottodomini ma non siti simili', () => {
		expect(hostAllowed('cdn.example.it', hosts)).toBe(true);
		expect(hostAllowed('a.b.example.it', hosts)).toBe(true);
		expect(hostAllowed('badexample.it', hosts)).toBe(false);
	});
	it("legge l'elenco dei siti dall'impostazione", () => {
		expect(parseHostList('i.imgur.com\nhttps://I.IBB.co/x, *.example.it ; boh!')).toEqual({
			hosts: ['i.imgur.com', 'i.ibb.co', '*.example.it'],
			invalid: ['boh!']
		});
	});
	it('distingue link e vecchi file caricati', () => {
		expect(isPortraitLink('https://i.imgur.com/a.png')).toBe(true);
		expect(isPortraitLink('a1b2c3.webp')).toBe(false);
	});
});

describe('dati anagrafici', () => {
	it('tiene solo i campi compilati, nel loro ordine', () => {
		const form = new FormData();
		form.set('profile_height', '  1,82   m ');
		form.set('profile_age', '34');
		form.set('profile_weight', '');
		const r = readProfile(form);
		expect(r.success && r.data).toEqual({ age: '34', height: '1,82 m' });
		expect(profileRows({ height: '1,82 m', age: '34', ignoto: 'x' }).map((x) => x.label)).toEqual(['Età', 'Altezza']);
	});
	it('limita la lunghezza', () => {
		const form = new FormData();
		form.set('profile_age', 'x'.repeat(61));
		expect(readProfile(form).success).toBe(false);
	});
});
