// Ustawienia jako dane (17 XI 2026): pokrętło jest deklaracją, wartość obowiązuje w zasięgu i ma historię, zestaw to
// motyw albo preset, a liczenie idzie od najbliższego zasięgu w górę. Sprawdziany pytają o to, na czym stoi warstwa
// odczuwalna: czy zmiana jest zapisem z autorem i cofnięciem, czy prawo do strojenia jest prawem obszaru, czy zepsuta
// wartość nie dochodzi do twarzy, i czy to, czego ktoś nie widzi, nie wychodzi mu przez ustawienia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko, idZ, sprawdzCechy } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { obsluzSrodowisko } from './srodowisko-http.mjs';
import { umowaOkna } from './opis.mjs';
import { sprawdzSpojnosc } from './spojnosc.mjs';
import { policzUstawienia, POKRETLO_ZESTAWOW, FORMAT_USTAWIEN, wadaWartosci, wadyDeklaracji } from './ustawienia.mjs';
import { POKRETLA, Pokretla } from '../public/pokretla.mjs';

async function swiat() {
  let t = Date.UTC(2026, 10, 17, 21, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w)); return w; };
  const glowny = r.meta('obszar_glowny');
  const wartosc = (kto, op, pokretlo, w, dodatkowe = {}) => s.ruch(kto, { op, co: 'poloz', rodzaj: 'wartosc/1', cechy: { pokretlo, wartosc: w, ...(dodatkowe.zasieg ? { zasieg: dodatkowe.zasieg } : {}) }, ...(dodatkowe.wersja ? { wersja: dodatkowe.wersja } : {}), ...('obszar' in dodatkowe ? { obszar: dodatkowe.obszar } : {}) });
  const szkic = ok(await s.ruch('jozz', { op: 'ust-szkic', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Szkic wyglądu', ile_wolno: 'prowadzic' } })).rzecz;
  return { r, s, ok, glowny, szkic, wartosc, licz: (kto, o = {}) => policzUstawienia(s.dla(kto), o) };
}

test('U1. pierwsze pokrętła są rzeczami z jednej tablicy, a ich tożsamość jest nazwą: ta sama deklaracja dołożona ręką trafia w tę samą rzecz', async () => {
  const { s, licz } = await swiat();
  assert.equal(s.ile({ rodzaj: 'pokretlo/1' }), POKRETLA.length + 1, 'tablica i pokrętło zestawów');
  const u = licz('agent-a', { deklaracje: true });
  assert.equal(u.format, FORMAT_USTAWIEN);
  for (const d of POKRETLA) {
    assert.deepEqual(u.wartosci[d.nazwa], { wartosc: d.domyslna, skad: 'domyslna' }, d.nazwa);
    assert.deepEqual(wadyDeklaracji(d), [], d.nazwa);
  }
  const akcent = POKRETLA.find((d) => d.nazwa === 'wyglad.kolor.akcent');
  const rzecz = u.deklaracje.find((d) => d.nazwa === akcent.nazwa).rzecz;
  assert.equal(rzecz, await idZ('klucz', 'pokretlo', JSON.stringify([akcent.nazwa])), 'ziarno z kluczem ma tożsamość z klucza');
  const drugiRaz = await s.ruch('jozz', { op: 'ust-u1-drugi-raz', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { ...akcent } });
  assert.equal(drugiRaz.status, 409, JSON.stringify(drugiRaz));
  assert.equal(drugiRaz.rzecz, rzecz, 'nie powstaje druga deklaracja o tej samej nazwie');
  assert.deepEqual(u.lancuch.map((z) => z.rodzaj), ['obszar/1'], 'bez wskazanej rzeczy zasięgiem jest samo Miejsce');
});

test('U2. zmiana wyglądu jest zapisem: ma autora, kolejne wersje, cofnięcie i powrót do wartości domyślnej', async () => {
  const { s, ok, glowny, wartosc, licz } = await swiat();
  const a = ok(await wartosc('jozz', 'ust-u2-a', 'wyglad.kolor.akcent', '#336699'));
  assert.equal(a.skutek, 'polozone');
  const rz = s.rzecz(a.rzecz);
  assert.equal(rz.cechy.zasieg, glowny, 'bez podanego zasięgu wartość dotyczy całego Miejsca');
  assert.equal(rz.obszar, null, 'i leży w obszarze głównym');
  assert.deepEqual(licz('agent-a').wartosci['wyglad.kolor.akcent'], { wartosc: '#336699', skad: 'wartosc', zasieg: glowny, rzecz: a.rzecz, wersja: a.wersja });
  const b = ok(await wartosc('jozz', 'ust-u2-b', 'wyglad.kolor.akcent', '#aa0000', { wersja: a.wersja }));
  assert.equal(b.rzecz, a.rzecz, 'druga zmiana jest nową wersją tej samej rzeczy');
  assert.equal(s.historia(a.rzecz).length, 2);
  assert.equal(licz('agent-a').wartosci['wyglad.kolor.akcent'].wartosc, '#aa0000');
  ok(await s.ruch('jozz', { op: 'ust-u2-cofnij', co: 'cofnij', rzecz: a.rzecz, wersja: 'dowolna' }));
  assert.equal(licz('agent-a').wartosci['wyglad.kolor.akcent'].wartosc, '#336699', 'cofnięcie wraca poprzednią wartość');
  ok(await s.ruch('jozz', { op: 'ust-u2-odloz', co: 'odloz', rzecz: a.rzecz, wersja: 'dowolna' }));
  assert.equal(licz('agent-a').wartosci['wyglad.kolor.akcent'].skad, 'domyslna', 'odłożona wartość oddaje miejsce wartości odziedziczonej');
  // ponowienie tej samej czynności niczego nie robi dwa razy, mimo że zasięg dopisało środowisko
  const znowu = await wartosc('jozz', 'ust-u2-a', 'wyglad.kolor.akcent', '#336699');
  assert.equal(znowu.powtorzone, true, JSON.stringify(znowu));
});

test('U3. wartość musi pasować do deklaracji: zły typ i twarda klamra odbijają się ze zdaniem, zakres suwaka nie jest granicą', async () => {
  const { ok, wartosc } = await swiat();
  const zlyKolor = await wartosc('jozz', 'ust-u3-kolor', 'wyglad.kolor.tlo', 'czerwony');
  assert.equal(zlyKolor.status, 422);
  assert.match(zlyKolor.blad, /#rrggbb/);
  const pozaSuwakiem = ok(await wartosc('jozz', 'ust-u3-suwak', 'start.ruch.przelacznik_ms', 9000));
  assert.equal(pozaSuwakiem.skutek, 'polozone', 'wartość poza zakresem suwaka (do 2000) wolno zapisać: suwaki pozwalają na absurdy');
  const pozaKlamra = await wartosc('jozz', 'ust-u3-klamra', 'start.ruch.calosc_ms', 90000000);
  assert.equal(pozaKlamra.status, 422);
  assert.match(pozaKlamra.blad, /twardej klamry \(60000\)/, 'przycięcie jest widoczne i mówi, gdzie stoi klamra');
  assert.equal((await wartosc('jozz', 'ust-u3-ujemny', 'start.ruch.calosc_ms', -5)).status, 422);
  const nieMa = await wartosc('jozz', 'ust-u3-niema', 'wyglad.kolor.rozowy', '#ff00ff');
  assert.equal(nieMa.status, 422);
  assert.match(nieMa.blad, /nie ma pokrętła/);
  assert.equal((await wartosc('jozz', 'ust-u3-wybor', 'wyglad.jasnosc', 'szara')).status, 422);
  // typy potrzebne wyglądowi i odczuciu mają sprawdzanie, zanim powstanie pierwsze takie pokrętło
  assert.equal(wadaWartosci({ typ: 'sprezyna' }, { sztywnosc: 170, tlumienie: 26 }), null);
  assert.match(wadaWartosci({ typ: 'sprezyna' }, { sztywnosc: 0, tlumienie: 1 }), /sprężyna/);
  assert.equal(wadaWartosci({ typ: 'rampa' }, [{ w: 0, kolor: '#000000' }, { w: 1, kolor: '#ffffff' }]), null);
  assert.match(wadaWartosci({ typ: 'rampa' }, [{ w: 1, kolor: '#000000' }, { w: 0, kolor: '#ffffff' }]), /rosnącego/);
  assert.equal(wadaWartosci({ typ: 'krzywa' }, [0.2, 0, 0, 1]), null);
  assert.equal(wadaWartosci({ typ: 'krzywa' }, 'gladka'), null);
  assert.equal(wadaWartosci({ typ: 'kroj' }, { rodzina: 'Recursive, sans-serif', grubosc: 650, osie: { wght: 650, CASL: 1 } }), null);
  assert.equal(wadaWartosci({ typ: 'cien' }, { x: 0, y: 8, rozmycie: 24, kolor: '#00000073' }), null);
});

test('U4. prawo do strojenia jest prawem obszaru: w szkicu agent stroi sam, całe Miejsce może tylko zaproponować', async () => {
  const { s, ok, szkic, wartosc, licz } = await swiat();
  const wSzkicu = ok(await wartosc('agent-a', 'ust-u4-szkic', 'wyglad.kolor.akcent', '#008800', { zasieg: szkic }));
  assert.equal(wSzkicu.skutek, 'polozone');
  assert.equal(s.rzecz(wSzkicu.rzecz).obszar, szkic, 'wartość, której zasięgiem jest obszar, leży w nim');
  const dlaMiejsca = await wartosc('agent-a', 'ust-u4-miejsce', 'wyglad.kolor.akcent', '#880000');
  assert.equal(dlaMiejsca.skutek, 'propozycja', JSON.stringify(dlaMiejsca));
  assert.equal(licz('agent-a').wartosci['wyglad.kolor.akcent'].skad, 'domyslna', 'propozycja nie zmienia wyglądu Miejsca');
  assert.equal(licz('agent-a', { dla: szkic }).wartosci['wyglad.kolor.akcent'].wartosc, '#008800', 'kto patrzy przez szkic, widzi wartość ze szkicu');
  // rzecz leżąca w szkicu dziedziczy po nim, a czego szkic nie mówi, bierze z Miejsca
  ok(await wartosc('jozz', 'ust-u4-tlo', 'wyglad.kolor.tlo', '#101010'));
  const widok = ok(await s.ruch('jozz', { op: 'ust-u4-widok', co: 'poloz', rodzaj: 'widok/1', obszar: szkic, cechy: { nazwa: 'Widok w szkicu' } }));
  const u = licz('agent-a', { dla: widok.rzecz });
  assert.deepEqual(u.lancuch.map((z) => z.rodzaj), ['widok/1', 'obszar/1', 'obszar/1']);
  assert.equal(u.wartosci['wyglad.kolor.akcent'].wartosc, '#008800');
  assert.equal(u.wartosci['wyglad.kolor.tlo'].wartosc, '#101010');
  // właściciel przyjmuje propozycję jednym gestem i dopiero wtedy zmienia się całe Miejsce
  ok(await s.ruch('jozz', { op: 'ust-u4-przyjmij', co: 'przyjmij', propozycja: dlaMiejsca.propozycja }));
  assert.equal(licz('agent-a').wartosci['wyglad.kolor.akcent'].wartosc, '#880000');
});

test('U5. wartości nie da się położyć gdzie indziej niż w jej zasięgu: agent nie zmieni wyglądu Miejsca z obszaru, w którym prowadzi', async () => {
  const { szkic, glowny, wartosc, licz } = await swiat();
  const bokiem = await wartosc('agent-a', 'ust-u5-bokiem', 'wyglad.kolor.akcent', '#ff0000', { zasieg: glowny, obszar: szkic });
  assert.equal(bokiem.ok, false, JSON.stringify(bokiem));
  assert.equal(bokiem.status, 400);
  assert.equal(licz('agent-a').wartosci['wyglad.kolor.akcent'].skad, 'domyslna');
});

test('U6. zestaw to motyw albo preset: włączony w zasięgu daje wartości, późniejszy wygrywa, wartość wprost wygrywa z każdym, zmiana zestawu dociera od razu', async () => {
  const { s, ok, glowny, wartosc, licz } = await swiat();
  const noc = ok(await s.ruch('jozz', { op: 'ust-u6-noc', co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa: 'Noc', po_co: 'motyw', wartosci: { 'wyglad.kolor.tlo': '#000011', 'wyglad.kolor.akcent': '#ffcc00' } } }));
  const spokojnie = ok(await s.ruch('jozz', { op: 'ust-u6-spokojnie', co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa: 'Spokojnie', po_co: 'preset', wartosci: { 'wyglad.ruch.natezenie': 0.5, 'wyglad.kolor.akcent': '#00ccff' } } }));
  assert.equal(licz('agent-a').wartosci['wyglad.kolor.tlo'].skad, 'domyslna', 'zestaw, którego nikt nie włączył, niczego nie zmienia');
  const wlaczone = ok(await wartosc('jozz', 'ust-u6-wlacz', POKRETLO_ZESTAWOW, [noc.rzecz, spokojnie.rzecz]));
  let u = licz('agent-a');
  assert.deepEqual(u.wartosci['wyglad.kolor.tlo'], { wartosc: '#000011', skad: 'zestaw', zasieg: glowny, rzecz: noc.rzecz, zestaw: 'Noc' });
  assert.equal(u.wartosci['wyglad.kolor.akcent'].wartosc, '#00ccff', 'późniejszy na liście wygrywa');
  assert.equal(u.wartosci['wyglad.ruch.natezenie'].wartosc, 0.5);
  ok(await wartosc('jozz', 'ust-u6-wprost', 'wyglad.kolor.akcent', '#123456'));
  assert.equal(licz('agent-a').wartosci['wyglad.kolor.akcent'].skad, 'wartosc', 'wartość wprost wygrywa z zestawem');
  const z = s.rzecz(noc.rzecz);
  ok(await s.ruch('jozz', { op: 'ust-u6-kuje', co: 'poloz', rzecz: noc.rzecz, wersja: z.wersja, rodzaj: 'zestaw/1', cechy: { ...z.cechy, wartosci: { ...z.cechy.wartosci, 'wyglad.kolor.tlo': '#220022' } } }));
  assert.equal(licz('agent-a').wartosci['wyglad.kolor.tlo'].wartosc, '#220022', 'zmiana motywu dociera wszędzie, gdzie jest włączony');
  ok(await wartosc('jozz', 'ust-u6-przelacz', POKRETLO_ZESTAWOW, [spokojnie.rzecz], { wersja: wlaczone.wersja }));
  assert.equal(licz('agent-a').wartosci['wyglad.kolor.tlo'].skad, 'domyslna', 'przełączenie motywu to jeden zapis');
  // zestaw nie przemyca wartości, które nie przeszłyby wprost
  const zly = await s.ruch('jozz', { op: 'ust-u6-zly', co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa: 'Zły', wartosci: { 'wyglad.kolor.tlo': 'nie kolor', 'nie.ma.takiego': 1 } } });
  assert.equal(zly.status, 422);
  assert.equal(zly.bledy.length, 2, JSON.stringify(zly));
  const obcy = await wartosc('jozz', 'ust-u6-obcy', POKRETLO_ZESTAWOW, [glowny], { wersja: 'dowolna' });
  assert.equal(obcy.status, 422, 'na liście zestawów stoją tylko zestawy');
});

