// Poprawki po niezależnym ataku 8 na próbę 1 umowy zapisu (20 XI 2026, Opus Code; atak i raport we wspólnej pamięci
// agentów, narzedzia/atak-niezalezny-2026-11-20-zapis/). Przed wydalaniem każdy ruch agenta dawał się cofnąć; z nim
// trzy drogi prowadziły agenta do nieodwracalnej utraty cudzej treści, a czwarta wymieniała obszar, którego czytający
// nie widzi. Każdy sprawdzian ma kontrolę drogi uczciwej: to, co ma działać jak na pniu, działa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { obsluzSrodowisko } from './srodowisko-http.mjs';

let n = 0;
const op = (p = 'za') => `za-${p}-${String(++n).padStart(5, '0')}`;
const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w).slice(0, 400)); return w; };

async function swiat() {
  let t = Date.UTC(2026, 10, 20, 18, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a', 'agent-b'] }));
  const obszar = async (nazwa, cechy = {}, rodzic) => ok(await s.ruch('jozz', { op: op('o'), co: 'poloz', rodzaj: 'obszar/1', ...(rodzic ? { obszar: rodzic } : {}), cechy: { nazwa, ile_wolno: 'prowadzic', ...cechy } })).rzecz;
  const poloz = async (kto, ob, rodzaj, cechy) => ok(await s.ruch(kto, { op: op('p'), co: 'poloz', rodzaj, ...(ob !== undefined ? { obszar: ob } : {}), cechy })).rzecz;
  const zmien = (kto, id, zm) => { const x = s.rzecz(id); return s.ruch(kto, { op: op('z'), co: 'poloz', rzecz: id, wersja: x.wersja, rodzaj: x.rodzaj, obszar: x.obszar, cechy: { ...x.cechy, ...zm } }); };
  const przenies = (kto, id, ob) => { const x = s.rzecz(id); return s.ruch(kto, { op: op('mv'), co: 'poloz', rzecz: id, wersja: x.wersja, rodzaj: x.rodzaj, obszar: ob, cechy: x.cechy }); };
  const odloz = (kto, id) => s.ruch(kto, { op: op('od'), co: 'odloz', rzecz: id, wersja: s.rzecz(id).wersja });
  const zWersjami = async (kto, ob, ile, nazwa) => { const X = await poloz(kto, ob, 'projekt/1', { nazwa: nazwa + ' 1' }); for (let i = 2; i <= ile; i++) ok(await zmien(kto, X, { nazwa: `${nazwa} ${i}` })); return X; };
  const pytaj = async (sciezka, kto) => (await obsluzSrodowisko(s, new Request('https://proba.example/api/srodowisko/' + sciezka, { headers: { 'x-kto': kto || '' } }), { podglad: false })).json();
  return { r, s, obszar, poloz, zmien, przenies, odloz, zWersjami, pytaj };
}
const wydalonych = (W, X, kto = null) => W.s.historia(X).filter((h) => h.wydalone && (kto === null || h.kto === kto)).length;

test('ZA1. obszaru nie da się naokoło przenieść pod krótszą historię: propozycja do właściciela, ze zdaniem o historii', async () => {
  const W = await swiat();
  const K = await W.obszar('Krótki', { historia: 2 });
  const D = await W.obszar('Długi');
  const T = await W.obszar('Też długi');
  const V = await W.obszar('Wnętrze', {}, D);
  const X = await W.zWersjami('jozz', V, 5, 'jego');
  const v = W.s.rzecz(V);
  assert.equal(W.s.ocen('agent-a', { stara: v, rodzaj: v.rodzaj, obszar: K, cechy: v.cechy }).wymaga, 'wlasciciel', 'rozstrzyga tylko właściciel');
  const w = await W.przenies('agent-a', V, K);
  assert.equal(w.skutek, 'propozycja', JSON.stringify(w).slice(0, 200));
  assert.match(w.powod, /histori/, 'właściciel widzi w powodzie, że chodzi o historię');
  assert.equal(W.s.rzecz(V).obszar, D);
  assert.equal(W.s.ustawienie(V, 'historia').wartosc, 'wszystko');
  ok(await W.zmien('agent-a', X, { nazwa: 'agent pisze' }));
  assert.equal(wydalonych(W, X), 0, 'zapis agenta nic nie wydala');
  // kontrole: pod rodzica, który trzyma tyle samo, przenosi ze skutkiem; obszar z WŁASNĄ historią też (wnętrze jej nie
  // traci); właściciel przenosi także pod krótszą
  assert.equal(ok(await W.przenies('agent-a', V, T)).skutek, 'polozone');
  const Wl = await W.obszar('Własna historia', { historia: 'wszystko' }, D);
  assert.equal(ok(await W.przenies('agent-a', Wl, K)).skutek, 'polozone', 'obszar z własną historią nic nie traci pod krótszym rodzicem');
  assert.equal(W.s.ustawienie(Wl, 'historia').wartosc, 'wszystko');
  assert.equal(ok(await W.przenies('jozz', V, K)).skutek, 'polozone');
  assert.equal(W.s.ustawienie(V, 'historia').wartosc, 2);
});

test('ZA2. cudzego punktu zapisu w obszarze z ograniczoną historią agent nie zdejmie; swój tak; tam, gdzie nic nie znika, jak na pniu', async () => {
  const W = await swiat();
  const K = await W.obszar('Krótki', { historia: 2 });
  const D = await W.obszar('Długi');
  const Y = await W.zWersjami('jozz', K, 2, 'jego');
  const v1 = W.s.historia(Y)[0].akt;
  const P = await W.poloz('jozz', K, 'punkt/1', { nazwa: 'tu wracam', czego: Y, wersja: v1 });
  const p = W.s.rzecz(P);
  assert.equal(W.s.ocen('agent-a', { stara: p, rodzaj: p.rodzaj, obszar: p.obszar, cechy: p.cechy }).wymaga, 'wlasciciel', 'rozstrzyga tylko właściciel');
  // odłożenie, przestawienie na inną wersję i zwykła zmiana: każde na osobnym punkcie właściciela (drugi ruch tego samego
  // agenta przy tej samej rzeczy odbija się od jego czekającej propozycji, a to inna sprawa)
  const punkty = [P];
  for (let i = 0; i < 2; i++) punkty.push(await W.poloz('jozz', K, 'punkt/1', { nazwa: 'też tu ' + i, czego: Y, wersja: v1 }));
  const ruchy = [() => W.odloz('agent-a', punkty[0]), () => W.zmien('agent-a', punkty[1], { wersja: W.s.rzecz(Y).wersja }), () => W.zmien('agent-a', punkty[2], { nazwa: 'inna nazwa' })];
  for (const ruch of ruchy) {
    const w = await ruch();
    assert.equal(w.skutek, 'propozycja', JSON.stringify(w).slice(0, 200));
    assert.match(w.powod, /trzyma wersję/);
  }
  for (let i = 0; i < 4; i++) ok(await W.zmien('agent-a', Y, { nazwa: 'agent ' + i }));
  assert.equal(W.s.historia(Y).find((h) => h.akt === v1).wydalone, undefined, 'wersja pod punktem właściciela zostaje');
  ok(await W.s.ruch('jozz', { op: op('wr'), co: 'wroc-do-punktu', punkt: P }));
  assert.equal(W.s.rzecz(Y).cechy.nazwa, 'jego 1', 'właściciel wraca do swojego punktu');
  // kontrole: swój punkt agent odkłada ze skutkiem; cudzy punkt tam, gdzie historia jest cała, też (nic nie znika, więc
  // jak na pniu); właściciel odkłada swój
  const Pa = await W.poloz('agent-a', K, 'punkt/1', { nazwa: 'mój', czego: Y, wersja: W.s.rzecz(Y).wersja });
  assert.equal(ok(await W.odloz('agent-a', Pa)).skutek, 'odlozone');
  const Yd = await W.zWersjami('jozz', D, 2, 'w długim');
  const Pd = await W.poloz('jozz', D, 'punkt/1', { nazwa: 'w długim', czego: Yd, wersja: W.s.historia(Yd)[0].akt });
  assert.equal(ok(await W.odloz('agent-a', Pd)).skutek, 'odlozone');
  assert.equal(ok(await W.odloz('jozz', P)).skutek, 'odlozone');
  // punkt drugiego agenta też jest cudzy
  const Pb = await W.poloz('agent-b', K, 'punkt/1', { nazwa: 'agenta b', czego: Y, wersja: W.s.rzecz(Y).wersja });
  assert.equal((await W.odloz('agent-a', Pb)).skutek, 'propozycja');
});

test('ZA3. zapisany układ właściciela przetrwa agenta, który tylko porządkuje; położenia agent dalej przesuwa', async () => {
  const W = await swiat();
  const Z = await W.obszar('Krótki, agenci porządkują', { historia: 2, ile_wolno: 'porzadkowac' });
  const V = await W.poloz('jozz', Z, 'widok/1', { nazwa: 'płótno' });
  const A = await W.poloz('jozz', Z, 'projekt/1', { nazwa: 'karta' });
  const M = ok(await W.s.ruch('jozz', { op: op('m'), co: 'poloz', rodzaj: 'miejsce/1', cechy: { widok: V, rzecz: A, x: 0, y: 0 } })).rzecz;
  const przesun = (kto, x) => { const m = W.s.rzecz(M); return W.s.ruch(kto, { op: op('mv'), co: 'poloz', rzecz: M, wersja: m.wersja, rodzaj: m.rodzaj, cechy: { ...m.cechy, x } }); };
  ok(await przesun('jozz', 10));
  const ch = ok(await W.s.ruch('jozz', { op: op('ch'), co: 'poloz', rodzaj: 'chwila/1', cechy: { nazwa: 'jego układ', widok: V, akt: W.s.ostatniNr() } })).rzecz;
  const w = await W.odloz('agent-a', ch);
  assert.equal(w.skutek, 'propozycja', JSON.stringify(w).slice(0, 200));
  for (const x of [20, 30, 40, 50]) assert.equal(ok(await przesun('agent-a', x)).skutek, 'polozone', 'kontrola: porządkowanie położeń działa jak na pniu');
  ok(await W.s.ruch('jozz', { op: op('pu'), co: 'przywroc-uklad', chwila: ch }));
  assert.equal(W.s.rzecz(M).cechy.x, 10, 'właściciel wraca do swojego układu');
});

test('ZA4. wydalone_przez nazywa obszar tylko temu, kto go widzi (historia, trasa rzeczy, 410)', async () => {
  const W = await swiat();
  const P = await W.obszar('Prywatny rodzic', { widzi: 'wlasciciel', historia: 2 });
  const V = await W.obszar('Widoczne dziecko', { widzi: 'uczestnicy' }, P);
  const Z = await W.zWersjami('jozz', V, 4, 'w dziecku');
  assert.equal(W.s.dla('agent-a').rzecz(P), null, 'kontrola: agent nie widzi rodzica');
  const wyd = W.s.historia(Z).find((h) => h.wydalone);
  assert.equal(wyd.wydalone_przez, P, 'kontrola: zdecydował rodzic');
  const agent = [JSON.stringify(W.s.dla('agent-a').historia(Z)), JSON.stringify(await W.pytaj('rzecz?id=' + Z, 'agent-a')), JSON.stringify(await W.pytaj(`wersja?id=${Z}&akt=${wyd.akt}`, 'agent-a'))];
  for (const a of agent) assert.ok(!a.includes(P), 'agent nie dostaje identyfikatora obszaru, którego nie widzi: ' + a.slice(0, 200));
  assert.equal((await W.pytaj(`wersja?id=${Z}&akt=${wyd.akt}`, 'agent-a')).status, 410, 'wersja wydalona dalej mówi 410');
  assert.equal(W.s.dla('agent-a').historia(Z).find((h) => h.akt === wyd.akt).wydalone, true, 'znak wydalenia zostaje');
  // kontrole: właściciel widzi, kto zdecydował; czytający, który WIDZI ten obszar, też
  assert.equal(W.s.dla('jozz').historia(Z).find((h) => h.akt === wyd.akt).wydalone_przez, P);
  const Q = await W.obszar('Jawny z historią', { widzi: 'uczestnicy', historia: 2 });
  const Zq = await W.zWersjami('jozz', Q, 4, 'w jawnym');
  assert.equal(W.s.dla('agent-a').historia(Zq).find((h) => h.wydalone).wydalone_przez, Q);
  assert.equal(W.s.dla('agent-a').wersja(Zq, W.s.historia(Zq)[0].akt).wydalone_przez, Q);
});
