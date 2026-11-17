// Widoczność z danych (17 XI 2026, front B, Opus Code): ustawienie `widzi` obszaru przestaje być nazwą,
// a zaczyna być mechanizmem. Każdy sprawdzian pyta o to samo z DWÓCH stron: że widzący widzi i że niewidzący
// NIE widzi — bo mechanizm, który wszystko przepuszcza, zalicza połowę tych sprawdzianów.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { obsluzSrodowisko } from './srodowisko-http.mjs';

async function swiat() {
  let t = Date.UTC(2026, 10, 17, 16, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-probny', 'agent-a', 'agent-b', 'agent-0', 'agent-1', 'agent-2', 'podglad'] }));
  // trzy obszary o trzech ustawieniach widoczności, każdy z jedną rzeczą
  const obszar = async (nazwa, widzi, op) => {
    const o = await s.ruch('jozz', { op, co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa, ile_wolno: 'proponowac', widzi } });
    assert.equal(o.ok, true, JSON.stringify(o));
    const rz = await s.ruch('jozz', { op: op + '-rzecz', co: 'poloz', rodzaj: 'projekt/1', obszar: o.rzecz, cechy: { nazwa: 'Projekt ' + nazwa } });
    assert.equal(rz.ok, true, JSON.stringify(rz));
    return { obszar: o.rzecz, rzecz: rz.rzecz };
  };
  const jawny = await obszar('Jawny', 'wszyscy', 'widocznosc-jawny-1');
  const zamkniety = await obszar('Dla uczestnikow', 'uczestnicy', 'widocznosc-uczestnicy-1');
  const prywatny = await obszar('Tylko wlasciciel', 'wlasciciel', 'widocznosc-wlasciciel-1');
  return { s, jawny, zamkniety, prywatny };
}
const nazwy = (lista) => lista.map((x) => x.cechy && x.cechy.nazwa).sort();

test('W1. trzy role widzą trzy różne listy tego samego spisu', async () => {
  const { s } = await swiat();
  const f = { rodzaj: 'projekt/1' };
  assert.deepEqual(nazwy(s.dla('jozz').spis(f)), ['Projekt Dla uczestnikow', 'Projekt Jawny', 'Projekt Tylko wlasciciel']);
  assert.deepEqual(nazwy(s.dla('agent-probny').spis(f)), ['Projekt Dla uczestnikow', 'Projekt Jawny']);
  assert.deepEqual(nazwy(s.dla(null).spis(f)), ['Projekt Jawny']);
  // samo środowisko w środku dalej widzi siebie całe - inaczej przestałoby znać własne kształty i uczestników
  assert.equal(s.spis(f).length, 3);
});

test('W2. liczba też jest treścią: ile() nie zdradza rzeczy, których ten ktoś nie widzi', async () => {
  const { s } = await swiat();
  assert.equal(s.dla('jozz').ile({ rodzaj: 'projekt/1' }), 3);
  assert.equal(s.dla('agent-probny').ile({ rodzaj: 'projekt/1' }), 2);
  assert.equal(s.dla(null).ile({ rodzaj: 'projekt/1' }), 1);
});

test('W3. "nie ma" i "nie dla ciebie" brzmią tak samo, także pod adresem jednej rzeczy', async () => {
  const { s, prywatny } = await swiat();
  assert.ok(s.dla('jozz').rzecz(prywatny.rzecz), 'właściciel ją widzi');
  assert.equal(s.dla('agent-probny').rzecz(prywatny.rzecz), null, 'uczestnik dostaje to samo co przy nieistniejącej');
  assert.equal(s.dla(null).rzecz(prywatny.rzecz), null);
  assert.equal(s.dla('agent-probny').wersja(prywatny.rzecz, 2), null, 'dawna wersja też nie');
});

