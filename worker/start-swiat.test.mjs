// Sprawdziany świata Startu (public/start/swiat.mjs): czyste rachunki, bez przeglądarki. 17 XI 2026.
// To podłoga budowniczego: mówi, że rachunek się zgadza, a nie, że ręka i oko mają dobrze.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jakoProjekt, zbudujSwiat, siatkaDomyslna, ukladStaly, poleCieklego, ukladCiekly, miedzy, lagodnie, krotkieImie, zywosc,
  galezieWPolu, trafienie, kolejnoscRysowania, naEkran, naSwiat, kameraNa, przybliz, waga, KARTA, SKALA } from '../public/start/swiat.mjs';

const id = (n) => String(n).padStart(26, 'a');
const WIDOK = id('widok');
const rodzina = (n, nazwa) => ({ id: id('rodz' + n), rodzaj: 'rodzina/1', cechy: { znak: 'r' + n, nazwa }, utworzyl: 'obserwator', zmienil: 'obserwator', wersja: 1 });
const repo = (n, cechy = {}) => ({ id: id('repo' + n), rodzaj: 'repo/1', tytul: 'repo-' + n, cechy: { nazwa: 'repo-' + n, adres: 'https://github.com/x/repo-' + n, commity: 100, ...cechy }, utworzyl: 'obserwator', zmienil: 'obserwator', wersja: 2 });
const miejsce = (n, rzecz, x, y, cechy = {}, widok = WIDOK) => ({ id: id('miej' + n), rodzaj: 'miejsce/1', cechy: { widok, rzecz, x, y, ...cechy }, utworzyl: 'jozz', zmienil: 'jozz', zmieniono: '2026-11-17T08:00:00.000Z', wersja: 9 });
const pole = (p) => p.w * p.h;
const nachodza = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function probka() {
  const rzeczy = [rodzina(1, 'Maszyny'), rodzina(2, 'Żywe istoty')];
  for (let i = 1; i <= 7; i++) rzeczy.push(repo(i, { rodzina: id('rodz' + (i <= 4 ? 1 : 2)), commity: i * i * 40 }));
  rzeczy.push(repo(8, { commity: 9 })); // bez rodziny
  return rzeczy;
}

test('S1. projekt z faktu o repozytorium i z dzieła czyta się tak samo; adres bez https nie jest wejściem do grania', () => {
  const f = jakoProjekt(repo(1, { ladna_nazwa: 'Tysiąc', tozsamosc: 'Karty dla znajomych.', strona: 'https://gra.test/', karta: true, wejscie: 'Miejsce przy stole.', ostatni_push: '2026-11-10T10:00:00Z', zycie: 'stygnące', galezie: 80, opis: 'opis z GitHuba' }));
  assert.deepEqual([f.tytul, f.opis, f.zagraj, f.wKarcie, f.wejscie, f.zycie, f.stan, f.ileGalezi, f.fakt], ['Tysiąc', 'Karty dla znajomych.', 'https://gra.test/', true, 'Miejsce przy stole.', '2026-11-10T10:00:00Z', 'stygnące', 80, true]);
  const d = jakoProjekt({ id: id('proj'), rodzaj: 'projekt/1', tytul: 'Moje dzieło', cechy: { nazwa: 'Moje dzieło', opis: 'Opis.', zagraj: 'http://bez-s.test/', zycie: '2026-11-01' }, utworzyl: 'jozz', zmienil: 'jozz', wersja: 3 });
  assert.deepEqual([d.tytul, d.opis, d.zagraj, d.zycie, d.fakt, d.commity], ['Moje dzieło', 'Opis.', null, '2026-11-01', false, 0]);
});

test('S2. świat: projekty, rodziny i gałęzie z listy rzeczy; miejsca tylko z podanego widoku, skala w granicach', () => {
  const rzeczy = probka();
  rzeczy.push({ id: id('gal1'), rodzaj: 'galaz/1', cechy: { repo: id('repo1'), nazwa: 'main', kiedy: '2026-11-16T10:00:00Z' } });
  rzeczy.push(miejsce(1, id('repo1'), 500, 300, { skala: 99 }));
  rzeczy.push(miejsce(2, id('repo2'), 1, 1, {}, id('innywidok')));
  rzeczy.push(miejsce(3, id('repo3'), 'zle', 1));
  rzeczy.push({ id: id('slow'), rodzaj: 'slowo/1', cechy: { tresc: 'x', dotyczy: [id('repo1'), id('repo1'), id('repo2')] } });
  const s = zbudujSwiat(rzeczy, { widok: WIDOK });
  assert.equal(s.projekty.length, 8);
  assert.equal(s.rodziny.size, 2);
  assert.equal(s.galezie.get(id('repo1')).length, 1);
  assert.deepEqual([...s.miejsca.keys()], [id('repo1')], 'cudzy widok i zepsute położenie nie wchodzą');
  assert.equal(s.miejsca.get(id('repo1')).skala, SKALA.max);
  assert.equal(s.ileSlow.get(id('repo1')), 2);
  assert.equal(zbudujSwiat(rzeczy).miejsca.size, 0, 'bez widoku nie ma miejsc z ręki');
});

