// Plik kart dla paska „Do obejrzenia” musi się parsować i mieć wymagane pola.
// Fable, 14 XI (atak 2): jeden zbędny przecinek gasił cały pasek, a testy i strażnik go przepuszczały.
// Karty dopisują agenci — także ręcznie, przez konektor GitHuba (Medium docs/ODDAJ-JOZZOWI.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const plik = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'do-obejrzenia', 'zgloszenia.json');

test('zgloszenia.json parsuje się i każda karta ma pola, które czyta pasek', () => {
  const d = JSON.parse(fs.readFileSync(plik, 'utf8'));
  assert.equal(d.wersja, 1, 'format v1');
  assert.ok(Array.isArray(d.zgloszenia), 'zgloszenia to tablica');
  const nry = new Set();
  for (const k of d.zgloszenia) {
    for (const pole of ['nr', 'czas', 'repo', 'co', 'adres', 'agent', 'model']) {
      assert.ok(k[pole] !== undefined && k[pole] !== '', `karta ${k.nr ?? '?'}: brak pola ${pole}`);
    }
    assert.ok(Number.isInteger(k.nr) && !nry.has(k.nr), `karta ${k.nr}: nr całkowity i niepowtarzalny`);
    nry.add(k.nr);
    assert.match(new URL(k.adres).protocol, /^https?:$/, `karta ${k.nr}: adres tylko http(s)`);
    assert.ok(!Number.isNaN(Date.parse(k.czas)), `karta ${k.nr}: czas jako data ISO`);
    if (k.podobne !== undefined) assert.ok(Array.isArray(k.podobne), `karta ${k.nr}: podobne to tablica`);
    for (const x of k.podobne || []) assert.ok(x && typeof x === 'object', `karta ${k.nr}: każdy element podobne to obiekt (pasek czyta x.data, x.repo, x.plik)`);
  }
});

// Sito na drodze ręcznej (14 XI, Opus czatu; zgłosił Opus Code, przed nim Fable §2 pkt 8).
// Wspólne części — lista publicznych repo, dozwolone adresy, sekrety i lokalne ścieżki — przeniesione
// 15 XI do `tools/sito-jawnosci.mjs`, bo `czeka.json` potrzebuje tego samego sita, a kopia tej samej
// treści w dwóch testach jest betonem (zasada 7 i 8). Tutaj zostaje to, co dotyczy tylko kart.
import { REPO_JAWNE, adresDozwolony, bledyTekstow } from './sito-jawnosci.mjs';

const POLA = new Set(['nr', 'czas', 'repo', 'galaz', 'commit', 'co', 'adres', 'agent', 'model', 'podobne', 'podobne_w_prywatnych']);

export { REPO_JAWNE, adresDozwolony };

export function sito(d) {
  const bledy = [];
  for (const k of d.zgloszenia) {
    const n = `karta ${k.nr}`;
    for (const p of Object.keys(k)) if (!POLA.has(p)) bledy.push(`${n}: nieznane pole ${p} (każde pole jest publiczne — dopisz je świadomie do POLA)`);
    if (!REPO_JAWNE.has(String(k.repo).toLowerCase())) bledy.push(`${n}: repo spoza listy publicznych`);
    for (const x of k.podobne || []) if (x && x.repo && !REPO_JAWNE.has(String(x.repo).toLowerCase())) bledy.push(`${n}: podobne wskazuje repo spoza listy publicznych`);
    if (k.podobne_w_prywatnych !== undefined && !Number.isInteger(k.podobne_w_prywatnych)) bledy.push(`${n}: podobne_w_prywatnych to tylko liczba`);
    try { if (!adresDozwolony(k.adres)) bledy.push(`${n}: adres poza Jaskinią, jej gałęziami i publicznymi repo Jozzpoly`); }
    catch { bledy.push(`${n}: adres nie jest poprawnym URL`); }
    bledy.push(...bledyTekstow(k, n));
  }
  return bledy; // Komunikaty nie powtarzają dopasowanego tekstu — logi CI publicznego repo są publiczne.
}

test('zgloszenia.json przechodzi przez sito jawności', () => {
  const bledy = sito(JSON.parse(fs.readFileSync(plik, 'utf8')));
  assert.deepEqual(bledy, [], bledy.join('\n'));
});

test('sito łapie to, po co jest (próby na kopiach w pamięci)', () => {
  const dobra = { nr: 1, czas: '2026-11-14T08:00:00Z', repo: 'Jaskinia', co: 'x', adres: 'https://jaskinia.jozzpoly.workers.dev/', agent: 'a', model: 'm', podobne: [] };
  const k = zmiana => ({ wersja: 1, zgloszenia: [{ ...dobra, ...zmiana }] });
  assert.deepEqual(sito(k({})), []);
  assert.deepEqual(sito(k({ adres: 'https://opus-code-studio-do-klikniecia-jaskinia.jozzpoly.workers.dev/studio/' })), []);
  assert.equal(sito(k({ repo: 'jakies-prywatne' })).length, 1);
  assert.equal(sito(k({ podobne: [{ data: '2026-10-01', repo: 'jakies-prywatne', plik: 'a.md' }] })).length, 1);
  assert.equal(sito(k({ adres: 'https://example.com/' })).length, 1);
  assert.equal(sito(k({ adres: 'http://jaskinia.jozzpoly.workers.dev/' })).length, 1);
  assert.equal(sito(k({ adres: 'https://jozzpoly.github.io/jakies-prywatne/' })).length, 1);
  assert.equal(sito(k({ co: 'klucz ghp_' + 'a'.repeat(36) })).length, 1);
  assert.equal(sito(k({ co: 'plik w C:\\Gry\\x' })).length, 1);
  // Ukosniki w druga strone tez sa lokalna sciezka: Windows przyjmuje oba zapisy, a pierwsza
  // wersja sita szukala wylacznie litery dysku z lewym ukosnikiem. Znalezione druga linia
  // 14 XI 14:47: karta z commit "C:/Users/..." przechodzila przez sito bez jednego bledu.
  assert.equal(sito(k({ commit: 'C:/Users/ktos/tajne' })).length, 1);
  assert.equal(sito(k({ co: 'zbudowane w D:/Program Files/x' })).length, 1);
  assert.equal(sito(k({ galaz: 'C:/Users/ktos/galaz' })).length, 1);
  assert.equal(sito(k({ co: 'zobacz /home/claude/x' })).length, 1);
  assert.deepEqual(sito(k({ co: 'Jozz powiedział "tak", a "Zagraj" działa' })), [], 'zwykły cudzysłów to nie ścieżka');
  assert.equal(sito(k({ co: 'udział \\\\serwer\\x' })).length, 1);
  assert.equal(sito(k({ podobne: [{ data: '2026-10-01', repo: 'Jaskinia', plik: 'C:/Users/x/a.md' }] })).length, 1);
  assert.equal(sito(k({ notatka: 'cokolwiek' })).length, 1);
  assert.equal(sito(k({ podobne_w_prywatnych: 'nazwa' })).length, 1);
});