test('W4. obszar w obszarze bierze widoczność z rodzica, dopóki nie powie inaczej', async () => {
  const { s, prywatny } = await swiat();
  const w = await s.ruch('jozz', { op: 'widocznosc-wew-1', co: 'poloz', rodzaj: 'obszar/1', obszar: prywatny.obszar, cechy: { nazwa: 'W srodku prywatnego' } });
  const rz = await s.ruch('jozz', { op: 'widocznosc-wew-2', co: 'poloz', rodzaj: 'projekt/1', obszar: w.rzecz, cechy: { nazwa: 'Projekt wewnetrzny' } });
  assert.equal(s.dla('agent-probny').rzecz(rz.rzecz), null, 'dziedziczy zamknięcie po rodzicu');
  const o = await s.ruch('jozz', { op: 'widocznosc-wew-3', co: 'poloz', rodzaj: 'obszar/1', rzecz: w.rzecz, wersja: 'dowolna', cechy: { nazwa: 'W srodku prywatnego', widzi: 'wszyscy' } });
  assert.equal(o.ok, true, JSON.stringify(o));
  assert.ok(s.dla(null).rzecz(rz.rzecz), 'własne ustawienie bije dziedziczone');
});

test('W5. to, co na rzecz wskazuje, też jest treścią', async () => {
  const { s, jawny, prywatny } = await swiat();
  const k = await s.ruch('jozz', { op: 'widocznosc-ksztalt-1', co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'notka/1', opis: 'Notka o rzeczy.', cechy: { o_czym: { typ: 'rzecz', wymagana: true }, tresc: { typ: 'tekst' } } } });
  assert.equal(k.ok, true, JSON.stringify(k));
  const n = await s.ruch('jozz', { op: 'widocznosc-notka-1', co: 'poloz', rodzaj: 'notka/1', obszar: prywatny.obszar, cechy: { o_czym: jawny.rzecz, tresc: 'prywatna uwaga' } });
  assert.equal(n.ok, true, JSON.stringify(n));
  assert.equal(s.dla('jozz').wskazujaNa(jawny.rzecz).length, 1);
  assert.equal(s.dla('agent-probny').wskazujaNa(jawny.rzecz).length, 0, 'odniesienie z zamkniętego obszaru zdradzałoby, że ono istnieje');
});

test('W6. drzwi: poza podglądem czytanie jest domyślnie zamknięte, a na podglądzie jawnie otwarte', async () => {
  const { s, prywatny, zamkniety } = await swiat();
  const zap = (sciezka, { kto = '', podglad = false } = {}) =>
    obsluzSrodowisko(s, new Request('https://przyklad.test' + sciezka, { headers: { 'x-kto': kto } }), { podglad });
  const spis = async (o) => (await (await zap('/api/srodowisko/spis?rodzaj=projekt/1', o)).json()).rzeczy.length;

  assert.equal(await spis({}), 1, 'poza podglądem bez klucza widać tylko obszar jawny');
  assert.equal(await spis({ kto: 'agent-probny' }), 2);
  assert.equal(await spis({ kto: 'jozz' }), 3);
  assert.equal(await spis({ podglad: true }), 2, 'na podglądzie czytający bez klucza jest uczestnikiem, bo klucz i tak stoi jawnie na stronie');

  const jednaRzecz = await zap('/api/srodowisko/rzecz?id=' + prywatny.rzecz);
  assert.equal((await jednaRzecz.json()).blad, 'nie ma takiej rzeczy', 'ta sama odpowiedź co przy nieistniejącej');
  assert.equal((await zap('/rzecz/' + zamkniety.rzecz)).status, 404, 'tekstowa strona rzeczy też');
  assert.equal((await zap('/rzecz/' + zamkniety.rzecz, { kto: 'agent-probny' })).status, 200);
});