test('S3. siatka domyślna: nic na siebie nie nachodzi, rodzina leży razem, a nowe commity niczego nie przestawiają', () => {
  const s = zbudujSwiat(probka(), { widok: WIDOK });
  const siatka = siatkaDomyslna(s);
  const p = [...siatka.values()];
  assert.equal(p.length, 8);
  for (let a = 0; a < p.length; a++) for (let b = a + 1; b < p.length; b++) assert.equal(nachodza(p[a], p[b]), false);
  for (const x of p) assert.deepEqual([x.w, x.h], [KARTA.w, KARTA.h]);
  // ta sama lista z innymi liczbami commitów daje tę samą siatkę
  const inne = probka().map((r) => (r.rodzaj === 'repo/1' ? { ...r, cechy: { ...r.cechy, commity: 5000 - r.cechy.commity } } : r));
  assert.deepEqual([...siatkaDomyslna(zbudujSwiat(inne, { widok: WIDOK }))], [...siatka]);
  // rodzina Maszyny (repo 1 do 4) zajmuje zwarty blok: jej prostokąt obejmujący nie zawiera środka żadnej rzeczy spoza niej
  const moje = [1, 2, 3, 4].map((n) => siatka.get(id('repo' + n)));
  const x0 = Math.min(...moje.map((m) => m.x)), x1 = Math.max(...moje.map((m) => m.x + m.w)), y0 = Math.min(...moje.map((m) => m.y)), y1 = Math.max(...moje.map((m) => m.y + m.h));
  for (const n of [5, 6, 7, 8]) { const o = siatka.get(id('repo' + n)); const cx = o.x + o.w / 2, cy = o.y + o.h / 2; assert.equal(cx > x0 && cx < x1 && cy > y0 && cy < y1, false); }
});

test('S4. stan stały: miejsce z ręki wygrywa z siatką i mówi, że jest z ręki; podpis rodziny obejmuje jej rzeczy, gdziekolwiek leżą', () => {
  const rzeczy = probka();
  rzeczy.push(miejsce(1, id('repo1'), 5000, 4000, { skala: 2 }));
  const s = zbudujSwiat(rzeczy, { widok: WIDOK });
  const u = ukladStaly(s);
  const r1 = u.prostokaty.get(id('repo1'));
  assert.deepEqual([r1.x + r1.w / 2, r1.y + r1.h / 2, r1.w, r1.h, r1.zReki], [5000, 4000, KARTA.w * 2, KARTA.h * 2, true]);
  assert.equal(u.prostokaty.get(id('repo2')).zReki, false);
  const maszyny = u.rodziny.find((r) => r.nazwa === 'Maszyny');
  assert.equal(maszyny.ile, 4);
  assert.ok(maszyny.x + maszyny.w >= 5000 + KARTA.w, 'podpis rodziny sięga do rzeczy wyniesionej ręką');
  assert.ok(u.rodziny.some((r) => r.nazwa === 'Bez rodziny' && r.ile === 1));
  assert.ok(u.granice.w >= 5000);
});

