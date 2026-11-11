// Osada: determinizm doganiania, przeżycie mieszkańców, gesty bez cichych porażek, przebudzenia Durable Object.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { nowySwiat, krok, dogon, gest, widok, sciezka, DOBA, LIMIT_KROKOW } from './swiat.mjs';
import { Swiat, KROK_MS, RZADKI_ALARM_MS } from './swiat-do.mjs';
import { sqlZNode } from './sql-node.mjs';

test('doganianie partiami, z zapisem do JSON między nimi, daje dokładnie ten sam świat co ciągły bieg', () => {
  const ciagly = nowySwiat(), partiami = nowySwiat();
  for (let i = 0; i < DOBA * 2; i++) krok(ciagly);
  let s = partiami;
  while (s.krok < ciagly.krok) { dogon(s, ciagly.krok); s = JSON.parse(JSON.stringify(s)); }
  assert.equal(JSON.stringify(s), JSON.stringify(ciagly));
});

test('mieszkańcy przeżywają tydzień na różnych mapach: jedzą, śpią, nikt nie utyka z pełnym głodem', () => {
  for (const ziarno of [20261111, 1, 2, 3, 7, 99]) {
    const s = nowySwiat(ziarno);
    for (let i = 0; i < DOBA * 7; i++) krok(s);
    for (const m of s.mieszkancy) {
      assert.ok(m.zjedzone >= 30, `${ziarno}: ${m.imie} zjadł tylko ${m.zjedzone} razy w tydzień`);
      assert.ok(m.glod < 90, `${ziarno}: ${m.imie} kończy tydzień z głodem ${Math.round(m.glod)}`);
    }
    const naDobe = s.nrZdarzenia / 7;
    assert.ok(naDobe > 20 && naDobe < 300, `${ziarno}: ${Math.round(naDobe)} zdarzeń na dobę (za cicho albo spam)`);
  }
});

test('droga omija wodę, a cel za wodą bez przejścia jest uczciwie niedostępny', () => {
  const s = nowySwiat();
  const d = sciezka(s, s.ognisko, { x: 1, y: 1 });
  assert.ok(Array.isArray(d) && d.length >= 24);
  for (const [x, y] of d) assert.equal(s.teren[y][x], '.');
  const woda = s.teren.findIndex((w) => w.includes('~'));
  assert.equal(sciezka(s, s.ognisko, { x: s.teren[woda].indexOf('~'), y: woda }), null);
});

test('gesty: błąd zamiast cichego braku skutku; zmęczony mieszkaniec odmawia prośby i mówi dlaczego', () => {
  const s = nowySwiat();
  const wy = s.teren.findIndex((w) => w.includes('~'));
  assert.equal(gest(s, 'jozz', { co: 'posadz', x: s.teren[wy].indexOf('~'), y: wy }).ok, false);
  assert.equal(gest(s, 'jozz', { co: 'posadz', x: s.ognisko.x + 2, y: s.ognisko.y }).ok, true);
  assert.equal(gest(s, 'jozz', { co: 'posadz', x: s.ognisko.x + 2, y: s.ognisko.y }).blad, 'tu już rośnie krzak');
  assert.equal(gest(s, 'jozz', { co: 'prosba', kogo: 'Nikt', x: 1, y: 1 }).ok, false);
  const m = s.mieszkancy[0]; m.energia = 10; m.glod = 10;
  assert.equal(gest(s, 'jozz', { co: 'prosba', kogo: m.imie, x: 1, y: 1 }).ok, true);
  krok(s);
  assert.ok(s.zdarzenia.some((z) => z.tekst.startsWith(`${m.imie} odmawia prośby (jozz): jest zbyt zmęczony`)), 'odmowa z powodem jest w zdarzeniach');
  assert.equal(widok(s).rng, undefined, 'stan generatora nie wychodzi do widoku');
});

test('Durable Object: świat dogania czas po przebudzeniu, zaległość ponad limit kończy się szybkim alarmem', async () => {
  const db = new DatabaseSync(':memory:');
  let alarm = null;
  const ctx = { storage: { sql: sqlZNode(db), getAlarm: async () => alarm, setAlarm: async (t) => { alarm = t; } }, getWebSockets: () => [] };
  const prawdziwy = Date.now;
  let teraz = Date.parse('2026-11-11T02:00:00Z');
  Date.now = () => teraz;
  try {
    const sw = new Swiat(ctx, {});
    const zapytaj = async () => (await sw.fetch(new Request('https://x/api/swiat', { headers: { 'x-kto': 'jozz' } }))).json();
    const a = await zapytaj();
    assert.equal(alarm, teraz + RZADKI_ALARM_MS, 'nikt nie patrzy: rzadki alarm');
    teraz += 60 * 60_000; alarm = null;
    const b = await zapytaj();
    assert.equal(b.krok - a.krok, 60 * 60_000 / KROK_MS, 'godzina prawdziwego czasu to 360 kroków świata');
    teraz += 3 * 24 * 3600_000; alarm = null;
    const c = await zapytaj();
    assert.equal(c.krok - b.krok, LIMIT_KROKOW);
    assert.ok(c.zaleglosc > 0);
    assert.equal(alarm, teraz + 1000, 'zaległość: następne przebudzenie za sekundę');
    await sw.alarm();
    assert.equal(c.meta.przebudzenia.find((p) => p.przyczyna === 'odczyt').ile, 3);
    const po = new Swiat(ctx, {});
    const d = await (await po.fetch(new Request('https://x/api/swiat', { headers: { 'x-kto': 'jozz' } }))).json();
    assert.equal(d.krok, c.krok + 2 * LIMIT_KROKOW, 'nowy obiekt nad tą samą bazą zaczyna tam, gdzie świat skończył');
  } finally { Date.now = prawdziwy; }
});
