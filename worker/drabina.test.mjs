// Drabina przedstawień jako wartość pokrętła (typ drabina, 19 XI 2026; specyfikacja Opusa czatu we wspólnej pamięci agentów,
// wplywy/2026-11-19-opus-czat-orientacja-i-klocek-drabina.md, § 2). Sprawdziany pytają o to, co specyfikacja wymienia:
// wartość domyślna przechodzi; powtórzone co, od > do, pusta miara, szczebel bez od i do i bez rozmiaru, ucinaj bez
// rozmiaru i nieznane pole są odrzucane; nieznane co przechodzi; odwołanie {z} do pokrętła typu drabina się liczy.
// Każda odmowa ma kontrolę: ta sama wartość bez tej jednej wady przechodzi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { existsSync } from 'node:fs';
import { policzUstawienia, stronaUstawien, wadaWartosci, wadyDeklaracji, TYPY_POKRETEL } from './ustawienia.mjs';
import { wadaDrabiny, NAJWIECEJ_SZCZEBLI, GRANICE_DRABINY } from '../public/drabina.mjs';

const D = { typ: 'drabina' };
const kopia = (x) => JSON.parse(JSON.stringify(x));
const szczebel = (o = {}) => ({ co: 'opis', miara: { szer: 1 }, od: 0, do: 0, ...o });
const wartosc = (...s) => ({ szczeble: s.length ? s : [szczebel()] });
const ciagly = (o = {}) => ({ co: 'imie', miara: { szer: 1 }, rozmiar: { od: 9, do: 34 }, ...o });
// Dane sprawdzianu, nie źródło prawdy: wartość domyślna przepisana ze specyfikacji (§ 2). Stała, z której korzysta
// twarz, mieszka przy czytelniku Startu (public/start/drabina.mjs); DR6 porównuje ją z tą, gdy jest w drzewie.
const ZE_SPECYFIKACJI = {
  szczeble: [
    { co: 'imie', miara: { szer: 0.1111111111111111, wys: 0.29411764705882354 }, rozmiar: { od: 9, do: 34 }, ucinaj: { szer_od: 64, wys_od: 20, rozmiar: 9.5 } },
    { co: 'podpis_rodziny', miara: { szer: 1 }, od: 60, do: 160 },
    { co: 'zycie', miara: { szer: 0.6666666666666666, wys: 1 }, od: 62, do: 96 },
    { co: 'opis', miara: { szer: 0.7142857142857143, wys: 1 }, od: 100, do: 150 },
    { co: 'galezie', miara: { szer: 1, wys: 1.3 }, od: 300, do: 460 },
  ],
};
const CZYTELNIK_STARTU = new URL('../public/start/drabina.mjs', import.meta.url);

test('DR1. wartość domyślna ze specyfikacji przechodzi regułę i deklarację pokrętła', () => {
  assert.equal(wadaWartosci(D, ZE_SPECYFIKACJI), null);
  assert.equal(wadaDrabiny(ZE_SPECYFIKACJI), null, 'zaplecze i moduł wspólny z twarzą mówią to samo');
  assert.deepEqual(wadyDeklaracji({ nazwa: 'wyglad.karta.drabina', typ: 'drabina', opis: 'Od jakiej miary karty pojawia się który element.', domyslna: ZE_SPECYFIKACJI }), []);
  assert.match(TYPY_POKRETEL.drabina, /szczeble/);
});

// Gdy czytelnik Startu jest w drzewie (PR 69), jego stała ma przechodzić tę samą regułę: inaczej zaplecze odrzuciłoby
// deklarację pokrętła wyglad.karta.drabina z tablicy pokręteł przy zasiewie. Do tamtej chwili sprawdzian stoi jako
// pominięty, widocznie, a nie jako zielony.
test('DR6. stała czytelnika Startu przechodzi regułę i jest wartością ze specyfikacji', { skip: !existsSync(CZYTELNIK_STARTU) && 'public/start/drabina.mjs jeszcze nie w drzewie (PR 69)' }, async () => {
  const { DRABINA_DOMYSLNA } = await import(CZYTELNIK_STARTU.href);
  assert.equal(wadaDrabiny(DRABINA_DOMYSLNA), null);
  assert.deepEqual(kopia(DRABINA_DOMYSLNA), ZE_SPECYFIKACJI);
  const m = Object.fromEntries(DRABINA_DOMYSLNA.szczeble.map((s) => [s.co, s.miara]));
  assert.ok(Object.is(m.imie.szer, 1 / 9) && Object.is(m.imie.wys, 1 / 3.4) && Object.is(m.zycie.szer, 1 / 1.5) && Object.is(m.opis.szer, 1 / 1.4), 'ułamki co do bitu');
});

