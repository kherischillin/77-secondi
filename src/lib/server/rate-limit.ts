/**
 * Limitatore di tentativi in memoria (per tentativi di accesso e simili).
 * Basta per un singolo server; se un giorno il gioco girerà su più server
 * questo si sposterà su Redis senza cambiare il resto del codice.
 */
export class RateLimiter {
	private hits = new Map<string, number[]>();
	private readonly max: number;
	private readonly windowMs: number;
	private readonly now: () => number;

	constructor(max: number, windowMs: number, now: () => number = Date.now) {
		this.max = max;
		this.windowMs = windowMs;
		this.now = now;
	}

	private recent(key: string): number[] {
		const cutoff = this.now() - this.windowMs;
		const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
		if (list.length) this.hits.set(key, list);
		else this.hits.delete(key);
		return list;
	}

	isLimited(key: string): boolean {
		return this.recent(key).length >= this.max;
	}

	hit(key: string): void {
		const list = this.recent(key);
		list.push(this.now());
		this.hits.set(key, list);
	}

	reset(key: string): void {
		this.hits.delete(key);
	}

	/** Secondi da attendere prima che si liberi un tentativo. */
	retryAfter(key: string): number {
		const list = this.recent(key);
		if (list.length < this.max) return 0;
		return Math.ceil((list[0] + this.windowMs - this.now()) / 1000);
	}
}

/** 5 tentativi falliti ogni 15 minuti, per indirizzo IP + nome utente. */
export const loginLimiter = new RateLimiter(5, 15 * 60 * 1000);
/** 30 tentativi falliti ogni 15 minuti per indirizzo IP, qualunque utente. */
export const loginIpLimiter = new RateLimiter(30, 15 * 60 * 1000);
/** 5 registrazioni all'ora per indirizzo IP. */
export const registerLimiter = new RateLimiter(5, 60 * 60 * 1000);
