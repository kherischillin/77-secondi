import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limit';

describe('limitatore di tentativi', () => {
	it('blocca dopo il massimo e si libera dopo la finestra', () => {
		let now = 0;
		const limiter = new RateLimiter(3, 1000, () => now);

		for (let i = 0; i < 3; i++) {
			expect(limiter.isLimited('ip')).toBe(false);
			limiter.hit('ip');
		}
		expect(limiter.isLimited('ip')).toBe(true);
		expect(limiter.retryAfter('ip')).toBe(1);

		now = 1001;
		expect(limiter.isLimited('ip')).toBe(false);
	});

	it('tiene separate le chiavi e si azzera con reset', () => {
		const limiter = new RateLimiter(1, 1000, () => 0);
		limiter.hit('a');
		expect(limiter.isLimited('a')).toBe(true);
		expect(limiter.isLimited('b')).toBe(false);
		limiter.reset('a');
		expect(limiter.isLimited('a')).toBe(false);
	});
});
