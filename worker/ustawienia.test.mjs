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
import { policzUstawienia, policzUstawieniaDlaNazw, stronaUstawien, POKRETLO_ZESTAWOW, FORMAT_USTAWIEN, NAJWIECEJ_POKRETEL, wadaWartosci, wadyDeklaracji } from './ustawienia.mjs';
import { POKRETLA, Pokretla, NAZWY_POKRETEL, pasuje, krojNaCss, sprezynaNaFizyke, polaczPodglad } from '../public/pokretla.mjs';

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
  assert.equal(s.ile({ rodzaj: 'pokretlo/1' }), POKRETLA.length + 2, 'tablica, pokrętło zestawów i pokrętło twarzy domyślnej');
  assert.equal(licz('agent-a').wartosci['srodowisko.twarz_domyslna'].wartosc, 'gospodarz', 'główny adres domyślnie otwiera stronę gospodarza');
  const u = licz('agent-a', { deklaracje: true });
  assert.equal(u.format, FORMAT_USTAWIEN);
  for (const d of POKRETLA) {
    // wartość domyślna może iść za innym pokrętłem: wtedy twarz dostaje wartość tamtego i nazwę, za którą idzie
    const za = d.domyslna && typeof d.domyslna === 'object' && typeof d.domyslna.z === 'string' && Object.keys(d.domyslna).length === 1 ? d.domyslna.z : null;
    assert.deepEqual(u.wartosci[d.nazwa], za ? { wartosc: POKRETLA.find((x) => x.nazwa === za).domyslna, skad: 'domyslna', z: za } : { wartosc: d.domyslna, skad: 'domyslna' }, d.nazwa);
    assert.deepEqual(wadyDeklaracji(d), [], d.nazwa);
  }
  const akcent = POKRETLA.find((d) => d.nazwa === 'wyglad.paleta.jasna.akcent');
  const rzecz = u.deklaracje.find((d) => d.nazwa === akcent.nazwa).rzecz;
  assert.equal(rzecz, await idZ('klucz', 'pokretlo', JSON.stringify([akcent.nazwa])), 'ziarno z kluczem ma tożsamość z klucza');
  const drugiRaz = await s.ruch('jozz', { op: 'ust-u1-drugi-raz', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { ...akcent } });
  assert.equal(drugiRaz.status, 409, JSON.stringify(drugiRaz));
  assert.equal(drugiRaz.rzecz, rzecz, 'nie powstaje druga deklaracja o tej samej nazwie');
  assert.deepEqual(u.lancuch.map((z) => z.rodzaj), ['obszar/1'], 'bez wskazanej rzeczy zasięgiem jest samo Miejsce');
});

test('U2. zmiana wyglądu jest zapisem: ma autora, kolejne wersje, cofnięcie i powrót do wartości domyślnej', async () => {
  const { s, ok, glowny, wartosc, licz } = await swiat();
  const a = ok(await wartosc('jozz', 'ust-u2-a', 'wyglad.paleta.jasna.akcent', '#336699'));
  assert.equal(a.skutek, 'polozone');
  const rz = s.rzecz(a.rzecz);
  assert.equal(rz.cechy.zasieg, glowny, 'bez podanego zasięgu wartość dotyczy całego Miejsca');
  assert.equal(rz.obszar, null, 'i leży w obszarze głównym');
  assert.deepEqual(licz('agent-a').wartosci['wyglad.paleta.jasna.akcent'], { wartosc: '#336699', skad: 'wartosc', zasieg: glowny, rzecz: a.rzecz, wersja: a.wersja });
  const b = ok(await wartosc('jozz', 'ust-u2-b', 'wyglad.paleta.jasna.akcent', '#aa0000', { wersja: a.wersja }));
  assert.equal(b.rzecz, a.rzecz, 'druga zmiana jest nową wersją tej samej rzeczy');
  assert.equal(s.historia(a.rzecz).length, 2);
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.akcent'].wartosc, '#aa0000');
  ok(await s.ruch('jozz', { op: 'ust-u2-cofnij', co: 'cofnij', rzecz: a.rzecz, wersja: 'dowolna' }));
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.akcent'].wartosc, '#336699', 'cofnięcie wraca poprzednią wartość');
  ok(await s.ruch('jozz', { op: 'ust-u2-odloz', co: 'odloz', rzecz: a.rzecz, wersja: 'dowolna' }));
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.akcent'].skad, 'domyslna', 'odłożona wartość oddaje miejsce wartości odziedziczonej');
  // ponowienie tej samej czynności niczego nie robi dwa razy, mimo że zasięg dopisało środowisko
  const znowu = await wartosc('jozz', 'ust-u2-a', 'wyglad.paleta.jasna.akcent', '#336699');
  assert.equal(znowu.powtorzone, true, JSON.stringify(znowu));
});