test('W7. nowa trasa czytająca nie ominie okularów po cichu', async () => {
  // Ten sprawdzian nie pyta o zachowanie, tylko o kształt kodu - i robi to świadomie. Mechanizm widoczności stoi
  // na jednym założeniu: że KAŻDA trasa czytająca pracuje na widoku `w`, a nie na surowym `s`. Takie założenie
  // samo się nie pilnuje; za pół roku ktoś dopisze trasę z `s.` i nic nie zapali się na czerwono, bo wszystkie
  // dotychczasowe sprawdziany dalej przechodzą. Dlatego pilnuje go tekst.
  const { readFile } = await import('node:fs/promises');
  const zrodlo = await readFile(new URL('./srodowisko-http.mjs', import.meta.url), 'utf8');
  const od = zrodlo.indexOf("if (request.method === 'GET') {");
  const do_ = zrodlo.indexOf("if (request.method === 'POST') {");
  assert.ok(od > 0 && do_ > od, 'bloki GET i POST stoją tam, gdzie je ten sprawdzian szuka');
  const blok = zrodlo.slice(od, do_);
  const bezKomentarzy = blok.replace(/\/\/[^\n]*/g, '');
  const golo = [...bezKomentarzy.matchAll(/(?<![A-Za-z0-9_.])s\.[a-zA-Z_]+/g)].map((m) => m[0]);
  assert.deepEqual(golo, [], `trasa czytająca sięga po surowe środowisko zamiast po widok czytającego: ${golo.join(', ')}. Użyj w.<...> albo napisz tutaj, dlaczego ta jedna ma widzieć wszystko.`);
});

test('W8. dawna wersja PRZEZ DRZWI: widoczna wraca, ukryta i nieistniejąca brzmią tak samo', async () => {
  // Ten sprawdzian istnieje, bo jego brak kosztował mnie błąd, którego nie złapał ani `node --check`, ani 339
  // pozostałych sprawdzianów: mechaniczna zamiana nazw zrobiła z `const w = s.wersja(...)` zapis `const w = w...`,
  // czyli nazwę zasłaniającą samą siebie. Trasa wywracała się na każdym żądaniu, a żaden sprawdzian jej nie dotykał.
  // Zobaczył to dopiero żywy adres. Dlatego tutaj pytamy przez drzwi, a nie przez metodę.
  const { s, jawny, prywatny } = await swiat();
  const zap = (sciezka, kto = '') => obsluzSrodowisko(s, new Request('https://przyklad.test' + sciezka, { headers: { 'x-kto': kto } }), { podglad: false });
  const aktJawnej = s.historia(jawny.rzecz)[0].akt;

  const dobra = await (await zap(`/api/srodowisko/wersja?id=${jawny.rzecz}&akt=${aktJawnej}`, 'agent-probny')).json();
  assert.equal(dobra.ok, true, JSON.stringify(dobra));
  assert.equal(dobra.wersja.rzecz, jawny.rzecz);

  const zlyAkt = await (await zap(`/api/srodowisko/wersja?id=${jawny.rzecz}&akt=999999`, 'agent-probny')).json();
  assert.equal(zlyAkt.status, 404);

  const ukryta = await (await zap(`/api/srodowisko/wersja?id=${prywatny.rzecz}&akt=${s.historia(prywatny.rzecz)[0].akt}`, 'agent-probny')).json();
  assert.equal(ukryta.status, 404, 'ukryta rzecz ma brzmieć dokładnie jak nieistniejąca');
  assert.deepEqual(Object.keys(ukryta).sort(), Object.keys(zlyAkt).sort(), 'ta sama odpowiedź co do pól, nie tylko co do kodu');

  const uWlasciciela = await (await zap(`/api/srodowisko/wersja?id=${prywatny.rzecz}&akt=${s.historia(prywatny.rzecz)[0].akt}`, 'jozz')).json();
  assert.equal(uWlasciciela.ok, true, 'właścicielowi ta sama trasa oddaje wersję');
});

