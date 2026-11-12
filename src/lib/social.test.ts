import { describe, expect, it } from 'vitest';
import { boardAccess, canActOnMember, canAssignRank, canManageGuild, type BoardViewer } from './social';

const player: BoardViewer = {
	hasCharacter: true,
	canModerate: false,
	canManageGuilds: false,
	guildIds: new Set(),
	leadGuildIds: new Set()
};
const moderator: BoardViewer = { ...player, canModerate: true };

describe('bacheche', () => {
	const offAll = { section: 'off' as const, visibility: 'all' as const, guildId: null, staffOnlyThreads: false };
	const onAll = { ...offAll, section: 'on' as const };

	it('OFF GAME: si scrive anche qui come personaggio', () => {
		expect(boardAccess(offAll, player)).toMatchObject({ canRead: true, canStartThread: true, canReply: true, postsAs: 'character' });
		const noChar = boardAccess(offAll, { ...player, hasCharacter: false });
		expect(noChar.canRead).toBe(true);
		expect(noChar.canStartThread).toBe(false);
	});

	it('ON GAME: serve un personaggio attivo', () => {
		const a = boardAccess(onAll, { ...player, hasCharacter: false });
		expect(a.canRead).toBe(true);
		expect(a.canStartThread).toBe(false);
		expect(a.writeBlock).toMatch(/come personaggio/);
		expect(boardAccess(onAll, player).postsAs).toBe('character');
	});

	it('bacheca dello staff invisibile ai giocatori', () => {
		const staff = { ...offAll, visibility: 'staff' as const };
		expect(boardAccess(staff, player).canRead).toBe(false);
		expect(boardAccess(staff, moderator).canRead).toBe(true);
	});

	it('bacheca di gilda: solo i membri', () => {
		const guild = { ...onAll, visibility: 'guild' as const, guildId: 7 };
		expect(boardAccess(guild, player).canRead).toBe(false);
		const member = { ...player, guildIds: new Set([7]) };
		expect(boardAccess(guild, member)).toMatchObject({ canRead: true, canStartThread: true });
		// Chi gestisce le gilde legge ma, se non è membro, non scrive.
		const manager = { ...player, canManageGuilds: true };
		expect(boardAccess(guild, manager)).toMatchObject({ canRead: true, canStartThread: false });
	});

	it('discussioni riservate allo staff (o ai capi di gilda)', () => {
		const news = { ...onAll, staffOnlyThreads: true };
		expect(boardAccess(news, player)).toMatchObject({ canStartThread: false, canReply: true });
		expect(boardAccess(news, moderator).canStartThread).toBe(true);
		const guildNews = { ...news, visibility: 'guild' as const, guildId: 3 };
		const leader = { ...player, guildIds: new Set([3]), leadGuildIds: new Set([3]) };
		expect(boardAccess(guildNews, leader).canStartThread).toBe(true);
	});

	it('discussione chiusa: rispondono solo i moderatori', () => {
		expect(boardAccess(offAll, player, true)).toMatchObject({ canReply: false, writeBlock: 'La discussione è chiusa.' });
		expect(boardAccess(offAll, moderator, true).canReply).toBe(true);
	});
});

describe('gerarchia di gilda', () => {
	const leader = { isStaff: false, rank: { level: 10, canManage: true } };
	const officer = { isStaff: false, rank: { level: 5, canManage: true } };
	const member = { isStaff: false, rank: { level: 1, canManage: false } };
	const staff = { isStaff: true, rank: null };

	it('chi gestisce', () => {
		expect(canManageGuild(leader)).toBe(true);
		expect(canManageGuild(member)).toBe(false);
		expect(canManageGuild({ isStaff: false, rank: null })).toBe(false);
		expect(canManageGuild(staff)).toBe(true);
	});

	it('si agisce solo su chi sta sotto', () => {
		expect(canActOnMember(officer, 1)).toBe(true);
		expect(canActOnMember(officer, 5)).toBe(false);
		expect(canActOnMember(officer, 10)).toBe(false);
		expect(canActOnMember(member, 0)).toBe(false);
		expect(canActOnMember(staff, 10)).toBe(true);
	});

	it('non si promuove nessuno al proprio grado o più su', () => {
		expect(canAssignRank(officer, 4)).toBe(true);
		expect(canAssignRank(officer, 5)).toBe(false);
		expect(canAssignRank(leader, 9)).toBe(true);
		expect(canAssignRank(staff, 10)).toBe(true);
	});
});