test('U3. wartość musi pasować do deklaracji: zły typ i twarda klamra odbijają się ze zdaniem, zakres suwaka nie jest granicą', async () => {
  const { ok, wartosc } = await swiat();
  const zlyKolor = await wartosc('jozz', 'ust-u3-kolor', 'wyglad.paleta.jasna.tlo', 'czerwony');
  assert.equal(zlyKolor.status, 422);
  assert.match(zlyKolor.blad, /#rrggbb/);
  const pozaSuwakiem = ok(await wartosc('jozz', 'ust-u3-suwak', 'odczucie.ruch.przelacznik', 9000));
  assert.equal(pozaSuwakiem.skutek, 'polozone', 'wartość poza zakresem suwaka (do 2000) wolno zapisać: suwaki pozwalają na absurdy');
  const pozaKlamra = await wartosc('jozz', 'ust-u3-klamra', 'odczucie.ruch.kamera_do_calosci', 90000000);
  assert.equal(pozaKlamra.status, 422);
  assert.match(pozaKlamra.blad, /twardej klamry \(60000\)/, 'przycięcie jest widoczne i mówi, gdzie stoi klamra');
  assert.equal((await wartosc('jozz', 'ust-u3-ujemny', 'odczucie.ruch.kamera_do_calosci', -5)).status, 422);
  const nieMa = await wartosc('jozz', 'ust-u3-niema', 'wyglad.paleta.jasna.rozowy', '#ff00ff');
  assert.equal(nieMa.status, 422);
  assert.match(nieMa.blad, /nie ma pokrętła/);
  assert.equal((await wartosc('jozz', 'ust-u3-wybor', 'wyglad.jasnosc', 'szara')).status, 422);
  // typy potrzebne wyglądowi i odczuciu mają sprawdzanie, zanim powstanie pierwsze takie pokrętło
  assert.equal(wadaWartosci({ typ: 'sprezyna' }, { czas: 320, odbicie: 0.25 }), null);
  assert.match(wadaWartosci({ typ: 'sprezyna' }, { czas: 320, odbicie: 1.5 }), /sprężyna/);
  assert.equal(wadaWartosci({ typ: 'rampa' }, { przystanki: [{ w: 0, kolor: '#000000' }, { w: 1, kolor: '#ffffff' }] }), null);
  assert.match(wadaWartosci({ typ: 'rampa' }, { przystanki: [{ w: 1, kolor: '#000000' }, { w: 0, kolor: '#ffffff' }] }), /rosnącego/);
  assert.equal(wadaWartosci({ typ: 'krzywa' }, [0.2, 0, 0, 1]), null);
  assert.equal(wadaWartosci({ typ: 'krzywa' }, 'gladka'), null);
  assert.equal(wadaWartosci({ typ: 'kroj' }, { rodzina: 'Recursive, sans-serif', grubosc: 650, osie: { wght: 650, CASL: 1 } }), null);
  assert.equal(wadaWartosci({ typ: 'cien' }, { x: 0, y: 8, rozmycie: 24, kolor: '#00000073' }), null);
});

test('U4. prawo do strojenia jest prawem obszaru: w szkicu agent stroi sam, całe Miejsce może tylko zaproponować', async () => {
  const { s, ok, szkic, wartosc, licz } = await swiat();
  const wSzkicu = ok(await wartosc('agent-a', 'ust-u4-szkic', 'wyglad.paleta.jasna.akcent', '#008800', { zasieg: szkic }));
  assert.equal(wSzkicu.skutek, 'polozone');
  assert.equal(s.rzecz(wSzkicu.rzecz).obszar, szkic, 'wartość, której zasięgiem jest obszar, leży w nim');
  const dlaMiejsca = await wartosc('agent-a', 'ust-u4-miejsce', 'wyglad.paleta.jasna.akcent', '#880000');
  assert.equal(dlaMiejsca.skutek, 'propozycja', JSON.stringify(dlaMiejsca));
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.akcent'].skad, 'domyslna', 'propozycja nie zmienia wyglądu Miejsca');
  assert.equal(licz('agent-a', { dla: szkic }).wartosci['wyglad.paleta.jasna.akcent'].wartosc, '#008800', 'kto patrzy przez szkic, widzi wartość ze szkicu');
  // rzecz leżąca w szkicu dziedziczy po nim, a czego szkic nie mówi, bierze z Miejsca
  ok(await wartosc('jozz', 'ust-u4-tlo', 'wyglad.paleta.jasna.tlo', '#101010'));
  const widok = ok(await s.ruch('jozz', { op: 'ust-u4-widok', co: 'poloz', rodzaj: 'widok/1', obszar: szkic, cechy: { nazwa: 'Widok w szkicu' } }));
  const u = licz('agent-a', { dla: widok.rzecz });
  assert.deepEqual(u.lancuch.map((z) => z.rodzaj), ['widok/1', 'obszar/1', 'obszar/1']);
  assert.equal(u.wartosci['wyglad.paleta.jasna.akcent'].wartosc, '#008800');
  assert.equal(u.wartosci['wyglad.paleta.jasna.tlo'].wartosc, '#101010');
  // właściciel przyjmuje propozycję jednym gestem i dopiero wtedy zmienia się całe Miejsce
  ok(await s.ruch('jozz', { op: 'ust-u4-przyjmij', co: 'przyjmij', propozycja: dlaMiejsca.propozycja }));
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.akcent'].wartosc, '#880000');
});

test('U5. wartości nie da się położyć gdzie indziej niż w jej zasięgu: agent nie zmieni wyglądu Miejsca z obszaru, w którym prowadzi', async () => {
  const { szkic, glowny, wartosc, licz } = await swiat();
  const bokiem = await wartosc('agent-a', 'ust-u5-bokiem', 'wyglad.paleta.jasna.akcent', '#ff0000', { zasieg: glowny, obszar: szkic });
  assert.equal(bokiem.ok, false, JSON.stringify(bokiem));
  assert.equal(bokiem.status, 400);
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.akcent'].skad, 'domyslna');
});

test('U6. zestaw to motyw albo preset: włączony w zasięgu daje wartości, późniejszy wygrywa, wartość wprost wygrywa z każdym, zmiana zestawu dociera od razu', async () => {
  const { s, ok, glowny, wartosc, licz } = await swiat();
  const noc = ok(await s.ruch('jozz', { op: 'ust-u6-noc', co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa: 'Noc', po_co: 'motyw', wartosci: { 'wyglad.paleta.jasna.tlo': '#000011', 'wyglad.paleta.jasna.akcent': '#ffcc00' } } }));
  const spokojnie = ok(await s.ruch('jozz', { op: 'ust-u6-spokojnie', co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa: 'Spokojnie', po_co: 'preset', wartosci: { 'odczucie.ruch.natezenie': 0.5, 'wyglad.paleta.jasna.akcent': '#00ccff' } } }));
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.tlo'].skad, 'domyslna', 'zestaw, którego nikt nie włączył, niczego nie zmienia');
  const wlaczone = ok(await wartosc('jozz', 'ust-u6-wlacz', POKRETLO_ZESTAWOW, [noc.rzecz, spokojnie.rzecz]));
  let u = licz('agent-a');
  assert.deepEqual(u.wartosci['wyglad.paleta.jasna.tlo'], { wartosc: '#000011', skad: 'zestaw', zasieg: glowny, rzecz: noc.rzecz, zestaw: 'Noc' });
  assert.equal(u.wartosci['wyglad.paleta.jasna.akcent'].wartosc, '#00ccff', 'późniejszy na liście wygrywa');
  assert.equal(u.wartosci['odczucie.ruch.natezenie'].wartosc, 0.5);
  ok(await wartosc('jozz', 'ust-u6-wprost', 'wyglad.paleta.jasna.akcent', '#123456'));
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.akcent'].skad, 'wartosc', 'wartość wprost wygrywa z zestawem');
  const z = s.rzecz(noc.rzecz);
  ok(await s.ruch('jozz', { op: 'ust-u6-kuje', co: 'poloz', rzecz: noc.rzecz, wersja: z.wersja, rodzaj: 'zestaw/1', cechy: { ...z.cechy, wartosci: { ...z.cechy.wartosci, 'wyglad.paleta.jasna.tlo': '#220022' } } }));
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.tlo'].wartosc, '#220022', 'zmiana motywu dociera wszędzie, gdzie jest włączony');
  ok(await wartosc('jozz', 'ust-u6-przelacz', POKRETLO_ZESTAWOW, [spokojnie.rzecz], { wersja: wlaczone.wersja }));
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.tlo'].skad, 'domyslna', 'przełączenie motywu to jeden zapis');
  // zestaw nie przemyca wartości, które nie przeszłyby wprost
  const zly = await s.ruch('jozz', { op: 'ust-u6-zly', co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa: 'Zły', wartosci: { 'wyglad.paleta.jasna.tlo': 'nie kolor', 'nie.ma.takiego': 1 } } });
  assert.equal(zly.status, 422);
  assert.equal(zly.bledy.length, 2, JSON.stringify(zly));
  const obcy = await wartosc('jozz', 'ust-u6-obcy', POKRETLO_ZESTAWOW, [glowny], { wersja: 'dowolna' });
  assert.equal(obcy.status, 422, 'na liście zestawów stoją tylko zestawy');
});

test('U7. profil to nakładka: wartości przypięte do profilu obowiązują tylko twarz, która go poda', async () => {
  const { s, ok, wartosc, licz } = await swiat();
  const telefon = ok(await s.ruch('jozz', { op: 'ust-u7-profil', co: 'poloz', rodzaj: 'profil/1', cechy: { nazwa: 'Telefon' } }));
  ok(await wartosc('jozz', 'ust-u7-miejsce', 'odczucie.reka.prog_przeciagania', 4));
  ok(await wartosc('jozz', 'ust-u7-telefon', 'odczucie.reka.prog_przeciagania', 14, { zasieg: telefon.rzecz }));
  assert.equal(licz('jozz').wartosci['odczucie.reka.prog_przeciagania'].wartosc, 4);
  const u = licz('jozz', { nakladki: [telefon.rzecz] });
  assert.equal(u.wartosci['odczucie.reka.prog_przeciagania'].wartosc, 14);
  assert.deepEqual(u.lancuch.map((z) => z.rodzaj), ['profil/1', 'obszar/1']);
});

