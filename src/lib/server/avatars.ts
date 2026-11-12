import { getSettings } from './settings.ts';
import { imageSrc } from '../portrait.ts';

/** Trasforma il valore salvato dell'avatar nell'indirizzo da mostrare (null se il sito non è più ammesso). */
export async function avatarResolver(): Promise<(stored: string | null | undefined) => string | null> {
	const hosts = (await getSettings()).portraitHosts;
	return (stored) => imageSrc(stored, hosts);
}
