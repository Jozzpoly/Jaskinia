// Stan oka przy słowie (18 XI 2026): słowo zostawione ręką niesie to, co widział piszący.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';

test('OK1. słowo niesie stan oka: twarz, jej wersję, akt i widok; zepsuty stan oka odbija się ze zdaniem, a słowo bez niego dalej przechodzi', async () => {
  let t = Date.UTC(2026, 10, 18, 1, 30, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w)); return w; };
  const widok = ok(await s.ruch('jozz', { op: 'ok1-widok-001', co: 'poloz', rodzaj: 'widok/1', cechy: { nazwa: 'Widok do patrzenia' } })).rzecz;
  const slowo = (op, oko) => s.ruch('jozz', { op, co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'Karty za ciasno, cień za ciężki.', dotyczy: [widok], ...(oko === undefined ? {} : { oko }) } });
  const dobre = { twarz: 'start', wersja: 'a1b2c3d4e5f6', akt: s.ostatniNr(), widok, ekran: { szer: 1280, wys: 720, klasa: 'szeroki', dotyk: false }, ciemny: true, stan: { ciekly: 1, kamera: { x: 10, y: 20, k: 0.5 } } };
  const a = ok(await slowo('ok1-slowo-dobre', dobre));
  assert.deepEqual(s.rzecz(a.rzecz).cechy.oko, dobre, 'stan oka leży przy słowie tak, jak przyszedł');
  assert.deepEqual(s.dla('agent-a').rzecz(a.rzecz).cechy.oko.stan.kamera, { x: 10, y: 20, k: 0.5 }, 'agent czyta, na co patrzył autor');
  ok(await slowo('ok1-slowo-bez-oka'));
  for (const [op, oko, wzor] of [
    ['ok1-zle-napis', 'start', /ma być obiektem/],
    ['ok1-zle-twarz', { ...dobre, twarz: 'Start!' }, /twarz:/],
    ['ok1-zle-wersja', { ...dobre, wersja: '' }, /wersja:/],
    ['ok1-zle-przyszlosc', { ...dobre, akt: s.ostatniNr() + 500 }, /nie z przyszłości/],
    ['ok1-zle-widok', { ...dobre, widok: 'widok' }, /widok:/],
    ['ok1-zle-rozmiar', { ...dobre, stan: { smieci: 'x'.repeat(3000) } }, /najwyżej 2000/],
  ]) {
    const o = await slowo(op, oko);
    assert.equal(o.status, 422, JSON.stringify(o));
    assert.match(o.blad, wzor);
  }
  assert.ok(s.ksztaltDla('slowo/1').cechy.oko, 'kształt słowa opisuje stan oka');
});