test('U8. ustawienia nie są drogą obok widoczności: zasięg, wartość i pokrętło z zamkniętego obszaru nie istnieją dla tego, kto go nie widzi', async () => {
  const { s, ok, wartosc, licz } = await swiat();
  const T = ok(await s.ruch('jozz', { op: 'ust-u8-tajne', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Tajne', widzi: 'wlasciciel', ile_wolno: 'prowadzic' } })).rzecz;
  ok(await wartosc('jozz', 'ust-u8-wartosc', 'wyglad.paleta.jasna.akcent', '#abcdef', { zasieg: T }));
  ok(await s.ruch('jozz', { op: 'ust-u8-pokretlo', co: 'poloz', rodzaj: 'pokretlo/1', obszar: T, cechy: { nazwa: 'tajne.narzedzie.prog', typ: 'liczba', domyslna: 3, opis: 'Tajne pokrętło.' } }));
  assert.equal(licz('jozz', { dla: T }).wartosci['wyglad.paleta.jasna.akcent'].wartosc, '#abcdef');
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
  assert.equal((await wartosc('agent-a', 'ust-u8-zapis-b', 'wyglad.paleta.jasna.akcent', '#111111', { zasieg: T })).ok, false);
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
  const naWidoku = ok(await wartosc('jozz', 'ust-u10-na-widoku', 'wyglad.karta.rog', 2, { zasieg: widok.rzecz }));
  const wSzkicu = ok(await wartosc('jozz', 'ust-u10-w-szkicu', 'wyglad.karta.rog', 30, { zasieg: szkic }));
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
  ok(await wartosc('jozz', 'ust-u11-wartosc', 'wyglad.paleta.jasna.akcent', '#445566'));
  const pytanie = (sciezka, kto = 'agent-a') => obsluzSrodowisko(s, new Request('https://proba.example' + sciezka, { headers: { 'x-kto': kto } }));
  const o = await pytanie('/api/srodowisko/ustawienia?deklaracje=tak');
  assert.equal(o.status, 200);
  const d = await o.json();
  assert.equal(d.wartosci['wyglad.paleta.jasna.akcent'].wartosc, '#445566');
  assert.equal(d.akt, s.ostatniNr());
  assert.ok(d.deklaracje.some((x) => x.nazwa === 'odczucie.ruch.przelacznik' && x.typ === 'czas' && x.zakres.do === 2000));
  assert.equal((await pytanie('/api/srodowisko/ustawienia?dla=zzzzzzzzzzzzzzzzzzzzzzzzzz')).status, 404);
  assert.equal((await pytanie('/api/srodowisko/ustawienia?dla=cos')).status, 400);
  const tekst = await (await pytanie('/ustawienia')).text();
  assert.match(tekst, /wyglad\.paleta\.jasna\.akcent = "#445566"/);
  assert.match(tekst, /JAK ZMIENIĆ/);
  assert.match(tekst, /sprezyna:/);
  // twarz: tablica w ręku daje wartości domyślne, a po odpowiedzi drzwi wartości z Miejsca; tryb bezpieczny zostaje przy domyślnych
  let zmian = 0;
  const p = new Pokretla({ naZmiane: () => { zmian++; } });
  assert.equal(p.w('wyglad.paleta.jasna.akcent'), POKRETLA.find((x) => x.nazwa === 'wyglad.paleta.jasna.akcent').domyslna);
  assert.equal(p.przyjmij(d), true);
  assert.equal(p.przyjmij(d), false, 'ta sama odpowiedź nie jest zmianą');
  assert.equal(zmian, 1);
  assert.equal(p.w('wyglad.paleta.jasna.akcent'), '#445566');
  assert.equal(p.kolor('akcent', false), '#445566');
  assert.equal(p.czas('odczucie.ruch.kamera_do_calosci'), 450);
  const bezpieczny = new Pokretla({ bezpiecznie: true });
  bezpieczny.przyjmij(d);
  assert.notEqual(bezpieczny.w('wyglad.paleta.jasna.akcent'), '#445566', 'tryb bezpieczny nie bierze wartości z Miejsca');
});

test('U12. ustawienie wartości po jej odłożeniu znowu działa; umowa okna i przykładowi goście znają wiadomość z wyglądem', async () => {
  const { s, ok, wartosc, licz } = await swiat();
  const a = ok(await wartosc('jozz', 'ust-u12-a', 'wyglad.paleta.jasna.akcent', '#111111'));
  ok(await s.ruch('jozz', { op: 'ust-u12-odloz', co: 'odloz', rzecz: a.rzecz, wersja: 'dowolna' }));
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.akcent'].skad, 'domyslna');
  ok(await wartosc('jozz', 'ust-u12-b', 'wyglad.paleta.jasna.akcent', '#222222', { wersja: 'dowolna' }));
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.akcent'].wartosc, '#222222', 'ponowne ustawienie przywraca wartość, inaczej ręka ustawiałaby coś bez skutku');
  assert.ok(!s.rzecz(a.rzecz).odlozone);
  assert.match(umowaOkna(), /look +\{v: 2, ciemny, kolory: \{<rola>: barwa/);
  assert.match(umowaOkna(), /read ustawienia -> \{wartosci/, 'narzędzie w oknie czyta pokrętła po nazwie, także własne');
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
  const zestaw = async (znak, nazwa, tlo) => ok(await s.ruch('agent-a', { op: 'ust-u13-zestaw-' + znak, co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa, po_co: 'motyw', wartosci: { 'wyglad.paleta.jasna.tlo': tlo } } }));
  const kuj = async (op, id, tlo) => { const rz = s.rzecz(id); return s.ruch('agent-a', { op, co: 'poloz', rzecz: id, wersja: rz.wersja, rodzaj: 'zestaw/1', cechy: { ...rz.cechy, wartosci: { 'wyglad.paleta.jasna.tlo': tlo } } }); };
  const a = await zestaw('a', 'Łagodny', '#f4f1ea');
  const b = await zestaw('b', 'Drugi', '#e0e0e0');
  assert.equal(a.skutek, 'polozone', 'agent kładzie zestaw tam, gdzie prowadzi');
  // dopóki zestaw nie działa nigdzie, gdzie agent może tylko proponować, kuje go sam
  assert.notEqual(ok(await kuj('ust-u13-kuje-przed', a.rzecz, '#f0ede6')).skutek, 'propozycja');
  const wlacz = ok(await wartosc('agent-a', 'ust-u13-wlacz', POKRETLO_ZESTAWOW, [b.rzecz, a.rzecz]));
  assert.equal(wlacz.skutek, 'propozycja', 'włączenie zestawu dla całego Miejsca agent może tylko zaproponować');
  ok(await s.ruch('jozz', { op: 'ust-u13-przyjmij', co: 'przyjmij', propozycja: wlacz.propozycja }));
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.tlo'].wartosc, '#f0ede6', 'właściciel przyjął zestaw taki, jaki był w chwili przyjęcia');
  // od tej chwili zestaw działa w zasięgu, w którym agent może tylko proponować: zmiana i odłożenie zestawu też są propozycją
  const podmiana = ok(await kuj('ust-u13-podmiana', a.rzecz, '#ff00ff'));
  assert.equal(podmiana.skutek, 'propozycja', JSON.stringify(podmiana));
  assert.match(podmiana.powod, /włączony w zasięgu/);
  const odlozenie = ok(await s.ruch('agent-a', { op: 'ust-u13-odloz', co: 'odloz', rzecz: b.rzecz, wersja: s.rzecz(b.rzecz).wersja }));
  assert.equal(odlozenie.skutek, 'propozycja', JSON.stringify(odlozenie));
  const u = licz('agent-a');
  assert.deepEqual([u.wartosci['wyglad.paleta.jasna.tlo'].wartosc, u.wartosci['wyglad.paleta.jasna.tlo'].skad], ['#f0ede6', 'zestaw'], 'wygląd Miejsca się nie zmienił');
  assert.ok(s.wskazujaNa(a.rzecz).some((x) => x.cecha === 'wartosc'), 'zestaw wie, które wartości go włączają');
  // właściciel wyłącza zestawy dla Miejsca: kucie wraca do agenta
  for (const pr of [podmiana.propozycja, odlozenie.propozycja]) ok(await s.ruch('jozz', { op: 'ust-u13-odrzuc-' + pr.slice(0, 6), co: 'odrzuc', propozycja: pr }));
  const wartoscZestawow = s.spis({ rodzaj: 'wartosc/1', gdzie: { pokretlo: POKRETLO_ZESTAWOW } })[0];
  ok(await s.ruch('jozz', { op: 'ust-u13-wylacz', co: 'odloz', rzecz: wartoscZestawow.id, wersja: 'dowolna' }));
  assert.notEqual(ok(await kuj('ust-u13-kuje-po', a.rzecz, '#eeeeee')).skutek, 'propozycja', 'zestaw, którego nic nie włącza poza zasięgiem agenta, znowu kuje agent');
  // kucie na żywo zostaje tam, gdzie zestaw i zasięg mają to samo prawo
  assert.notEqual(ok(await wartosc('agent-a', 'ust-u13-w-szkicu', POKRETLO_ZESTAWOW, [a.rzecz], { zasieg: szkic })).skutek, 'propozycja');
  assert.notEqual(ok(await kuj('ust-u13-kuje-w-szkicu', a.rzecz, '#dddddd')).skutek, 'propozycja');
  assert.equal(licz('agent-a', { dla: szkic }).wartosci['wyglad.paleta.jasna.tlo'].wartosc, '#dddddd');
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
  const v = ok(await wartosc('jozz', 'ust-u14-wartosc', 'wyglad.paleta.jasna.akcent', '#010203'));
  const naWartosci = await wartosc('jozz', 'ust-u14-na-wartosci', 'wyglad.paleta.jasna.tlo', '#040506', { zasieg: v.rzecz });
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
    'odczucie.ruch.natezenie': { wartosc: 'szybko', skad: 'wartosc' }, 'wyglad.paleta.jasna.akcent': { wartosc: '#112233', skad: 'wartosc' },
    'wyglad.karta.rog': { wartosc: 700, skad: 'wartosc' }, 'wyglad.jasnosc': { wartosc: 'szara', skad: 'wartosc' }, 'obce.pokretlo.x': { wartosc: 1, skad: 'wartosc' } } });
  assert.equal(p.w('odczucie.ruch.natezenie'), 1, 'napis zamiast liczby nie dochodzi do rysowania');
  assert.equal(p.w('wyglad.paleta.jasna.akcent'), '#112233');
  assert.equal(p.w('wyglad.karta.rog'), POKRETLA.find((x) => x.nazwa === 'wyglad.karta.rog').domyslna, 'liczba spoza twardej klamry też nie');
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
  const obca = await s.ruch('agent-a', { op: 'ust-u16-rzecz', co: 'poloz', rodzaj: 'wartosc/2', cechy: { pokretlo: 'odczucie.ruch.natezenie', zasieg: glowny, wartosc: 'cokolwiek' } });
  // rzecz rodzaju bez kształtu da się położyć (nikt jej nie sprawdza), ale nie jest wartością i nie zajmuje jej tożsamości
  assert.match(String(obca.uwaga), /nie ma kształtu/, JSON.stringify(obca).slice(0, 200));
  assert.notEqual(obca.rzecz, await idZ('klucz', 'wartosc', JSON.stringify(['odczucie.ruch.natezenie', glowny])));
  assert.equal(policzUstawienia(s.dla('agent-a')).wartosci['odczucie.ruch.natezenie'].skad, 'domyslna');
  assert.equal(ok(await wartosc('jozz', 'ust-u16-wlasciciel', 'odczucie.ruch.natezenie', 0.5)).skutek, 'polozone', 'właściciel ustawia wartość bez przeszkód');
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

test('U18. koszt liczenia dla twarzy nie rośnie z tym, co ktoś dołożył obok: twarz pyta po nazwach, a środowisko czyta tylko te pokrętła i zasięgi na drodze', async () => {
  const { s, ok, szkic, glowny, wartosc } = await swiat();
  ok(await wartosc('jozz', 'ust-u18-akcent', 'wyglad.paleta.jasna.akcent', '#102030'));
  const noc = ok(await s.ruch('jozz', { op: 'ust-u18-noc', co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa: 'Noc', po_co: 'motyw', wartosci: { 'wyglad.paleta.jasna.tlo': '#000011' } } }));
  ok(await wartosc('jozz', 'ust-u18-wlacz', POKRETLO_ZESTAWOW, [noc.rzecz]));
  const nazwy = NAZWY_POKRETEL.split(',');
  const licz = async (f) => { let wiersze = 0, pytan = 0; const q0 = s.q; s.q = function (...a) { const w = q0.apply(this, a); pytan++; wiersze += w.length; return w; }; try { return { wynik: await f(), wiersze, pytan }; } finally { s.q = q0; } };
  const przed = await licz(() => policzUstawieniaDlaNazw(s.dla('agent-a'), { nazwy }));
  assert.equal(przed.wynik.ok, true);
  assert.deepEqual(Object.keys(przed.wynik.wartosci).sort(), [...nazwy].sort(), 'tyle wartości, o ile nazw zapytano');
  assert.deepEqual(przed.wynik.wartosci, Object.fromEntries(Object.entries(policzUstawienia(s.dla('agent-a')).wartosci).filter(([n]) => nazwy.includes(n))), 'to samo, co daje liczenie wszystkiego');
  assert.equal(przed.wynik.wartosci['wyglad.paleta.jasna.akcent'].wartosc, '#102030');
  assert.equal(przed.wynik.wartosci['wyglad.paleta.jasna.tlo'].skad, 'zestaw');
  // ktoś dokłada obok 120 własnych pokręteł i 120 wartości tam, gdzie prowadzi
  for (let i = 0; i < 120; i++) {
    ok(await s.ruch('agent-a', { op: 'ust-u18-obce-' + i, co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: 'obce.narzedzie.p' + i, typ: 'liczba', domyslna: i, opis: 'Pokrętło obcego narzędzia.' } }));
    ok(await wartosc('agent-a', 'ust-u18-obca-wartosc-' + i, 'obce.narzedzie.p' + i, i + 1, { zasieg: szkic }));
  }
  const po = await licz(() => policzUstawieniaDlaNazw(s.dla('agent-a'), { nazwy }));
  assert.deepEqual(po.wynik.wartosci, przed.wynik.wartosci);
  assert.ok(po.wiersze <= przed.wiersze + 4, `wiersze przed ${przed.wiersze}, po ${po.wiersze}`);
  assert.ok(po.pytan <= przed.pytan + 4, `pytania przed ${przed.pytan}, po ${po.pytan}`);
  assert.ok(Object.keys(policzUstawienia(s.dla('agent-a')).wartosci).length >= nazwy.length + 120, 'liczenie wszystkiego niesie też cudze pokrętła, więc rośnie razem z nimi');
  // zasięg na drodze dalej działa: przez szkic widać wartość ze szkicu, a obce pokrętło jest dostępne temu, kto o nie zapyta
  ok(await wartosc('agent-a', 'ust-u18-szkic', 'wyglad.paleta.jasna.akcent', '#008800', { zasieg: szkic }));
  assert.equal((await policzUstawieniaDlaNazw(s.dla('agent-a'), { nazwy, dla: szkic })).wartosci['wyglad.paleta.jasna.akcent'].wartosc, '#008800');
  assert.deepEqual((await policzUstawieniaDlaNazw(s.dla('agent-a'), { nazwy: ['obce.narzedzie.p7', 'nie.ma.takiego'], dla: szkic })).wartosci, { 'obce.narzedzie.p7': { wartosc: 8, skad: 'wartosc', zasieg: szkic, rzecz: (await policzUstawieniaDlaNazw(s.dla('agent-a'), { nazwy: ['obce.narzedzie.p7'], dla: szkic })).wartosci['obce.narzedzie.p7'].rzecz, wersja: (await policzUstawieniaDlaNazw(s.dla('agent-a'), { nazwy: ['obce.narzedzie.p7'], dla: szkic })).wartosci['obce.narzedzie.p7'].wersja } });
  // przez drzwi, i oczami czytającego: zamknięty zasięg brzmi jak brak
  const pytanie = (sciezka, kto = 'agent-a') => obsluzSrodowisko(s, new Request('https://proba.example' + sciezka, { headers: { 'x-kto': kto } }));
  const d = await (await pytanie('/api/srodowisko/ustawienia?nazwy=wyglad.paleta.jasna.akcent,nie.ma.takiego,ZLA NAZWA')).json();
  assert.deepEqual(Object.keys(d.wartosci), ['wyglad.paleta.jasna.akcent']);
  assert.equal(d.lancuch[d.lancuch.length - 1].id, glowny);
  const T = ok(await s.ruch('jozz', { op: 'ust-u18-tajne', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Tajne', widzi: 'wlasciciel', ile_wolno: 'prowadzic' } })).rzecz;
  ok(await wartosc('jozz', 'ust-u18-tajna', 'wyglad.paleta.jasna.akcent', '#abcdef', { zasieg: T }));
  assert.equal((await pytanie('/api/srodowisko/ustawienia?nazwy=wyglad.paleta.jasna.akcent&dla=' + T)).status, 404);
  assert.equal((await (await pytanie('/api/srodowisko/ustawienia?nazwy=wyglad.paleta.jasna.akcent&dla=' + T, 'jozz')).json()).wartosci['wyglad.paleta.jasna.akcent'].wartosc, '#abcdef');
  assert.equal((await pytanie('/api/srodowisko/ustawienia?nazwy=' + Array.from({ length: 201 }, (_, i) => 'a.b' + i).join(','))).status, 400);
});

// --- umowa po ataku linii wyglądu (18 XI 2026, Opus czatu: rundy/2026-11-17-format-ustawien-atak-linii-wygladu.md) ------

test('U19. wartość pochodna: rola idzie za barwą bazową, więc nowa rola dołożona po motywie go nie rozjeżdża; koła i złe typy nie przechodzą', async () => {
  const { s, ok, szkic, glowny, wartosc, licz } = await swiat();
  const AKCENT = 'wyglad.paleta.ciemna.akcent';
  // motyw ustawia kilka barw bazowych, a jedną rolę przez odwołanie
  const glebia = ok(await s.ruch('jozz', { op: 'ust-u19-glebia', co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa: 'Głębia', po_co: 'motyw', wartosci: { [AKCENT]: '#7fb2ff', 'wyglad.paleta.ciemna.tlo': '#0b1020', 'wyglad.paleta.ciemna.znak': { z: AKCENT } } } }));
  ok(await wartosc('jozz', 'ust-u19-wlacz', POKRETLO_ZESTAWOW, [glebia.rzecz]));
  assert.deepEqual(licz('agent-a').wartosci['wyglad.paleta.ciemna.znak'], { wartosc: '#7fb2ff', skad: 'zestaw', zasieg: glowny, rzecz: glebia.rzecz, zestaw: 'Głębia', z: AKCENT });
  // ktoś dokłada nową rolę PO motywie: jej wartość domyślna idzie za akcentem, więc od razu ma barwę motywu
  const rola = { nazwa: 'wyglad.paleta.ciemna.reka', typ: 'kolor', domyslna: { z: AKCENT }, opis: 'Barwa ręki: to, co właśnie niesiesz.' };
  ok(await s.ruch('agent-a', { op: 'ust-u19-rola', co: 'poloz', rodzaj: 'pokretlo/1', cechy: rola }));
  assert.deepEqual(licz('agent-a').wartosci[rola.nazwa], { wartosc: '#7fb2ff', skad: 'domyslna', z: AKCENT });
  // twarz pyta tylko o tę rolę: pokrętło, za którym idzie, środowisko dociąga samo
  assert.deepEqual((await policzUstawieniaDlaNazw(s.dla('agent-a'), { nazwy: [rola.nazwa] })).wartosci, { [rola.nazwa]: { wartosc: '#7fb2ff', skad: 'domyslna', z: AKCENT } });
  // liczy się w zasięgu patrzącego: przez szkic rola idzie za akcentem szkicu
  ok(await wartosc('agent-a', 'ust-u19-w-szkicu', AKCENT, '#ff8800', { zasieg: szkic }));
  assert.equal(licz('agent-a', { dla: szkic }).wartosci[rola.nazwa].wartosc, '#ff8800');
  assert.equal((await policzUstawieniaDlaNazw(s.dla('agent-a'), { nazwy: [rola.nazwa], dla: szkic })).wartosci[rola.nazwa].wartosc, '#ff8800');
  // wartość wprost też może iść za innym pokrętłem
  ok(await wartosc('jozz', 'ust-u19-linia', 'wyglad.paleta.ciemna.linia', { z: 'wyglad.paleta.ciemna.ciche' }));
  const linia = licz('agent-a').wartosci['wyglad.paleta.ciemna.linia'];
  assert.deepEqual([linia.wartosc, linia.skad, linia.z], [POKRETLA.find((d) => d.nazwa === 'wyglad.paleta.ciemna.ciche').domyslna, 'wartosc', 'wyglad.paleta.ciemna.ciche']);
  // zapis odbija odwołania, które nie mają dokąd iść
  for (const [op, w, wzor] of [['a', { z: 'nie.ma.takiego' }, /którego nie ma/], ['b', { z: 'odczucie.ruch.natezenie' }, /typu liczba, a samo jest typu kolor/], ['c', { z: AKCENT }, /samego siebie/]]) {
    const o = await wartosc('jozz', 'ust-u19-zle-' + op, AKCENT, w);
    assert.equal(o.status, 422, JSON.stringify(o));
    assert.match(o.blad, wzor);
  }
  // koło w wartościach domyślnych odbija się przy deklaracji
  ok(await s.ruch('agent-a', { op: 'ust-u19-kolo-a', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: 'proba.kolo.a', typ: 'liczba', domyslna: 1, opis: 'A.' } }));
  ok(await s.ruch('agent-a', { op: 'ust-u19-kolo-b', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: 'proba.kolo.b', typ: 'liczba', domyslna: { z: 'proba.kolo.a' }, opis: 'B idzie za A.' } }));
  const a = s.spis({ rodzaj: 'pokretlo/1', gdzie: { nazwa: 'proba.kolo.a' } })[0];
  const zamkniecie = await s.ruch('agent-a', { op: 'ust-u19-kolo-zamkniecie', co: 'poloz', rzecz: a.id, wersja: a.wersja, rodzaj: 'pokretlo/1', cechy: { ...a.cechy, domyslna: { z: 'proba.kolo.b' } } });
  assert.equal(zamkniecie.status, 422, JSON.stringify(zamkniecie));
  assert.match(zamkniecie.blad, /zamykają koło/);
  // koło w wartościach (każdy zapis z osobna jest poprawny) jest pomijane przy liczeniu i wraca do wartości domyślnej
  ok(await wartosc('agent-a', 'ust-u19-kolo-wartosc', 'proba.kolo.a', { z: 'proba.kolo.b' }, { zasieg: szkic }));
  let u = licz('agent-a', { dla: szkic });
  assert.deepEqual([u.wartosci['proba.kolo.a'].wartosc, u.wartosci['proba.kolo.b'].wartosc], [1, 1]);
  assert.ok(u.pominiete.some((x) => /koło/.test(x.dlaczego)), JSON.stringify(u.pominiete));
  // wartość, która po przejściu odwołania nie mieści się w klamrze pokrętła, nie dochodzi do twarzy
  ok(await s.ruch('agent-a', { op: 'ust-u19-waskie', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: 'proba.waskie', typ: 'liczba', domyslna: 2, twarde: { od: 0, do: 10 }, opis: 'Wąska klamra.' } }));
  ok(await s.ruch('agent-a', { op: 'ust-u19-szerokie', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: 'proba.szerokie', typ: 'liczba', domyslna: 50, opis: 'Bez klamry.' } }));
  ok(await wartosc('agent-a', 'ust-u19-waskie-wartosc', 'proba.waskie', { z: 'proba.szerokie' }, { zasieg: szkic }));
  u = licz('agent-a', { dla: szkic });
  assert.deepEqual(u.wartosci['proba.waskie'], { wartosc: 2, skad: 'domyslna' });
  assert.ok(u.pominiete.some((x) => x.pokretlo === 'proba.waskie' && /klamry/.test(x.dlaczego)), JSON.stringify(u.pominiete));
  // typ dowolne bierze {z: …} dosłownie
  ok(await s.ruch('agent-a', { op: 'ust-u19-dowolne', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: 'proba.dowolne', typ: 'dowolne', domyslna: { z: 'cokolwiek' }, opis: 'Własna struktura narzędzia.' } }));
  assert.deepEqual(licz('agent-a').wartosci['proba.dowolne'], { wartosc: { z: 'cokolwiek' }, skad: 'domyslna' });
  assert.equal(licz('agent-a').format, 'ustawienia-2');
});

