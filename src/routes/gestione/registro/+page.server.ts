import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { requireCapability } from '#lib/server/guards.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { AUDIT_LABELS } from '#lib/server/audit.ts';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async (event) => {
	requireCapability(event, 'audit.view');
	const action = event.url.searchParams.get('azione') ?? '';
	const pageNum = Math.max(1, Number(event.url.searchParams.get('pagina')) || 1);

	const rows = await db
		.select({
			id: schema.auditLog.id,
			action: schema.auditLog.action,
			targetType: schema.auditLog.targetType,
			targetId: schema.auditLog.targetId,
			details: schema.auditLog.details,
			ip: schema.auditLog.ip,
			createdAt: schema.auditLog.createdAt,
			actor: schema.users.username
		})
		.from(schema.auditLog)
		.leftJoin(schema.users, eq(schema.auditLog.actorUserId, schema.users.id))
		.where(action && action in AUDIT_LABELS ? eq(schema.auditLog.action, action) : undefined)
		.orderBy(desc(schema.auditLog.id))
		.limit(PAGE_SIZE + 1)
		.offset((pageNum - 1) * PAGE_SIZE);

	return {
		action,
		page: pageNum,
		hasNext: rows.length > PAGE_SIZE,
		labels: AUDIT_LABELS,
		entries: rows.slice(0, PAGE_SIZE).map((r) => ({
			...r,
			createdAt: r.createdAt.toISOString(),
			details: r.details ? JSON.stringify(r.details) : null
		}))
	};
};
