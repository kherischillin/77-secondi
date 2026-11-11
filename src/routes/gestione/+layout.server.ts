import type { LayoutServerLoad } from './$types';
import { requireCapability } from '#lib/server/guards.ts';

export const load: LayoutServerLoad = (event) => {
	const { user } = requireCapability(event, 'admin.access');
	return { adminCapabilities: [...user.capabilities] };
};
