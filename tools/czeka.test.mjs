// `public/do-obejrzenia/czeka.json` — rzeczy, które czekają na ruch właściciela.
//
// Po co ten plik i ten test: 15 XI 2026 właściciel powiedział, że prośby agentów przepadają mu
// w natłoku rozmów, bo jedynym sposobem ich odzyskania jest przewijanie ścian tekstu
// („musiałbym jedyne co robić to czytać”). Lista w czacie jest po kilku godzinach nieistniejąca,
// więc ta lista ma adres. Test pilnuje trzech rzeczy, których proza nie załatwi:
//   1. plik się parsuje — jeden zbędny przecinek gasi całą sekcję na pasku (Fable, 14 XI);
//   2. każdy wpis mówi, DLACZEGO to on, i CO BĘDZIE, jeśli nic nie zrobi — bez tego lista
//      zamienia się w listę zadań, a on wprost tego nie chce;
//   3. każdy wpis ma datę ostatniego potwierdzenia aktualności — rzecz aktualna w chwili pisania
//      po kilku dniach już nie musi być (jego potrzeba nr 55).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adresDozwolony, bledyTekstow } from './sito-jawnosci.mjs';

const katalog = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'do-obejrzenia');
const plik = path.join(katalog, 'czeka.json');
const strona = path.join(katalog, 'index.html');

const POLA = new Set(['nr', 'co', 'dlaczego_ty', 'jesli_nic', 'czego_brakuje', 'od', 'kto', 'adres', 'waga', 'sprawdzone', 'dowod']);
const WAGI = new Set(['teraz', 'kiedys', 'opcjonalne']);
const data = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

function sito(d) {
  const bledy = [];
  if (d.wersja !== 1) bledy.push('format inny niż v1');
  if (!Array.isArray(d.czeka)) return [...bledy, 'czeka nie jest tablicą'];
  const nry = new Set();
  for (const w of d.czeka) {
    const n = `wpis ${w.nr ?? '?'}`;
    for (const p of Object.keys(w)) if (!POLA.has(p)) bledy.push(`${n}: nieznane pole ${p} (każde pole jest publiczne — dopisz je świadomie do POLA)`);
    // `jesli_nic` jest obowiązkowe celowo: wpis, który nie mówi, co się stanie, gdy właściciel nic
    // nie zrobi, jest naciskiem bez treści. Jego słowa z 14 XI: żadnych bezsensownych decyzji.
    for (const p of ['co', 'dlaczego_ty', 'jesli_nic', 'od', 'kto', 'waga', 'sprawdzone']) {
      if (w[p] === undefined || w[p] === '') bledy.push(`${n}: brak pola ${p}`);
    }
    if (!Number.isInteger(w.nr) || nry.has(w.nr)) bledy.push(`${n}: nr całkowity i niepowtarzalny`);
    nry.add(w.nr);
    if (!WAGI.has(w.waga)) bledy.push(`${n}: waga tylko ${[...WAGI].join(' / ')}`);
    if (!data(w.od)) bledy.push(`${n}: od jako data RRRR-MM-DD`);
    if (!data(w.sprawdzone)) bledy.push(`${n}: sprawdzone jako data RRRR-MM-DD`);
    if (data(w.od) && data(w.sprawdzone) && Date.parse(w.sprawdzone) < Date.parse(w.od)) {
      bledy.push(`${n}: sprawdzone wcześniej niż od`);
    }
    // `adres: null` jest dozwolone i znaczy „nie ma czego otworzyć”, a nie „zapomniałem”.
    // Adres wewnątrz Jaskini podajemy ścieżką, nie pełnym URL-em: ten plik czytamy najpierw pod
    // adresem podglądu gałęzi, a pełny URL produkcji dawałby tam 404 na rzecz, której jeszcze nie ma.
    // Ścieżka działa w obu miejscach — zmierzone 15 XI, zanim ten PR wszedł.
    if (w.adres !== null && w.adres !== undefined) {
      if (typeof w.adres === 'string' && w.adres.startsWith('/')) {
        if (w.adres.startsWith('//')) bledy.push(`${n}: ścieżka nie może zaczynać się od //, to obcy host`);
        if (w.adres.includes('..')) bledy.push(`${n}: ścieżka bez ..`);
      } else {
        try { if (!adresDozwolony(w.adres)) bledy.push(`${n}: adres poza Jaskinią i publicznymi repo Jozzpoly`); }
        catch { bledy.push(`${n}: adres nie jest poprawnym URL`); }
      }
    }
    bledy.push(...bledyTekstow(w, n));
  }
  for (const o of d.odlozone_przez_ciebie || []) {
    const n = `odłożone „${String(o.co).slice(0, 30)}…”`;
    for (const p of ['co', 'twoja_decyzja', 'od', 'sprawdzone']) {
      if (o[p] === undefined || o[p] === '') bledy.push(`${n}: brak pola ${p}`);
    }
    bledy.push(...bledyTekstow(o, n));
  }
  return bledy;
}

