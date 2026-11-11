import { describe, expect, it } from 'vitest';
import { ALL_CAPABILITIES, hasCapability, isCapability, normalizeCapabilities } from './permissions';
import { canActOnUser, canAssignRole, isSubset } from './server/admin-rules';

describe('catalogo capacità', () => {
	it('non contiene duplicati', () => {
		expect(new Set(ALL_CAPABILITIES).size).toBe(ALL_CAPABILITIES.length);
	});

	it('riconosce solo capacità esistenti', () => {
		expect(isCapability('roles.manage')).toBe(true);
		expect(isCapability('roles.manage; drop table')).toBe(false);
	});

	it('normalizza scartando valori sconosciuti e duplicati', () => {
		expect(normalizeCapabilities(['users.view', 'inventata', 'users.view', 'admin.access'])).toEqual([
			'admin.access',
			'users.view'
		]);
	});

	it('controlla la presenza di una capacità', () => {
		expect(hasCapability(new Set(['chat.master']), 'chat.master')).toBe(true);
		expect(hasCapability(['chat.npc'], 'chat.master')).toBe(false);
		expect(hasCapability(null, 'chat.master')).toBe(false);
	});
});

describe('regole anti-abuso', () => {
	const moderator = { id: 2, capabilities: new Set(['admin.access', 'users.view', 'users.manage']) };
	const admin = { id: 1, capabilities: new Set(ALL_CAPABILITIES) };

	it('isSubset', () => {
		expect(isSubset(['a'], new Set(['a', 'b']))).toBe(true);
		expect(isSubset(['a', 'c'], new Set(['a', 'b']))).toBe(false);
		expect(isSubset([], new Set())).toBe(true);
	});

	it('un moderatore non può assegnare un ruolo con poteri che non ha', () => {
		expect(canAssignRole(moderator.capabilities, { capabilities: ['roles.manage'] })).toBe(false);
		expect(canAssignRole(moderator.capabilities, { capabilities: ['users.view'] })).toBe(true);
		expect(canAssignRole(moderator.capabilities, { capabilities: [] })).toBe(true);
	});

	it('un moderatore non può agire su un amministratore', () => {
		expect(canActOnUser(moderator, { id: 1, capabilities: admin.capabilities })).toBe(false);
	});

	it('un amministratore può agire su un moderatore', () => {
		expect(canActOnUser(admin, { id: 2, capabilities: moderator.capabilities })).toBe(true);
	});

	it('nessuno può agire su sé stesso', () => {
		expect(canActOnUser(admin, { id: 1, capabilities: [] })).toBe(false);
	});
});
