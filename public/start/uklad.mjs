// Czyste funkcje układu i miar, bez DOM i bez danych. Prostokąt to zawsze {x, y, w, h}.
// Wzięte bez zmian w rachunkach z części kampanii Skala (Opus czatu, 17 XI 2026), gdzie zostały zmierzone na
// 28 prawdziwych projektach i 551 gałęziach: nadmuchanie z miejsca dawało 2 do 6 skrzyżowań dróg przy przejściu
// zamiast 37 do 61 przy squarify w porządku czytania. Start (swiat.mjs) używa stąd nadmuchania i squarify;
// miary (zamiany porządku, skrzyżowania) zostają do sprawdzania układów w testach.

/** Squarify (Bruls i in., 2000) w podanej kolejności. el: [{i, v}], v > 0. Zwraca [[i, prostokąt]]. */
export function squarify(el, x, y, w, h) {
  const tot = el.reduce((a, e) => a + e.v, 0);
  if (!tot || w <= 0 || h <= 0) return el.map(e => [e.i, { x, y, w: 0, h: 0 }]);
  const k = (w * h) / tot, A = el.map(e => ({ i: e.i, a: e.v * k })), out = [];
  let s0 = 0, cx = x, cy = y, cw = w, ch = h;
  while (s0 < A.length) {
    const side = Math.min(cw, ch); let s = 0, mx = 0, mn = Infinity, best = Infinity, n = 0;
    for (let j = s0; j < A.length; j++) {
      const a = A[j].a, s2 = s + a, mx2 = Math.max(mx, a), mn2 = Math.min(mn, a);
      const worst = Math.max(side * side * mx2 / (s2 * s2), (s2 * s2) / (side * side * mn2));
      if (worst <= best || n === 0) { best = worst; s = s2; mx = mx2; mn = mn2; n++; } else break;
    }
    const row = A.slice(s0, s0 + n); s0 += n;
    if (cw >= ch) { const rw = s / ch; let yy = cy; for (const c of row) { const hh = c.a / rw; out.push([c.i, { x: cx, y: yy, w: rw, h: hh }]); yy += hh; } cx += rw; cw -= rw; }
    else { const rh = s / cw; let xx = cx; for (const c of row) { const ww = c.a / rh; out.push([c.i, { x: xx, y: cy, w: ww, h: rh }]); xx += ww; } cy += rh; ch -= rh; }
  }
  return out;
}

/** Nadmuchanie z miejsca: mozaika liczona z położeń (w duchu Wood i Dykes, 2008). Cięcia proste wzdłuż dłuższego
 *  boku, rzeczy w kolejności swoich środków; cięcie tam, gdzie wagi są najbliżej połowy (podzial: 'waga') albo w
 *  połowie liczby rzeczy ('liczba': kto jest w której połowie, zależy tylko od położeń). el: [{i, v, cx, cy, klucz}]. */
export function sot(el, x, y, w, h, { podzial = 'waga' } = {}, out = []) {
  if (!el.length) return out;
  if (el.length === 1 || w <= 0 || h <= 0) { el.forEach((e, j) => out.push([e.i, j || w <= 0 || h <= 0 ? { x, y, w: 0, h: 0 } : { x, y, w, h }])); return out; }
  const pion = w >= h, k1 = pion ? 'cx' : 'cy', k2 = pion ? 'cy' : 'cx';
  const s = el.slice().sort((a, b) => a[k1] - b[k1] || a[k2] - b[k2] || (String(a.klucz) < String(b.klucz) ? -1 : 1));
  const tot = s.reduce((a, e) => a + e.v, 0); let k = 1;
  if (podzial === 'liczba') k = Math.floor(s.length / 2);
  else { let acc = 0, best = Infinity; for (let j = 1; j < s.length; j++) { acc += s[j - 1].v; const d = Math.abs(acc - tot / 2); if (d < best) { best = d; k = j; } } }
  const A = s.slice(0, k), B = s.slice(k), fa = tot ? A.reduce((a, e) => a + e.v, 0) / tot : 0.5;
  if (pion) { sot(A, x, y, w * fa, h, { podzial }, out); sot(B, x + w * fa, y, w * (1 - fa), h, { podzial }, out); }
  else { sot(A, x, y, w, h * fa, { podzial }, out); sot(B, x, y + h * fa, w, h * (1 - fa), { podzial }, out); }
  return out;
}

/** Wygodne opakowanie: rzeczy [{id}], położenie(id) → {cx, cy} ze stanu stałego, waga(id) → liczba. Zwraca Map id → prostokąt. */
export function nadmuchaj(rzeczy, { x = 0, y = 0, w, h }, { polozenie, waga, podzial = 'waga' }) {
  const el = rzeczy.map((r, i) => ({ i, v: waga(r.id), klucz: r.id, ...polozenie(r.id) }));
  return new Map(sot(el, x, y, w, h, { podzial }).map(([i, p]) => [rzeczy[i].id, p]));
}

const srodek = r => [r.x + r.w / 2, r.y + r.h / 2];

/** Zamiany porządku między dwoma układami (Map id → prostokąt): pary, które zamieniły się stronami w poziomie albo
 *  w pionie; liczy się para, której środki w pierwszym układzie dzieli więcej niż prog. Miara pamięci przestrzennej. */
export function zamianyPorzadku(A, B, ids, prog = 30) {
  let z = 0;
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const [ax0, ay0] = srodek(A.get(ids[a])), [bx0, by0] = srodek(A.get(ids[b])), [ax1, ay1] = srodek(B.get(ids[a])), [bx1, by1] = srodek(B.get(ids[b]));
    if (Math.abs(ax0 - bx0) > prog && Math.sign(ax0 - bx0) !== Math.sign(ax1 - bx1)) z++;
    if (Math.abs(ay0 - by0) > prog && Math.sign(ay0 - by0) !== Math.sign(ay1 - by1)) z++;
  }
  return z;
}

/** Skrzyżowania dróg w przejściu: drogi [[[x0, y0], [x1, y1]], ...]; ile par odcinków przecina się właściwie. */
export function skrzyzowania(drogi) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  let n = 0;
  for (let i = 0; i < drogi.length; i++) for (let j = i + 1; j < drogi.length; j++) {
    const [a, b] = drogi[i], [c, d] = drogi[j];
    if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) n++;
  }
  return n;
}

/** Drobnica w grupę (jego pomysł z 16 XI, 17:39): które rzeczy stoją osobno, a które idą do jednej grupy, żeby
 *  najmniejsza osobna miała co najmniej minPole przy polu `pole`. Grupa bierze udzialGrupy pola osobnych; grupa
 *  powstaje dopiero od dwóch rzeczy. Zwraca { osobno: [id], wGrupie: [id] }; razem zawsze wszystkie, bez powtórzeń. */
export function drobnica(rzeczy, pole, { waga, minPole, udzialGrupy = 0.25 }) {
  const s = rzeczy.slice().sort((a, b) => waga(b.id) - waga(a.id) || (String(a.id) < String(b.id) ? -1 : 1));
  let k = s.length;
  while (k > 1) {
    const sw = s.slice(0, k).reduce((a, r) => a + waga(r.id), 0), wg = k < s.length ? sw * udzialGrupy : 0;
    if (pole * waga(s[k - 1].id) / (sw + wg) >= minPole) break;
    k--;
  }
  if (k >= s.length - 1) return { osobno: s.map(r => r.id), wGrupie: [] };
  return { osobno: s.slice(0, k).map(r => r.id), wGrupie: s.slice(k).map(r => r.id) };
}
