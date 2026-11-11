// Osada: mały świat, który żyje, kiedy nikt nie patrzy (11 XI 2026). Status: próba (TYMCZASOWE.md).
// Pytanie próby: czy Durable Object na darmowym planie uniesie świat z mieszkańcami, którzy mają własne powody
// (MiniFeniks: poznają, pracują, odpoczywają, odmawiają i zmieniają zamiary), dostępny dla Jozza, agentów i kiedyś
// znajomych, i trwający bez otwartej karty. Odpowiedź tej próby: świat jest deterministyczny, więc nie musi
// tykać co chwilę. Po przebudzeniu (alarm, wejście, wiadomość) dogania czas, który minął, krok po kroku z tym samym
// wynikiem, jaki dałby ciągły bieg. Tykanie na żywo jest potrzebne tylko wtedy, kiedy ktoś patrzy.
// Czysta logika, bez Cloudflare: testy w Node sprawdzają, że doganianie partiami daje dokładnie ten sam świat.

export const SZER = 32, WYS = 20;
export const DOBA = 1440;            // kroków na dobę świata (1 krok = 1 minuta świata)
export const LIMIT_KROKOW = 400;     // najwięcej kroków na jedno przebudzenie (ok. 7 ms w Node); reszta przy następnym
const IMIONA = ['Bura', 'Kret', 'Iskra', 'Mech', 'Lato'];
const KOLORY = ['#c0703a', '#6d7f3a', '#d4a72c', '#4f8a7a', '#b5596b'];

// mulberry32: mały generator, którego cały stan to jedna liczba, więc zapisuje się razem ze światem
function los(s) {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const pora = (krok) => { const m = krok % DOBA; return m < 300 || m >= 1260 ? 'noc' : m < 420 ? 'świt' : m < 1140 ? 'dzień' : 'zmierzch'; };
export const godzina = (krok) => { const m = krok % DOBA; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

export function nowySwiat(ziarno = 20261111) {
  const s = { wersja: 1, krok: 420, rng: ziarno | 0, teren: [], krzaki: [], ognisko: { x: 16, y: 10 }, mieszkancy: [], zdarzenia: [], nrZdarzenia: 0 };
  for (let y = 0; y < WYS; y++) {
    let wiersz = '';
    for (let x = 0; x < SZER; x++) {
      const staw = (x - 6) ** 2 / 16 + (y - 14) ** 2 / 6 < 1;
      const rzeczka = Math.abs(x - (24 + Math.round(Math.sin(y / 3) * 2))) < 1 && y < 13;
      wiersz += staw || rzeczka ? '~' : los(s) < 0.06 ? '^' : '.';
    }
    s.teren.push(wiersz);
  }
  while (s.krzaki.length < 9) {
    const x = Math.floor(los(s) * SZER), y = Math.floor(los(s) * WYS);
    if (chodliwe(s, x, y) && dist({ x, y }, s.ognisko) > 4 && !s.krzaki.some((k) => k.x === x && k.y === y)) s.krzaki.push({ x, y, jagody: 3 + Math.floor(los(s) * 3), odrost: 0 });
  }
  IMIONA.forEach((imie, i) => s.mieszkancy.push({ imie, kolor: KOLORY[i], x: s.ognisko.x + (i % 3) - 1, y: s.ognisko.y + Math.floor(i / 3) + 1,
    glod: 20 + Math.floor(los(s) * 30), energia: 60 + Math.floor(los(s) * 30), zamiar: null, znane: [], prosba: null, zjedzone: 0 }));
  return s;
}

export function chodliwe(s, x, y) { return x >= 0 && y >= 0 && x < SZER && y < WYS && s.teren[y][x] === '.'; }

function zdarzenie(s, tekst, kto = null) {
  s.nrZdarzenia += 1;
  s.zdarzenia.push({ nr: s.nrZdarzenia, krok: s.krok, tekst, ...(kto ? { kto } : {}) });
  if (s.zdarzenia.length > 300) s.zdarzenia.splice(0, s.zdarzenia.length - 300);
}

// Droga: przeszukanie wszerz po siatce 32 x 20, liczone raz na zamiar, a nie co krok. null = nie da się dojść.
export function sciezka(s, z, cel) {
  if (z.x === cel.x && z.y === cel.y) return [];
  const prev = new Int16Array(SZER * WYS).fill(-1), start = z.y * SZER + z.x, koniec = cel.y * SZER + cel.x;
  if (!chodliwe(s, cel.x, cel.y)) return null;
  prev[start] = start; const q = [start];
  for (let i = 0; i < q.length; i++) {
    const c = q[i]; if (c === koniec) break;
    const cx = c % SZER, cy = (c - cx) / SZER;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, n = ny * SZER + nx;
      if (chodliwe(s, nx, ny) && prev[n] === -1) { prev[n] = c; q.push(n); }
    }
  }
  if (prev[koniec] === -1) return null;
  const droga = []; for (let c = koniec; c !== start; c = prev[c]) droga.push([c % SZER, Math.floor(c / SZER)]);
  return droga.reverse();
}

function krokKu(s, m, cel) {
  const z = m.zamiar;
  if (z && z.droga && z.droga.length) { const [x, y] = z.droga.shift(); m.x = x; m.y = y; return; }
  const opcje = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: m.x + dx, y: m.y + dy })).filter((p) => chodliwe(s, p.x, p.y));
  if (!opcje.length) return;
  opcje.sort((a, b) => dist(a, cel) - dist(b, cel) || los(s) - 0.5);
  // czasem boczny krok: omija przeszkody i wygląda mniej jak automat
  const p = los(s) < 0.15 && opcje.length > 1 ? opcje[1] : opcje[0];
  m.x = p.x; m.y = p.y;
}

