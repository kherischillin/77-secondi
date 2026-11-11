const TIME_ZONE = 'Europe/Rome';

export function formatDateTime(value: string | Date | null | undefined): string {
	if (!value) return '—';
	return new Date(value).toLocaleString('it-IT', {
		timeZone: TIME_ZONE,
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function formatDate(value: string | Date | null | undefined): string {
	if (!value) return '—';
	return new Date(value).toLocaleDateString('it-IT', { timeZone: TIME_ZONE });
}

export function fullName(c: { name: string; surname: string | null }): string {
	return c.surname ? `${c.name} ${c.surname}` : c.name;
}