test('U7. profil to nakładka: wartości przypięte do profilu obowiązują tylko twarz, która go poda', async () => {
  const { s, ok, wartosc, licz } = await swiat();
  const telefon = ok(await s.ruch('jozz', { op: 'ust-u7-profil', co: 'poloz', rodzaj: 'profil/1', cechy: { nazwa: 'Telefon' } }));
  ok(await wartosc('jozz', 'ust-u7-miejsce', 'reka.prog_przeciagania_px', 4));
  ok(await wartosc('jozz', 'ust-u7-telefon', 'reka.prog_przeciagania_px', 14, { zasieg: telefon.rzecz }));
  assert.equal(licz('jozz').wartosci['reka.prog_przeciagania_px'].wartosc, 4);
  const u = licz('jozz', { nakladki: [telefon.rzecz] });
  assert.equal(u.wartosci['reka.prog_przeciagania_px'].wartosc, 14);
  assert.deepEqual(u.lancuch.map((z) => z.rodzaj), ['profil/1', 'obszar/1']);
});

test('U8. ustawienia nie są drogą obok widoczności: zasięg, wartość i pokrętło z zamkniętego obszaru nie istnieją dla tego, kto go nie widzi', async () => {
  const { s, ok, wartosc, licz } = await swiat();
  const T = ok(await s.ruch('jozz', { op: 'ust-u8-tajne', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Tajne', widzi: 'wlasciciel', ile_wolno: 'prowadzic' } })).rzecz;
  ok(await wartosc('jozz', 'ust-u8-wartosc', 'wyglad.kolor.akcent', '#abcdef', { zasieg: T }));
  ok(await s.ruch('jozz', { op: 'ust-u8-pokretlo', co: 'poloz', rodzaj: 'pokretlo/1', obszar: T, cechy: { nazwa: 'tajne.narzedzie.prog', typ: 'liczba', domyslna: 3, opis: 'Tajne pokrętło.' } }));
  assert.equal(licz('jozz', { dla: T }).wartosci['wyglad.kolor.akcent'].wartosc, '#abcdef');
  assert.ok('tajne.narzedzie.prog' in licz('jozz').wartosci);
  const dlaAgenta = licz('agent-a', { dla: T });
  assert.equal(dlaAgenta.status, 404, JSON.stringify(dlaAgenta).slice(0, 200));
  const u = licz('agent-a');
  assert.ok(!('tajne.narzedzie.prog' in u.wartosci), 'pokrętło z zamkniętego obszaru nie jest wymienione');
  assert.ok(!JSON.stringify(u).includes('#abcdef') && !JSON.stringify(u).includes(T));
  // i zapis: agent nie ustawi wartości pokrętła, którego nie widzi, ani w zasięgu, którego nie widzi
  const tajnePokretlo = await wartosc('agent-a', 'ust-u8-zapis-a', 'tajne.narzedzie.prog', 5);
  const nieMaPokretla = await wartosc('agent-a', 'ust-u8-zapis-a', 'tajne.narzedzie.inne', 5);
  assert.equal(JSON.stringify(tajnePokretlo).split('tajne.narzedzie.prog').join('X'), JSON.stringify(nieMaPokretla).split('tajne.narzedzie.inne').join('X'));
  assert.equal((await wartosc('agent-a', 'ust-u8-zapis-b', 'wyglad.kolor.akcent', '#111111', { zasieg: T })).ok, false);
});

test('U9. nowe pokrętło dokłada każdy, bez wydania kodu; zła deklaracja odbija się ze zdaniem; zepsuta wartość nie dochodzi do twarzy', async () => {
  const { s, ok, wartosc, licz } = await swiat();
  const d = { nazwa: 'pomysly.lista.odstep_px', typ: 'liczba', domyslna: 8, zakres: { od: 0, do: 40 }, twarde: { od: 0, do: 400 }, jednostka: 'px', opis: 'Odstęp między pozycjami listy pomysłów.' };
  const dekl = ok(await s.ruch('agent-a', { op: 'ust-u9-deklaracja', co: 'poloz', rodzaj: 'pokretlo/1', cechy: d }));
  assert.equal(dekl.skutek, 'polozone', 'narzędzie deklaruje własne pokrętło ruchem (ląduje w Nowe)');
  assert.equal(licz('agent-a').wartosci[d.nazwa].wartosc, 8);
  ok(await wartosc('jozz', 'ust-u9-wartosc', d.nazwa, 12));
  assert.equal(licz('agent-a').wartosci[d.nazwa].wartosc, 12);
  for (const [op, zla, wzor] of [['a', { ...d, nazwa: 'bezkropki' }, /nazwa:/], ['b', { ...d, nazwa: 'x.y', domyslna: 'osiem' }, /domyslna:/], ['c', { ...d, nazwa: 'x.z', typ: 'kolorek' }, /typ:/], ['d', { ...d, nazwa: 'x.w', opis: ' ' }, /opis:/], ['e', { ...d, nazwa: 'x.v', zakres: { od: 5, do: 1 } }, /zakres:/]]) {
    const w = await s.ruch('agent-a', { op: 'ust-u9-zla-' + op, co: 'poloz', rodzaj: 'pokretlo/1', cechy: zla });
    assert.equal(w.status, 422, JSON.stringify(w));
    assert.match(w.blad, wzor);
  }
  // deklaracja zmienia typ: dawna wartość przestaje do niej pasować, więc liczenie ją pomija i mówi o tym
  const rz = s.rzecz(dekl.rzecz);
  ok(await s.ruch('jozz', { op: 'ust-u9-zmiana-typu', co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: 'pokretlo/1', cechy: { nazwa: d.nazwa, typ: 'wybor', wartosci: ['ciasno', 'luzno'], domyslna: 'luzno', opis: d.opis } }));
  const u = licz('agent-a');
  assert.equal(u.wartosci[d.nazwa].wartosc, 'luzno');
  assert.equal(u.pominiete.length, 1);
  assert.equal(u.pominiete[0].pokretlo, d.nazwa);
});

test('U10. zasięg się przenosi: wartość idzie za rzeczą, do której jest przypięta, a wnętrze obszaru zostaje w nim; spis jest spójny', async () => {
  const { s, ok, szkic, wartosc } = await swiat();
  const widok = ok(await s.ruch('jozz', { op: 'ust-u10-widok', co: 'poloz', rodzaj: 'widok/1', cechy: { nazwa: 'Wędrowny widok' } }));
  const naWidoku = ok(await wartosc('jozz', 'ust-u10-na-widoku', 'start.karta.rog_px', 2, { zasieg: widok.rzecz }));
  const wSzkicu = ok(await wartosc('jozz', 'ust-u10-w-szkicu', 'start.karta.rog_px', 30, { zasieg: szkic }));
  assert.equal(s.rzecz(naWidoku.rzecz).obszar, null);
  const w = s.rzecz(widok.rzecz);
  ok(await s.ruch('jozz', { op: 'ust-u10-przenies-widok', co: 'poloz', rzecz: w.id, wersja: w.wersja, rodzaj: 'widok/1', obszar: szkic, cechy: w.cechy }));
  assert.equal(s.rzecz(naWidoku.rzecz).obszar, szkic, 'wartość poszła za widokiem');
  const inny = ok(await s.ruch('jozz', { op: 'ust-u10-inny', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Inny rodzic' } }));
  const o = s.rzecz(szkic);
  ok(await s.ruch('jozz', { op: 'ust-u10-przenies-szkic', co: 'poloz', rzecz: szkic, wersja: o.wersja, rodzaj: 'obszar/1', obszar: inny.rzecz, cechy: o.cechy }));
  assert.equal(s.rzecz(wSzkicu.rzecz).obszar, szkic, 'wnętrze obszaru zostaje w nim, gdy obszar zmienia rodzica');
  assert.equal(s.rzecz(naWidoku.rzecz).obszar, szkic);
  assert.equal(sprawdzSpojnosc(s).niezgodne.length, 0, JSON.stringify(sprawdzSpojnosc(s).niezgodne).slice(0, 300));
  s.przebuduj();
  assert.equal(s.rzecz(wSzkicu.rzecz).obszar, szkic, 'spis odbudowany z dziennika daje to samo');
  assert.equal(s.rzecz(naWidoku.rzecz).obszar, szkic);
});

test('U11. przez drzwi: jedno żądanie daje twarzy wszystkie wartości, a strona tekstowa mówi agentowi, co da się stroić i jak', async () => {
  const { s, ok, wartosc } = await swiat();
  ok(await wartosc('jozz', 'ust-u11-wartosc', 'wyglad.kolor.akcent', '#445566'));
  const pytanie = (sciezka, kto = 'agent-a') => obsluzSrodowisko(s, new Request('https://proba.example' + sciezka, { headers: { 'x-kto': kto } }));
  const o = await pytanie('/api/srodowisko/ustawienia?deklaracje=tak');
  assert.equal(o.status, 200);
  const d = await o.json();
  assert.equal(d.wartosci['wyglad.kolor.akcent'].wartosc, '#445566');
  assert.equal(d.akt, s.ostatniNr());
  assert.ok(d.deklaracje.some((x) => x.nazwa === 'start.ruch.przelacznik_ms' && x.typ === 'czas' && x.zakres.do === 2000));
  assert.equal((await pytanie('/api/srodowisko/ustawienia?dla=zzzzzzzzzzzzzzzzzzzzzzzzzz')).status, 404);
  assert.equal((await pytanie('/api/srodowisko/ustawienia?dla=cos')).status, 400);
  const tekst = await (await pytanie('/ustawienia')).text();
  assert.match(tekst, /wyglad\.kolor\.akcent = "#445566"/);
  assert.match(tekst, /JAK ZMIENIĆ/);
  assert.match(tekst, /sprezyna:/);
  // twarz: tablica w ręku daje wartości domyślne, a po odpowiedzi drzwi wartości z Miejsca; tryb bezpieczny zostaje przy domyślnych
  let zmian = 0;
  const p = new Pokretla({ naZmiane: () => { zmian++; } });
  assert.equal(p.w('wyglad.kolor.akcent'), POKRETLA.find((x) => x.nazwa === 'wyglad.kolor.akcent').domyslna);
  assert.equal(p.przyjmij(d), true);
  assert.equal(p.przyjmij(d), false, 'ta sama odpowiedź nie jest zmianą');
  assert.equal(zmian, 1);
  assert.equal(p.w('wyglad.kolor.akcent'), '#445566');
  assert.equal(p.kolor('akcent', false), '#445566');
  assert.equal(p.czas('start.ruch.calosc_ms'), 450);
  const bezpieczny = new Pokretla({ bezpiecznie: true });
  bezpieczny.przyjmij(d);
  assert.notEqual(bezpieczny.w('wyglad.kolor.akcent'), '#445566', 'tryb bezpieczny nie bierze wartości z Miejsca');
});

test('U12. ustawienie wartości po jej odłożeniu znowu działa; umowa okna i przykładowi goście znają wiadomość z wyglądem', async () => {
  const { s, ok, wartosc, licz } = await swiat();
  const a = ok(await wartosc('jozz', 'ust-u12-a', 'wyglad.kolor.akcent', '#111111'));
  ok(await s.ruch('jozz', { op: 'ust-u12-odloz', co: 'odloz', rzecz: a.rzecz, wersja: 'dowolna' }));
  assert.equal(licz('agent-a').wartosci['wyglad.kolor.akcent'].skad, 'domyslna');
  ok(await wartosc('jozz', 'ust-u12-b', 'wyglad.kolor.akcent', '#222222', { wersja: 'dowolna' }));
  assert.equal(licz('agent-a').wartosci['wyglad.kolor.akcent'].wartosc, '#222222', 'ponowne ustawienie przywraca wartość, inaczej ręka ustawiałaby coś bez skutku');
  assert.ok(!s.rzecz(a.rzecz).odlozone);
  assert.match(umowaOkna(), /look +\{ciemny, kolory/);
  const goscie = s.spis({ rodzaj: 'gosc/1', limit: 20 });
  assert.ok(goscie.length >= 2);
  for (const g of goscie) {
    const kod = s.kodGoscia(g.cechy.kod);
    assert.match(kod, /m\.type === 'look'/, g.cechy.nazwa);
    assert.match(kod, /function ubierz/, g.cechy.nazwa);
  }
});

// --- po niezależnym ataku (17 XI 2026, pomocnik na innym modelu, lokalnie) ---------------------------------------------

test('U13. zestaw podlega prawu każdego zasięgu, w którym jest włączony: agent nie zmieni wyglądu Miejsca, kując albo odkładając zestaw, który leży tam, gdzie prowadzi', async () => {
  const { s, ok, szkic, wartosc, licz } = await swiat();
  const zestaw = async (znak, nazwa, tlo) => ok(await s.ruch('agent-a', { op: 'ust-u13-zestaw-' + znak, co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa, po_co: 'motyw', wartosci: { 'wyglad.kolor.tlo': tlo } } }));
  const kuj = async (op, id, tlo) => { const rz = s.rzecz(id); return s.ruch('agent-a', { op, co: 'poloz', rzecz: id, wersja: rz.wersja, rodzaj: 'zestaw/1', cechy: { ...rz.cechy, wartosci: { 'wyglad.kolor.tlo': tlo } } }); };
  const a = await zestaw('a', 'Łagodny', '#f4f1ea');
  const b = await zestaw('b', 'Drugi', '#e0e0e0');
  assert.equal(a.skutek, 'polozone', 'agent kładzie zestaw tam, gdzie prowadzi');
  // dopóki zestaw nie działa nigdzie, gdzie agent może tylko proponować, kuje go sam
  assert.notEqual(ok(await kuj('ust-u13-kuje-przed', a.rzecz, '#f0ede6')).skutek, 'propozycja');
  const wlacz = ok(await wartosc('agent-a', 'ust-u13-wlacz', POKRETLO_ZESTAWOW, [b.rzecz, a.rzecz]));
  assert.equal(wlacz.skutek, 'propozycja', 'włączenie zestawu dla całego Miejsca agent może tylko zaproponować');
  ok(await s.ruch('jozz', { op: 'ust-u13-przyjmij', co: 'przyjmij', propozycja: wlacz.propozycja }));
  assert.equal(licz('agent-a').wartosci['wyglad.kolor.tlo'].wartosc, '#f0ede6', 'właściciel przyjął zestaw taki, jaki był w chwili przyjęcia');
  // od tej chwili zestaw działa w zasięgu, w którym agent może tylko proponować: zmiana i odłożenie zestawu też są propozycją
  const podmiana = ok(await kuj('ust-u13-podmiana', a.rzecz, '#ff00ff'));
  assert.equal(podmiana.skutek, 'propozycja', JSON.stringify(podmiana));
  assert.match(podmiana.powod, /włączony w zasięgu/);
  const odlozenie = ok(await s.ruch('agent-a', { op: 'ust-u13-odloz', co: 'odloz', rzecz: b.rzecz, wersja: s.rzecz(b.rzecz).wersja }));
  assert.equal(odlozenie.skutek, 'propozycja', JSON.stringify(odlozenie));
  const u = licz('agent-a');
  assert.deepEqual([u.wartosci['wyglad.kolor.tlo'].wartosc, u.wartosci['wyglad.kolor.tlo'].skad], ['#f0ede6', 'zestaw'], 'wygląd Miejsca się nie zmienił');
  assert.ok(s.wskazujaNa(a.rzecz).some((x) => x.cecha === 'wartosc'), 'zestaw wie, które wartości go włączają');
  // właściciel wyłącza zestawy dla Miejsca: kucie wraca do agenta
  for (const pr of [podmiana.propozycja, odlozenie.propozycja]) ok(await s.ruch('jozz', { op: 'ust-u13-odrzuc-' + pr.slice(0, 6), co: 'odrzuc', propozycja: pr }));
  const wartoscZestawow = s.spis({ rodzaj: 'wartosc/1', gdzie: { pokretlo: POKRETLO_ZESTAWOW } })[0];
  ok(await s.ruch('jozz', { op: 'ust-u13-wylacz', co: 'odloz', rzecz: wartoscZestawow.id, wersja: 'dowolna' }));
  assert.notEqual(ok(await kuj('ust-u13-kuje-po', a.rzecz, '#eeeeee')).skutek, 'propozycja', 'zestaw, którego nic nie włącza poza zasięgiem agenta, znowu kuje agent');
  // kucie na żywo zostaje tam, gdzie zestaw i zasięg mają to samo prawo
  assert.notEqual(ok(await wartosc('agent-a', 'ust-u13-w-szkicu', POKRETLO_ZESTAWOW, [a.rzecz], { zasieg: szkic })).skutek, 'propozycja');
  assert.notEqual(ok(await kuj('ust-u13-kuje-w-szkicu', a.rzecz, '#dddddd')).skutek, 'propozycja');
  assert.equal(licz('agent-a', { dla: szkic }).wartosci['wyglad.kolor.tlo'].wartosc, '#dddddd');
});

test('U14. obszar z natury liczy się po całym łańcuchu: po odbudowie spisu nic z zamkniętego obszaru nie zostaje w głównym, spójność widzi każde ogniwo, a zasięgiem wartości nie jest inne ustawienie', async () => {
  const { s, ok, wartosc } = await swiat();
  const T = ok(await s.ruch('jozz', { op: 'ust-u14-tajne', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Tajne', widzi: 'wlasciciel', ile_wolno: 'prowadzic' } })).rzecz;
  ok(await s.ruch('jozz', { op: 'ust-u14-ksztalt', co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'ogniwo/1', opis: 'Ogniwo łańcucha: leży tam, gdzie poprzednie.', lezy_z: 'poprzednie', cechy: { nazwa: { typ: 'tekst', wymagana: true }, poprzednie: { typ: 'rzecz', wymagana: true } } } }));
  const kotwica = ok(await s.ruch('jozz', { op: 'ust-u14-kotwica', co: 'poloz', rodzaj: 'widok/1', obszar: T, cechy: { nazwa: 'Kotwica' } })).rzecz;
  const lancuch = [];
  let poprzednie = kotwica;
  for (let i = 0; i < 14; i++) { poprzednie = ok(await s.ruch('jozz', { op: 'ust-u14-ogniwo-' + i, co: 'poloz', rodzaj: 'ogniwo/1', cechy: { nazwa: 'ogniwo ' + i, poprzednie } })).rzecz; lancuch.push(poprzednie); }
  for (const id of lancuch) assert.equal(s.rzecz(id).obszar, T, 'ogniwo leży tam, gdzie poprzednie');
  s.przebuduj();
  for (const id of lancuch) {
    assert.equal(s.rzecz(id).obszar, T, 'po odbudowie spisu każde ogniwo dalej leży w zamkniętym obszarze');
    assert.equal(s.rzecz(id, { dla: 'agent-a' }), null);
  }
  assert.equal(sprawdzSpojnosc(s).rodziny.lezy_z, 0);
  // spis skrzywiony w całym ogonie (tak zostawiała go odbudowa z ograniczoną liczbą obiegów): spójność liczy każde ogniwo
  for (const id of lancuch.slice(-5)) s._przenies(id, 'ogniwo/1', T, false, null);
  assert.equal(sprawdzSpojnosc(s).rodziny.lezy_z, 5, 'pięć ogniw leży nie tam, gdzie wynika z łańcucha, a nie jedno');
  assert.equal(s.wyrownajZNatury(), 5);
  assert.equal(sprawdzSpojnosc(s).rodziny.lezy_z, 0);
  // koła nie da się zamknąć nawet ręką właściciela, więc łańcuch zawsze ma koniec
  const pierwsze = s.rzecz(lancuch[0]);
  const kolo = await s.ruch('jozz', { op: 'ust-u14-kolo', co: 'poloz', rzecz: pierwsze.id, wersja: pierwsze.wersja, rodzaj: 'ogniwo/1', cechy: { ...pierwsze.cechy, poprzednie: lancuch[1] } });
  assert.equal(kolo.status, 422, JSON.stringify(kolo));
  assert.match(kolo.blad, /zamyka koło/);
  assert.equal(s.wyrownajZNatury(), 0);
  assert.equal(sprawdzSpojnosc(s).rodziny.lezy_z, 0);
  // zasięgiem jest rzecz, którą się stroi, nie samo ustawienie
  const v = ok(await wartosc('jozz', 'ust-u14-wartosc', 'wyglad.kolor.akcent', '#010203'));
  const naWartosci = await wartosc('jozz', 'ust-u14-na-wartosci', 'wyglad.kolor.tlo', '#040506', { zasieg: v.rzecz });
  assert.equal(naWartosci.status, 422, JSON.stringify(naWartosci));
  assert.match(naWartosci.blad, /zasięgiem wartości nie może być/);
});

test('U15. nazwy pokrętła nie da się zająć z góry: zasiew bierze rzecz założoną pod kluczem ziarna przez kogoś innego niż właściciel, a twarz nie rysuje wartością w złym typie', async () => {
  const { s, ok, wartosc } = await swiat();
  const d = { nazwa: 'przyszle.narzedzie.rozmiar', typ: 'liczba', domyslna: 3, twarde: { od: 0, do: 10 }, opis: 'Rozmiar w przyszłym narzędziu.' };
  const ziarno = [{ nazwa: 'pokretlo-' + d.nazwa, rodzaj: 'pokretlo/1', cechy: d }];
  const zajecie = ok(await s.ruch('agent-a', { op: 'ust-u15-zajecie', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: d.nazwa, typ: 'dowolne', domyslna: 'cokolwiek', opis: 'Zajęte z góry.' } }));
  assert.notEqual(s.rzecz(zajecie.rzecz).obszar, null, 'agent kładzie deklarację tam, gdzie prowadzi');
  await s.zasiej(ziarno);
  let rz = s.rzecz(zajecie.rzecz);
  assert.deepEqual([rz.cechy.typ, rz.obszar, rz.zmienil], ['liczba', null, 'srodowisko'], 'deklaracja jest z ziarna i leży tam, gdzie ziarno');
  assert.deepEqual(s.historia(rz.id).map((h) => h.kto), ['agent-a', 'srodowisko'], 'obca wersja zostaje w historii');
  assert.equal((await wartosc('jozz', 'ust-u15-zla', d.nazwa, 'napis')).status, 422, 'wartość w złym typie znowu się odbija');
  await s.zasiej(ziarno);
  assert.equal(s.historia(rz.id).length, 2, 'drugi zasiew tego samego ziarna niczego nie dopisuje');
  // rzecz, której dotknął właściciel, jest jego: zasiew ustępuje
  const e = { ...d, nazwa: 'przyszle.narzedzie.kolor' };
  const drugie = ok(await s.ruch('agent-a', { op: 'ust-u15-drugie', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: e.nazwa, typ: 'dowolne', domyslna: 'cokolwiek', opis: 'Też z góry.' } }));
  rz = s.rzecz(drugie.rzecz);
  ok(await s.ruch('jozz', { op: 'ust-u15-reka', co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: 'pokretlo/1', cechy: { ...rz.cechy, opis: 'Właściciel to obejrzał i zostawił.' } }));
  await s.zasiej([{ nazwa: 'pokretlo-' + e.nazwa, rodzaj: 'pokretlo/1', cechy: e }]);
  assert.equal(s.rzecz(drugie.rzecz).cechy.typ, 'dowolne', 'ręka właściciela wygrywa z zasiewem');
  // twarz: z Miejsca bierze tylko to, co zna, i tylko w typie ze swojej tablicy
  const p = new Pokretla();
  p.przyjmij({ ok: true, format: FORMAT_USTAWIEN, akt: 5, wartosci: {
    'wyglad.ruch.natezenie': { wartosc: 'szybko', skad: 'wartosc' }, 'wyglad.kolor.akcent': { wartosc: '#112233', skad: 'wartosc' },
    'start.cien.krycie': { wartosc: 7, skad: 'wartosc' }, 'wyglad.jasnosc': { wartosc: 'szara', skad: 'wartosc' }, 'obce.pokretlo.x': { wartosc: 1, skad: 'wartosc' } } });
  assert.equal(p.w('wyglad.ruch.natezenie'), 1, 'napis zamiast liczby nie dochodzi do rysowania');
  assert.equal(p.w('wyglad.kolor.akcent'), '#112233');
  assert.equal(p.w('start.cien.krycie'), POKRETLA.find((x) => x.nazwa === 'start.cien.krycie').domyslna, 'liczba spoza twardej klamry też nie');
  assert.equal(p.w('wyglad.jasnosc'), 'auto');
  assert.equal(p.w('obce.pokretlo.x'), undefined);
});

test('U16. następne pokolenie rodzaju nie jest furtką: kształt rodzaju środowiska i kształt, który zmienia leżenie, układ albo klucz względem pokolenia już opisanego, ustala właściciel', async () => {
  const { s, ok, glowny, wartosc } = await swiat();
  const k = (op, cechy) => s.ruch('agent-a', { op, co: 'poloz', rodzaj: 'ksztalt/1', cechy });
  const w2 = await k('ust-u16-wartosc2', { dla: 'wartosc/2', klucz: ['pokretlo', 'zasieg'], opis: 'Drugie pokolenie wartości, bez reguły leżenia.', cechy: { pokretlo: { typ: 'tekst', wymagana: true }, zasieg: { typ: 'tekst', wymagana: true }, wartosc: { typ: 'dowolne' } } });
  assert.equal(w2.skutek, 'propozycja', JSON.stringify(w2));
  assert.match(w2.powod, /należy do środowiska/);
  const u2 = await k('ust-u16-uczestnik2', { dla: 'uczestnik/2', klucz: ['imie'], tytul: 'imie', opis: 'Drugie pokolenie uczestnika.', cechy: { imie: { typ: 'tekst', wymagana: true }, rola: { typ: 'tekst' } } });
  assert.equal(u2.skutek, 'propozycja', JSON.stringify(u2));
  assert.equal(s.ksztaltDla('wartosc/2'), null);
  assert.equal(s.ksztaltDla('uczestnik/2'), null);
  const obca = await s.ruch('agent-a', { op: 'ust-u16-rzecz', co: 'poloz', rodzaj: 'wartosc/2', cechy: { pokretlo: 'wyglad.ruch.natezenie', zasieg: glowny, wartosc: 'cokolwiek' } });
  // rzecz rodzaju bez kształtu da się położyć (nikt jej nie sprawdza), ale nie jest wartością i nie zajmuje jej tożsamości
  assert.match(String(obca.uwaga), /nie ma kształtu/, JSON.stringify(obca).slice(0, 200));
  assert.notEqual(obca.rzecz, await idZ('klucz', 'wartosc', JSON.stringify(['wyglad.ruch.natezenie', glowny])));
  assert.equal(policzUstawienia(s.dla('agent-a')).wartosci['wyglad.ruch.natezenie'].skad, 'domyslna');
  assert.equal(ok(await wartosc('jozz', 'ust-u16-wlasciciel', 'wyglad.ruch.natezenie', 0.5)).skutek, 'polozone', 'właściciel ustawia wartość bez przeszkód');
  // rodzaj spoza środowiska: to samo pokolenie z tym samym kluczem agent dokłada sam, z innym kluczem tylko proponuje
  ok(await s.ruch('jozz', { op: 'ust-u16-etykieta1', co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'etykieta/1', klucz: ['nazwa'], opis: 'Etykieta o jednej nazwie.', cechy: { nazwa: { typ: 'tekst', wymagana: true } } } }));
  const e2 = await k('ust-u16-etykieta2', { dla: 'etykieta/2', klucz: ['nazwa'], opis: 'Etykieta z kolorem.', cechy: { nazwa: { typ: 'tekst', wymagana: true }, kolor: { typ: 'tekst' } } });
  assert.equal(e2.skutek, 'polozone', JSON.stringify(e2));
  const e3 = await k('ust-u16-etykieta3', { dla: 'etykieta/3', opis: 'Etykieta bez klucza.', cechy: { nazwa: { typ: 'tekst', wymagana: true } } });
  assert.equal(e3.skutek, 'propozycja', JSON.stringify(e3));
  assert.match(e3.powod, /tożsamość/);
});

test('U17. za długi napis mówi, że jest za długi, a nie że nie jest napisem', () => {
  const k = { cechy: { tresc: { typ: 'tekst' } } };
  assert.deepEqual(sprawdzCechy(k, { tresc: 'x'.repeat(200000) }, () => null, () => null).bledy, []);
  const b = sprawdzCechy(k, { tresc: 'x'.repeat(200001) }, () => null, () => null).bledy;
  assert.equal(b.length, 1);
  assert.match(b[0], /200001 znaków, a może mieć najwyżej 200000/);
  assert.match(sprawdzCechy(k, { tresc: 7 }, () => null, () => null).bledy[0], /ma być napisem/);
});