test('OK4. okno jest osobiste: kładzie je i zmienia tylko ten, czyje jest, a strona wraca sama tylko do własnego okna i niezmienionego narzędzia', async () => {
  const { oknoWracaSamo } = await import('../public/okna.mjs');
  let t = Date.UTC(2026, 10, 18, 3, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a', 'agent-b'] }));
  const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w)); return w; };
  const gosc = s.spis({ rodzaj: 'gosc/1' }).find((g) => g.cechy.umowa === 'okno/3');
  const okno = (kto, op, czyje, dod = {}, opcje = {}) => s.ruch(kto, { op, co: 'poloz', rodzaj: 'okno/1', wersja: 'dowolna', cechy: { nazwa: 'Słowa', czyje, gosc: gosc.id, otwarte: true, wersja_goscia: gosc.wersja, ...dod } }, opcje);
  // agent nie położy okna z imieniem właściciela ani z imieniem innego agenta: odmowa, nie propozycja, i nic nie powstaje
  for (const [op, czyje] of [['ok4-cudze-wlasciciela', 'jozz'], ['ok4-cudze-agenta', 'agent-b']]) {
    const w = await okno('agent-a', op, czyje);
    assert.equal(w.status, 403, JSON.stringify(w));
    assert.match(w.blad, /okno należy do tego, kto je otworzył/);
  }
  assert.equal(s.ile({ rodzaj: 'okno/1', odlozone: 'razem' }), 0);
  assert.equal(s.ile({ rodzaj: 'propozycja/1' }), 0, 'cudzego okna nie da się nawet zaproponować');
  // własne okno przechodzi; drugi agent go nie zmieni ani nie odłoży, choć leży tam, gdzie agenci prowadzą
  const moje = ok(await okno('agent-a', 'ok4-moje-okno', 'agent-a'));
  let rz = s.rzecz(moje.rzecz);
  assert.notEqual(rz.obszar, null);
  assert.equal((await s.ruch('agent-b', { op: 'ok4-cudza-zmiana', co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: 'okno/1', cechy: { ...rz.cechy, otwarte: false } })).status, 403);
  assert.equal((await s.ruch('agent-b', { op: 'ok4-cudze-odlozenie', co: 'odloz', rzecz: rz.id, wersja: rz.wersja })).status, 403);
  // zajęcie klucza z wyprzedzeniem: nie ma czego zająć, więc okno właściciela jest jego rzeczą w jego obszarze
  const wlasciciela = ok(await okno('jozz', 'ok4-okno-wlasciciela', 'jozz'));
  const ow = s.rzecz(wlasciciela.rzecz);
  assert.deepEqual([ow.utworzyl, ow.zmienil, ow.obszar], ['jozz', 'jozz', null]);
  assert.equal((await okno('agent-a', 'ok4-przejecie', 'jozz', { otwarte: false })).status, 403);
  assert.equal((await s.ruch('agent-a', { op: 'ok4-odlozenie-wlasciciela', co: 'odloz', rzecz: ow.id, wersja: ow.wersja })).status, 403);
  assert.equal(s.rzecz(ow.id).cechy.otwarte, true);
  // narzędzie w oknie nie otwiera ani nie zamyka okien, także okna tego, kto je otworzył
  for (const [op, czyje] of [['ok4-z-okna-wlasciciela', 'jozz'], ['ok4-z-okna-na-siebie', 'gosc-' + gosc.id]]) {
    const w = await okno('jozz', op, czyje, {}, { gosc: gosc.id });
    assert.equal(w.status, 403, JSON.stringify(w));
  }
  // następne pokolenie kształtu okna ustala tylko właściciel
  const pokolenie = ok(await s.ruch('agent-a', { op: 'ok4-okno-2-ksztalt', co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'okno/2', tytul: 'nazwa', opis: 'okno bez właściciela', cechy: { nazwa: { typ: 'tekst' } } } }));
  assert.equal(pokolenie.skutek, 'propozycja');
  // strona: wraca samo tylko okno, które zapisałem sam, i tylko do narzędzia w wersji, którą otworzyła moja ręka
  const g = { ...s.rzecz(gosc.id), tytul: 'Słowa' };
  const wraca = (o, gg = g, ja = 'jozz') => oknoWracaSamo(o, gg, ja).wraca;
  assert.equal(wraca(ow), true);
  assert.equal(wraca({ ...ow, zmienil: 'agent-a' }), false, 'cudza ręka przy moim oknie niczego nie otwiera');
  assert.equal(wraca({ ...ow, utworzyl: 'agent-a' }), false);
  assert.equal(wraca({ ...ow, cechy: { ...ow.cechy, czyje: 'agent-a' } }), false);
  assert.equal(wraca({ ...ow, cechy: { ...ow.cechy, otwarte: false } }), false);
  assert.equal(wraca({ ...ow, odlozone: true }), false);
  assert.equal(wraca(ow, { ...g, odlozone: true }), false);
  assert.equal(wraca(ow, null), false);
  const { wersja_goscia: _bez, ...bezWersji } = ow.cechy;
  assert.equal(wraca({ ...ow, cechy: bezWersji }), false, 'okno sprzed tej reguły nie wraca samo');
  const zmienione = oknoWracaSamo(ow, { ...g, wersja: g.wersja + 7 }, 'jozz');
  assert.equal(zmienione.wraca, false);
  assert.match(zmienione.powiedz, /zmieniło się, odkąd je otwarto/);
  assert.equal(wraca(rz, g, 'agent-a'), true, 'okno agenta wraca u agenta');
  assert.equal(wraca(rz, g, 'jozz'), false);
});