function wybierz(s, m) {
  const p = pora(s.krok);
  if (m.prosba) {
    const r = m.prosba; m.prosba = null;
    if (m.energia < 25) zdarzenie(s, `${m.imie} odmawia prośby (${r.od}): jest zbyt zmęczony, idzie spać.`, m.imie);
    else if (m.glod > 75) zdarzenie(s, `${m.imie} odmawia prośby (${r.od}): najpierw musi coś zjeść.`, m.imie);
    else { m.zamiar = { co: 'prosba', cel: { x: r.x, y: r.y }, powod: `prośba ${r.od}` }; zdarzenie(s, `${m.imie} przyjmuje prośbę (${r.od}) i idzie na (${r.x}, ${r.y}).`, m.imie); return; }
  }
  // głód powyżej 85 jest silniejszy niż zmęczenie; inaczej mieszkaniec zasypia głodny i budzi się co krok
  if (m.glod <= 85 && (m.energia < 22 || (p === 'noc' && m.energia < 85))) { m.zamiar = { co: 'sen', cel: { ...s.ognisko }, powod: p === 'noc' ? 'noc' : 'zmęczenie' }; return; }
  if (m.glod > 55) {
    const z = s.krzaki.filter((k) => k.jagody > 0 && (m.znane.includes(k.x + ',' + k.y) || dist(k, m) <= 6)).sort((a, b) => dist(a, m) - dist(b, m))[0];
    if (z) { m.zamiar = { co: 'jedz', cel: { x: z.x, y: z.y }, powod: 'głód' }; return; }
    // mniej więcej wie, gdzie rośnie zarośl: idzie w okolice jakiegoś krzaka, nie wie, czy są na nim jagody
    const k = s.krzaki[Math.floor(los(s) * s.krzaki.length)];
    const cel = { x: Math.max(0, Math.min(SZER - 1, k.x + Math.floor(los(s) * 7) - 3)), y: Math.max(0, Math.min(WYS - 1, k.y + Math.floor(los(s) * 7) - 3)) };
    m.zamiar = { co: 'szukaj', cel: chodliwe(s, cel.x, cel.y) ? cel : losowyCel(s), powod: 'głód, nie zna krzaka z jagodami' };
    if (m.glod > 80 && los(s) < 0.2) zdarzenie(s, `${m.imie} jest bardzo głodny i nie wie, gdzie są jagody.`, m.imie);
    return;
  }
  const r = los(s);
  if (r < 0.35) {
    const inny = s.mieszkancy.filter((x) => x !== m)[Math.floor(los(s) * (s.mieszkancy.length - 1))];
    m.zamiar = { co: 'odwiedz', cel: { x: inny.x, y: inny.y }, kogo: inny.imie, powod: 'ciekawość' };
  } else if (r < 0.75) m.zamiar = { co: 'wedruj', cel: losowyCel(s), powod: 'zwiedza' };
  else m.zamiar = { co: 'odpoczynek', cel: { x: m.x, y: m.y }, czas: 20 + Math.floor(los(s) * 40), powod: 'odpoczywa' };
}