test('DR2. odmowy ze spisu specyfikacji, każda z kontrolą: ta sama wartość bez tej jednej wady przechodzi', () => {
  assert.equal(wadaWartosci(D, wartosc()), null, 'kontrola: najmniejszy szczebel przechodzi');
  assert.equal(wadaWartosci(D, wartosc(ciagly())), null, 'kontrola: najmniejszy szczebel ciągły przechodzi');
  const przypadki = [
    ['powtórzone co', wartosc(szczebel(), szczebel()), /ma już szczebel/],
    ['od większe niż do', wartosc(szczebel({ od: 150, do: 100 })), /od \(150\) jest większe niż do \(100\)/],
    ['pusta miara', wartosc(szczebel({ miara: {} })), /przynajmniej jednego pola/],
    ['miara zero', wartosc(szczebel({ miara: { szer: 0 } })), /miara\.szer ma być liczbą większą od 0/],
    ['miara ujemna', wartosc(szczebel({ miara: { wys: -1 } })), /miara\.wys ma być liczbą większą od 0/],
    ['miara napisem', wartosc(szczebel({ miara: { szer: '1' } })), /miara\.szer/],
    ['miara z nieznanym polem', wartosc(szczebel({ miara: { szer: 1, glebia: 2 } })), /"glebia" nikt nie czyta/],
    ['bez od i do, bez rozmiaru', wartosc({ co: 'opis', miara: { szer: 1 } }), /brakuje od i do/],
    ['samo od', wartosc({ co: 'opis', miara: { szer: 1 }, od: 3 }), /od i do to liczby/],
    ['od ujemne', wartosc(szczebel({ od: -5, do: 10 })), /nie mniejsze niż 0/],
    ['od i do razem z rozmiarem', wartosc(szczebel({ rozmiar: { od: 9, do: 34 } })), /nie oba naraz/],
    ['ucinaj bez rozmiaru', wartosc(szczebel({ ucinaj: { szer_od: 64, wys_od: 20, rozmiar: 9.5 } })), /tylko przy szczeblu ciągłym/],
    ['ucinaj bez jednego pola', wartosc(ciagly({ ucinaj: { szer_od: 64, rozmiar: 9.5 } })), /wszystkie trzy pola/],
    ['ucinaj z nieznanym polem', wartosc(ciagly({ ucinaj: { szer_od: 64, wys_od: 20, rozmiar: 9.5, kropki: 3 } })), /wszystkie trzy pola/],
    ['rozmiar od zera', wartosc(ciagly({ rozmiar: { od: 0, do: 34 } })), /od większe od 0/],
    ['rozmiar do mniejsze niż od', wartosc(ciagly({ rozmiar: { od: 20, do: 10 } })), /do nie mniejsze niż od/],
    ['rozmiar z nieznanym polem', wartosc(ciagly({ rozmiar: { od: 9, do: 34, krok: 1.5 } })), /rozmiar to \{od, do\}/],
    ['nieznane pole liczbowe w szczeblu', wartosc(szczebel({ przezroczystosc: 0.5 })), /"przezroczystosc" nikt nie czyta/],
    ['nieznane pole w drabinie', { ...wartosc(), wersja: 2 }, /tylko pole szczeble/],
    ['zero szczebli', { szczeble: [] }, /od 1 do 24 szczebli, a ta ma 0/],
    ['25 szczebli', { szczeble: Array.from({ length: NAJWIECEJ_SZCZEBLI + 1 }, (_, i) => szczebel({ co: 'e' + i })) }, /a ta ma 25/],
    ['co z wielkiej litery', wartosc(szczebel({ co: 'Opis' })), /co to nazwa elementu/],
    ['co za długie', wartosc(szczebel({ co: 'a'.repeat(41) })), /co to nazwa elementu/],
    ['co od cyfry', wartosc(szczebel({ co: '1opis' })), /co to nazwa elementu/],
    ['szczebel nie obiektem', { szczeble: ['opis'] }, /szczebel 1: ma być obiektem/],
    // krzywa przenikania stoi w specyfikacji, ale twarz jej nie czyta: na razie odrzucana jak każde pole bez czytelnika
    ['krzywa po nazwie', wartosc(szczebel({ krzywa: 'gladka' })), /"krzywa" nikt nie czyta/],
    ['krzywa Béziera', wartosc(szczebel({ krzywa: [0.4, 0, 0.2, 1] })), /"krzywa" nikt nie czyta/],
    ['lista zamiast obiektu', [szczebel()], /drabina to \{szczeble/],
    ['null', null, /drabina to \{szczeble/],
  ];
  for (const [nazwa, w, wzor] of przypadki) {
    const wada = wadaWartosci(D, w);
    assert.ok(wada, `${nazwa}: miała być odmowa`);
    assert.match(wada, wzor, `${nazwa}: ${wada}`);
  }
  // kontrole drugiej strony: granice, które mają przejść
  for (const [nazwa, w] of [
    ['24 szczeble', { szczeble: Array.from({ length: NAJWIECEJ_SZCZEBLI }, (_, i) => szczebel({ co: 'e' + i })) }],
    ['od = do = 0 (zawsze)', wartosc(szczebel({ od: 0, do: 0 }))],
    ['od = do (próg)', wartosc(szczebel({ od: 120, do: 120 }))],
    ['sama wysokość w mierze', wartosc(szczebel({ miara: { wys: 2 } }))],
    ['co z cyfrą i podkreśleniem', wartosc(szczebel({ co: 'podpis_rodziny2' }))],
    ['rozmiar od = do', wartosc(ciagly({ rozmiar: { od: 9, do: 9 } }))],
    ['ucinaj z zerami', wartosc(ciagly({ ucinaj: { szer_od: 0, wys_od: 0, rozmiar: 1 } }))],
  ]) assert.equal(wadaWartosci(D, w), null, nazwa);
});

test('DR3. nieznane co przechodzi: nowa twarz i nowy element nie psują starych wartości', () => {
  const w = kopia(ZE_SPECYFIKACJI);
  w.szczeble.push(szczebel({ co: 'przyszly_element', od: 10, do: 20 }));
  assert.equal(wadaWartosci(D, w), null);
});

// Druga linia zgłoszenia 72 (20 XI 2026): wartość, którą reguła przepuszczała, zatrzymywała rysowanie Startu.
test('DR7. twarde granice liczb: wartość, na której twarz stawała (2·10^8 prób na kartę), jest odrzucana zdaniem; same granice przechodzą', () => {
  const zawieszajaca = { szczeble: [{ co: 'imie', miara: { szer: 1e6 }, rozmiar: { od: 1e-6, do: 1e9 } }] };
  assert.ok(wadaDrabiny(zawieszajaca), 'wartość z drugiej linii zgłoszenia 72 jest odrzucana');
  const przypadki = [
    ['miara ponad granicę', wartosc(szczebel({ miara: { szer: GRANICE_DRABINY.miara * 10 } })), /nie większą niż 100/],
    ['do ponad granicę px', wartosc(szczebel({ od: 0, do: GRANICE_DRABINY.px + 1 })), /przekracza 100000 px/],
    ['pismo mniejsze niż 1 px', wartosc(ciagly({ rozmiar: { od: 0.5, do: 34 } })), /między 1 a 1000 px/],
    ['pismo większe niż 1000 px', wartosc(ciagly({ rozmiar: { od: 9, do: 5000 } })), /między 1 a 1000 px/],
    ['ucinaj ponad granicę', wartosc(ciagly({ ucinaj: { szer_od: 1e9, wys_od: 20, rozmiar: 9.5 } })), /najwyżej 100000 px/],
    ['ucinaj z pismem 0.5 px', wartosc(ciagly({ ucinaj: { szer_od: 64, wys_od: 20, rozmiar: 0.5 } })), /między 1 a 1000 px/],
    // dwa warunki, na których mutanty przeżyły (druga linia Opusa czatu, 20 XI 01:06): każdy ma teraz własny przypadek
    ['ucinaj z wys_od ponad granicę', wartosc(ciagly({ ucinaj: { szer_od: 64, wys_od: GRANICE_DRABINY.px + 1, rozmiar: 9.5 } })), /najwyżej 100000 px/],
    ['ucinaj z pismem ponad 1000 px', wartosc(ciagly({ ucinaj: { szer_od: 64, wys_od: 20, rozmiar: GRANICE_DRABINY.pismo.do + 1 } })), /między 1 a 1000 px/],
  ];
  for (const [nazwa, w, wzor] of przypadki) {
    const wada = wadaWartosci(D, w);
    assert.ok(wada, `${nazwa}: miała być odmowa`);
    assert.match(wada, wzor, `${nazwa}: ${wada}`);
  }
  for (const [nazwa, w] of [
    ['miara równa granicy', wartosc(szczebel({ miara: { szer: GRANICE_DRABINY.miara } }))],
    ['do równe granicy px', wartosc(szczebel({ od: 0, do: GRANICE_DRABINY.px }))],
    ['pismo od 1 do 1000 px', wartosc(ciagly({ rozmiar: { od: 1, do: 1000 } }))],
    ['ucinaj na granicach', wartosc(ciagly({ ucinaj: { szer_od: GRANICE_DRABINY.px, wys_od: GRANICE_DRABINY.px, rozmiar: 1000 } }))],
  ]) assert.equal(wadaWartosci(D, w), null, `kontrola: ${nazwa}`);
});

test('DR4. przez środowisko: pokrętło typu drabina, wartość w zasięgu, odmowa zdaniem i odwołanie {z} do drugiej drabiny', async () => {
  let t = Date.UTC(2026, 10, 19, 19, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w)); return w; };
  ok(await s.ruch('jozz', { op: 'dr4-karta', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: 'proba.karta.drabina', typ: 'drabina', domyslna: ZE_SPECYFIKACJI, opis: 'Od jakiej miary karty pojawia się który element.' } }));
  ok(await s.ruch('jozz', { op: 'dr4-telefon', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: 'proba.telefon.drabina', typ: 'drabina', domyslna: { z: 'proba.karta.drabina' }, opis: 'Drabina na telefonie idzie za drabiną karty.' } }));
  const licz = () => policzUstawienia(s.dla('agent-a')).wartosci;
  assert.deepEqual(licz()['proba.karta.drabina'].wartosc, kopia(ZE_SPECYFIKACJI));
  // opis zawsze w pełni: od = do = 0 (falsyfikator 2 specyfikacji, tu tylko jako wartość, bez twarzy)
  const zawsze = kopia(ZE_SPECYFIKACJI);
  Object.assign(zawsze.szczeble.find((x) => x.co === 'opis'), { od: 0, do: 0 });
  const w = ok(await s.ruch('jozz', { op: 'dr4-zawsze', co: 'poloz', rodzaj: 'wartosc/1', cechy: { pokretlo: 'proba.karta.drabina', wartosc: zawsze } }));
  assert.deepEqual(licz()['proba.karta.drabina'].wartosc, zawsze);
  assert.deepEqual(licz()['proba.telefon.drabina'].wartosc, zawsze, 'odwołanie {z} idzie za dzisiejszą wartością, nie za domyślną');
  // zła wartość: odmowa zdaniem, które mówi, który szczebel; do twarzy nic nie dochodzi
  const zla = kopia(zawsze);
  Object.assign(zla.szczeble[1], { od: 500, do: 100 });
  const odmowa = await s.ruch('jozz', { op: 'dr4-zla-wartosc', co: 'poloz', rodzaj: 'wartosc/1', rzecz: w.rzecz, wersja: w.wersja, cechy: { pokretlo: 'proba.karta.drabina', wartosc: zla } });
  assert.equal(odmowa.status, 422, JSON.stringify(odmowa));
  assert.match(JSON.stringify(odmowa), /szczebel 2 \(podpis_rodziny\): od \(500\) jest większe niż do \(100\)/);
  assert.deepEqual(licz()['proba.karta.drabina'].wartosc, zawsze);
  // kontrola: ta sama wartość z poprawionym szczeblem przechodzi
  Object.assign(zla.szczeble[1], { od: 100, do: 500 });
  ok(await s.ruch('jozz', { op: 'dr4-dobra', co: 'poloz', rodzaj: 'wartosc/1', rzecz: w.rzecz, wersja: w.wersja, cechy: { pokretlo: 'proba.karta.drabina', wartosc: zla } }));
  // odwołanie do pokrętła innego typu nie przechodzi (drabina nie idzie za kolorem)
  const obcy = await s.ruch('jozz', { op: 'dr4-obcy', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: 'proba.zla.drabina', typ: 'drabina', domyslna: { z: 'wyglad.paleta.jasna.tlo' }, opis: 'Idzie za kolorem.' } });
  assert.equal(obcy.status, 422, JSON.stringify(obcy));
  assert.match(obcy.blad, /typu kolor, a samo jest typu drabina/);
});

test('DR5. tekst /ustawienia mówi agentowi, czym jest typ drabina', async () => {
  let t = Date.UTC(2026, 10, 19, 19, 30, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const strona = stronaUstawien(s.dla('agent-a'));
  const tekst = typeof strona === 'string' ? strona : JSON.stringify(strona);
  assert.match(tekst, /drabina: drabina przedstawień/);
});