test('W9. obszar, do którego nie ma wstępu, nie jest wymieniony - nazwa też bywa treścią', async () => {
  // Znalezione atakiem na własną granicę pod żywym adresem: rzeczy ze skarbca nie było widać, ale sam skarbiec
  // stał na liście obszarów z nazwą, identyfikatorem i ustawieniami. Obszar leży w obszarze NADRZĘDNYM, więc
  // filtr po `obszar` go nie dotyczył.
  const { s, prywatny, zamkniety } = await swiat();
  const widziObszary = (kto) => s.dla(kto).spis({ rodzaj: 'obszar/1' }).map((o) => o.cechy.nazwa).sort();
  assert.ok(widziObszary('jozz').includes('Tylko wlasciciel'));
  assert.ok(!widziObszary('agent-probny').includes('Tylko wlasciciel'), 'uczestnik nie widzi nawet nazwy');
  assert.ok(widziObszary('agent-probny').includes('Dla uczestnikow'), 'ale obszar, do którego ma wstęp, owszem');
  assert.equal(s.dla('agent-probny').rzecz(prywatny.obszar), null, 'ani pod własnym adresem');
  assert.ok(s.dla('agent-probny').rzecz(zamkniety.obszar), 'obszar dla uczestników zostaje widoczny');
  assert.ok(s.dla(null).spis({ rodzaj: 'obszar/1' }).every((o) => o.cechy.nazwa !== 'Dla uczestnikow'));
});

test('W10. dziennik jest drugą drogą do tych samych faktów i też przechodzi przez okulary', async () => {
  // Trzecia dziura z ataku na własną granicę, inna w rodzaju niż dwie pierwsze: lista "co się zmieniło" pyta
  // wprost akty, nie spis, więc filtr jej nie dotyczył. Nazwa była już '?', ale identyfikator wychodził - a
  // identyfikator jest uchwytem. Zostaje po takich wierszach liczba, bo sam ruch i tak słychać po numerze aktu.
  const { s, prywatny } = await swiat();
  const { opisDane } = await import('./opis.mjs');
  const u = opisDane(s.dla('agent-probny'), { kto: 'agent-probny' });
  assert.ok(u.zmiany.lista.every((z) => z.id !== prywatny.rzecz && z.id !== prywatny.obszar), 'żadnego identyfikatora z zamkniętego obszaru');
  assert.ok(u.zmiany.ukryte >= 2, `liczba ukrytych zmian jest powiedziana wprost (jest ${u.zmiany.ukryte})`);
  assert.ok(u.zmiany.lista.every((z) => z.tytul !== '?'), 'nie zostaje wiersz-widmo z pytajnikiem zamiast nazwy');
  const wl = opisDane(s.dla('jozz'), { kto: 'jozz' });
  assert.equal(wl.zmiany.ukryte, 0, 'właściciel nie ma nic ukrytego');
  assert.ok(wl.zmiany.lista.some((z) => z.id === prywatny.rzecz), 'i widzi tę samą zmianę z nazwą');
});

test('W11. kanał na żywo: obecność nie podaje rzeczy z obszaru, którego czytelnik nie widzi', async () => {
  // Czwarta dziura z tego samego ataku, i jedyna znaleziona POD adresem przez otwarcie dwóch połączeń naraz
  // (17 XI 2026): obecność niesie `przy: <rzecz>`, a budowała jedną listę dla wszystkich. Właściciel siadał przy
  // rzeczy w obszarze `widzi: wlasciciel`, a uczestnik dostawał jej identyfikator. Kanał nie pyta spisu, więc nie
  // wystarczyło przefiltrować spisu - to ta sama zasada co przy dzienniku: każda droga do faktów jest osobną drogą.
  const { s, prywatny, jawny } = await swiat();
  const { obecni, rozglosObecnych } = await import('./zywe.mjs');
  const gniazdo = (stan) => {
    const g = { wyslane: [], zal: stan, send(t) { g.wyslane.push(JSON.parse(t)); }, close() {}, serializeAttachment(x) { g.zal = structuredClone(x); }, deserializeAttachment() { return g.zal ? structuredClone(g.zal) : null; } };
    return g;
  };
  const widac = (kto, id) => s.rzecz(id, { dla: kto || null }) !== null;
  const wl = gniazdo({ kto: 'jozz', przy: prywatny.rzecz });
  const ag = gniazdo({ kto: 'agent-probny', przy: jawny.rzecz });
  const gniazda = [wl, ag];

  // bez okularów (tak było do 17 XI): jedna lista dla wszystkich i identyfikator leci do każdego
  rozglosObecnych(gniazda, { podglad: true });
  assert.ok(JSON.stringify(ag.wyslane).includes(prywatny.rzecz), 'kontrola sprawdzianu: bez okularów wyciek jest');

  wl.wyslane.length = 0; ag.wyslane.length = 0;
  rozglosObecnych(gniazda, { podglad: true, widac });
  const u = ag.wyslane.at(-1), w = wl.wyslane.at(-1);
  assert.ok(!JSON.stringify(u).includes(prywatny.rzecz), 'uczestnik nie dostaje identyfikatora rzeczy ze skarbca');
  assert.deepEqual(u.lista.find((x) => x.kto === 'jozz'), { kto: 'jozz' }, 'ale widzi, że właściciel jest obecny');
  assert.ok(u.lista.some((x) => x.kto === 'agent-probny' && x.przy === jawny.rzecz), 'rzecz z jawnego obszaru zostaje');
  assert.ok(w.lista.some((x) => x.kto === 'jozz' && x.przy === prywatny.rzecz), 'właściciel widzi własną rzecz');
  assert.deepEqual(obecni(gniazda).lista.length, 2, 'sama obecność jest nadal pełna: ukrywamy rzecz, nie człowieka');
});