test('U20. typy po ataku linii wyglądu: sprężyna w parametrach ręki, rampa z przestrzenią barw, pole dotyczy; twarz zna krój, cień i sprężynę', () => {
  assert.match(wadaWartosci({ typ: 'sprezyna' }, { sztywnosc: 170, tlumienie: 26 }), /sprężyna/);
  const f = sprezynaNaFizyke({ czas: 500, odbicie: 0 });
  assert.ok(Math.abs(f.sztywnosc - (4 * Math.PI) ** 2) < 1e-9 && Math.abs(f.tlumienie - 8 * Math.PI) < 1e-9 && f.masa === 1, JSON.stringify(f));
  assert.equal(sprezynaNaFizyke({ czas: 500, odbicie: 1 }).tlumienie, 0, 'odbicie 1 nie gaśnie');
  assert.equal(wadaWartosci({ typ: 'rampa' }, { przystanki: [{ w: 0, kolor: '#000000' }, { w: 1, kolor: '#ffffff' }], przestrzen: 'oklab' }), null);
  assert.match(wadaWartosci({ typ: 'rampa' }, { przystanki: [{ w: 0, kolor: '#000000' }, { w: 1, kolor: '#ffffff' }], przestrzen: 'cmyk' }), /przestrzeń/);
  const d = { nazwa: 'proba.rzecz.x', typ: 'liczba', domyslna: 1, opis: 'X.' };
  assert.deepEqual(wadyDeklaracji({ ...d, dotyczy: ['karta', 'ciagniecie'] }), []);
  assert.match(wadyDeklaracji({ ...d, dotyczy: ['Karta!'] })[0], /dotyczy/);
  assert.match(wadyDeklaracji({ ...d, domyslna: { z: 'proba.rzecz.y' }, twarde: { od: 0, do: 5 } })[0], /nie podaje własnej klamry/);
  assert.match(wadyDeklaracji({ ...d, domyslna: { z: 'proba.rzecz.x' } })[0], /za samym sobą/);
  // twarz: krój i cień przechodzą w typie, a krój roli jest zawsze obiektem z rodziną
  const p = new Pokretla();
  assert.equal(p.kroj('imiona').rodzina, p.kroj('tekst').rodzina, 'imiona idą za tekstem, dopóki nikt ich nie ustawi');
  p.przyjmij({ wartosci: { 'wyglad.kroj.tekst': { wartosc: { rodzina: 'Recursive, sans-serif', grubosc: 450, osie: { CASL: 1, MONO: 0 } } }, 'odczucie.reka.cien_niesionej': { wartosc: { x: 2, y: 10, rozmycie: 30, kolor: '#10204080' } }, 'wyglad.kroj.imiona': { wartosc: 'Arial' } } });
  assert.deepEqual(krojNaCss(p.kroj('tekst')), { rodzina: 'Recursive, sans-serif', grubosc: '450', osie: '"CASL" 1, "MONO" 0' });
  assert.equal(p.kroj('imiona').rodzina, 'Recursive, sans-serif', 'napis zamiast kroju nie dochodzi, więc imiona dalej idą za tekstem');
  assert.equal(p.w('odczucie.reka.cien_niesionej').kolor, '#10204080');
  assert.ok(pasuje({ typ: 'sprezyna' }, { czas: 200, odbicie: 0.3 }) && !pasuje({ typ: 'sprezyna' }, { czas: -1, odbicie: 0 }));
});

