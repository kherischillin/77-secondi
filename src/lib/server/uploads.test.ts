import { describe, expect, it } from 'vitest';
import { detectImageType, isSafeName } from './uploads';

describe('immagini caricate', () => {
	it('riconosce i formati dal contenuto', () => {
		expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('png');
		expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
		expect(detectImageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
		expect(detectImageType(new TextEncoder().encode('GIF89a'))).toBe('gif');
	});

	it('rifiuta file che non sono immagini, anche se rinominati', () => {
		expect(detectImageType(new TextEncoder().encode('<svg onload="alert(1)">'))).toBeNull();
		expect(detectImageType(new TextEncoder().encode('<?php echo 1; ?>'))).toBeNull();
	});

	it('accetta solo nomi generati dal sistema', () => {
		expect(isSafeName('0123456789abcdef0123456789abcdef.png')).toBe(true);
		expect(isSafeName('../../etc/passwd')).toBe(false);
		expect(isSafeName('immagine.png')).toBe(false);
		expect(isSafeName('0123456789abcdef0123456789abcdef.svg')).toBe(false);
	});
});

describe('dimensioni delle immagini', () => {
	it('legge PNG, GIF e WEBP (VP8X) dall\'intestazione', async () => {
		const { imageSize } = await import('./uploads.ts');
		const png = new Uint8Array(32);
		png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		new DataView(png.buffer).setUint32(16, 3240);
		new DataView(png.buffer).setUint32(20, 3690);
		expect(imageSize(png)).toEqual({ width: 3240, height: 3690 });
		const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x03, 0x8f, 0x03]);
		expect(imageSize(gif)).toEqual({ width: 800, height: 911 });
		const webp = new Uint8Array(30);
		webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58]);
		const w = 3240 - 1;
		const h = 3690 - 1;
		webp.set([w & 255, (w >> 8) & 255, w >> 16, h & 255, (h >> 8) & 255, h >> 16], 24);
		expect(imageSize(webp)).toEqual({ width: 3240, height: 3690 });
		expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull();
	});
});
