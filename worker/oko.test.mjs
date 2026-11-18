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
