import type { RequestHandler } from './$types';
import { resolvePlayableLocation } from '#lib/server/game-context.ts';
import { enterLocation, leaveLocation, touch } from '#lib/server/presence.ts';
import { broadcastPresence, connectionsOf, subscribe } from '#lib/server/realtime.ts';
import { loadSince } from '#lib/server/chat-service.ts';

const HEARTBEAT_MS = 25_000;
/** Dopo una disconnessione si aspetta un attimo prima di dichiarare "uscito": copre i ricaricamenti di pagina. */
const LEAVE_GRACE_MS = 8_000;

/**
 * Canale in tempo reale di una chat (Server-Sent Events).
 * Il browser lo apre con EventSource e riceve: nuovi messaggi, presenti, modifiche al luogo.
 */
export const GET: RequestHandler = async (event) => {
	const ctx = await resolvePlayableLocation(event);
	if ('error' in ctx) return new Response(null, { status: ctx.error });

	const { character, location, canModerate } = ctx;
	const encoder = new TextEncoder();
	let cleanup = () => {};

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			let closed = false;
			const write = (chunk: string) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(chunk));
				} catch {
					closed = true;
				}
			};
			const send = (eventName: string, data: unknown, id?: number) => {
				write(`${id !== undefined ? `id: ${id}\n` : ''}event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
			};

			// Il browser riprova da solo dopo 3 secondi se la connessione cade.
			write('retry: 3000\n\n');

			const unsubscribe = subscribe(location.id, { characterId: character.id, canModerate, send });
			await enterLocation(character.id, location.mapId, location.id);

			// Riconnessione: recupera i messaggi persi nel frattempo.
			const lastId = Number(event.request.headers.get('last-event-id'));
			if (Number.isInteger(lastId) && lastId > 0) {
				for (const m of await loadSince(location.id, { characterId: character.id, canModerate }, lastId)) {
					send('message', m, m.id);
				}
			}

			send('ready', { locationId: location.id });
			await broadcastPresence(location.id);

			const heartbeat = setInterval(() => {
				write(': ping\n\n');
				touch(character.id).catch(() => {});
			}, HEARTBEAT_MS);

			let cleaned = false;
			cleanup = () => {
				if (cleaned) return;
				cleaned = true;
				closed = true;
				clearInterval(heartbeat);
				unsubscribe();
				setTimeout(async () => {
					if (connectionsOf(location.id, character.id) > 0) return;
					await leaveLocation(character.id, location.id).catch(() => {});
					await broadcastPresence(location.id).catch(() => {});
				}, LEAVE_GRACE_MS).unref?.();
			};

			event.request.signal.addEventListener('abort', () => cleanup(), { once: true });
			if (event.request.signal.aborted) cleanup();
		},
		cancel() {
			cleanup();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