function losowyCel(s) {
  for (let i = 0; i < 20; i++) { const x = Math.floor(los(s) * SZER), y = Math.floor(los(s) * WYS); if (chodliwe(s, x, y)) return { x, y }; }
  return { ...s.ognisko };
}

function zobacz(s, m) {
  for (const k of s.krzaki) {
    const id = k.x + ',' + k.y;
    if (k.jagody > 0 && dist(k, m) <= 3 && !m.znane.includes(id) && sciezka(s, m, k)) {
      m.znane.push(id); if (m.znane.length > 6) m.znane.shift();
      // wiedza krąży: kto stoi obok znajomego, dzieli się tym, co wie (bez tego każdy szuka sam)
      zdarzenie(s, `${m.imie} znajduje krzak z jagodami (${k.x}, ${k.y}).`, m.imie);
    }
  }
  for (const o of s.mieszkancy) if (o !== m && dist(o, m) <= 1) for (const id of m.znane) if (!o.znane.includes(id)) { o.znane.push(id); if (o.znane.length > 6) o.znane.shift(); }
}

export function krok(s) {
  s.krok += 1;
  const p = pora(s.krok);
  if (s.krok % DOBA === 420) zdarzenie(s, `Świt, dzień ${Math.floor(s.krok / DOBA) + 1}.`);
  for (const k of s.krzaki) if (k.jagody < 5 && ++k.odrost >= 140) { k.jagody += 1; k.odrost = 0; }
  for (const m of s.mieszkancy) {
    const spi = m.zamiar && m.zamiar.co === 'sen' && dist(m, s.ognisko) <= 1;
    m.glod = Math.min(100, m.glod + (spi ? 0.08 : 0.2));
    m.energia = Math.max(0, Math.min(100, m.energia + (spi ? 0.5 : -0.12)));
    // pilna potrzeba przerywa każdy zamiar, który jej nie służy; zamiar bez postępu wygasa (np. cel za wodą)
    const zz = m.zamiar;
    if (zz && ((m.glod > 85 && !['jedz', 'szukaj'].includes(zz.co)) || (m.energia < 12 && m.glod <= 85 && zz.co !== 'sen'))) m.zamiar = null;
    else if (zz && zz.co !== 'sen' && zz.co !== 'odpoczynek' && (s.krok - zz.od > 240 || s.krok - zz.lepiej > 40)) {
      if (zz.co === 'jedz') m.znane = m.znane.filter((id) => id !== zz.cel.x + ',' + zz.cel.y);
      m.zamiar = null;
    }
    if (!m.zamiar) {
      wybierz(s, m);
      const n = m.zamiar; n.od = s.krok; n.lepiej = s.krok; n.min = dist(m, n.cel);
      if (n.co !== 'odpoczynek') { n.droga = sciezka(s, m, n.cel); if (!n.droga) { if (n.co === 'jedz') m.znane = m.znane.filter((id) => id !== n.cel.x + ',' + n.cel.y); m.zamiar = { co: 'odpoczynek', cel: { x: m.x, y: m.y }, czas: 5, powod: 'nie da się tam dojść', od: s.krok }; } }
    }
    const z = m.zamiar;
    if (z.co === 'odwiedz' && (s.krok - z.od) % 10 === 0) { const o = s.mieszkancy.find((x) => x.imie === z.kogo); z.cel = { x: o.x, y: o.y }; z.droga = sciezka(s, m, z.cel) || []; }
    const blisko = dist(m, z.cel) <= (z.co === 'sen' || z.co === 'odwiedz' ? 1 : 0);
    if (!blisko) {
      if (m.energia < 5 && s.krok % 2) continue; // wyczerpany wlecze się co drugi krok
      krokKu(s, m, z.cel);
      const d = dist(m, z.cel); if (d < z.min) { z.min = d; z.lepiej = s.krok; }
      zobacz(s, m);
      if (z.co === 'szukaj' && m.znane.length) m.zamiar = null; // zobaczył krzak: przestaje szukać na ślepo
      continue;
    }
    if (z.co === 'jedz') {
      const k = s.krzaki.find((q) => q.x === z.cel.x && q.y === z.cel.y);
      if (k && k.jagody > 0) { k.jagody -= 1; m.glod = Math.max(0, m.glod - 35); m.zjedzone += 1; if (m.zjedzone % 5 === 1) zdarzenie(s, `${m.imie} je jagody przy (${k.x}, ${k.y}).`, m.imie); }
      else { m.znane = m.znane.filter((id) => id !== z.cel.x + ',' + z.cel.y); zdarzenie(s, `${m.imie} dochodzi do krzaka (${z.cel.x}, ${z.cel.y}), a jagód już nie ma.`, m.imie); }
      m.zamiar = null;
    } else if (z.co === 'sen') {
      if (!z.spi) { z.spi = true; zdarzenie(s, `${m.imie} zasypia przy ognisku (${z.powod}).`, m.imie); }
      if ((p !== 'noc' && m.energia > 90) || m.glod > 92) { zdarzenie(s, `${m.imie} budzi się${m.glod > 85 ? ' głodny' : ''}.`, m.imie); m.zamiar = null; }
    } else if (z.co === 'odpoczynek') { if (--z.czas <= 0) m.zamiar = null; }
    else if (z.co === 'odwiedz') { if (los(s) < 0.3) zdarzenie(s, `${m.imie} rozmawia z ${z.kogo}.`, m.imie); m.zamiar = { co: 'odpoczynek', cel: { x: m.x, y: m.y }, czas: 10, powod: 'po rozmowie' }; }
    else if (z.co === 'prosba') { zdarzenie(s, `${m.imie} jest na miejscu (${m.x}, ${m.y}), o które prosił ${z.powod.slice(7)}.`, m.imie); m.zamiar = null; }
    else m.zamiar = null;
    zobacz(s, m);
  }
}

