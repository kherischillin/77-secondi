/**
 * Brevi avvisi sonori generati dal browser (nessun file audio da scaricare).
 * I browser li permettono solo dopo che la persona ha interagito con la pagina.
 */
let ctx: AudioContext | null = null;

const TONES = {
	missive: [660, 880],
	whisper: [520, 390],
	master: [440, 554, 659]
} as const;

export function playTone(kind: keyof typeof TONES) {
	try {
		ctx ??= new AudioContext();
		if (ctx.state === 'suspended') void ctx.resume();
		const start = ctx.currentTime;
		TONES[kind].forEach((freq, i) => {
			const osc = ctx!.createOscillator();
			const gain = ctx!.createGain();
			osc.type = 'sine';
			osc.frequency.value = freq;
			const t = start + i * 0.12;
			gain.gain.setValueAtTime(0.0001, t);
			gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
			osc.connect(gain).connect(ctx!.destination);
			osc.start(t);
			osc.stop(t + 0.2);
		});
	} catch {
		// Audio non disponibile: nessun suono.
	}
}
