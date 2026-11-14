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