test('W12. nowe wywołanie kanału nie zapomni okularów po cichu', async () => {
  // Rodzeństwo W7, ten sam powód: granica trzyma tak długo, jak długo KAŻDE wywołanie ją podaje. Tu nie ma
  // domyślnej ścieżki, która by o tym pamiętała - `widac` pominięte w nowym miejscu znaczy po cichu brak filtra.
  const { readFileSync } = await import('node:fs');
  const zrodlo = readFileSync(new URL('./miejsce-do.mjs', import.meta.url), 'utf8');
  const bez = zrodlo.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /\b(przyjmijGniazdo|przyjmijWiadomosc|poZamknieciu|rozglosObecnych)\s*\(/.test(l) && !l.startsWith('import') && !l.includes('widac'));
  assert.deepEqual(bez, [], 'wywołania kanału bez `widac` (obecność poniosłaby identyfikatory bez okularów)');
});

test('W13. "co czeka" nie niesie prośby z obszaru, którego czytelnik nie widzi', async () => {
  // Pierwsza z pięciu rzeczy, które Fable złamał atakiem pod żywym adresem (17 XI 2026). Źródło usterki nie jest
  // w trasie, tylko w FUNKCJI, którą trasa woła: czeka() pytało `wszystkie` na celu, nie na widoku, więc okulary
  // jej nie dotyczyły. W7 pilnuje trasy; to jest o jedno piętro głębiej.
  const { s, prywatny, jawny } = await swiat();
  const dodaj = async (obszar, tresc, op) => (await s.ruch('jozz', { op, co: 'poloz', rodzaj: 'prosba/1', obszar, cechy: { tresc, stan: 'czeka' } })).rzecz;
  const tajna = await dodaj(prywatny.obszar, 'TAJNA-PROSBA-DRUGIEJ-LINII', 'widocznosc-prosba-1');
  const jawna = await dodaj(jawny.obszar, 'Jawna prośba', 'widocznosc-prosba-2');

  const u = s.dla('agent-probny').czeka();
  const id = (lista) => lista.map((x) => x.id);
  assert.ok(!id(u.prosby).includes(tajna), 'uczestnik nie dostaje ani identyfikatora prośby ze skarbca');
  assert.ok(!JSON.stringify(u.prosby).includes('TAJNA-PROSBA'), 'ani jej treści');
  assert.ok(id(u.prosby).includes(jawna), 'a jawną prośbę widzi');
  assert.ok(id(s.dla('jozz').czeka().prosby).includes(tajna), 'właściciel widzi obie');
  // i to samo przez dane opisu, bo tam ta dziura wyszła
  const { opisDane } = await import('./opis.mjs');
  assert.ok(!JSON.stringify(opisDane(s.dla('agent-probny'), { kto: 'agent-probny' }).czeka).includes('TAJNA-PROSBA'));
});

