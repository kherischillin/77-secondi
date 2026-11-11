import { describe, expect, it } from 'vitest';
import { characterSchema, fieldErrors, registerSchema } from './validation';
import { safeRedirectTarget } from './redirect';

const validRegistration = {
	username: 'Eric_17',
	email: '  Eric@Example.COM ',
	password: 'una frase lunga',
	passwordConfirm: 'una frase lunga'
};

describe('registrazione', () => {
	it('accetta dati validi e normalizza l’email', () => {
		const r = registerSchema.safeParse(validRegistration);
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.email).toBe('eric@example.com');
	});

	it('rifiuta password diverse', () => {
		const r = registerSchema.safeParse({ ...validRegistration, passwordConfirm: 'altra cosa lunga' });
		expect(r.success).toBe(false);
		if (!r.success) expect(fieldErrors(r.error).passwordConfirm).toMatch(/coincidono/);
	});

	it('rifiuta password corte', () => {
		const r = registerSchema.safeParse({ ...validRegistration, password: 'corta', passwordConfirm: 'corta' });
		expect(r.success).toBe(false);
	});

	it('rifiuta nomi utente con caratteri strani', () => {
		const r = registerSchema.safeParse({ ...validRegistration, username: '<script>' });
		expect(r.success).toBe(false);
	});

	it('rifiuta email non valide', () => {
		const r = registerSchema.safeParse({ ...validRegistration, email: 'non-una-email' });
		expect(r.success).toBe(false);
	});
});

describe('personaggi', () => {
	it('accetta nomi con accenti, apostrofi e trattini', () => {
		const r = characterSchema.safeParse({ name: "Élodie  D'Arco", surname: 'Ferro-Nero', bio: '' });
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.name).toBe("Élodie D'Arco");
			expect(r.data.bio).toBeNull();
		}
	});

	it('cognome vuoto diventa null', () => {
		const r = characterSchema.safeParse({ name: 'Aldric', surname: '   ', bio: 'Un cavaliere.' });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.surname).toBeNull();
	});

	it('rifiuta numeri e simboli nel nome', () => {
		expect(characterSchema.safeParse({ name: 'Aldric99', surname: '', bio: '' }).success).toBe(false);
		expect(characterSchema.safeParse({ name: '<b>Aldric</b>', surname: '', bio: '' }).success).toBe(false);
		expect(characterSchema.safeParse({ name: "'Aldric", surname: '', bio: '' }).success).toBe(false);
	});
});

describe('redirect sicuri', () => {
	it('accetta percorsi interni', () => {
		expect(safeRedirectTarget('/gestione/utenti?q=a')).toBe('/gestione/utenti?q=a');
	});

	it('rifiuta siti esterni e trucchi', () => {
		expect(safeRedirectTarget('https://evil.com')).toBe('/account');
		expect(safeRedirectTarget('//evil.com')).toBe('/account');
		expect(safeRedirectTarget('/\\evil.com')).toBe('/account');
		expect(safeRedirectTarget(null)).toBe('/account');
	});
});
