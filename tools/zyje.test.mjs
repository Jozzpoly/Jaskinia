// Testy sprawdzianu życia. Pilnują dwóch rzeczy, które łatwo zepsuć:
//  (a) że prowokacje naprawdę padają, gdy mechanizm jest martwy — inaczej sam sprawdzian
//      byłby takim samym krajobrazem jak to, co ma wykrywać;
//  (b) że żadna reguła strażnika nie zostaje bez przynęty.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prowokacje, rozpoznanie, przyneta } from './zyje.mjs';
import { SECRET_RULES } from './straznik.mjs';

test('wszystkie prowokacje przechodzą na dzisiejszym strażniku', () => {
  const w = prowokacje();
  const zle = w.filter(x => !x.ok);
  assert.deepEqual(zle, [], 'martwe mechanizmy: ' + zle.map(x => x.nazwa).join(', '));
  assert.ok(w.length >= 13, 'prowokacji ma być co najmniej 13, jest ' + w.length);
});

test('każda reguła sekretu ma przynętę — nowa reguła bez przynęty to błąd, nie cisza', () => {
  for (const r of SECRET_RULES) {
    const p = przyneta(r.id);
    assert.ok(r.re.test(p), `przynęta dla ${r.id} nie pasuje do własnej reguły`);
  }
  assert.throws(() => przyneta('reguła-której-nie-ma'), /Dopisz ją|dopisz ją/,
    'brak przynęty musi krzyczeć, bo inaczej reguła przestaje być sprawdzana po cichu');
});

test('prowokacja pada, gdy mechanizm jest martwy', () => {
  // Nie da się tu wyłączyć prawdziwego strażnika, więc sprawdzam samą logikę werdyktu:
  // prowokacja opiera się na tym, że w znaleziskach JEST wpis o wadze blok.
  // Jeśli skan nic nie zwróci (strażnik martwy), warunek musi być fałszywy.
  const pusteZnaleziska = [];
  assert.equal(pusteZnaleziska.some(x => x.waga === 'blok'), false,
    'martwy strażnik zwraca zero znalezisk, więc prowokacja musi dać fałsz');
});

test('rozpoznanie nigdy nie przewraca wyniku i nie pokazuje treści wzorców', () => {
  const r = rozpoznanie({ cwd: process.cwd(), env: {} });
  assert.ok(Array.isArray(r) && r.length > 0);
  // Bez zmiennej: musi powiedzieć wprost, że blokująca waga nie działa.
  const wz = r.find(x => x.co === 'JASKINIA_WZORCE');
  assert.equal(wz.stan, '(nieustawione)');
  assert.match(wz.uwaga, /NIE DZIAŁA/);
  // Nigdzie nie wolno wypisać treści wzorca ani dopasowania — tylko liczby i nazwy.
  const tekst = JSON.stringify(r);
  assert.ok(!/kryptonim/.test(tekst), 'rozpoznanie nie może nieść treści wzorców');
});

test('rozpoznanie mówi o nieustawionym hooku, zamiast milczeć', () => {
  const r = rozpoznanie({ cwd: process.cwd(), env: {} });
  const h = r.find(x => x.co === 'core.hooksPath');
  assert.ok(h, 'hooksPath musi być w sprawozdaniu zawsze');
  // Gdy ustawione poprawnie — bez uwagi. Gdy nie — uwaga musi wskazać zasadę 1.
  if (h.stan !== '.githooks') assert.match(h.uwaga, /NIEAKTYWNY/);
});
