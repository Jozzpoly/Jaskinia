// `public/wejscia.json` — rzeczy Jozza, które da się otworzyć i ruszyć od razu.
//
// Po co ten plik i ten test: 15 XI 2026 zmierzyliśmy, że osiem jego projektów działa pod adresem
// (otwarte po kolei, nie wyczytane z repo), a drzwi Jaskini miały sześć odnośników i żaden nie
// prowadził do grania. Jedyne wejście, na które Jaskinia wskazywała, mówi o sobie wprost, że
// telefon jest poza zakresem projektu — a jego potrzeby 15 i 42 są właśnie o telefonie.
//
// Test pilnuje trzech rzeczy, których proza nie załatwi:
//   1. plik się parsuje — jeden przecinek gasi całą sekcję na drzwiach (Fable, 14 XI);
//   2. każde wejście mówi, CZYM jest i SKĄD wiemy o telefonie — bez tego znacznik „działa na
//      telefonie” jest obietnicą bez pokrycia, czyli główną chorobą tego projektu;
//   3. drzwi naprawdę czytają ten plik, a nie tylko mają go w repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adresDozwolony, bledyTekstow } from './sito-jawnosci.mjs';

const publiczne = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const plik = path.join(publiczne, 'wejscia.json');
const drzwi = path.join(publiczne, 'index.html');

const POLA = new Set(['nazwa', 'adres', 'co_to_jest', 'telefon', 'skad_wiem', 'sprawdzone']);
const TELEFON = new Set(['tak', 'nie', 'nieznane']);
const data = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

function sito(d) {
  const bledy = [];
  if (d.wersja !== 1) bledy.push('format inny niż v1');
  for (const p of ['opis', 'zrodlo_opisow']) if (!d[p]) bledy.push(`brak pola ${p} na górze`);
  if (!Array.isArray(d.wejscia)) return [...bledy, 'wejscia nie jest tablicą'];
  const adresy = new Set();
  for (const w of d.wejscia) {
    const n = `wejście „${String(w.nazwa).slice(0, 28)}”`;
    for (const p of Object.keys(w)) if (!POLA.has(p)) bledy.push(`${n}: nieznane pole ${p} (każde pole jest publiczne — dopisz je świadomie do POLA)`);
    for (const p of ['nazwa', 'adres', 'co_to_jest', 'telefon', 'skad_wiem', 'sprawdzone']) {
      if (w[p] === undefined || w[p] === '') bledy.push(`${n}: brak pola ${p}`);
    }
    // `skad_wiem` jest obowiązkowe celowo: znacznik o telefonie bez źródła to obietnica bez
    // mechanizmu. Wolno napisać „nie sprawdziliśmy” — nie wolno nie napisać nic.
    if (!TELEFON.has(w.telefon)) bledy.push(`${n}: telefon tylko ${[...TELEFON].join(' / ')}`);
    if (!data(w.sprawdzone)) bledy.push(`${n}: sprawdzone jako data RRRR-MM-DD`);
    if (adresy.has(w.adres)) bledy.push(`${n}: ten sam adres już jest na liście`);
    adresy.add(w.adres);
    try { if (!adresDozwolony(w.adres)) bledy.push(`${n}: adres poza Jaskinią i publicznymi repo Jozzpoly`); }
    catch { bledy.push(`${n}: adres nie jest poprawnym URL`); }
    bledy.push(...bledyTekstow(w, n));
  }
  return bledy;
}

test('wejscia.json parsuje się, a każde wejście mówi, czym jest i skąd wiemy o telefonie', () => {
  const bledy = sito(JSON.parse(fs.readFileSync(plik, 'utf8')));
  assert.deepEqual(bledy, [], bledy.join('\n'));
});

test('drzwi naprawdę czytają ten plik, a nie tylko mają go w repo', () => {
  const html = fs.readFileSync(drzwi, 'utf8');
  assert.match(html, /wejscia\.json/, 'drzwi pobierają wejscia.json');
  assert.match(html, /id="wejscia"/, 'drzwi mają miejsce, w które wstawiają tę listę');
  assert.match(html, /dom\/status\.json/, 'drzwi biorą świeżość ze starej Jaskini, zamiast kopiować jej stan');
  // Na telefonie nie ma najechania myszą, więc dymek `title` tam nie istnieje. Powód przy
  // „niesprawdzonym" musi trafić na ekran, bo sam znacznik wprowadzałby w błąd.
  assert.match(html, /telefon === 'nieznane' && w\.skad_wiem/, 'przy niesprawdzonym powód idzie na ekran, nie tylko w dymek');
});

test('sito łapie to, po co jest (próby na kopiach w pamięci)', () => {
  const dobre = {
    nazwa: 'x', adres: 'https://jozzpoly.github.io/Combat-Lab/', co_to_jest: 'y',
    telefon: 'nieznane', skad_wiem: 'nie sprawdziliśmy', sprawdzone: '2026-11-15',
  };
  const k = (zmiana) => ({ wersja: 1, opis: 'o', zrodlo_opisow: 'z', wejscia: [{ ...dobre, ...zmiana }] });
  assert.deepEqual(sito(k({})), []);
  assert.deepEqual(sito(k({ adres: 'https://jaskinia.jozzpoly.workers.dev/studio/' })), []);
  assert.equal(sito(k({ skad_wiem: '' })).length, 1, 'znacznik o telefonie bez źródła nie przechodzi');
  assert.equal(sito(k({ telefon: 'chyba tak' })).length, 1, 'telefon tylko z listy');
  assert.equal(sito(k({ co_to_jest: undefined })).length, 1, 'wejście bez opisu nie przechodzi');
  assert.equal(sito(k({ sprawdzone: '15 XI' })).length, 1, 'data w jednym formacie');
  assert.equal(sito(k({ adres: 'https://example.com/' })).length, 1, 'adres poza Jaskinią i publicznymi repo');
  assert.equal(sito(k({ adres: 'http://jozzpoly.github.io/Combat-Lab/' })).length, 1, 'tylko https');
  assert.equal(sito(k({ adres: 'https://jozzpoly.github.io/Jakies-Prywatne/' })).length, 1, 'repo spoza listy jawnych');
  assert.equal(sito(k({ co_to_jest: 'leży w C:/Users/ktos/tajne' })).length, 1, 'lokalna ścieżka');
  assert.equal(sito(k({ skad_wiem: 'klucz ghp_' + 'a'.repeat(36) })).length, 1, 'sekret w dowolnym polu');
  assert.equal(sito(k({ pilne: true })).length, 1, 'nieznane pole trzeba dopisać świadomie');
  assert.equal(sito({ wersja: 1, opis: 'o', zrodlo_opisow: 'z', wejscia: [dobre, { ...dobre }] }).length, 1, 'ten sam adres dwa razy');
  assert.equal(sito({ wersja: 1, wejscia: [] }).length, 2, 'brak opisu i źródła opisów na górze');
});
