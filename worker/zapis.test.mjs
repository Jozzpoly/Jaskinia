// Próba 1 umowy zapisu (20 XI 2026): ile historii trzymać jest ustawieniem obszaru, wersje ponad nie są wydalane przy
// zapisie ze śladem, a odczyt rzeczy nie rośnie z historią. Umowa i egzamin: we wspólnej pamięci agentów,
// plan/egzamin-zapisu.md (U2, U3, U4, U6, U7, U10, U12). Każdy sprawdzian ma kontrolę drogi uczciwej: ta sama droga,
// która powinna przejść, przechodzi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko, WYDALAJ_NA_RAZ, HISTORIA_NA_STRONE } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { obsluzSrodowisko } from './srodowisko-http.mjs';

let n = 0;
const op = (p = 'z') => `zp-${p}-${String(++n).padStart(5, '0')}`;
const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w).slice(0, 400)); return w; };

async function swiat({ sql = sqlZNode() } = {}) {
  let t = Date.UTC(2026, 10, 20, 9, 0, 0);
  const miara = { zapytan: 0, wierszy: 0 };
  const licz = { exec: (q, ...p) => { miara.zapytan++; const a = sql.exec(q, ...p).toArray(); miara.wierszy += a.length; return { toArray: () => a }; } };
  const r = new Rdzen(licz, { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const obszar = async (nazwa, cechy = {}, rodzic = undefined) => ok(await s.ruch('jozz', { op: op('obszar'), co: 'poloz', rodzaj: 'obszar/1', ...(rodzic ? { obszar: rodzic } : {}), cechy: { nazwa, ile_wolno: 'prowadzic', ...cechy } })).rzecz;
  const poloz = async (kto, ob, rodzaj, cechy) => ok(await s.ruch(kto, { op: op('p'), co: 'poloz', rodzaj, obszar: ob, cechy })).rzecz;
  const zmien = (kto, id, zm, dod = {}) => { const x = s.rzecz(id); return s.ruch(kto, { op: op('zm'), co: 'poloz', rzecz: id, wersja: x.wersja, rodzaj: x.rodzaj, obszar: x.obszar, cechy: { ...x.cechy, ...zm }, ...dod }); };
  const ustaw = (id, historia) => zmien('jozz', id, { historia });
  const pytaj = async (sciezka, kto = 'jozz') => (await obsluzSrodowisko(s, new Request('https://proba.example/api/srodowisko/' + sciezka, { headers: { 'x-kto': kto || '' } }))).json();
  const zapisow = () => r.q(`SELECT COUNT(*) AS n FROM zapisy`)[0].n;
  const aktow = () => r.q(`SELECT COUNT(*) AS n FROM akty`)[0].n;
  return { r, s, sql, miara, obszar, poloz, zmien, ustaw, pytaj, zapisow, aktow, glowny: r.meta('obszar_glowny') };
}

// rzecz z `ile` wersjami (pierwsza to założenie)
async function zWersjami(W, ob, ile, kto = 'jozz', nazwa = 'rzecz') {
  const X = await W.poloz(kto, ob, 'projekt/1', { nazwa: nazwa + ' 1' });
  for (let i = 2; i <= ile; i++) ok(await W.zmien(kto, X, { nazwa: `${nazwa} ${i}` }));
  return X;
}

test('Z1. odczyt rzeczy pod adresem czyta tyle samo wierszy przy 20 i 200 wersjach (przy 2 mniej, bo mniej jest); starsze strony da się doczytać', async () => {
  const W = await swiat();
  const X = await zWersjami(W, null, 2);
  const zmierz = async () => { await W.pytaj('rzecz?id=' + X); const q = W.miara.zapytan, w = W.miara.wierszy; const d = await W.pytaj('rzecz?id=' + X); return { d, koszt: [W.miara.zapytan - q, W.miara.wierszy - w] }; };
  const przy = {};
  for (const ile of [2, 20, 200]) {
    while (W.s.rzecz(X).numer < ile) ok(await W.zmien('jozz', X, { nazwa: 'v' + W.s.rzecz(X).numer }));
    przy[ile] = await zmierz();
  }
  // przy 2 wersjach strona ma 2 wiersze historii, przy 20 i 200 po HISTORIA_NA_STRONE; zapytań zawsze tyle samo
  assert.equal(przy[2].koszt[0], przy[200].koszt[0], 'tyle samo zapytań: ' + JSON.stringify([przy[2].koszt, przy[200].koszt]));
  assert.equal(przy[20].koszt[1] - przy[2].koszt[1], HISTORIA_NA_STRONE - 2, 'różnica 2 -> 20 to tylko wiersze historii, których przy 2 nie ma');
  assert.deepEqual(przy[200].koszt, przy[20].koszt, 'ten sam koszt przy 20 i 200 wersjach: ' + JSON.stringify([przy[20].koszt, przy[200].koszt]));
  const d = przy[200].d;
  assert.equal(d.historia.length, HISTORIA_NA_STRONE);
  assert.equal(d.historia_razem, 200);
  assert.equal(d.historia[d.historia.length - 1].akt, W.s.rzecz(X).wersja, 'ostatni wiersz to wersja bieżąca');
  assert.equal(d.historia[d.historia.length - 1].numer, 200);
  // kontrola drogi uczciwej: strony doczytane jedna po drugiej dają całą historię, co do znaku tę samą co pełna
  const strony = [...d.historia];
  for (let dalej = d.historia_dalej; dalej;) {
    const s2 = await W.pytaj(`rzecz?id=${X}&historia_przed=${dalej}&historia_ile=50`);
    strony.unshift(...s2.historia);
    dalej = s2.historia_dalej;
  }
  assert.deepEqual(strony, W.s.historia(X), 'strony razem to pełna historia');
  // okulary czytającego zostają: uczestnik nie dostaje odcisków treści, właściciel dostaje
  const ag = await W.pytaj('rzecz?id=' + X, 'agent-a');
  assert.ok(ag.historia.length === HISTORIA_NA_STRONE && ag.historia.every((h) => !('zapis' in h)), 'uczestnik bez odcisków');
  assert.ok(d.historia.every((h) => typeof h.zapis === 'string'), 'kontrola: właściciel z odciskami');
});

test('Z2. wersja i cofnięcie pytają punktowo: koszt nie rośnie z historią, a wynik jest ten sam co dawniej', async () => {
  const W = await swiat();
  const X = await zWersjami(W, null, 3);
  const koszt = (f) => { const q = W.miara.zapytan, w = W.miara.wierszy; const x = f(); return { x, k: [W.miara.zapytan - q, W.miara.wierszy - w] }; };
  const v2 = W.s.historia(X)[1];
  const male = koszt(() => W.s.wersja(X, v2.akt));
  while (W.s.rzecz(X).numer < 200) ok(await W.zmien('jozz', X, { nazwa: 'v' + W.s.rzecz(X).numer }));
  const ostatnia = W.s.historia(X)[198];
  const duze = koszt(() => W.s.wersja(X, ostatnia.akt));
  assert.deepEqual(duze.k, male.k, 'wersja: te same liczby zapytań i wierszy przy 3 i 200 wersjach');
  assert.equal(male.x.cechy.nazwa, 'rzecz 2');
  assert.equal(male.x.numer, 2);
  assert.equal(duze.x.numer, 199);
  // cofnięcie do poprzedniej (bez pola do) dalej działa i daje wersję 199
  const c = ok(await W.s.ruch('jozz', { op: op('c'), co: 'cofnij', rzecz: X, wersja: W.s.rzecz(X).wersja }));
  assert.equal(c.z_wersji, ostatnia.akt);
  assert.equal(W.s.rzecz(X).cechy.nazwa, duze.x.cechy.nazwa);
});

test('Z3. domyślnie "wszystko": nic nie jest wydalane i ruch nie mówi o wydalaniu (dopóki nikt nic nie ustawi, nic się nie zmienia)', async () => {
  const W = await swiat();
  const Z = await W.obszar('zwykły');
  const X = await zWersjami(W, Z, 30);
  const w = ok(await W.zmien('jozz', X, { nazwa: 'jeszcze' }));
  assert.equal('wydalanie' in w, false);
  assert.equal(W.s.historia(X).filter((h) => h.wydalone).length, 0);
  assert.equal(W.s.ustawienie(Z, 'historia').wartosc, 'wszystko');
});

test('Z4. ustawienie historia: wydalanie przy zapisie, najwyżej kilka wersji naraz, zaległość policzalna, akty zostają', async () => {
  const W = await swiat();
  const Z = await W.obszar('krótka pamięć');
  const X = await zWersjami(W, Z, 30);
  const zapisyPrzed = W.zapisow();
  ok(await W.ustaw(Z, 4));
  assert.equal(W.s.ustawienie(Z, 'historia').wartosc, 4);
  const aktowPrzed = W.aktow();
  const pierwszy = ok(await W.zmien('jozz', X, { nazwa: 'zapis 31' }));
  assert.deepEqual(pierwszy.wydalanie, { ustawienie: 4, wydalone: WYDALAJ_NA_RAZ, zaleglosc: 31 - 4 - WYDALAJ_NA_RAZ, trzymane: 0 }, 'ruch mówi, ile wydalił i ile czeka');
  assert.equal(W.aktow(), aktowPrzed + 2, 'wydalenie nie kasuje aktów: przybyła tylko para aktów nowego zapisu');
  let ostatni = pierwszy, zapisow = 1;
  while (ostatni.wydalanie.zaleglosc > 0) { ostatni = ok(await W.zmien('jozz', X, { nazwa: 'zapis ' + (31 + zapisow) })); zapisow++; assert.ok(ostatni.wydalanie.wydalone <= WYDALAJ_NA_RAZ); }
  const h = W.s.historia(X);
  assert.equal(h.length, 30 + zapisow, 'historia ma wszystkie wiersze');
  assert.equal(h.filter((x) => !x.wydalone).length, 4, 'treść mają tylko 4 najnowsze wersje');
  assert.ok(h.slice(0, -4).every((x) => x.wydalone && !('zapis' in x) && typeof x.wydalone_kiedy === 'string' && x.wydalone_przez === Z), 'starsze: ślad z chwilą i obszarem, którego ustawienie zdecydowało');
  assert.ok(h.every((x, i) => x.numer === i + 1 && Number.isInteger(x.akt) && x.kto === 'jozz'), 'numer, akt i autor zostają');
  assert.equal(W.s.rzecz(X).wydalonych, h.length - 4);
  assert.ok(W.zapisow() < zapisyPrzed, `wiersze treści naprawdę zniknęły (${zapisyPrzed} -> ${W.zapisow()})`);
  // kontrola drogi uczciwej: cofnięcie do poprzedniej i do jednej z trzymanych wersji działa
  ok(await W.s.ruch('jozz', { op: op('c'), co: 'cofnij', rzecz: X, wersja: W.s.rzecz(X).wersja }));
  const trzymana = W.s.historia(X).filter((x) => !x.wydalone)[0];
  ok(await W.s.ruch('jozz', { op: op('c'), co: 'cofnij', rzecz: X, wersja: W.s.rzecz(X).wersja, do: trzymana.akt }));
});

test('Z5. ustawienie zmienia tylko właściciel; zakres szeroki, wartość spoza niego to odmowa ze zdaniem; dziedziczenie w górę', async () => {
  const W = await swiat();
  const Z = await W.obszar('wspólny');
  const ag = await W.zmien('agent-a', Z, { historia: 3 });
  assert.equal(ag.skutek, 'propozycja', 'ruch uczestnika staje się propozycją: ' + JSON.stringify(ag).slice(0, 200));
  assert.equal(W.s.rzecz(ag.propozycja).cechy.wymaga, 'wlasciciel');
  assert.equal(W.s.ustawienie(Z, 'historia').wartosc, 'wszystko', 'nic się nie zmieniło');
  const nowyAg = await W.s.ruch('agent-a', { op: op('o'), co: 'poloz', rodzaj: 'obszar/1', obszar: Z, cechy: { nazwa: 'mój', historia: 2 } });
  assert.equal(nowyAg.skutek, 'propozycja', 'nowy obszar z ustawieniem od uczestnika też');
  for (const zla of [1, 0, -5, 100001, 2.5, 'dużo', null, true]) {
    const w = await W.ustaw(Z, zla);
    assert.equal(w.status, 422, `historia ${JSON.stringify(zla)}: ${JSON.stringify(w).slice(0, 160)}`);
    assert.match(w.blad, /od 2 do 100000/);
  }
  for (const dobra of [2, 100000, 'wszystko', 7]) ok(await W.ustaw(Z, dobra)); // kontrola: brzegi zakresu przechodzą
  const D = await W.obszar('dziecko', {}, Z);
  assert.deepEqual(W.s.ustawienie(D, 'historia'), { wartosc: 7, skad: Z }, 'dziecko dziedziczy po rodzicu');
  ok(await W.ustaw(W.glowny, 50));
  assert.deepEqual(W.s.ustawienie(null, 'historia'), { wartosc: 50, skad: W.glowny }, 'obszar główny daje wartość wszystkiemu, co nie mówi inaczej');
});

test('Z6. uczestnik nie skróci historii naokoło: przeniesienie do obszaru, który trzyma mniej, jest propozycją do właściciela', async () => {
  const W = await swiat();
  const Dl = await W.obszar('długa');
  const Kr = await W.obszar('krótka', { historia: 2 });
  const Ta = await W.obszar('też długa');
  const X = await zWersjami(W, Dl, 5, 'agent-a');
  const przenies = (kto, ob) => { const x = W.s.rzecz(X); return W.s.ruch(kto, { op: op('mv'), co: 'poloz', rzecz: X, wersja: x.wersja, rodzaj: x.rodzaj, obszar: ob, cechy: x.cechy }); };
  const w = await przenies('agent-a', Kr);
  assert.equal(w.skutek, 'propozycja', JSON.stringify(w).slice(0, 200));
  assert.match(w.powod, /skróciłoby jej historię/);
  assert.equal(W.s.rzecz(X).obszar, Dl);
  // kontrola: to samo przeniesienie do obszaru, który trzyma tyle samo, ma skutek; właściciel przenosi także do krótkiej
  assert.equal(ok(await przenies('agent-a', Ta)).skutek, 'polozone');
  const wl = ok(await przenies('jozz', Kr));
  assert.equal(wl.skutek, 'polozone');
  // 7 wersji, ustawienie 2: wydalone 4, bo wersji, przy której czeka propozycja agenta, nie wydala się (U4)
  assert.deepEqual(wl.wydalanie, { ustawienie: 2, wydalone: 4, zaleglosc: 1, trzymane: 1 });
});

test('Z7. treść wspólna dwóm rzeczom zostaje, dopóki wskazuje ją niewydalony akt; nie wskazywana znika', async () => {
  const W = await swiat();
  const Z = await W.obszar('krótka', { historia: 2 });
  const A = await W.poloz('jozz', Z, 'projekt/1', { nazwa: 'wspólna treść' });
  const zapisA1 = W.s.rzecz(A).zapis;
  ok(await W.zmien('jozz', A, { nazwa: 'a2' }));
  // B ma dziś dokładnie tę treść, którą miała pierwsza wersja A (ten sam rodzaj, obszar i cechy: ten sam zapis)
  const B = await W.poloz('jozz', Z, 'projekt/1', { nazwa: 'wspólna treść' });
  assert.equal(W.s.rzecz(B).zapis, zapisA1, 'kontrola przygotowania: ta sama treść, ten sam zapis');
  const zapisA2 = W.s.rzecz(A).zapis;
  const w = ok(await W.zmien('jozz', A, { nazwa: 'a3' }));
  assert.equal(w.wydalanie.wydalone, 1);
  assert.equal(W.s.historia(A)[0].wydalone, true, 'pierwsza wersja A jest wydalona');
  assert.equal(W.r.q(`SELECT COUNT(*) AS n FROM zapisy WHERE id = ?`, zapisA1)[0].n, 1, 'treść została, bo wskazuje ją B');
  assert.equal(W.s.rzecz(B).cechy.nazwa, 'wspólna treść');
  ok(await W.zmien('jozz', A, { nazwa: 'a4' }));
  assert.equal(W.r.q(`SELECT COUNT(*) AS n FROM zapisy WHERE id = ?`, zapisA2)[0].n, 0, 'kontrola: treść, której nic już nie wskazuje, znika');
});

test('Z8. rodzaje niosące prawa nie tracą historii (obszar), inne rzeczy w tym samym obszarze tak', async () => {
  const W = await swiat();
  const Z = await W.obszar('krótka', { historia: 2 });
  const O = await W.obszar('obszar w krótkiej', {}, Z);
  for (let i = 0; i < 6; i++) ok(await W.zmien('jozz', O, { opis: 'opis ' + i }));
  assert.equal(W.s.historia(O).filter((h) => h.wydalone).length, 0, 'obszar trzyma całą historię');
  const X = await zWersjami(W, Z, 6);
  assert.equal(W.s.historia(X).filter((h) => h.wydalone).length, 4, 'kontrola: zwykła rzecz obok traci treść ponad ustawienie');
  ok(await W.ustaw(Z, 2)); // ten sam zapis ustawienia: obszar Z leży w głównym, który trzyma wszystko
  assert.equal(W.s.historia(Z).filter((h) => h.wydalone).length, 0);
});

test('Z9. punkt zapisu i czekająca propozycja trzymają swoją wersję; odłożony punkt już nie', async () => {
  const W = await swiat();
  const Z = await W.obszar('krótka', { historia: 2, ile_wolno: 'proponowac' });
  const X = await zWersjami(W, Z, 3);
  const v2 = W.s.historia(X)[1];
  const P = await W.poloz('jozz', Z, 'punkt/1', { nazwa: 'ciekawa', czego: X, wersja: v2.akt });
  const v3 = W.s.rzecz(X).wersja;
  // propozycja agenta przy wersji v3 (w obszarze, gdzie agenci proponują)
  const pr = await W.zmien('agent-a', X, { nazwa: 'pomysł agenta' });
  assert.equal(pr.skutek, 'propozycja');
  for (let i = 0; i < 6; i++) ok(await W.zmien('jozz', X, { nazwa: 'dalej ' + i }));
  const h = W.s.historia(X);
  const stan = (akt) => h.find((x) => x.akt === akt).wydalone === true;
  assert.equal(stan(h[0].akt), true, 'kontrola: pierwsza wersja, której nic nie trzyma, jest wydalona');
  assert.equal(stan(v2.akt), false, 'punkt zapisu trzyma swoją wersję');
  assert.equal(stan(v3), false, 'czekająca propozycja trzyma swoją wersję');
  const ost = ok(await W.zmien('jozz', X, { nazwa: 'jeszcze' }));
  assert.equal(ost.wydalanie.trzymane, 2);
  assert.ok(ost.wydalanie.zaleglosc >= 2, 'trzymane liczą się do zaległości: ' + JSON.stringify(ost.wydalanie));
  // powrót do punktu działa mimo wydalania wokół
  ok(await W.s.ruch('jozz', { op: op('wp'), co: 'wroc-do-punktu', punkt: P }));
  assert.equal(W.s.rzecz(X).cechy.nazwa, 'rzecz 2');
  // odłożony punkt i rozstrzygnięta propozycja już nie trzymają
  const p = W.s.rzecz(P);
  ok(await W.s.ruch('jozz', { op: op('o'), co: 'odloz', rzecz: P, wersja: p.wersja }));
  ok(await W.s.ruch('jozz', { op: op('r'), co: 'odrzuc', propozycja: pr.propozycja }));
  ok(await W.zmien('jozz', X, { nazwa: 'po odłożeniu' }));
  const h2 = W.s.historia(X);
  assert.equal(h2.find((x) => x.akt === v2.akt).wydalone, true, 'po odłożeniu punktu jego wersja odchodzi');
  assert.equal(h2.find((x) => x.akt === v3).wydalone, true, 'po rozstrzygnięciu propozycji też');
});

test('Z10. po wydaleniu nic nie kłamie: wersja oddaje ślad, trasa mówi zdaniem, cofnięcie i powrót do punktu odmawiają', async () => {
  const W = await swiat();
  const Z = await W.obszar('krótka', { historia: 2 });
  const X = await zWersjami(W, Z, 4);
  const h = W.s.historia(X);
  const stara = h[0];
  assert.equal(stara.wydalone, true);
  const w = W.s.wersja(X, stara.akt);
  assert.deepEqual([w.wydalone, w.akt, w.numer, w.kto, 'cechy' in w], [true, stara.akt, 1, 'jozz', false], 'wiersz bez treści ze znakiem');
  assert.equal(W.s.dla('agent-a').wersja(X, stara.akt).wydalone, true, 'uczestnik widzi ten sam ślad');
  const http = await W.pytaj(`wersja?id=${X}&akt=${stara.akt}`);
  assert.deepEqual([http.ok, http.status, http.wersja.wydalone], [false, 410, true]);
  assert.match(http.blad, /została wydalona/);
  const c = await W.s.ruch('jozz', { op: op('c'), co: 'cofnij', rzecz: X, wersja: W.s.rzecz(X).wersja, do: stara.akt });
  assert.equal(c.status, 409);
  assert.match(c.blad, /została wydalona/);
  // punkt zapisu założony na wersję, której treści już nie ma
  const P = await W.poloz('jozz', Z, 'punkt/1', { nazwa: 'za późno', czego: X, wersja: stara.akt });
  const wp = await W.s.ruch('jozz', { op: op('wp'), co: 'wroc-do-punktu', punkt: P });
  assert.equal(wp.status, 409);
  assert.match(wp.blad, /została wydalona/);
  // historia pod adresem i strona tekstem pokazują wiersz jako wydalony
  const d = await W.pytaj('rzecz?id=' + X);
  assert.equal(d.historia.filter((x) => x.wydalone).length, 2);
  const tekst = await (await obsluzSrodowisko(W.s, new Request('https://proba.example/rzecz/' + X, { headers: { 'x-kto': 'jozz' } }))).text();
  assert.match(tekst, /WYDALONA/);
  assert.match(tekst, /ile wersji trzyma obszar tej rzeczy: 2/);
  // kontrola: wersja z treścią czyta się i cofa jak dawniej
  const zywa = W.s.historia(X).filter((x) => !x.wydalone)[0];
  assert.equal(W.s.wersja(X, zywa.akt).cechy.nazwa, 'rzecz 3');
  ok(await W.s.ruch('jozz', { op: op('c'), co: 'cofnij', rzecz: X, wersja: W.s.rzecz(X).wersja, do: zywa.akt }));
});

test('Z11. wywóz i wwóz po wydaleniu dają to samo co do znaku; plik w starszym formacie dalej wchodzi', async () => {
  const W = await swiat();
  const Z = await W.obszar('krótka', { historia: 3 });
  const X = await zWersjami(W, Z, 9);
  await zWersjami(W, null, 4, 'jozz', 'długa');
  assert.ok(W.s.historia(X).some((h) => h.wydalone), 'kontrola przygotowania: jest co wywozić');
  const e = JSON.parse(JSON.stringify(W.r.eksport()));
  assert.equal(e.wersja, 'miejsce-4');
  const r2 = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => Date.UTC(2026, 10, 21) });
  ok(await r2.importuj(e));
  const s2 = new Srodowisko(r2);
  s2.przebuduj();
  const obraz = (s) => JSON.stringify(s.spis({ limit: 100000, odlozone: 'razem' }).map((x) => [x.id, x.rodzaj, x.wersja, x.numer, x.wydalonych ?? 0, x.cechy]));
  assert.equal(obraz(s2), obraz(W.s), 'spis po wwozie ten sam');
  assert.equal(JSON.stringify(s2.historia(X)), JSON.stringify(W.s.historia(X)), 'historia z wydalonymi wierszami ta sama');
  const bez = (x) => JSON.stringify({ ...x, zebrane: null });
  assert.equal(bez(JSON.parse(JSON.stringify(r2.eksport()))), bez(e), 'drugi wywóz co do znaku ten sam');
  // kontrola drogi wstecz: plik miejsce-3 (bez pól wydalenia) wchodzi jak dawniej
  const W3 = await swiat();
  await zWersjami(W3, null, 3);
  const e3 = JSON.parse(JSON.stringify(W3.r.eksport()));
  e3.wersja = 'miejsce-3';
  for (const a of e3.akty) { delete a.wydalone; delete a.wydalone_przez; }
  const r3 = new Rdzen(sqlZNode(), { wlasciciel: 'jozz' });
  ok(await r3.importuj(e3));
  // a plik, w którym akt bez znaku wydalenia wskazuje treść, której nie ma, dalej jest odrzucany
  const zly = JSON.parse(JSON.stringify(e));
  const wyd = zly.akty.find((a) => a.wydalone != null);
  wyd.wydalone = null;
  assert.equal((await new Rdzen(sqlZNode()).importuj(zly)).status, 422);
});