test('U21. propozycja włączenia zestawu pamięta jego wersję: gdy zestaw zmieni się przed przyjęciem, przyjęcie odmawia i mówi, co się zmieniło', async () => {
  const { s, ok, wartosc, licz } = await swiat();
  const z = ok(await s.ruch('agent-a', { op: 'ust-u21-zestaw', co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa: 'Łagodny', po_co: 'motyw', wartosci: { 'wyglad.paleta.jasna.tlo': '#f0ede6' } } }));
  const pr = ok(await wartosc('agent-a', 'ust-u21-wlacz', POKRETLO_ZESTAWOW, [z.rzecz]));
  assert.equal(pr.skutek, 'propozycja');
  assert.deepEqual(s.rzecz(pr.propozycja).cechy.przypiete, { [z.rzecz]: z.wersja }, 'propozycja przypina wersję zestawu, który ma włączyć');
  const rz = s.rzecz(z.rzecz);
  ok(await s.ruch('agent-a', { op: 'ust-u21-podmiana', co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: 'zestaw/1', cechy: { ...rz.cechy, wartosci: { 'wyglad.paleta.jasna.tlo': '#ff00ff' } } }));
  const odmowa = await s.ruch('jozz', { op: 'ust-u21-przyjmij', co: 'przyjmij', propozycja: pr.propozycja });
  assert.equal(odmowa.status, 409, JSON.stringify(odmowa));
  assert.match(odmowa.blad, /zestaw "Łagodny"/);
  assert.deepEqual(odmowa.zmienione.map((x) => [x.rzecz, x.byla]), [[z.rzecz, z.wersja]]);
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.tlo'].skad, 'domyslna', 'nic się nie włączyło');
  ok(await s.ruch('jozz', { op: 'ust-u21-swiadomie', co: 'przyjmij', propozycja: pr.propozycja, mimo_zmian: true }));
  assert.equal(licz('agent-a').wartosci['wyglad.paleta.jasna.tlo'].wartosc, '#ff00ff', 'przyjęte świadomie, w dzisiejszej wersji');
  // zestaw, który się nie zmienił, przyjmuje się zwyczajnie
  const y = ok(await s.ruch('agent-a', { op: 'ust-u21-drugi', co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa: 'Drugi', po_co: 'preset', wartosci: { 'odczucie.ruch.natezenie': 0.5 } } }));
  const wlaczone = s.spis({ rodzaj: 'wartosc/1', gdzie: { pokretlo: POKRETLO_ZESTAWOW } })[0];
  const pr2 = ok(await wartosc('agent-a', 'ust-u21-wlacz-2', POKRETLO_ZESTAWOW, [z.rzecz, y.rzecz], { wersja: wlaczone.wersja }));
  assert.equal(pr2.skutek, 'propozycja');
  ok(await s.ruch('jozz', { op: 'ust-u21-przyjmij-2', co: 'przyjmij', propozycja: pr2.propozycja }));
  assert.equal(licz('agent-a').wartosci['odczucie.ruch.natezenie'].wartosc, 0.5);
});

