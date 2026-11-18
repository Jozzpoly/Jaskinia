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