test('Z12. migracja: baza sprzed wydalania (bez nowych kolumn) otwiera się, dostaje kolumny i wydala dalej', async () => {
  const sql = sqlZNode();
  const W = await swiat({ sql });
  const Z = await W.obszar('krótka');
  const X = await zWersjami(W, Z, 5);
  // stan bazy sprzed 20 XI: bez kolumn wydalenia w aktach i bez licznika w spisie
  sql.exec(`ALTER TABLE akty DROP COLUMN wydalone_przez`);
  sql.exec(`ALTER TABLE akty DROP COLUMN wydalone`);
  sql.exec(`ALTER TABLE rzeczy DROP COLUMN wydalonych`);
  const r = new Rdzen(sql, { wlasciciel: 'jozz', teraz: () => Date.UTC(2026, 10, 21) + n * 1000 });
  const s = new Srodowisko(r);
  const kol = (t) => sql.exec(`PRAGMA table_info(${t})`).toArray().map((k) => k.name);
  assert.ok(kol('akty').includes('wydalone') && kol('akty').includes('wydalone_przez') && kol('rzeczy').includes('wydalonych'));
  assert.equal(s.historia(X).length, 5, 'kontrola: historia ta sama');
  const o = s.rzecz(Z);
  ok(await s.ruch('jozz', { op: op('u'), co: 'poloz', rzecz: Z, wersja: o.wersja, rodzaj: 'obszar/1', cechy: { ...o.cechy, historia: 2 } }));
  const x = s.rzecz(X);
  const w = ok(await s.ruch('jozz', { op: op('zm'), co: 'poloz', rzecz: X, wersja: x.wersja, rodzaj: x.rodzaj, cechy: { ...x.cechy, nazwa: 'po migracji' } }));
  assert.equal(w.wydalanie.wydalone, 4);
});

