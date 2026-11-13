/**
 * Night City 2077 (77 Secondi): gli undici distretti della mappa di Cyberpunk 2077 e i loro luoghi.
 *
 * Le forme sono in percentuale dell'immagine della mappa (2200×2330 px: le tre versioni per tema hanno la stessa
 * inquadratura), ricavate dai confini ufficiali dei distretti. Le immagini NON sono nel repository (copyright
 * CD Projekt): le carica il proprietario in Gestione → Mappe e luoghi → Night City, una per tema.
 * I luoghi sono quelli dei vecchi distretti (mappa di Cyberpunk RED, `night-city.ts`) riassegnati al distretto
 * corrispondente, più alcuni luoghi nuovi per le zone che prima non c'erano. Le posizioni dei luoghi si calcolano
 * al momento della preparazione (`spreadPoints`), sparse dentro la forma del distretto: lo staff può poi spostarle.
 */
import type { Point } from '../../districts.ts';
import { NIGHT_CITY_DISTRICTS as RED_DISTRICTS } from './night-city.ts';

export const NIGHT_CITY_2077_IMAGE = { width: 2200, height: 2330 };

export type District2077 = { name: string; description: string; points: Point[]; locations: { name: string; description: string }[] };

/** Vecchi distretti (Cyberpunk RED) → distretto 2077 in cui finiscono i loro luoghi. */
export const RED_TO_2077: Record<string, string> = {
	'Little Europe': 'City Center',
	Downtown: 'City Center',
	'The Hot Zone': 'City Center',
	'Upper Marina': 'Watson',
	'Little China': 'Watson',
	'Watson Development': 'Watson',
	Kabuki: 'Watson',
	'University District': 'Heywood',
	'The Glen': 'Heywood',
	'South Night City': 'Heywood',
	'North Heywood': 'Heywood',
	'Old Japantown': 'Westbrook',
	'New Westbrook': 'Westbrook',
	'Charter Hill': 'Westbrook',
	'Exec Zone': 'Westbrook',
	'Port of Night City': 'Pacifica',
	'Reclamation Zone': 'Pacifica',
	'Pacifica Playground': 'Pacifica',
	'Old Combat Zone': 'Dogtown',
	'NorCal Military Base': 'Badlands North',
	'Heywood Docks': 'Santo Domingo',
	'Heywood Industrial Zone': 'Santo Domingo',
	'Santo Domingo': 'Santo Domingo',
	'Rancho Coronado': 'Santo Domingo'
};

