import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Immagini caricate dal pannello (mappe, luoghi).
 * Si controlla il contenuto reale del file, non solo l'estensione dichiarata,
 * e si salva con un nome casuale: niente nomi scelti dall'utente sul disco.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const TYPES = {
	png: 'image/png',
	jpg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif'
} as const;
type Ext = keyof typeof TYPES;

export function uploadDir(): string {
	return path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
}

/** Riconosce il formato dai primi byte del file. */
export function detectImageType(bytes: Uint8Array): Ext | null {
	const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
	if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
	if (starts([0xff, 0xd8, 0xff])) return 'jpg';
	if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
	if (starts([0x47, 0x49, 0x46, 0x38])) return 'gif';
	return null;
}

export class UploadError extends Error {}

/** Salva un'immagine caricata e restituisce il nome del file, oppure null se il campo è vuoto. */
export async function saveImage(file: FormDataEntryValue | null): Promise<string | null> {
	if (!file || typeof file === 'string' || file.size === 0) return null;
	if (file.size > MAX_IMAGE_BYTES) {
		throw new UploadError('L’immagine è troppo grande (massimo 5 MB).');
	}
	const bytes = new Uint8Array(await file.arrayBuffer());
	const ext = detectImageType(bytes);
	if (!ext) throw new UploadError('Formato non supportato: usa PNG, JPG, WEBP o GIF.');

	const name = `${randomBytes(16).toString('hex')}.${ext}`;
	await mkdir(uploadDir(), { recursive: true });
	await writeFile(path.join(uploadDir(), name), bytes);
	return name;
}

/** Nomi validi: solo quelli generati da saveImage. Impedisce di leggere file fuori dalla cartella. */
const SAFE_NAME = /^[a-f0-9]{32}\.(png|jpg|webp|gif)$/;

export function isSafeName(name: string): boolean {
	return SAFE_NAME.test(name);
}

export async function readImage(name: string): Promise<{ bytes: Buffer; type: string } | null> {
	if (!isSafeName(name)) return null;
	try {
		const bytes = await readFile(path.join(uploadDir(), name));
		const ext = name.split('.').pop() as Ext;
		return { bytes, type: TYPES[ext] };
	} catch {
		return null;
	}
}

export async function deleteImage(name: string | null | undefined): Promise<void> {
	if (!name || !isSafeName(name)) return;
	await unlink(path.join(uploadDir(), name)).catch(() => {});
}

/** Indirizzo pubblico di un'immagine caricata. */
export function mediaUrl(name: string | null | undefined): string | null {
	return name ? `/media/${name}` : null;
}