test('Z13. budżet jest jeden na czynność: gest wielu rzeczy wydala razem najwyżej kilka wersji', async () => {
  const W = await swiat();
  const Z = await W.obszar('krótka');
  const rzeczy = [];
  for (let i = 0; i < 3; i++) rzeczy.push(await zWersjami(W, Z, 6, 'jozz', 'r' + i));
  // cofnięcie gestu, który ruszył trzy rzeczy, zapisuje je jedną czynnością
  for (const X of rzeczy) { const x = W.s.rzecz(X); ok(await W.s.ruch('jozz', { op: op('g'), gest: 'gest-trzech-1', co: 'poloz', rzecz: X, wersja: x.wersja, rodzaj: x.rodzaj, cechy: { ...x.cechy, nazwa: x.cechy.nazwa + '!' } })); }
  ok(await W.ustaw(Z, 2));
  const przed = W.s.historia(rzeczy[0]).filter((h) => h.wydalone).length + W.s.historia(rzeczy[1]).filter((h) => h.wydalone).length + W.s.historia(rzeczy[2]).filter((h) => h.wydalone).length;
  const c = ok(await W.s.ruch('jozz', { op: op('cg'), co: 'cofnij-gest', cofany: 'gest-trzech-1' }));
  assert.ok(c.wydalanie.wydalone <= WYDALAJ_NA_RAZ, JSON.stringify(c.wydalanie));
  const po = rzeczy.reduce((s, X) => s + W.s.historia(X).filter((h) => h.wydalone).length, 0);
  assert.equal(po - przed, c.wydalanie.wydalone, 'ruch mówi prawdę o tym, ile wydalił');
  assert.ok(c.wydalanie.zaleglosc > 0, 'reszta czeka i to widać');
});