const own: { name: string; description: string; points: Point[]; locations: { name: string; description: string }[] }[] = [
	{
		name: 'Watson',
		description:
			'Il nord della città, cresciuto e svuotato al ritmo delle corporazioni. Tra i moli abbandonati, i mercati di Kabuki e i vicoli di Little China la vita costa poco, e anche la pelle di chi ci vive.',
		points: [
			[33.45, 12.29],
			[38.34, 10.53],
			[44.21, 12.17],
			[47.89, 20.79],
			[45.98, 21.97],
			[45.55, 24.17],
			[44.27, 25.76],
			[40.23, 28.33],
			[39.8, 31.13],
			[38.73, 31.92],
			[38.73, 33.92],
			[29.8, 33.86],
			[26.83, 28.64],
			[19.81, 26.79],
			[23.02, 16.22],
			[27.7, 14.65],
			[31.95, 15.08]
		],
		locations: []
	},
	{
		name: 'Westbrook',
		description:
			"Il quartiere di chi può permetterselo: le insegne di Japantown, i club di Charter Hill e le ville blindate di North Oak sulle colline. Qui il divertimento è un'industria e la discrezione si paga a parte.",
		points: [
			[47.89, 20.79],
			[50.22, 25.4],
			[51.29, 26.01],
			[53.62, 29.62],
			[56.94, 30.45],
			[56.93, 36.44],
			[53.18, 38.42],
			[55.52, 40.83],
			[55.93, 45.04],
			[50.19, 45.0],
			[46.58, 42.57],
			[44.24, 41.64],
			[38.72, 36.32],
			[38.73, 33.92],
			[38.73, 31.92],
			[39.8, 31.13],
			[40.23, 28.33],
			[44.27, 25.76],
			[45.55, 24.17],
			[45.98, 21.97]
		],
		locations: []
	},
	{
		name: 'City Center',
		description:
			'Il cuore di vetro e acciaio di Night City. Torri corporative, Corpo Plaza e il traffico dei soldi veri: ogni passo è registrato, e chi non ha un badge viene notato in fretta.',
		points: [
			[22.56, 36.21],
			[24.91, 34.03],
			[27.03, 35.84],
			[29.8, 33.86],
			[38.73, 33.92],
			[38.72, 36.32],
			[39.57, 36.93],
			[37.87, 39.71],
			[39.57, 40.32],
			[38.29, 41.92],
			[37.65, 43.31],
			[35.52, 43.9],
			[34.04, 43.09],
			[32.98, 41.08],
			[25.32, 40.83],
			[24.26, 37.82]
		],
		locations: []
	},
	{
		name: 'Heywood',
		description:
			"Una città dentro la città, stretta tra il centro e il porto. A Wellsprings il lusso, a The Glen gli uffici comunali, a Vista del Rey le bande: in poche strade si passa da un mondo all'altro.",
		points: [
			[25.32, 40.83],
			[32.98, 41.08],
			[34.04, 43.09],
			[35.52, 43.9],
			[37.65, 43.31],
			[38.29, 41.92],
			[39.57, 40.32],
			[37.87, 39.71],
			[39.57, 36.93],
			[44.24, 41.64],
			[36.57, 52.1],
			[27.22, 51.84],
			[26.16, 49.03],
			[25.1, 45.42]
		],
		locations: []
	},
	{
		name: 'Santo Domingo',
		description:
			'Il motore industriale della città: centrali, fabbriche e casermoni operai ad Arroyo e Rancho Coronado. Turni infiniti, aria pesante e una solidarietà che non si trova altrove.',
		points: [
			[44.24, 41.64],
			[46.58, 42.57],
			[50.19, 45.0],
			[55.93, 45.04],
			[56.78, 45.64],
			[57.85, 47.05],
			[57.42, 49.64],
			[55.92, 57.23],
			[54.64, 58.02],
			[52.93, 60.01],
			[51.23, 61.8],
			[49.32, 61.38],
			[48.47, 59.38],
			[44.64, 59.35],
			[41.03, 57.33],
			[37.42, 53.31],
			[36.57, 52.3]
		],
		locations: []
	},
	{
		name: 'Pacifica',
		description:
			'Il resort che doveva cambiare la città, abbandonato a metà dagli investitori. Hotel mai finiti, centri commerciali vuoti e comunità che si arrangiano lontano da tutto, polizia compresa.',
		points: [
			[24.46, 50.62],
			[27.22, 51.84],
			[36.57, 52.3],
			[35.93, 54.38],
			[34.44, 56.28],
			[29.76, 58.65],
			[28.05, 60.84],
			[22.52, 62.28],
			[20.82, 61.99],
			[18.91, 58.58]
		],
		locations: []
	},
	{
		name: 'Dogtown',
		description:
			'Una zona franca murata dentro Pacifica, con le sue leggi e i suoi padroni. Lo stadio è diventato un mercato nero a cielo aperto: si entra con un lasciapassare e si esce, se va bene, con meno di prima.',
		points: [
			[41.03, 57.33],
			[37.41, 62.5],
			[28.04, 66.84],
			[24.44, 63.33],
			[28.05, 60.84],
			[29.76, 58.65],
			[34.44, 56.28],
			[35.93, 54.38],
			[38.7, 55.11]
		],
		locations: []
	},
	{
		name: 'Night City International',
		description:
			"L'aeroporto internazionale e lo spazioporto translunare, su un'isola artificiale nella baia. Navette per l'orbita, controlli doganali feroci e tutto quello che riesce a passarci attraverso.",
		points: [
			[1.73, 31.27],
			[4.03, 29.76],
			[22.57, 30.21],
			[22.91, 33.81],
			[21.37, 39.0],
			[15.15, 45.36],
			[4.26, 45.28],
			[1.97, 43.51]
		],
		locations: [
			{ name: 'Terminal passeggeri', description: "Sale d'attesa sterili, annunci in dodici lingue e agenti di sicurezza che guardano tutti come sospetti." },
			{ name: 'Area cargo', description: "Container in arrivo da tutto il mondo e dall'orbita. Quello che sparisce qui non viene mai cercato davvero." },
			{ name: 'Piattaforme di lancio', description: 'Le rampe delle navette translunari. Ogni partenza illumina la baia e fa tremare i vetri fino a Watson.' }
		]
	},
	{
		name: 'Badlands North',
		description:
			'Le terre aride a nord della città: discariche, vecchie basi militari e coste battute dal vento. Ci si va per nascondere qualcosa, o qualcuno.',
		points: [
			[10.88, 0.0],
			[43.46, 2.12],
			[49.14, 8.56],
			[44.21, 12.17],
			[38.34, 10.53],
			[33.45, 12.29],
			[29.83, 11.87],
			[27.28, 12.09],
			[21.75, 12.45],
			[15.46, 10.97],
			[12.23, 10.95],
			[6.45, 8.91],
			[7.98, 4.12]
		],
		locations: [
			{
				name: 'Discarica settentrionale',
				description: 'Montagne di rottami e rifiuti della città. I rigattieri ci passano le giornate, i corpi ci restano per sempre.'
			},
			{ name: 'Costa del nord', description: 'Scogli, relitti e un mare grigio. Il posto giusto per uno scambio che non deve avere testimoni.' }
		]
	},
	{
		name: 'Badlands East',
		description:
			"Il deserto a est di Night City: autostrade spezzate, motel dimenticati, campi nomadi e la grande diga. Qui la rete è debole, e qualcuno dice che anche l'Eco taccia.",
		points: [
			[61.71, 20.64],
			[96.75, 27.92],
			[100.0, 56.36],
			[72.03, 62.22],
			[55.92, 57.23],
			[57.42, 49.64],
			[57.85, 47.05],
			[56.78, 45.64],
			[55.93, 45.04],
			[55.52, 40.83],
			[53.18, 38.42],
			[56.93, 36.44],
			[56.94, 30.45]
		],
		locations: [
			{
				name: 'Accampamento Aldecaldos',
				description: 'Roulotte, fuochi e auto truccate disposte in cerchio. Gli Aldecaldos accolgono chi chiede aiuto, ma non chi porta guai.'
			},
			{ name: 'Motel sulla statale', description: "Un'insegna al neon mezza spenta, stanze pagate in contanti e nessuna domanda alla reception." },
			{
				name: 'Stazione di servizio abbandonata',
				description: "Pompe a secco e un'officina ancora funzionante: punto d'incontro di nomadi, contrabbandieri e viaggiatori sfortunati."
			}
		]
	},
	{
		name: 'Badlands South',
		description:
			'La pianura a sud della città, tra impianti solari, campi di petrolio e i lotti infiniti di container. Lavoro duro, sole implacabile e strade dove nessuno viene a cercarti.',
		points: [
			[18.91, 58.58],
			[20.82, 61.99],
			[22.52, 62.28],
			[24.44, 63.33],
			[28.04, 66.84],
			[37.41, 62.5],
			[41.03, 57.33],
			[44.64, 59.35],
			[48.47, 59.38],
			[49.32, 61.38],
			[51.23, 61.8],
			[52.93, 60.01],
			[54.64, 58.02],
			[55.92, 57.23],
			[62.93, 59.92],
			[64.03, 62.33],
			[46.98, 88.92],
			[9.88, 99.54],
			[1.25, 70.21],
			[7.21, 66.73],
			[13.59, 64.54]
		],
		locations: [
			{ name: 'Campi petroliferi', description: 'Pozzi e torri di estrazione che lavorano giorno e notte. La sicurezza privata spara prima di chiedere.' },
			{ name: 'Impianto solare', description: 'Distese di pannelli e tre grandi serbatoi rotondi. Rubare energia qui è un mestiere, e anche un rischio.' },
			{ name: 'Lotti dei container', description: 'Una città di container impilati: magazzini, rifugi e officine abusive dove si trova di tutto.' }
		]
	}
];

/** I distretti con tutti i loro luoghi: quelli nuovi più quelli dei vecchi distretti assegnati qui. */
export const NIGHT_CITY_2077: District2077[] = own.map((d) => ({
	...d,
	locations: [
		...d.locations,
		...RED_DISTRICTS.filter((r) => RED_TO_2077[r.name] === d.name).flatMap((r) => r.locations.map((l) => ({ name: l.name, description: l.description })))
	]
}));
