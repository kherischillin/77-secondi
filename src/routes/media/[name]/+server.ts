import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readImage } from '#lib/server/uploads.ts';

export const GET: RequestHandler = async ({ params }) => {
	const image = await readImage(params.name);
	if (!image) error(404, 'Immagine non trovata.');
	return new Response(new Uint8Array(image.bytes), {
		headers: {
			'Content-Type': image.type,
			// Il nome è casuale e non cambia mai: il browser può tenerla in cache a lungo.
			'Cache-Control': 'public, max-age=31536000, immutable',
			'Content-Security-Policy': "default-src 'none'",
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