test('U22. granica liczby pokręteł mówi zdaniem i nie dotyka istniejących; zestaw z jedną paletą jest nazwany w uwagach i na stronie tekstowej', async () => {
  const { s, ok, wartosc, licz } = await swiat();
  const ile0 = s.ile;
  s.ile = function (o) { return o && o.rodzaj === 'pokretlo/1' ? NAJWIECEJ_POKRETEL : ile0.call(this, o); };
  const nad = await s.ruch('agent-a', { op: 'ust-u22-nad', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: 'proba.ponad.granice', typ: 'liczba', domyslna: 1, opis: 'Ponad granicę.' } });
  assert.equal(nad.status, 422, JSON.stringify(nad));
  assert.match(nad.blad, /granica, która chroni wspólny limit/);
  const akcent = s.spis({ rodzaj: 'pokretlo/1', gdzie: { nazwa: 'wyglad.paleta.jasna.akcent' } })[0];
  ok(await s.ruch('jozz', { op: 'ust-u22-zmiana', co: 'poloz', rzecz: akcent.id, wersja: akcent.wersja, rodzaj: 'pokretlo/1', cechy: { ...akcent.cechy, opis: akcent.cechy.opis + ' Zmienione.' } }));
  delete s.ile;
  const noc = ok(await s.ruch('jozz', { op: 'ust-u22-noc', co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa: 'Noc', po_co: 'motyw', wartosci: { 'wyglad.paleta.ciemna.tlo': '#000011' } } }));
  ok(await wartosc('jozz', 'ust-u22-wlacz', POKRETLO_ZESTAWOW, [noc.rzecz]));
  const u = licz('agent-a');
  assert.equal(u.uwagi.length, 1);
  assert.match(u.uwagi[0], /Zestaw "Noc" ustawia tylko paletę ciemną/);
  assert.deepEqual((await policzUstawieniaDlaNazw(s.dla('agent-a'), { nazwy: ['wyglad.paleta.ciemna.tlo'] })).uwagi, u.uwagi, 'pytanie po nazwach niesie te same uwagi');
  const tekst = stronaUstawien(s.dla('agent-a'));
  for (const wzor of [/UWAGI/, /Zestaw "Noc"/, /Nakładka \(profil/, /Wartość pochodna/, /Nazwy: pierwszy człon/, /wyglad\.kroj\.imiona = .*idzie za wyglad\.kroj\.tekst/]) assert.match(tekst, wzor);
});

test('U23. podgląd w trakcie kręcenia: wartość tymczasowa bez zapisu, także między kartami tego samego adresu; twarz uczy się nowej roli z deklaracji', async () => {
  let zmian = 0;
  const p = new Pokretla({ naZmiane: () => { zmian++; } });
  const rog = POKRETLA.find((d) => d.nazwa === 'wyglad.karta.rog').domyslna;
  assert.equal(p.podejrzyj('wyglad.karta.rog', 30), true);
  assert.equal(p.w('wyglad.karta.rog'), 30);
  assert.equal(p.podejrzyj('wyglad.karta.rog', 'trzydzieści'), false, 'podgląd też sprawdza typ');
  assert.equal(p.podejrzyj('nie.ma.takiego', 1), false);
  p.przyjmij({ wartosci: { 'wyglad.karta.rog': { wartosc: 20 } } });
  assert.equal(p.w('wyglad.karta.rog'), 30, 'podgląd stoi nad wartością z Miejsca');
  assert.equal(p.koniecPodgladu('wyglad.karta.rog'), true);
  assert.equal(p.w('wyglad.karta.rog'), 20);
  assert.ok(zmian >= 3, String(zmian));
  const bezpieczny = new Pokretla({ bezpiecznie: true });
  bezpieczny.podejrzyj('wyglad.karta.rog', 30);
  assert.equal(bezpieczny.w('wyglad.karta.rog'), rog, 'tryb bezpieczny nie bierze też podglądu');
  bezpieczny.koniecPodgladu();
  // dwie karty tego samego adresu
  const a = new Pokretla(), b = new Pokretla();
  const ka = polaczPodglad(a, 'jaskinia:podglad:proba-u23'), kb = polaczPodglad(b, 'jaskinia:podglad:proba-u23');
  const chwila = () => new Promise((r) => setTimeout(r, 80));
  ka.nadaj('odczucie.ruch.natezenie', 0.5);
  await chwila();
  assert.equal(b.w('odczucie.ruch.natezenie'), 0.5, 'druga karta widzi wartość w trakcie kręcenia');
  assert.equal(a.w('odczucie.ruch.natezenie'), 1, 'nadawca ustawia swoją kartę sam');
  ka.koniec('odczucie.ruch.natezenie');
  await chwila();
  assert.equal(b.w('odczucie.ruch.natezenie'), 1);
  b.koniecPodgladu(); ka.zamknij(); kb.zamknij();
  // nauka roli z deklaracji w Miejscu
  const q = new Pokretla();
  assert.equal(q.znaj({ nazwa: 'wyglad.paleta.ciemna.reka', typ: 'kolor', domyslna: { z: 'wyglad.paleta.ciemna.akcent' } }), true);
  assert.equal(q.znaj({ nazwa: 'wyglad.paleta.ciemna.reka', typ: 'kolor', domyslna: '#000000' }), false, 'tablica i to, czego twarz już się nauczyła, wygrywają');
  assert.ok(q.role().includes('reka') && q.role().includes('akcent'));
  assert.equal(q.kolor('reka', true), POKRETLA.find((d) => d.nazwa === 'wyglad.paleta.ciemna.akcent').domyslna);
  assert.equal(q.kolor('reka', false), undefined, 'rola zadeklarowana tylko w jednej palecie nie ma barwy w drugiej');
  q.przyjmij({ wartosci: { 'wyglad.paleta.ciemna.reka': { wartosc: '#abcdef' } } });
  assert.equal(q.kolor('reka', true), '#abcdef');
  assert.ok(q.nazwy().split(',').includes('wyglad.paleta.ciemna.reka'));
});

