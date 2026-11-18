// Sprawdziany stanu budowy z etapami (17 XI 2026). Stan budowy ma mówić nie tylko, co stoi, ale też czego brakuje
// i na którym etapie jest potrzebne: grunt, ściany i kable, wykończenie, tworzenie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna, ETAPY } from './ziarna.mjs';
import { opisDane, coTuJest } from './opis.mjs';

async function swiat() {
  let t = Date.UTC(2026, 10, 17, 14, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz' }));
  return { r, s };
}

test('E1. każda zasiana zdolność mówi swój etap, a etapy są cztery i w stałej kolejności', async () => {
  const { s } = await swiat();
  assert.deepEqual(ETAPY.map((e) => e.id), ['grunt', 'sciany-i-kable', 'wykonczenie', 'tworzenie']);
  const zd = s.spis({ rodzaj: 'zdolnosc/1', limit: 500 });
  assert.ok(zd.length >= 45, 'stan budowy nazywa też to, czego nie ma: ' + zd.length);
  for (const z of zd) assert.ok(ETAPY.some((e) => e.id === z.cechy.etap), `${z.cechy.nazwa}: etap ${z.cechy.etap}`);
  const wEtapie = (id) => zd.filter((z) => z.cechy.etap === id).length;
  for (const e of ETAPY) assert.ok(wEtapie(e.id) > 0, 'etap bez ani jednej zdolności: ' + e.id);
  // to, co jest wykończeniem, nie udaje gruntu: ręka i oko Startu oraz treść czekają na swój etap
  const etapWg = (nazwa) => zd.find((z) => z.cechy.nazwa === nazwa).cechy.etap;
  assert.equal(etapWg('Ręka i oko Startu'), 'wykonczenie');
  assert.equal(etapWg('Treść w środku'), 'wykonczenie');
  assert.equal(etapWg('Ustawienia jako dane'), 'grunt');
  assert.equal(etapWg('Gość, który pisze'), 'grunt');
  assert.equal(etapWg('Okna gości w przestrzeni'), 'sciany-i-kable');
});

test('E2. tekst pod adresem pokazuje stan budowy etapami, z liczbami, które sumują się do całości', async () => {
  const { s } = await swiat();
  const d = opisDane(s, { origin: 'https://proba.example' });
  assert.deepEqual(d.etapy.map((e) => e.id), ETAPY.map((e) => e.id));
  const t = coTuJest(s, { origin: 'https://proba.example' });
  const osma = t.slice(t.indexOf('8. STAN BUDOWY'), t.indexOf('9. GRANICE'));
  let suma = 0;
  for (const e of ETAPY) {
    const m = new RegExp(e.nazwa.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ': .*\\(stoi (\\d+), cienko (\\d+), brak (\\d+)\\)').exec(osma);
    assert.ok(m, 'nagłówek etapu: ' + e.nazwa);
    const [stoi, cienko, brak] = m.slice(1).map(Number);
    assert.equal(stoi + cienko + brak, d.zdolnosci.filter((z) => z.etap === e.id).length, e.id);
    suma += stoi + cienko + brak;
  }
  assert.equal(suma, d.zdolnosci.length, 'żadna zdolność nie wypada poza etapy');
  assert.match(osma, /\[BRAK\] Ustawienia jako dane:/);
  assert.match(osma, /\[CIENKO\] Gość, który pisze:/);
  // kolejność etapów w tekście jest kolejnością budowy
  const pozycje = ETAPY.map((e) => osma.indexOf(e.nazwa.toUpperCase()));
  assert.deepEqual([...pozycje].sort((a, b) => a - b), pozycje);
});

test('E3. zdolność dołożona ręką bez etapu albo z nieznanym etapem liczy się do gruntu, zamiast znikać', async () => {
  const { s } = await swiat();
  const a = await s.ruch('jozz', { op: 'etapy-test-bez-etapu', co: 'poloz', rodzaj: 'zdolnosc/1', cechy: { nazwa: 'Próbna bez etapu', stan: 'brak', opis: 'Dołożona ręką, bez etapu.' } });
  assert.equal(a.ok, true, JSON.stringify(a));
  const zly = await s.ruch('jozz', { op: 'etapy-test-zly-etap', co: 'poloz', rodzaj: 'zdolnosc/1', cechy: { nazwa: 'Próbna ze złym etapem', stan: 'brak', opis: 'Etap spoza listy.', etap: 'dach' } });
  assert.equal(zly.ok, false, 'kształt odbija etap spoza listy');
  const d = opisDane(s, { origin: 'https://proba.example' });
  assert.equal(d.zdolnosci.find((z) => z.nazwa === 'Próbna bez etapu').etap, 'grunt');
  assert.match(coTuJest(s, { origin: 'https://proba.example' }), /\[BRAK\] Próbna bez etapu:/);
});
