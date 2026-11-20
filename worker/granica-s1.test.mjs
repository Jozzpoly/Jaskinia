// S1 z ataku 7 Opusa czatu na granicę jawności (zgłoszenie 77), 20 XI 2026, poprawka Opusa Code. Koniec życia wersji
// liczy się od czynności, która ją zastąpiła, a nie od samego aktu rzeczy: czynność wielu rzeczy pisze akty po kolei,
// ale dzieje się naraz. Każdy sprawdzian ma kontrolę, że granica nie jest za ciasna.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';

let n = 0;
const op = (p) => `gs1-${p}-${String(++n).padStart(5, '0')}`;
const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w).slice(0, 300)); return w; };

async function swiat() {
  let t = Date.UTC(2026, 10, 20, 19, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const obszar = async (widzi) => ok(await s.ruch('jozz', { op: op('o'), co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Z ' + n, ile_wolno: 'prowadzic', widzi } })).rzecz;
  const zestaw = async (Z, nazwa) => ok(await s.ruch('jozz', { op: op('x'), co: 'poloz', rodzaj: 'zestaw/1', obszar: Z, cechy: { nazwa, wartosci: {} } })).rzecz;
  const zmien = async (id, cechy, gest) => { const x = s.rzecz(id); return ok(await s.ruch('jozz', { op: op('m'), ...(gest ? { gest } : {}), co: 'poloz', rzecz: id, wersja: x.wersja, rodzaj: x.rodzaj, obszar: x.obszar, cechy: { ...x.cechy, ...cechy } })); };
  const nazwa = (kto, id, akt) => { const w = s.dla(kto).wersja(id, akt); return w && w.cechy ? w.cechy.nazwa : null; };
  return { r, s, obszar, zestaw, zmien, nazwa };
}

test('GS1. cofnięcie gestu, które w jednej czynności otwiera obszar i cofa rzecz, nie pokazuje szkicu z zamknięcia', async () => {
  const W = await swiat();
  const Z = await W.obszar('wszyscy');
  const X = await W.zestaw(Z, 'PUBLICZNA-V1');
  await W.zmien(Z, { widzi: 'wlasciciel' }, 'gest-gs1-aaaa');
  await W.zmien(X, { nazwa: 'SEKRET-V2-SZKIC' }, 'gest-gs1-aaaa');
  const v2 = W.s.rzecz(X).wersja;
  assert.equal(W.s.dla(null).rzecz(X), null, 'kontrola: po zamknięciu zwiedzający rzeczy nie widzi');
  ok(await W.s.ruch('jozz', { op: op('cg'), co: 'cofnij-gest', cofany: 'gest-gs1-aaaa', publikuj: true }));
  assert.equal(W.s.dla(null).rzecz(X).cechy.nazwa, 'PUBLICZNA-V1', 'kontrola: cofnięcie przywróciło jawną wersję i otworzyło obszar');
  assert.equal(W.nazwa(null, X, v2), null, 'szkic z zamknięcia nie wychodzi do zwiedzającego');
  assert.equal(W.nazwa('agent-a', X, v2), null, 'ani do uczestnika: obszar był tylko właściciela');
  assert.equal(W.nazwa('jozz', X, v2), 'SEKRET-V2-SZKIC', 'właściciel widzi swój szkic');
});

test('GS2. kontrola: wersja bieżąca w chwili otwarcia, zastąpiona OSOBNĄ późniejszą czynnością, zostaje widoczna', async () => {
  const W = await swiat();
  const Z = await W.obszar('wlasciciel');
  const X = await W.zestaw(Z, 'POKAZANA-PRZY-OTWARCIU');
  const v1 = W.s.rzecz(X).wersja;
  await W.zmien(Z, { widzi: 'wszyscy' });
  await W.zmien(X, { nazwa: 'NOWSZA' });
  assert.equal(W.nazwa(null, X, v1), 'POKAZANA-PRZY-OTWARCIU', 'otwarcie ją pokazało, więc zostaje widoczna (nie za ciasno)');
  // ta sama sytuacja gestem: otwarcie i zmiana w dwóch krokach jednego gestu to dwie czynności
  const Y = await W.zestaw(await W.obszar('wlasciciel'), 'Y-POKAZANA');
  const y1 = W.s.rzecz(Y).wersja;
  await W.zmien(W.s.rzecz(Y).obszar, { widzi: 'wszyscy' }, 'gest-gs2-bbbb');
  await W.zmien(Y, { nazwa: 'Y-NOWSZA' }, 'gest-gs2-bbbb');
  assert.equal(W.nazwa(null, Y, y1), 'Y-POKAZANA', 'krok gestu to osobna czynność: wersja bieżąca przy otwarciu zostaje widoczna');
});

test('GS3. kontrola: zwykła zmiana jednej rzeczy w obszarze jawnym nie chowa dawnej wersji', async () => {
  const W = await swiat();
  const Z = await W.obszar('wszyscy');
  const X = await W.zestaw(Z, 'JAWNA-V1');
  const v1 = W.s.rzecz(X).wersja;
  await W.zmien(X, { nazwa: 'JAWNA-V2' });
  assert.equal(W.nazwa(null, X, v1), 'JAWNA-V1');
});