test('U24. odwołanie nie jest drogą obok prawa: wartość dla całego Miejsca nie idzie za pokrętłem, które agent zmienia sam tam, gdzie leży', async () => {
  const { s, ok, szkic, wartosc, licz } = await swiat();
  const AKCENT = 'wyglad.paleta.jasna.akcent';
  const akcentDomyslny = POKRETLA.find((d) => d.nazwa === AKCENT).domyslna;
  // agent deklaruje własną barwę tam, gdzie prowadzi, i kładzie motyw, który każe akcentowi iść za nią
  ok(await s.ruch('agent-a', { op: 'ust-u24-barwa', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: 'narzedzie.barwa.glowna', typ: 'kolor', domyslna: '#111111', opis: 'Barwa narzędzia.' } }));
  const motyw = ok(await s.ruch('agent-a', { op: 'ust-u24-motyw', co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa: 'Podstępny', po_co: 'motyw', wartosci: { [AKCENT]: { z: 'narzedzie.barwa.glowna' }, 'wyglad.paleta.jasna.tlo': '#fefefe' } } }));
  const pr = ok(await wartosc('agent-a', 'ust-u24-wlacz', POKRETLO_ZESTAWOW, [motyw.rzecz]));
  ok(await s.ruch('jozz', { op: 'ust-u24-przyjmij', co: 'przyjmij', propozycja: pr.propozycja }));
  const u = licz('agent-a');
  assert.equal(u.wartosci['wyglad.paleta.jasna.tlo'].wartosc, '#fefefe', 'zwykłe wartości motywu działają');
  assert.deepEqual(u.wartosci[AKCENT], { wartosc: akcentDomyslny, skad: 'domyslna' }, 'akcent Miejsca nie idzie za barwą, którą agent zmienia sam');
  assert.ok(u.pominiete.some((x) => x.pokretlo === AKCENT && /zmienia sam/.test(x.dlaczego)), JSON.stringify(u.pominiete));
  assert.equal((await policzUstawieniaDlaNazw(s.dla('agent-a'), { nazwy: [AKCENT] })).wartosci[AKCENT].wartosc, akcentDomyslny, 'pytanie po nazwach liczy tak samo');
  // w szkicu, gdzie agent i tak stroi sam, to samo odwołanie działa
  ok(await wartosc('agent-a', 'ust-u24-w-szkicu', POKRETLO_ZESTAWOW, [motyw.rzecz], { zasieg: szkic }));
  const wSzkicu = licz('agent-a', { dla: szkic }).wartosci[AKCENT];
  assert.deepEqual([wSzkicu.wartosc, wSzkicu.z], ['#111111', 'narzedzie.barwa.glowna']);
  // wartość wprost dla całego Miejsca z takim odwołaniem odbija się już przy zapisie, także właścicielowi, ze zdaniem
  const wprost = await wartosc('jozz', 'ust-u24-wprost', AKCENT, { z: 'narzedzie.barwa.glowna' });
  assert.equal(wprost.status, 422, JSON.stringify(wprost));
  assert.match(wprost.blad, /zmienia sam/);
  // pokrętło z obszaru głównego (zmiana wymaga zgody) jest dobrym celem
  ok(await wartosc('jozz', 'ust-u24-dobre', AKCENT, { z: 'wyglad.paleta.jasna.znak' }));
  assert.equal(licz('agent-a').wartosci[AKCENT].z, 'wyglad.paleta.jasna.znak');
});

test('U25. pełne liczenie czyta wartości tylko z zasięgów na drodze: wartości w cudzych widokach nie podnoszą kosztu panelu', async () => {
  const { s, ok, szkic, wartosc } = await swiat();
  ok(await wartosc('jozz', 'ust-u25-akcent', 'wyglad.paleta.jasna.akcent', '#102030'));
  const licz = (f) => { let wiersze = 0, pytan = 0; const q0 = s.q; s.q = function (...a) { const w = q0.apply(this, a); pytan++; wiersze += w.length; return w; }; try { return { wynik: f(), wiersze, pytan }; } finally { delete s.q; } };
  const przed = licz(() => policzUstawienia(s.dla('jozz'), { deklaracje: true }));
  // agent dokłada 40 widoków tam, gdzie prowadzi, a w każdym po 4 wartości
  for (let i = 0; i < 40; i++) {
    const widok = ok(await s.ruch('agent-a', { op: 'ust-u25-widok-' + i, co: 'poloz', rodzaj: 'widok/1', obszar: szkic, cechy: { nazwa: 'Widok ' + i } })).rzecz;
    for (const [j, n] of ['wyglad.paleta.jasna.tlo', 'wyglad.paleta.jasna.tekst', 'wyglad.karta.rog', 'odczucie.ruch.natezenie'].entries()) ok(await wartosc('agent-a', `ust-u25-w-${i}-${j}`, n, j < 2 ? '#0a0b0c' : 1, { zasieg: widok }));
  }
  const po = licz(() => policzUstawienia(s.dla('jozz'), { deklaracje: true }));
  assert.deepEqual(po.wynik.wartosci, przed.wynik.wartosci);
  assert.ok(po.wiersze <= przed.wiersze + 6, `wiersze przed ${przed.wiersze}, po ${po.wiersze}`);
  // wartość w zasięgu na drodze dalej dochodzi
  const jeden = s.spis({ rodzaj: 'widok/1', gdzie: { nazwa: 'Widok 7' } })[0];
  assert.equal(policzUstawienia(s.dla('jozz'), { dla: jeden.id }).wartosci['wyglad.karta.rog'].wartosc, 1);
  assert.equal(policzUstawienia(s.dla('jozz')).wartosci['wyglad.paleta.jasna.akcent'].wartosc, '#102030');
});

// --- suwaki świata obok jego okna (krok 3 serca domu, 21 XI 2026, Opus czatu) ------------------------------------------

test('U26. świat czyta swoje pokrętła dla własnej rzeczy gościa: pytanie po nazwach niesie deklaracje tylko tych pokręteł, a wartość w zasięgu gościa nie zmienia Miejsca', async () => {
  const { s, ok, wartosc } = await swiat();
  const swiatGosc = s.spis({ rodzaj: 'gosc/1', limit: 20 })[0];
  assert.ok(swiatGosc, 'zasiew ma przykładowego gościa');
  // świat (tu: agent w jego imieniu) deklaruje dwa własne pokrętła; jedno idzie domyślnie za drugim (odwołanie dociągane po drodze)
  ok(await s.ruch('agent-a', { op: 'ust-u26-moc', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: 'swiat.probny.moc', typ: 'liczba', domyslna: 1, zakres: { od: 0, do: 3, krok: 0.1 }, jednostka: '×', grupa: 'Świat próbny / Napęd', opis: 'Mnożnik mocy.' } }));
  ok(await s.ruch('agent-a', { op: 'ust-u26-ham', co: 'poloz', rodzaj: 'pokretlo/1', cechy: { nazwa: 'swiat.probny.hamulec', typ: 'liczba', domyslna: 1, zakres: { od: 0, do: 3, krok: 0.1 }, jednostka: '×', grupa: 'Świat próbny / Napęd', opis: 'Mnożnik hamulca.' } }));
  const nazwy = ['swiat.probny.moc', 'swiat.probny.hamulec', 'nie.ma.takiego'];
  const pytanie = (sciezka, kto = 'jozz') => obsluzSrodowisko(s, new Request('https://proba.example' + sciezka, { headers: { 'x-kto': kto } }));
  const zDeklaracjami = async (dla) => (await pytanie('/api/srodowisko/ustawienia?nazwy=' + nazwy.join(',') + '&deklaracje=tak' + (dla ? '&dla=' + dla : ''))).json();
  let d = await zDeklaracjami(swiatGosc.id);
  assert.equal(d.ok, true, JSON.stringify(d));
  assert.deepEqual(d.deklaracje.map((x) => x.nazwa).sort(), ['swiat.probny.hamulec', 'swiat.probny.moc'], 'deklaracje tylko pytanych i istniejących pokręteł, bez pokrętła zestawów');
  const moc = d.deklaracje.find((x) => x.nazwa === 'swiat.probny.moc');
  assert.deepEqual([moc.typ, moc.zakres.do, moc.jednostka, moc.grupa], ['liczba', 3, '×', 'Świat próbny / Napęd']);
  assert.ok(/^[0-9a-z]{26}$/.test(moc.rzecz), 'deklaracja niesie swoją rzecz');
  assert.equal(d.wartosci['swiat.probny.moc'].skad, 'domyslna');
  assert.equal((await (await pytanie('/api/srodowisko/ustawienia?nazwy=' + nazwy.join(','))).json()).deklaracje, undefined, 'bez deklaracje=tak odpowiedź jest taka jak przedtem');
  // właściciel stroi świat: wartość w zasięgu jego rzeczy gościa (tak pisze panel suwaków), także poza zakresem suwaka
  ok(await wartosc('jozz', 'ust-u26-strojenie', 'swiat.probny.moc', 7.5, { zasieg: swiatGosc.id }));
  d = await zDeklaracjami(swiatGosc.id);
  assert.deepEqual([d.wartosci['swiat.probny.moc'].wartosc, d.wartosci['swiat.probny.moc'].skad, d.wartosci['swiat.probny.moc'].zasieg], [7.5, 'wartosc', swiatGosc.id], 'zakres suwaka nie jest granicą (reguła właściciela z JV, 9 VII)');
  assert.equal((await zDeklaracjami(null)).wartosci['swiat.probny.moc'].wartosc, 1, 'całe Miejsce zostaje przy domyślnej');
  // wartość dla całego Miejsca świat dziedziczy, dopóki nie ma własnej
  ok(await wartosc('jozz', 'ust-u26-miejsce', 'swiat.probny.hamulec', 2));
  d = await zDeklaracjami(swiatGosc.id);
  assert.equal(d.wartosci['swiat.probny.hamulec'].wartosc, 2);
  assert.notEqual(d.wartosci['swiat.probny.hamulec'].zasieg, swiatGosc.id, 'odziedziczona leży wyżej niż gość');
  assert.ok(d.lancuch.some((z) => z.id === d.wartosci['swiat.probny.hamulec'].zasieg), 'zasięg odziedziczonej jest w łańcuchu, więc twarz nazwie, skąd przyszła');
  // „wróć do domyślnego”: odłożenie wartości gościa oddaje odziedziczoną (tu: domyślną)
  ok(await s.ruch('jozz', { op: 'ust-u26-wroc', co: 'odloz', rzecz: (await zDeklaracjami(swiatGosc.id)).wartosci['swiat.probny.moc'].rzecz, wersja: 'dowolna', powod: 'powrót do wartości odziedziczonej' }));
  assert.equal((await zDeklaracjami(swiatGosc.id)).wartosci['swiat.probny.moc'].wartosc, 1);
});