test('czeka.json parsuje się i każdy wpis mówi, dlaczego to on i co będzie, jeśli nic nie zrobi', () => {
  const bledy = sito(JSON.parse(fs.readFileSync(plik, 'utf8')));
  assert.deepEqual(bledy, [], bledy.join('\n'));
});

test('pasek naprawdę czyta ten plik, a nie tylko go ma w repo', () => {
  const html = fs.readFileSync(strona, 'utf8');
  assert.match(html, /czeka\.json/, 'strona paska pobiera czeka.json');
  assert.match(html, /id="czeka"/, 'strona paska ma miejsce, w które wstawia tę sekcję');
});

test('sito łapie to, po co jest (próby na kopiach w pamięci)', () => {
  const dobry = {
    nr: 1, co: 'x', dlaczego_ty: 'y', jesli_nic: 'z', od: '2026-11-15', kto: 'Opus Code',
    adres: null, waga: 'teraz', sprawdzone: '2026-11-15',
  };
  const k = (zmiana) => ({ wersja: 1, czeka: [{ ...dobry, ...zmiana }] });
  assert.deepEqual(sito(k({})), []);
  assert.deepEqual(sito(k({ adres: 'https://jaskinia.jozzpoly.workers.dev/zlecenia/' })), []);
  assert.deepEqual(sito(k({ adres: '/zlecenia/cos' })), [], 'ścieżka wewnątrz Jaskini działa też pod adresem podglądu');
  assert.equal(sito(k({ adres: '//example.com/' })).length, 1, 'dwa ukośniki to obcy host, nie ścieżka');
  assert.equal(sito(k({ adres: '/../tajne' })).length, 1, 'ścieżka bez wyjścia w górę');
  assert.deepEqual(sito(k({ adres: 'https://github.com/Jozzpoly/Feniks-Studio/settings/rules' })), []);
  assert.equal(sito(k({ jesli_nic: '' })).length, 1, 'wpis bez skutku zaniechania nie przechodzi');
  assert.equal(sito(k({ dlaczego_ty: undefined })).length, 1, 'wpis bez powodu, dlaczego to on, nie przechodzi');
  assert.equal(sito(k({ waga: 'pilne' })).length, 1, 'waga tylko z listy');
  assert.equal(sito(k({ od: '15 XI' })).length, 1, 'data w jednym formacie');
  assert.equal(sito(k({ sprawdzone: '2026-11-01' })).length, 1, 'potwierdzenie nie może być starsze niż wpis');
  assert.equal(sito(k({ adres: 'https://example.com/' })).length, 1, 'adres poza Jaskinią i publicznymi repo');
  assert.equal(sito(k({ adres: 'http://jaskinia.jozzpoly.workers.dev/' })).length, 1, 'tylko https');
  assert.equal(sito(k({ co: 'plik w C:/Users/ktos/tajne' })).length, 1, 'lokalna ścieżka');
  assert.equal(sito(k({ dowod: 'klucz ghp_' + 'a'.repeat(36) })).length, 1, 'sekret w dowolnym polu');
  assert.equal(sito(k({ pilne: true })).length, 1, 'nieznane pole trzeba dopisać świadomie');
  assert.equal(sito({ wersja: 1, czeka: [dobry, { ...dobry }] }).length, 1, 'powtórzony nr');
  // Odłożone przez właściciela to nie przypomnienie: musi mówić, że to JEGO decyzja.
  assert.equal(sito({ wersja: 1, czeka: [], odlozone_przez_ciebie: [{ co: 'x', od: '2026-11-13', sprawdzone: '2026-11-15' }] }).length, 1);
});