test('Z14. stan sprzed ostatniego gestu zostaje: cofnięcie gestu, który ruszył rzecz kilka razy, działa przy ustawieniu 2', async () => {
  const W = await swiat();
  const Z = await W.obszar('krótka', { historia: 2 });
  const X = await W.poloz('jozz', Z, 'projekt/1', { nazwa: 'przed gestem' });
  for (let i = 1; i <= 4; i++) { const x = W.s.rzecz(X); ok(await W.s.ruch('jozz', { op: op('g'), gest: 'gest-ciagniecia', co: 'poloz', rzecz: X, wersja: x.wersja, rodzaj: x.rodzaj, cechy: { ...x.cechy, nazwa: 'krok ' + i } })); }
  const h = W.s.historia(X);
  assert.equal(h[0].wydalone, undefined, 'wersja sprzed gestu ma treść');
  assert.ok(h.slice(1, -2).every((x) => x.wydalone), 'kontrola: kroki w środku gestu są wydalone');
  ok(await W.s.ruch('jozz', { op: op('cg'), co: 'cofnij-gest', cofany: 'gest-ciagniecia' }));
  assert.equal(W.s.rzecz(X).cechy.nazwa, 'przed gestem');
});

test('Z15. zapisana chwila trzyma wersje położeń; powrót do układu z wydaloną wersją odmawia zdaniem, zamiast odkładać', async () => {
  const W = await swiat();
  const Z = await W.obszar('krótka', { historia: 2 });
  const V = await W.poloz('jozz', Z, 'widok/1', { nazwa: 'płótno' });
  const A = await W.poloz('jozz', Z, 'projekt/1', { nazwa: 'karta' });
  const M = ok(await W.s.ruch('jozz', { op: op('m'), co: 'poloz', rodzaj: 'miejsce/1', cechy: { widok: V, rzecz: A, x: 0, y: 0 } })).rzecz;
  const przesun = async (x) => { const m = W.s.rzecz(M); ok(await W.s.ruch('jozz', { op: op('mv'), co: 'poloz', rzecz: M, wersja: m.wersja, rodzaj: m.rodzaj, cechy: { ...m.cechy, x } })); };
  await przesun(10);
  const ch = ok(await W.s.ruch('jozz', { op: op('ch'), co: 'poloz', rodzaj: 'chwila/1', cechy: { nazwa: 'rano', widok: V, akt: W.s.ostatniNr() } })).rzecz;
  for (const x of [20, 30, 40, 50]) await przesun(x);
  ok(await W.s.ruch('jozz', { op: op('pu'), co: 'przywroc-uklad', chwila: ch }));
  assert.equal(W.s.rzecz(M).cechy.x, 10, 'kontrola: chwila trzyma swoją wersję i powrót działa');
  // chwila bez ochrony: zapisana na akt, którego wersję położenia już wydalono
  const pierwszyAkt = W.s.historia(M)[0];
  assert.equal(pierwszyAkt.wydalone, true);
  const ch2 = ok(await W.s.ruch('jozz', { op: op('ch'), co: 'poloz', rodzaj: 'chwila/1', cechy: { nazwa: 'dawno', widok: V, akt: pierwszyAkt.akt } })).rzecz;
  const w = await W.s.ruch('jozz', { op: op('pu'), co: 'przywroc-uklad', chwila: ch2 });
  assert.equal(w.status, 409, JSON.stringify(w).slice(0, 200));
  assert.match(w.blad, /wydalona/);
  assert.equal(W.s.rzecz(M).odlozone, undefined, 'położenie nie zostało odłożone po cichu');
  const wc = W.s.widokNa(V, pierwszyAkt.akt);
  assert.deepEqual(wc.find((x) => x.rzecz === M), { rzecz: M, akt: pierwszyAkt.akt, wydalone: true }, 'widok w chwili mówi, że tamtej wersji nie ma');
});

test('Z16. ponowienie czynności, której wersja została wydalona, nie zapisuje drugi raz', async () => {
  const W = await swiat();
  const Z = await W.obszar('krótka', { historia: 2 });
  const X = await W.poloz('jozz', Z, 'projekt/1', { nazwa: 'a' });
  const x = W.s.rzecz(X);
  const cialo = { op: op('raz'), co: 'poloz', rzecz: X, wersja: x.wersja, rodzaj: x.rodzaj, cechy: { nazwa: 'b' } };
  ok(await W.s.ruch('jozz', cialo));
  assert.equal(ok(await W.s.ruch('jozz', cialo)).powtorzone, true, 'kontrola: zwykłe ponowienie oddaje pierwszy wynik');
  for (const nazwa of ['c', 'd', 'e']) ok(await W.zmien('jozz', X, { nazwa }));
  const ile = W.s.historia(X).length;
  const pon = await W.s.ruch('jozz', cialo);
  assert.equal(pon.ok, false);
  assert.equal(W.s.historia(X).length, ile, 'nic nie przybyło');
});