// Dogonić czas: kroki od ostatniego razu, najwyżej LIMIT_KROKOW naraz. Zwraca ile zrobiono i ile zostało.
export function dogon(s, docelowy) {
  const ile = Math.max(0, Math.min(LIMIT_KROKOW, docelowy - s.krok));
  for (let i = 0; i < ile; i++) krok(s);
  return { zrobione: ile, zostalo: Math.max(0, docelowy - s.krok) };
}

// Gesty z zewnątrz (Jozz albo agent). Zwracają błąd zamiast cicho nic nie zrobić.
export function gest(s, kto, g) {
  if (!g || typeof g !== 'object') return { ok: false, blad: 'gest musi być obiektem' };
  const x = g.x | 0, y = g.y | 0;
  if (g.co === 'posadz') {
    if (!chodliwe(s, x, y)) return { ok: false, blad: 'tu nie da się nic posadzić' };
    if (s.krzaki.some((k) => k.x === x && k.y === y)) return { ok: false, blad: 'tu już rośnie krzak' };
    if (s.krzaki.length >= 24) return { ok: false, blad: 'w osadzie rośnie już 24 krzaki' };
    s.krzaki.push({ x, y, jagody: 1, odrost: 0 });
    zdarzenie(s, `${kto} sadzi krzak przy (${x}, ${y}).`, kto);
    return { ok: true };
  }
  if (g.co === 'prosba') {
    const m = s.mieszkancy.find((q) => q.imie === g.kogo);
    if (!m) return { ok: false, blad: 'nie ma takiego mieszkańca' };
    if (!chodliwe(s, x, y)) return { ok: false, blad: 'tam nie da się dojść' };
    m.prosba = { od: kto, x, y }; m.zamiar = null;
    zdarzenie(s, `${kto} prosi ${m.imie}, żeby poszedł na (${x}, ${y}).`, kto);
    return { ok: true };
  }
  return { ok: false, blad: 'co: posadz albo prosba' };
}

// Co pokazać: bez wewnętrznego stanu generatora; zdarzenia od podanego numeru.
export function widok(s, odZdarzenia = 0) {
  return { krok: s.krok, godzina: godzina(s.krok), pora: pora(s.krok), dzien: Math.floor(s.krok / DOBA) + 1, teren: s.teren, krzaki: s.krzaki,
    ognisko: s.ognisko, mieszkancy: s.mieszkancy.map(({ imie, kolor, x, y, glod, energia, zamiar }) => ({ imie, kolor, x, y, glod: Math.round(glod), energia: Math.round(energia),
      zamiar: zamiar ? { co: zamiar.co, powod: zamiar.powod, cel: zamiar.cel, ...(zamiar.kogo ? { kogo: zamiar.kogo } : {}) } : null })),
    zdarzenia: s.zdarzenia.filter((z) => z.nr > odZdarzenia), ostatnieZdarzenie: s.nrZdarzenia };
}