test('S5. stan ciekły: wypełnia pole, mieści się w nim, ważniejszy projekt jest większy, a mnożnik z ręki go powiększa', () => {
  const s = zbudujSwiat(probka(), { widok: WIDOK });
  const staly = ukladStaly(s);
  const okno = poleCieklego(staly.granice, 16 / 9);
  assert.ok(Math.abs(okno.w / okno.h - 16 / 9) < 1e-9);
  assert.ok(okno.x <= staly.granice.x && okno.y <= staly.granice.y && okno.x + okno.w >= staly.granice.x + staly.granice.w - 1e-9 && okno.y + okno.h >= staly.granice.y + staly.granice.h - 1e-9, 'pole ciekłego obejmuje cały stan stały');
  const c = ukladCiekly(s, staly, okno, { odstep: 0 });
  const suma = [...c.values()].reduce((a, p) => a + pole(p), 0);
  assert.ok(Math.abs(suma - pole(okno)) < 1e-6 * pole(okno), 'bez odstępu działki wypełniają pole co do rachunku');
  for (const p of c.values()) assert.ok(p.x >= okno.x - 1e-6 && p.y >= okno.y - 1e-6 && p.x + p.w <= okno.x + okno.w + 1e-6 && p.y + p.h <= okno.y + okno.h + 1e-6);
  assert.ok(pole(c.get(id('repo7'))) > pole(c.get(id('repo5'))), 'więcej commitów, większa działka');
  const stosunek = pole(c.get(id('repo7'))) / pole(c.get(id('repo5')));
  assert.ok(Math.abs(stosunek - waga(s.projekty.find((p) => p.id === id('repo7'))) / waga(s.projekty.find((p) => p.id === id('repo5')))) < 1e-6);
  // z odstępem działki są mniejsze, ale dalej w polu
  const zOdstepem = ukladCiekly(s, staly, okno);
  assert.ok([...zOdstepem.values()].reduce((a, p) => a + pole(p), 0) < suma);
  // mnożnik z ręki: ta sama rzecz dwa razy ważniejsza
  const rzeczy2 = probka();
  const m = staly.prostokaty.get(id('repo5'));
  rzeczy2.push(miejsce(1, id('repo5'), m.x + m.w / 2, m.y + m.h / 2, { skala: 2 }));
  const s2 = zbudujSwiat(rzeczy2, { widok: WIDOK });
  const c2 = ukladCiekly(s2, ukladStaly(s2), okno, { odstep: 0 });
  assert.ok(pole(c2.get(id('repo5'))) > pole(c.get(id('repo5'))) * 1.5);
});

test('S6. nadmuchanie z miejsca: rzecz położona ręką daleko na lewo zostaje przy lewej krawędzi stanu ciekłego', () => {
  const rzeczy = probka();
  rzeczy.push(miejsce(1, id('repo7'), -9000, 0));
  const s = zbudujSwiat(rzeczy, { widok: WIDOK });
  const staly = ukladStaly(s);
  const okno = poleCieklego(staly.granice, 1.6);
  const c = ukladCiekly(s, staly, okno, { odstep: 0 });
  const srodek = (p) => p.x + p.w / 2;
  const moja = c.get(id('repo7'));
  assert.ok(Math.abs(moja.x - okno.x) < 1e-6, 'działka dotyka lewej krawędzi pola');
  // Podział po wadze może dołożyć do lewej połowy kilka rzeczy nad albo pod nią, więc nie każda inna leży na prawo;
  // większość musi (kampania Skala mierzyła zachowanie strony w ok. 9 parach na 10).
  const naPrawo = s.projekty.filter((p) => p.id !== id('repo7') && srodek(c.get(p.id)) > srodek(moja)).length;
  assert.ok(naPrawo >= 5, 'na prawo od niej leży ' + naPrawo + ' z 7');
  // a rzecz wyniesiona daleko na prawo ląduje przy prawej krawędzi
  const rzeczy2 = probka();
  rzeczy2.push(miejsce(1, id('repo7'), 99000, 0));
  const s2 = zbudujSwiat(rzeczy2, { widok: WIDOK });
  const st2 = ukladStaly(s2), okno2 = poleCieklego(st2.granice, 1.6);
  const p2 = ukladCiekly(s2, st2, okno2, { odstep: 0 }).get(id('repo7'));
  assert.ok(Math.abs(p2.x + p2.w - (okno2.x + okno2.w)) < 1e-6);
});

test('S7. przejście między stanami: końce są dokładne (powrót co do rachunku), środek leży pomiędzy', () => {
  const a = { x: 10, y: 20, w: 240, h: 150 }, b = { x: 300, y: -40, w: 900, h: 500 };
  assert.deepEqual(miedzy(a, b, 0), a);
  assert.deepEqual(miedzy(a, b, 1), b);
  assert.deepEqual(miedzy(a, b, -3), a);
  assert.deepEqual(miedzy(a, b, 0.5), { x: 155, y: -10, w: 570, h: 325 });
  assert.deepEqual([lagodnie(0), lagodnie(1), lagodnie(0.5), lagodnie(-1), lagodnie(2)], [0, 1, 0.5, 0, 1]);
  assert.ok(lagodnie(0.25) < 0.25 && lagodnie(0.75) > 0.75, 'rusza i kończy łagodnie');
});