test('OK5. narzędzie w oknie czyta słabszymi z dwóch par oczu: w oknie właściciela nie widzi tego, co widzi tylko on', async () => {
  const { obsluzSrodowisko } = await import('./srodowisko-http.mjs');
  let t = Date.UTC(2026, 10, 18, 3, 30, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w)); return w; };
  const gosc = s.spis({ rodzaj: 'gosc/1' }).find((g) => g.cechy.umowa === 'okno/3');
  const T = ok(await s.ruch('jozz', { op: 'ok5-tajne-001', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Tajne', widzi: 'wlasciciel', ile_wolno: 'prowadzic' } })).rzecz;
  const jawny = ok(await s.ruch('jozz', { op: 'ok5-projekt-1', co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Jawny projekt' } })).rzecz;
  const tajny = ok(await s.ruch('jozz', { op: 'ok5-projekt-2', co: 'poloz', rodzaj: 'projekt/1', obszar: T, cechy: { nazwa: 'Tajny projekt' } })).rzecz;
  const pytanie = async (sciezka, kto, oknem = null) => {
    const o = await obsluzSrodowisko(s, new Request('https://proba.example' + sciezka, { headers: { ...(kto ? { 'x-kto': kto } : {}), ...(oknem !== null ? { 'x-gosc': oknem } : {}) } }));
    return { status: o.status, dane: await o.json().catch(() => null) };
  };
  const nazwy = (o) => o.dane.rzeczy.map((x) => x.cechy.nazwa).sort();
  // właściciel sam widzi oba projekty; narzędzie w jego oknie tylko jawny, a liczba zgadza się z tym, co pokazane
  assert.deepEqual(nazwy(await pytanie('/api/srodowisko/spis?rodzaj=projekt', 'jozz')), ['Jawny projekt', 'Tajny projekt']);
  const zOkna = await pytanie('/api/srodowisko/spis?rodzaj=projekt', 'jozz', gosc.id);
  assert.deepEqual(nazwy(zOkna), ['Jawny projekt']);
  assert.equal(zOkna.dane.razem, 1, 'licznik nie zdradza rzeczy, której okno nie widzi');
  assert.equal((await pytanie('/api/srodowisko/rzecz?id=' + tajny, 'jozz')).status, 200);
  const tajnyZOkna = await pytanie('/api/srodowisko/rzecz?id=' + tajny, 'jozz', gosc.id);
  const nieMa = await pytanie('/api/srodowisko/rzecz?id=' + 'z'.repeat(26), 'jozz', gosc.id);
  assert.equal(tajnyZOkna.status, 404);
  assert.deepEqual(tajnyZOkna.dane, nieMa.dane, 'tajna rzecz brzmi w oknie jak rzecz, której nie ma');
  assert.equal((await pytanie('/api/srodowisko/rzecz?id=' + jawny, 'jozz', gosc.id)).status, 200);
  assert.equal((await pytanie('/api/srodowisko/rzecz?id=' + T, 'jozz', gosc.id)).status, 404, 'sam zamknięty obszar też');
  // obszar tajny nie stoi na liście obszarów czytanej z okna
  assert.equal((await pytanie('/api/srodowisko/spis?rodzaj=obszar', 'jozz', gosc.id)).dane.rzeczy.some((x) => x.id === T), false);
  // ustawienia i kształty z okna działają; wszystko inne z okna jest zamknięte
  assert.equal((await pytanie('/api/srodowisko/ustawienia?nazwy=wyglad.jasnosc', 'jozz', gosc.id)).dane.ok, true);
  assert.equal((await pytanie('/api/srodowisko/ksztalty', 'jozz', gosc.id)).dane.ok, true);
  for (const sciezka of ['/api/srodowisko/opis', '/co-tu-jest', '/api/srodowisko/gesty', '/api/srodowisko/wersja?id=' + tajny + '&akt=1', '/api/srodowisko/widok-w-chwili?widok=' + 'a'.repeat(26) + '&akt=1', '/rzeczy', '/api/srodowisko/bajty?rzecz=' + 'a'.repeat(26)]) {
    assert.equal((await pytanie(sciezka, 'jozz', gosc.id)).status, 403, sciezka);
  }
  // okno agenta widzi tyle, co agent; okno z gościem, którego nie ma, czyta jak zwiedzający, także u właściciela
  assert.deepEqual(nazwy(await pytanie('/api/srodowisko/spis?rodzaj=projekt', 'agent-a', gosc.id)), nazwy(await pytanie('/api/srodowisko/spis?rodzaj=projekt', 'agent-a')));
  for (const zly of ['z'.repeat(26), 'nie-id', jawny]) {
    const o = await pytanie('/api/srodowisko/spis?rodzaj=projekt', 'jozz', zly);
    assert.deepEqual([o.status, o.dane.razem], [200, 0], 'gość: ' + zly);
  }
  // odłożone narzędzie też czyta jak zwiedzający
  const gz = s.rzecz(gosc.id);
  ok(await s.ruch('jozz', { op: 'ok5-odloz-goscia', co: 'odloz', rzecz: gz.id, wersja: gz.wersja }));
  assert.equal((await pytanie('/api/srodowisko/spis?rodzaj=projekt', 'jozz', gosc.id)).dane.razem, 0);
  // samo środowisko: imię, pod którym liczy się widoczność okna
  assert.equal(s.czytelnikOkna('jozz', gosc.id), null);
  ok(await s.ruch('jozz', { op: 'ok5-przywroc-goscia', co: 'przywroc', rzecz: gz.id, wersja: s.rzecz(gz.id).wersja }));
  assert.equal(s.czytelnikOkna('jozz', gosc.id), 'gosc-' + gosc.id);
  assert.equal(s.czytelnikOkna('agent-a', gosc.id), 'agent-a');
  assert.equal(s.czytelnikOkna(null, gosc.id), null);
});

test('OK2. okno jest rzeczą i zasięgiem: jedno okno na uczestnika i narzędzie, a wartość z zasięgiem okna zmienia wygląd tylko w nim', async () => {
  const { policzUstawieniaDlaNazw } = await import('./ustawienia.mjs');
  let t = Date.UTC(2026, 10, 18, 2, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w)); return w; };
  const gosc = s.spis({ rodzaj: 'gosc/1', limit: 5 })[0];
  const okno = ok(await s.ruch('jozz', { op: 'ok2-okno-001', co: 'poloz', rodzaj: 'okno/1', wersja: 'dowolna', cechy: { nazwa: gosc.cechy.nazwa, czyje: 'jozz', gosc: gosc.id, otwarte: true } }));
  const drugiRaz = ok(await s.ruch('jozz', { op: 'ok2-okno-002', co: 'poloz', rodzaj: 'okno/1', wersja: 'dowolna', cechy: { nazwa: gosc.cechy.nazwa, czyje: 'jozz', gosc: gosc.id, otwarte: false } }));
  assert.equal(drugiRaz.rzecz, okno.rzecz, 'zamknięcie jest nową wersją tego samego okna, nie drugim oknem');
  assert.equal(s.rzecz(okno.rzecz).cechy.otwarte, false);
  assert.equal(s.historia(okno.rzecz).length, 2);
  const zly = await s.ruch('jozz', { op: 'ok2-okno-zle', co: 'poloz', rodzaj: 'okno/1', cechy: { nazwa: 'X', czyje: 'jozz', gosc: okno.rzecz, otwarte: true } });
  assert.equal(zly.ok, false, 'okno wskazuje narzędzie, nie dowolną rzecz');
  ok(await s.ruch('jozz', { op: 'ok2-wartosc-1', co: 'poloz', rodzaj: 'wartosc/1', cechy: { pokretlo: 'wyglad.paleta.jasna.akcent', wartosc: '#aa00aa', zasieg: okno.rzecz } }));
  const dlaOkna = await policzUstawieniaDlaNazw(s.dla('agent-a'), { nazwy: ['wyglad.paleta.jasna.akcent'], dla: okno.rzecz });
  const dlaMiejsca = await policzUstawieniaDlaNazw(s.dla('agent-a'), { nazwy: ['wyglad.paleta.jasna.akcent'] });
  assert.equal(dlaOkna.wartosci['wyglad.paleta.jasna.akcent'].wartosc, '#aa00aa');
  assert.equal(dlaMiejsca.wartosci['wyglad.paleta.jasna.akcent'].skad, 'domyslna', 'wygląd Miejsca się nie zmienił');
});

test('OK3. spis czasowników nazywa także to, co umie ręka: jedna tablica dla pomocy na twarzy i dla agenta', async () => {
  const { CZASOWNIKI_REKI, czasownikiTwarzy } = await import('../public/reka.mjs');
  const { opisMiejsca, czasownikiReki } = await import('./opis.mjs');
  assert.ok(CZASOWNIKI_REKI.length >= 10);
  assert.equal(new Set(CZASOWNIKI_REKI.map((c) => c.nazwa)).size, CZASOWNIKI_REKI.length, 'nazwy są umową, więc się nie powtarzają');
  for (const c of CZASOWNIKI_REKI) {
    assert.match(c.nazwa, /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/, c.nazwa);
    assert.equal(c.nazwa.split('.')[0], c.twarz);
    assert.ok(c.co && c.jak, c.nazwa);
  }
  assert.ok(czasownikiTwarzy('start').some((c) => c.nazwa === 'start.cofnij' && c.klawisz === 'Ctrl+Z'));
  const reka = czasownikiReki();
  assert.ok(reka.some((c) => c.nazwa === 'reka:start.zamien-projekty' && /zapisuje miejsce\/1/.test(c.opis) && /ręka na twarzy start/.test(c.ktoredy)));
  if (typeof opisMiejsca === 'function') {
    let t = Date.UTC(2026, 10, 18, 2, 30, 0);
    const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
    const s = new Srodowisko(r);
    await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
    const o = opisMiejsca(s.dla('agent-a'), {});
    if (o && Array.isArray(o.czasowniki)) assert.ok(o.czasowniki.some((c) => c.nazwa === 'reka:start.cofnij'), 'opis Miejsca niesie czasowniki ręki');
  }
});

test('OK6. żadna strona tekstowa dla agentów nie niesie gołego "undefined": każdy czasownik mówi, co bierze i co oddaje, albo tego pola nie drukuje', async () => {
  const { obsluzSrodowisko } = await import('./srodowisko-http.mjs');
  const { czasowniki, czasownikiReki } = await import('./opis.mjs');
  let t = Date.UTC(2026, 10, 18, 13, 30, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const strona = async (sciezka, kto = 'agent-a') => (await obsluzSrodowisko(s, new Request('https://proba.example' + sciezka, { headers: kto ? { 'x-kto': kto } : {} }))).text();
  const gosc = s.spis({ rodzaj: 'gosc/1', limit: 1 })[0];
  for (const sciezka of ['/co-tu-jest', '/rodzaje', '/ustawienia', '/umowa-okna', '/rzeczy', '/rodzaj/okno/1', '/rodzaj/plik/1', '/rodzaj/slowo/1', '/rzecz/' + gosc.id]) {
    for (const kto of ['agent-a', 'jozz', null]) {
      const tekst = await strona(sciezka, kto);
      for (const smiec of ['undefined', '[object Object]', 'NaN']) assert.equal(tekst.includes(smiec), false, `${sciezka} dla ${kto || 'zwiedzającego'} niesie "${smiec}": ${(tekst.split('\n').find((l) => l.includes(smiec)) || '').slice(0, 160)}`);
    }
  }
  for (const c of [...czasowniki(s.dla('agent-a')), ...czasownikiReki()]) {
    for (const pole of ['nazwa', 'ktoredy', 'opis', 'wejscie', 'wynik']) assert.equal(typeof c[pole] === 'string' && c[pole].length > 0, true, `czasownik ${c.nazwa}: pole ${pole}`);
  }
});

test('OK7. lista rodzajów przez drzwi idzie oczami czytającego: kształt z zamkniętego obszaru nie stoi na niej ani dla agenta, ani dla zwiedzającego, ani dla narzędzia w oknie', async () => {
  const { obsluzSrodowisko } = await import('./srodowisko-http.mjs');
  let t = Date.UTC(2026, 10, 18, 15, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w)); return w; };
  const T = ok(await s.ruch('jozz', { op: 'ok7-tajne-001', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Tajne', widzi: 'wlasciciel', ile_wolno: 'nic' } })).rzecz;
  const k = ok(await s.ruch('jozz', { op: 'ok7-ksztalt-01', co: 'poloz', rodzaj: 'ksztalt/1', obszar: T, cechy: { dla: 'tajnyrodzaj/1', tytul: 'nazwa', opis: 'opis-tajnego-rodzaju', cechy: { nazwa: { typ: 'tekst', wymagana: true, opis: 'cecha-tajna' } } } })).rzecz;
  const gosc = s.spis({ rodzaj: 'gosc/1' }).find((g) => g.cechy.umowa === 'okno/3');
  const pytanie = async (kto, naglowki = {}) => (await obsluzSrodowisko(s, new Request('https://proba.example/api/srodowisko/ksztalty', { headers: { ...(kto ? { 'x-kto': kto } : {}), ...naglowki } }))).text();
  assert.match(await pytanie('jozz'), /opis-tajnego-rodzaju/, 'właściciel widzi swój kształt');
  for (const [kto, naglowki, kim] of [['agent-a', {}, 'agent'], [null, {}, 'zwiedzający'], ['jozz', { 'x-gosc': gosc.id }, 'narzędzie w oknie właściciela'], ['agent-a', { 'x-gosc': gosc.id }, 'narzędzie w oknie agenta']]) {
    const tekst = await pytanie(kto, naglowki);
    for (const slad of ['tajnyrodzaj', 'opis-tajnego-rodzaju', 'cecha-tajna', k]) assert.equal(tekst.includes(slad), false, `${kim}: lista rodzajów niesie "${slad}"`);
    // zwiedzający poza podglądem nie widzi obszaru głównego (widzi: uczestnicy), więc jego lista jest pusta, tak jak spis
    if (kto) assert.match(tekst, /"dla":\s*"projekt\/1"/, `${kim}: jawne rodzaje dalej są na liście`);
    else assert.deepEqual(JSON.parse(tekst).ksztalty, [], 'zwiedzający: lista rodzajów jest pusta jak jego spis');
  }
});
