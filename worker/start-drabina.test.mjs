// Falsyfikator 0 klocka „drabina przedstawień” (wspólna pamięć agentów, wplywy/2026-11-19-opus-czat-orientacja-i-klocek-drabina.md):
// z wartością domyślną drabina liczy to samo co dawne wzory Startu (pień 057c9a5), z dokładnością 1e-9, na losowych
// wymiarach i na siatce, gdzie dzielenie i mnożenie najczęściej różnią się ostatnim bitem. Dawne wzory przepisane
// dosłownie z public/start/start.mjs sprzed zmiany. Napisał Opus czatu, 19 XI 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRABINA_DOMYSLNA, szczebel, miara, alfa, rozmiarStartowy, ucieta } from '../public/start/drabina.mjs';

const plynnie = (w, od, doo) => Math.max(0, Math.min(1, (w - od) / (doo - od)));
const DAWNE = {
  podpis_rodziny: (w) => plynnie(w, 60, 160), // w. 242 (szerokość bloku rodziny)
  zycie: (w, h) => plynnie(Math.min(w / 1.5, h), 62, 96), // w. 343
  opis: (w, h) => plynnie(Math.min(w / 1.4, h), 100, 150), // w. 375
  galezie: (w, h) => plynnie(Math.min(w, h * 1.3), 300, 460), // w. 391
};
const dawnyRozmiar = (w, h) => Math.max(9, Math.min(34, w / 9, h / 3.4)); // w. 301
const dawnaUcieta = (w, h) => (w > 64 && h > 20 ? 9.5 : null); // w. 310
const kroki = (r, od) => { let n = 0; for (; r >= od; r -= 1.5) n++; return n; }; // w. 304

// Powtarzalny los (mulberry32): porażka podaje wymiary, które da się odtworzyć.
function los(ziarno) {
  let a = ziarno >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('drabina domyślna: cztery szczeble przenikają jak dawne wzory (1e-9, 20 000 losowych kart)', () => {
  const r = los(19112026);
  for (let i = 0; i < 20000; i++) {
    const w = r() * 3000, h = r() * 3000;
    for (const co of Object.keys(DAWNE)) {
      const nowe = alfa(szczebel(DRABINA_DOMYSLNA, co), w, h), dawne = DAWNE[co](w, h);
      assert.ok(Math.abs(nowe - dawne) <= 1e-9, `${co}: w=${w} h=${h} nowe=${nowe} dawne=${dawne}`);
    }
  }
});

test('drabina domyślna: imię startuje z tego samego rozmiaru, schodzi tyle samo kroków i tnie się tam, gdzie dawniej', () => {
  const s = szczebel(DRABINA_DOMYSLNA, 'imie');
  const r = los(1840);
  for (let i = 0; i < 20000; i++) {
    const w = r() * 1500, h = r() * 600;
    const a = rozmiarStartowy(s, w, h), b = dawnyRozmiar(w, h);
    assert.ok(Math.abs(a - b) <= 1e-9, `rozmiar: w=${w} h=${h}`);
    assert.equal(kroki(a, s.rozmiar.od), kroki(b, 9), `kroki: w=${w} h=${h}`);
    assert.equal(ucieta(s, w, h), dawnaUcieta(w, h), `ucięta: w=${w} h=${h}`);
  }
  // Siatka co 0,25 px: tu 1/9 razy szerokość i szerokość przez 9 najczęściej różnią się ostatnim bitem.
  for (let w = 10; w <= 400; w += 0.25) {
    assert.equal(kroki(rozmiarStartowy(s, w, 1e6), s.rozmiar.od), kroki(dawnyRozmiar(w, 1e6), 9), `siatka szerokości: w=${w}`);
    assert.equal(kroki(rozmiarStartowy(s, 1e6, w), s.rozmiar.od), kroki(dawnyRozmiar(1e6, w), 9), `siatka wysokości: h=${w}`);
  }
  // Progi wersji uciętej dokładnie na granicy: 64 i 20 px jeszcze nie, odrobinę więcej już tak.
  assert.equal(ucieta(s, 64, 100), null);
  assert.equal(ucieta(s, 100, 20), null);
  assert.equal(ucieta(s, 64.01, 20.01), 9.5);
});

test('drabina domyślna ma te same liczby co opis wartości we wspólnej pamięci (pełna precyzja)', () => {
  const imie = szczebel(DRABINA_DOMYSLNA, 'imie');
  assert.equal(imie.miara.szer, 0.1111111111111111);
  assert.equal(imie.miara.wys, 0.29411764705882354);
  assert.equal(szczebel(DRABINA_DOMYSLNA, 'zycie').miara.szer, 0.6666666666666666);
  assert.equal(szczebel(DRABINA_DOMYSLNA, 'opis').miara.szer, 0.7142857142857143);
  assert.deepEqual(DRABINA_DOMYSLNA.szczeble.map((x) => x.co), ['imie', 'podpis_rodziny', 'zycie', 'opis', 'galezie']);
  assert.ok(Object.isFrozen(DRABINA_DOMYSLNA) && Object.isFrozen(imie.miara), 'wartość domyślna jest zamrożona');
});

test('szczebel: brak w wartości bierze domyślny; „od = do = 0” znaczy zawsze; „od = do” to próg; wymiar bez pola nie ogranicza', () => {
  const d = { szczeble: [{ co: 'opis', miara: { szer: 1 }, od: 0, do: 0 }, { co: 'nieznany', miara: { szer: 1 }, od: 1, do: 2 }] };
  assert.equal(alfa(szczebel(d, 'opis'), 1, 1), 1);
  assert.equal(alfa(szczebel(d, 'opis'), 0, 0), 1, 'zawsze, nawet przy zerowej karcie');
  assert.deepEqual(szczebel(d, 'galezie'), szczebel(DRABINA_DOMYSLNA, 'galezie'));
  assert.deepEqual(szczebel(null, 'zycie'), szczebel(DRABINA_DOMYSLNA, 'zycie'));
  assert.equal(szczebel(d, 'czego-nie-ma'), null);
  const prog = { miara: { szer: 1 }, od: 100, do: 100 };
  assert.equal(alfa(prog, 99.9, 0), 0);
  assert.equal(alfa(prog, 100, 0), 1);
  assert.equal(miara({ miara: { wys: 2 } }, 5, 10), 20);
  assert.equal(miara({ miara: {} }, 5, 10), Infinity);
  assert.equal(ucieta({ co: 'imie', rozmiar: { od: 9, do: 34 } }, 500, 500), null, 'bez `ucinaj` nie ma wersji uciętej');
});