test('S8. krótkie imię gałęzi: ostatni człon bez daty; żywość: dzisiejsza 1, sprzed pół roku 0, bez daty brak', () => {
  assert.equal(krotkieImie('research/world-ecology-d1-coupled-affordance-2026-10-11'), 'world-ecology-d1-coupled-affordance');
  assert.equal(krotkieImie('fable/rdzen-krok-1'), 'rdzen-krok-1');
  assert.equal(krotkieImie('main'), 'main');
  assert.equal(krotkieImie('archiwum/2026-10-11'), '2026-10-11', 'gdy po obcięciu nic nie zostaje, zostaje człon');
  const teraz = Date.parse('2026-11-17T00:00:00Z');
  assert.equal(zywosc('2026-11-17T00:00:00Z', teraz), 1);
  assert.equal(zywosc('2026-05-20T00:00:00Z', teraz), 0);
  assert.ok(zywosc('2026-11-10T00:00:00Z', teraz) > zywosc('2026-10-01T00:00:00Z', teraz));
  assert.equal(zywosc(null, teraz), null);
});

test('S9. gałęzie w działce projektu: wypełniają pole, świeższa jest większa', () => {
  const teraz = Date.parse('2026-11-17T00:00:00Z');
  const g = [{ nazwa: 'stara', kiedy: '2026-01-01T00:00:00Z' }, { nazwa: 'swieza', kiedy: '2026-11-16T00:00:00Z' }, { nazwa: 'bez-daty', kiedy: null }];
  const w = new Map(galezieWPolu(g, { x: 0, y: 0, w: 300, h: 200 }, teraz).map(([x, p]) => [x.nazwa, p]));
  assert.ok(Math.abs([...w.values()].reduce((a, p) => a + pole(p), 0) - 60000) < 1e-6);
  assert.ok(pole(w.get('swieza')) > pole(w.get('stara')) * 3);
  assert.ok(Math.abs(pole(w.get('stara')) - pole(w.get('bez-daty'))) < 1e-6, 'bez daty liczy się jak stara, nie jak świeża');
  assert.deepEqual(galezieWPolu([], { x: 0, y: 0, w: 10, h: 10 }), []);
  assert.deepEqual(galezieWPolu(g, { x: 0, y: 0, w: 0, h: 10 }), []);
});

test('S10. trafienie i kolejność rysowania: mała rzecz leży na dużej i to ona jest trafiana', () => {
  const p = new Map([['duza', { x: 0, y: 0, w: 400, h: 300 }], ['mala', { x: 100, y: 100, w: 50, h: 50 }], ['obok', { x: 500, y: 0, w: 100, h: 100 }]]);
  const k = kolejnoscRysowania(p);
  assert.deepEqual(k, ['duza', 'obok', 'mala']);
  assert.equal(trafienie(p, k, 120, 120), 'mala');
  assert.equal(trafienie(p, k, 20, 20), 'duza');
  assert.equal(trafienie(p, k, 450, 20), null);
});

test('S11. kamera: świat i ekran zamieniają się bez straty; przybliżenie trzyma punkt pod kursorem; kamera na prostokąt go mieści', () => {
  const okno = { w: 1200, h: 800 }, kam = { x: 340, y: -120, k: 0.37 };
  const e = naEkran(kam, okno, { x: 1000, y: 500, w: 240, h: 150 });
  const s = naSwiat(kam, okno, e.x, e.y);
  assert.ok(Math.abs(s.x - 1000) < 1e-9 && Math.abs(s.y - 500) < 1e-9);
  assert.ok(Math.abs(e.w - 240 * 0.37) < 1e-9);
  const pod = naSwiat(kam, okno, 900, 200);
  const blizej = przybliz(kam, okno, 900, 200, 2.5);
  const podPo = naSwiat(blizej, okno, 900, 200);
  assert.ok(Math.abs(pod.x - podPo.x) < 1e-6 && Math.abs(pod.y - podPo.y) < 1e-6);
  assert.ok(Math.abs(blizej.k - 0.37 * 2.5) < 1e-9);
  assert.equal(przybliz(kam, okno, 0, 0, 1e9).k, 12, 'przybliżenie ma górną granicę');
  const prost = { x: -500, y: 100, w: 4000, h: 900 };
  const na = kameraNa(prost, okno, 24);
  const rog = naEkran(na, okno, prost);
  assert.ok(rog.x >= 24 - 1e-6 && rog.y >= 24 - 1e-6 && rog.x + rog.w <= 1200 - 24 + 1e-6 && rog.y + rog.h <= 800 - 24 + 1e-6);
});