test('W14. liczba też jest treścią - także ta z tabeli przekroju, nie tylko ze spisu', async () => {
  // Druga rzecz z ataku Fable: opis mówił 4 projekty, a spis pokazywał 2. liczby() biorą się z przekroju
  // (liczby zsumowane w tabeli), więc filtr w zapytaniu ich nie dotykał. To moje własne zdanie z W2 złamane
  // o jedno piętro niżej.
  const { s, prywatny } = await swiat();
  const ileProjektow = (kto) => (s.dla(kto)._liczbyDla(kto).find((l) => l.rodzaj === 'projekt/1') || { ile: 0 }).ile;
  assert.equal(ileProjektow('jozz'), 3);
  assert.equal(ileProjektow('agent-probny'), 2, 'licznik mówi tyle, ile widać w spisie');
  assert.equal(s.dla('agent-probny').spis({ rodzaj: 'projekt/1' }).length, 2, 'i spis mówi to samo co licznik');
  assert.equal(ileProjektow(null), 1);
  // sam obszar zamknięty leży w obszarze NADRZĘDNYM, więc przekrój policzył go po stronie rodzica
  const ileObszarow = (kto) => (s.dla(kto)._liczbyDla(kto).find((l) => l.rodzaj === 'obszar/1') || { ile: 0 }).ile;
  assert.equal(ileObszarow('agent-probny'), s.dla('agent-probny').spis({ rodzaj: 'obszar/1' }).length, 'obszar zamknięty nie jest doliczony');
  assert.ok(ileObszarow('jozz') > ileObszarow('agent-probny'));
  const { opisDane } = await import('./opis.mjs');
  const d = opisDane(s.dla('agent-probny'), { kto: 'agent-probny' });
  assert.equal((d.liczby.find((l) => l.rodzaj === 'projekt/1') || { ile: 0 }).ile, 2, 'opis liczy tak samo');
  assert.equal(d.razem, d.liczby.reduce((a, x) => a + x.ile, 0));
  assert.ok(prywatny.rzecz);
});

test('W15. przeniesienie rzeczy do jawnego obszaru nie publikuje jej przeszłości', async () => {
  // Trzecia rzecz z ataku Fable, i jedyna, którą sam nazwał pytaniem o projekt, nie o błąd. Odpowiedź: dawna
  // wersja jest widoczna tylko dla tego, kto widzi obszar Z JEJ ZAPISU i dzisiejszy. Inaczej przeniesienie rzeczy
  // do jawnego obszaru jest publikacją całej jej historii, a publikacja ma być świadomym gestem.
  const { s, prywatny } = await swiat();
  const p = await s.ruch('jozz', { op: 'widocznosc-przeszlosc-1', co: 'poloz', rodzaj: 'projekt/1', obszar: prywatny.obszar, cechy: { nazwa: 'Projekt', opis: 'TAJNA-PRZESZLOSC' } });
  const pierwszy = s.historia(p.rzecz)[0].akt;
  const teraz = s.rzecz(p.rzecz);
  await s.ruch('jozz', { op: 'widocznosc-przeszlosc-2', co: 'poloz', rzecz: p.rzecz, wersja: teraz.wersja, rodzaj: 'projekt/1', obszar: null, cechy: { nazwa: 'Projekt', opis: 'Jawny opis' } });

  const w = s.dla('agent-probny');
  assert.ok(w.rzecz(p.rzecz), 'dziś rzecz jest jawna i uczestnik ją widzi');
  assert.equal(w.rzecz(p.rzecz).cechy.opis, 'Jawny opis');
  assert.equal(w.wersja(p.rzecz, pierwszy), null, 'ale jej tajna przeszłość nie wraca razem z nią');
  assert.ok(s.dla('jozz').wersja(p.rzecz, pierwszy).cechy.opis === 'TAJNA-PRZESZLOSC', 'właściciel przeszłość widzi');
  // sam fakt, że akt był, zostaje słyszalny: numer aktu i tak jest jawny, tak samo jak w dzienniku
  assert.ok(s.historia(p.rzecz).length >= 2);
});

