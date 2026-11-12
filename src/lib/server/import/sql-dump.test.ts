import { describe, expect, it } from 'vitest';
import { fixMojibake, htmlToText, parseDump } from './sql-dump.ts';

// Un piccolo dump con le stranezze tipiche di phpMyAdmin e mysqldump.
const DUMP = `-- phpMyAdmin SQL Dump
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
# commento in stile MySQL

CREATE TABLE IF NOT EXISTS \`personaggio\` (
  \`nome\` varchar(255) NOT NULL DEFAULT '',
  \`cognome\` varchar(255) NOT NULL DEFAULT '-',
  \`soldi\` int DEFAULT '50',
  \`descrizione\` text,
  PRIMARY KEY (\`nome\`),
  KEY \`IDRazza\` (\`soldi\`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='tabella; con punto e virgola';

LOCK TABLES \`personaggio\` WRITE;
INSERT INTO \`personaggio\` VALUES ('Selene','Varo',120,'Occhi verdi,\\nsguardo fermo; \\'misteriosa\\''),('O''Brien','-',-5,NULL);
UNLOCK TABLES;

CREATE TABLE \`chat\` (\`id\` int, \`testo\` text);
INSERT INTO \`chat\` VALUES (1,'una riga; con ) e ( e \\' apici'),(2,'altra');

INSERT IGNORE INTO \`abilita\` (\`id_abilita\`, \`nome\`, \`car\`) VALUES
(1, 'Furtivit\\u00e0', 2),
(2, "Armi \\"bianche\\"", 0);
INSERT INTO \`mercato\` (\`id_oggetto\`, \`numero\`) VALUES (1, 0x33), (2, b'101');
`;

describe('lettura dei dump SQL', () => {
	const t = parseDump(DUMP, ['personaggio', 'abilita', 'mercato']);

	it('usa le colonne della CREATE TABLE quando l’INSERT non le elenca', () => {
		expect(t.get('personaggio')).toEqual([
			{ nome: 'Selene', cognome: 'Varo', soldi: 120, descrizione: "Occhi verdi,\nsguardo fermo; 'misteriosa'" },
			{ nome: "O'Brien", cognome: '-', soldi: -5, descrizione: null }
		]);
	});
	it('legge INSERT con l’elenco delle colonne e i doppi apici', () => {
		expect(t.get('abilita')?.map((r) => r.nome)).toEqual(['Furtivitu00e0', 'Armi "bianche"']);
	});
	it('valori esadecimali e binari', () => {
		expect(t.get('mercato')).toEqual([
			{ id_oggetto: 1, numero: '3' },
			{ id_oggetto: 2, numero: 5 }
		]);
	});
	it('salta le tabelle non richieste (anche con ; dentro le stringhe)', () => {
		expect(t.has('chat')).toBe(false);
		expect(parseDump(DUMP, ['chat']).get('chat')?.length).toBe(2);
	});
	it('un punto e virgola dopo un commento non fa saltare l’istruzione seguente', () => {
		const t = parseDump("/*!40101 SET NAMES utf8 */;\nINSERT INTO `a` (`x`) VALUES (1);\n/*!40101 X */;\nINSERT INTO `a` (`x`) VALUES (2);", ['a']);
		expect(t.get('a')).toEqual([{ x: 1 }, { x: 2 }]);
	});
	it('file troncato: errore chiaro', () => {
		expect(() => parseDump("INSERT INTO `a` (`x`) VALUES ('non chiusa", ['a'])).toThrow(/incompleto/);
	});
});

describe('pulizia dei testi', () => {
	it('corregge i caratteri accentati doppiamente codificati', () => {
		expect(fixMojibake('Il personaggio Ã¨ abile')).toBe('Il personaggio è abile');
		expect(fixMojibake('FurtivitÃ\u00a0')).toBe('Furtività');
		expect(fixMojibake('già corretto è')).toBe('già corretto è');
		expect(fixMojibake('20Â°c - sereno')).toBe('20°c - sereno');
	});
	it('da HTML a testo', () => {
		expect(htmlToText('<b>Ciao</b><br>riga due<br />&egrave; &amp; &#8364; &laquo;s&igrave;&raquo;')).toBe('Ciao\nriga due\nè & € «sì»');
		expect(htmlToText('<script>x</script>testo')).toBe('xtesto');
		expect(htmlToText(null)).toBe('');
	});
});