test('U27. nakładka, której czytający nie widzi, mówi w pominiete, a nie znika po cichu (warunek A/B, 21 XI 2026)', async () => {
  const { s, ok, wartosc, licz } = await swiat();
  const T = ok(await s.ruch('jozz', { op: 'ust-u27-tajne', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Tajne', widzi: 'wlasciciel', ile_wolno: 'prowadzic' } })).rzecz;
  const profil = ok(await s.ruch('jozz', { op: 'ust-u27-profil', co: 'poloz', rodzaj: 'profil/1', obszar: T, cechy: { nazwa: 'B' } })).rzecz;
  ok(await wartosc('jozz', 'ust-u27-wartosc', 'odczucie.reka.prog_przeciagania', 14, { zasieg: profil }));
  const wlasciciel = licz('jozz', { nakladki: [profil] });
  assert.equal(wlasciciel.wartosci['odczucie.reka.prog_przeciagania'].wartosc, 14, 'kontrola: właściciel widzi profil i dostaje jego wartość');
  assert.ok(!(wlasciciel.pominiete || []).some((p) => p.nakladka === profil), 'kontrola: widoczna nakładka nie jest pominięta');
  const agent = licz('agent-a', { nakladki: [profil] });
  assert.notEqual(agent.wartosci['odczucie.reka.prog_przeciagania'].wartosc, 14, 'agent nie dostaje wartości z profilu, którego nie widzi');
  const p = (agent.pominiete || []).find((x) => x.nakladka === profil);
  assert.ok(p, 'i słyszy, że nakładkę pominięto: ' + JSON.stringify(agent.pominiete));
  assert.match(p.dlaczego, /nie widać/);
  const brak = '0'.repeat(26);
  assert.ok((licz('jozz', { nakladki: [brak] }).pominiete || []).some((x) => x.nakladka === brak), 'nieistniejąca nakładka też mówi');
});

test('U28. nakładka mówi na każdej drodze: wprost, po nazwach (tą czyta okno świata), na stronie tekstowej; zły kształt i piąta też (druga linia Opusa czatu na 86, 21 XI 2026)', async () => {
  const { s, ok, wartosc } = await swiat();
  const T = ok(await s.ruch('jozz', { op: 'ust-u28-tajne', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Tajne', widzi: 'wlasciciel', ile_wolno: 'prowadzic' } })).rzecz;
  const profil = ok(await s.ruch('jozz', { op: 'ust-u28-profil', co: 'poloz', rodzaj: 'profil/1', obszar: T, cechy: { nazwa: 'B' } })).rzecz;
  ok(await wartosc('jozz', 'ust-u28-wartosc', 'odczucie.reka.prog_przeciagania', 14, { zasieg: profil }));
  const N = 'odczucie.reka.prog_przeciagania';
  const brak = '0'.repeat(26);
  const pytanie = (sciezka, kto) => obsluzSrodowisko(s, new Request('https://proba.example' + sciezka, { headers: { 'x-kto': kto } }));
  const json = async (sciezka, kto) => (await pytanie(sciezka, kto)).json();
  const slyszy = (u, id) => (u.pominiete || []).some((x) => x.nakladka === id);
  for (const [droga, nazwy] of [['wprost', ''], ['po nazwach', `nazwy=${N}&`]]) {
    const wl = await json(`/api/srodowisko/ustawienia?${nazwy}nakladki=${profil}`, 'jozz');
    assert.equal(wl.wartosci[N].wartosc, 14, `${droga}: kontrola, właściciel widzi profil i dostaje jego wartość`);
    assert.equal(slyszy(wl, profil), false, `${droga}: kontrola, widoczna nakładka nie jest pominięta`);
    const ag = await json(`/api/srodowisko/ustawienia?${nazwy}nakladki=${profil}`, 'agent-a');
    assert.notEqual(ag.wartosci[N].wartosc, 14, `${droga}: agent nie dostaje wartości z profilu, którego nie widzi`);
    assert.equal(slyszy(ag, profil), true, `${droga}: agent słyszy, że nakładkę pominięto: ${JSON.stringify(ag.pominiete)}`);
    assert.equal(slyszy(await json(`/api/srodowisko/ustawienia?${nazwy}nakladki=${brak}`, 'jozz'), brak), true, `${droga}: nieistniejąca nakładka też mówi`);
    // zły kształt i piąta nakładka: dawniej odpadały bez słowa
    const wiele = [profil, brak, '1'.repeat(26), '2'.repeat(26), '3'.repeat(26)];
    const u = await json(`/api/srodowisko/ustawienia?${nazwy}nakladki=zly-ksztalt,${wiele.join(',')}`, 'jozz');
    assert.equal(u.wartosci[N].wartosc, 14, `${droga}: kontrola, cztery pierwsze dobre nakładki dalej działają`);
    assert.match((u.pominiete || []).find((x) => x.nakladka === 'zly-ksztalt')?.dlaczego || '', /nie identyfikator/, `${droga}: zły kształt mówi`);
    assert.match((u.pominiete || []).find((x) => x.nakladka === '3'.repeat(26))?.dlaczego || '', /najwyżej 4/, `${droga}: piąta nakładka mówi`);
  }
  // ta sama odpowiedź dla niewidocznej i nieistniejącej: pominięcie nie zdradza, że ukryta rzecz istnieje
  const ag = await json(`/api/srodowisko/ustawienia?nakladki=${profil},${brak}`, 'agent-a');
  const dl = (id) => ag.pominiete.find((x) => x.nakladka === id).dlaczego;
  assert.equal(dl(profil), dl(brak));
  const tekst = await (await pytanie(`/ustawienia?nakladki=${profil}`, 'agent-a')).text();
  assert.match(tekst, new RegExp(`nakładka ${profil}: `), 'strona tekstowa przyjmuje nakładki i mówi o pominiętej');
  assert.doesNotMatch(await (await pytanie(`/ustawienia?nakladki=${profil}`, 'jozz')).text(), new RegExp(`nakładka ${profil}: `), 'kontrola: właścicielowi strona nie mówi o pominięciu');
  // echo złego kształtu bez znaków sterujących: nowa linia nie dopisuje na stronie tekstowej własnego wiersza (sonda Opusa czatu)
  const falszywa = 'x\n  nakładka FALSZYWA';
  const echo = await pytanie(`/ustawienia?nakladki=${encodeURIComponent(falszywa)}`, 'agent-a');
  assert.doesNotMatch(await echo.text(), /\n {2}nakładka FALSZYWA/, 'znak nowej linii z adresu nie robi nowego wiersza');
  const jakoDane = await json(`/api/srodowisko/ustawienia?nakladki=${encodeURIComponent(falszywa)}`, 'agent-a');
  assert.equal(jakoDane.pominiete.find((x) => /FALSZYWA/.test(x.nakladka))?.nakladka, 'x?  nakładka FALSZYWA', 'w danych echo ma znak zapytania w miejscu znaku sterującego');
  assert.equal((await json(`/api/srodowisko/ustawienia?nakladki=zly-ksztalt`, 'agent-a')).pominiete[0].nakladka, 'zly-ksztalt', 'kontrola: zwykły zły kształt wraca bez zmian');
  // CR też robi wiersz w przeglądarce; NEL, U+2028 i U+2029 dzielą wiersze u agentów (druga linia Opusa czatu na 90)
  const kazdy = 'a\rb\u0085c\u2028d\u2029e';
  assert.equal((await json(`/api/srodowisko/ustawienia?nakladki=${encodeURIComponent(kazdy)}`, 'agent-a')).pominiete[0].nakladka, 'a?b?c?d?e', 'CR, NEL, U+2028 i U+2029 też idą na znak zapytania');
  assert.doesNotMatch(await (await pytanie(`/ustawienia?nakladki=${encodeURIComponent('y\r  nakładka FALSZYWA2')}`, 'agent-a')).text(), /\r {2}nakładka FALSZYWA2/, 'powrót karetki z adresu nie robi nowego wiersza');
});