test('W16. widok czytelnika nie przepuszcza niczego po cichu: surowy SQL rzuca, a lista owiniętych metod jest jawna', async () => {
  // Dwie z pięciu dziur Fable miały ten sam kształt: metoda WOŁANA NA WIDOKU pytała bazy na celu, bo zapas
  // (fallback) w Proxy wiązał wszystko z celem. Zapas, który wszystko przepuszcza, nie jest granicą. Odtąd:
  // surowy SQL przez widok nie przechodzi, a każda publiczna metoda, która sama dotyka SQL, musi być albo
  // owinięta, albo wypisana tutaj z powodem - żeby następna taka padła głośno, a nie po cichu.
  const { s } = await swiat();
  const w = s.dla('agent-probny');
  assert.throws(() => w.q('SELECT 1'), /nie podaje surowego SQL/);
  assert.equal(s.q('SELECT 1 AS x')[0].x, 1, 'na samym środowisku surowe zapytanie dalej działa');

  const owiniete = new Set(['spis', 'wszystkie', 'ile', 'rzecz', 'rzeczyWiele', 'wersja', 'wskazujaNa', 'pamietaj', 'czeka', 'liczby', 'przekroj', 'q', 'ksztalty', 'ustawienie']);
  const swiadomie = {
    historia: 'same numery aktow i autorzy, bez tresci; tresc podaje wersja(), a ta jest owinieta',
    aktyRzeczy: 'wiersze dziennika; kazdy i tak sprawdzany oczami czytelnika w opis.mjs (zmiany)',
    kodGoscia: 'kod goscia jest dzis jawny po odcisku - zapisane jako brak, nie jako rzecz zrobiona',
    przebuduj: 'odbudowa spisu: ruch srodowiska, nie czytanie dla kogos',
    ksztaltDla: 'ksztalt JEDNEGO rodzaju: nazwa i uklad rzeczy, ktora czytajacy juz widzi; lista rodzajow jest owinieta',
    rola: 'prawa czytajacego, policzone o NIM; sama widocznosc z niej wychodzi, wiec nie moze od niej zalezec',
    wyrownajZNatury: 'ruch srodowiska (naprawa polozen), nie czytanie dla kogos',
  };
  // Pierwsza wersja tego straznika pytala tylko o SUROWY SQL w ciele metody - i dlatego przepuscila dwie metody,
  // ktore czytaja baze PRZEZ inna metode: `ksztalty` (lista rodzajow: ksztalt z zamknietego obszaru wychodzil
  // kazdemu czytajacemu) i `ustawienie` (obszar jawny podawal w polu `skad` identyfikator ukrytego rodzica).
  // Straznik, ktory lapie jeden ksztalt bledu, sam jest dziura; odtad pyta takze o czytanie POSREDNIE.
  const proto = Object.getPrototypeOf(s);
  const metody = Object.getOwnPropertyNames(proto).filter((n) => {
    if (n === 'constructor' || n.startsWith('_')) return false;
    const d = Object.getOwnPropertyDescriptor(proto, n);
    return d && typeof d.value === 'function';
  });
  const POSREDNIO = /this\.(wszystkie|spis|ile|rzecz|rzeczyWiele|wersja|wskazujaNa|historia|aktyRzeczy|ksztalty|przekroj|liczby)\(/;
  const czyta = metody.filter((n) => /this\.q\(|\.sql\.exec\(/.test(String(proto[n])) || POSREDNIO.test(String(proto[n])));
  const nieznane = czyta.filter((n) => !owiniete.has(n) && !Object.hasOwn(swiadomie, n));
  assert.deepEqual(nieznane, [], 'metoda publiczna, ktora czyta rzeczy (sama albo przez inna metode), a nie przechodzi przez okulary ani nie jest tu wypisana z powodem');
});

test('W17. rodzaj jest rzeczą: kształt z zamkniętego obszaru nie wychodzi w liście rodzajów, a nazwy rzeczy widocznego rodzaju nie znikają', async () => {
  // Znalezisko Fable z drugiego ataku na tę granicę, potwierdzone u źródła przez drugą linię (17/18 XI 2026):
  // `ksztalty()` czytało bazę PRZEZ `wszystkie()`, więc zapas w Proxy wiązał je z celem i lista rodzajów szła
  // obok okularów. Rodzaj opisany w obszarze tylko dla właściciela był widoczny każdemu czytającemu z nazwą
  // i opisem - a nazwa rodzaju mówi, czym ktoś się zajmuje.
  const { s, jawny, prywatny } = await swiat();
  const k = await s.ruch('jozz', { op: 'w17-ksztalt-tajny', co: 'poloz', rodzaj: 'ksztalt/1', obszar: prywatny.obszar,
    cechy: { dla: 'tajnyrodzaj/1', opis: 'Rodzaj, o którym nikt obcy nie ma wiedzieć.', cechy: {} } });
  assert.equal(k.ok, true, JSON.stringify(k));
  const rodzaje = (kto) => [...s.dla(kto).ksztalty().keys()];
  assert.ok(rodzaje('jozz').includes('tajnyrodzaj/1'), 'właściciel widzi własny rodzaj');
  assert.ok(!rodzaje('agent-probny').includes('tajnyrodzaj/1'), 'uczestnik NIE widzi rodzaju z obszaru właściciela');
  assert.ok(!rodzaje(null).includes('tajnyrodzaj/1'), 'zwiedzający NIE widzi tego rodzaju');
  // Druga strona: uczestnik dalej widzi cały rdzeń rodzajów, więc to nie jest zgaszenie listy.
  for (const r of ['projekt/1', 'obszar/1', 'ksztalt/1', 'uczestnik/1']) assert.ok(rodzaje('agent-probny').includes(r), r);
  // Kształty rdzenia leżą w obszarze głównym, a ten domyślnie mówi `widzi: uczestnicy` - więc zwiedzający bez
  // klucza nie widzi ŻADNEGO rodzaju. To jest zgodne z resztą: nie widzi też żadnej rzeczy z tego obszaru.
  // Nazwa rzeczy z obszaru `wszyscy` i tak działa, bo `tytul` i `ksztaltDla` są wiązane z celem, nie z widokiem.
  assert.deepEqual(rodzaje(null), []);
  assert.equal(s.dla(null).tytul(s.dla(null).rzecz(jawny.rzecz)), 'Projekt Jawny');
});

test('W18. ustawienie podaje wartość dziedziczoną, ale nie identyfikator obszaru, którego czytający nie widzi', async () => {
  // Ten sam skan, druga metoda: `ustawienie()` chodzi po drodze w górę i MUSI widzieć wszystko (z niego wychodzi
  // sama widoczność), ale pole `skad` to identyfikator rzeczy. Obszar jawny położony w obszarze zamkniętym
  // podawał tak identyfikator swojego ukrytego rodzica - i robił to w opisie Miejsca, przy każdym obszarze.
  const { s, prywatny } = await swiat();
  const w = await s.ruch('jozz', { op: 'w18-jawny-w-prywatnym', co: 'poloz', rodzaj: 'obszar/1', obszar: prywatny.obszar,
    cechy: { nazwa: 'Jawne okno w prywatnym', widzi: 'wszyscy' } });
  assert.equal(w.ok, true, JSON.stringify(w));
  // `ile_wolno` dziedziczy się z rodzica, którego zwiedzający nie widzi.
  const dlaWlasciciela = s.dla('jozz').ustawienie(w.rzecz, 'ile_wolno');
  assert.equal(dlaWlasciciela.skad, prywatny.obszar, 'właścicielowi źródło wolno pokazać');
  const dlaGoscia = s.dla(null).ustawienie(w.rzecz, 'ile_wolno');
  assert.equal(dlaGoscia.wartosc, dlaWlasciciela.wartosc, 'wartość prawa zostaje: ona dotyczy obszaru, który widzi');
  assert.equal(dlaGoscia.skad, null, 'ale identyfikator ukrytego rodzica nie wychodzi');
  // Droga ustawienia nie może zależeć od czytającego: wartość policzona przez okulary i bez nich jest ta sama.
  assert.equal(s.ustawienie(w.rzecz, 'ile_wolno').wartosc, dlaGoscia.wartosc);
});
