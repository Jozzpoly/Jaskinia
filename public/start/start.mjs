// Start: szkielet (17 XI 2026). Status: próba (TYMCZASOWE.md). Jego projekty w przestrzeni, w dwóch stanach:
// stałym (leżą tam, gdzie je położył) i ciekłym (wypełniają okno, ważniejsze większe), z przełącznikiem i suwakiem.
// Podział pracy (materiał Ściany, par. 8 pkt 1): świat osobno od rysowania. swiat.mjs liczy, co leży gdzie;
// ten plik tylko to rysuje na płótnie (rysuje to, co widać, i tylko po zmianie) i zamienia ruchy ręki w ruchy w Miejscu.
// Płótno, nie element strony na każdą rzecz: kampania Skala zmierzyła, że przy 579 rzeczach elementy strony gubią
// klatki przy przełączniku, a płótno nie (wizualność, par. 7).
// Co jest stanem oka (nie trafia do Miejsca): kamera, liczba stały/ciekły, wybrana rzecz. Co jest zapisem: położenie
// rzeczy z ręki, przy puszczeniu, jako rzecz rodzaju miejsce w widoku Start (więc ma autora, historię i prawa z obszaru).
import { Drzwi } from './drzwi.mjs';
import { zbudujSwiat, ukladStaly, poleCieklego, ukladCiekly, miedzy, lagodnie, krotkieImie, zywosc, galezieWPolu, trafienie,
  kolejnoscRysowania, naEkran, naSwiat, kameraNa, przybliz, KARTA, SKALA } from './swiat.mjs';

const $ = (id) => document.getElementById(id);
const el = (znacznik, cechy = {}, ...dzieci) => {
  const e = document.createElement(znacznik);
  for (const [k, w] of Object.entries(cechy)) {
    if (w === null || w === undefined || w === false) continue;
    if (k === 'tekst') e.textContent = w; else if (k === 'klik') e.addEventListener('click', w); else if (k === 'klasa') e.className = w; else e.setAttribute(k, w === true ? '' : w);
  }
  for (const d of dzieci.flat()) if (d !== null && d !== undefined && d !== false) e.append(d);
  return e;
};
// Wkłada dzieci do elementu, pomijając puste: zwykłe append(null) wpisałoby na stronę słowo "null".
const wloz = (rodzic, ...dzieci) => { rodzic.append(...dzieci.flat().filter((d) => d !== null && d !== undefined && d !== false)); return rodzic; };
const kiedy = (iso) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(min)) return '';
  if (min < 1) return 'przed chwilą';
  if (min < 60) return min + ' min temu';
  if (min < 60 * 36) return Math.round(min / 60) + ' godz. temu';
  const dni = Math.round(min / 1440);
  return dni < 60 ? dni + ' dni temu' : Math.round(dni / 30) + ' mies. temu';
};
const lp = (n, a, b, c) => `${n} ${n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c)}`;

// --- stan ------------------------------------------------------------------------------------------------------------
const OKO = 'jaskinia:start:oko';
const plotno = $('plotno'), ctx = plotno.getContext('2d');
const okno = { w: 1, h: 1 };
let dpr = 1, gora = 40;                // gora: wysokość paska, pod którym nie rysujemy rzeczy przy "cały widok"
let swiat = null, staly = null, ciekly = null, pole = null, widok = null;
let t = (() => { try { const z = JSON.parse(localStorage.getItem(OKO) || 'null'); return z && Number.isFinite(z.t) ? Math.max(0, Math.min(1, z.t)) : 1; } catch { return 1; } })();
let kam = null, animT = null, animKam = null, suwakWRuchu = false;
const pokazane = new Map();           // id -> prostokąt świata, który teraz widać (dogania cel)
const wToku = new Map();              // id -> miejsce położone ręką, zanim Miejsce je potwierdzi
let kolejnosc = [], strefy = [];      // kolejność rysowania i miejsca do dotknięcia narysowane w ostatniej klatce
let wybrany = null, ciagnie = null, celZamiany = null, nad = null;
let zaplanowana = false, ostatniaKlatka = 0;
const drzwi = new Drzwi({ naZmiane: poZmianie, naStan: rysujPasek });

// --- kolory z motywu (zmienne CSS), przeliczane przy zmianie jasny/ciemny --------------------------------------------
let K = {};
const rgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); const n = m ? parseInt(m[1], 16) : 0x808080; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mieszaj = (a, b, ile) => { const A = rgb(a), B = rgb(b), k = Math.max(0, Math.min(1, ile)); return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)}, ${Math.round(A[1] + (B[1] - A[1]) * k)}, ${Math.round(A[2] + (B[2] - A[2]) * k)})`; };
function wczytajKolory() {
  const cs = getComputedStyle(document.documentElement);
  for (const n of ['tlo', 'plyta', 'tekst', 'ciche', 'akcent', 'linia', 'zywe', 'stare', 'znak']) K[n] = cs.getPropertyValue('--' + n).trim() || '#808080';
  popros();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', wczytajKolory);

// --- zdanie o skutku --------------------------------------------------------------------------------------------------
function komunikat(tekst, zly = false) {
  const k = $('komunikat');
  k.textContent = tekst || '';
  k.className = zly ? 'komunikat zly' : 'komunikat';
  k.hidden = !tekst;
  clearTimeout(komunikat.zegar);
  if (tekst) komunikat.zegar = setTimeout(() => { k.hidden = true; }, zly ? 10000 : 4000);
}
$('komunikat').addEventListener('click', () => { $('komunikat').hidden = true; });

// --- świat z rzeczy ---------------------------------------------------------------------------------------------------
function poZmianie() {
  const rzeczy = [...drzwi.rzeczy.values()];
  widok = rzeczy.find((r) => r.rodzaj.startsWith('widok/') && r.cechy.nazwa === 'Start') || rzeczy.find((r) => r.rodzaj.startsWith('widok/')) || null;
  swiat = zbudujSwiat(rzeczy, { widok: widok ? widok.id : null, obszarWidoku: widok ? widok.obszar ?? null : null });
  // położenie, które ręka właśnie zrobiła, zostaje na wierzchu, dopóki Miejsce nie odpowie
  for (const [id, m] of wToku) swiat.miejsca.set(id, { ...(swiat.miejsca.get(id) || {}), ...m });
  if (wybrany && !swiat.projekty.some((p) => p.id === wybrany)) wybrany = null;
  przelicz();
  if (!kam) kam = kameraNa(t >= 0.5 ? pole : staly.granice, okno, 20, gora);
  rysujPasek(); rysujKarte(); rysujListe(); popros();
}
function przelicz() {
  if (!swiat) return;
  staly = ukladStaly(swiat);
  pole = poleCieklego(staly.granice, okno.w / Math.max(1, okno.h - gora));
  ciekly = ukladCiekly(swiat, staly, pole);
  kolejnosc = null;
}
const poId = (id) => (swiat ? swiat.projekty.find((p) => p.id === id) : null);
// Gdzie rzecz ma teraz być (w świecie): między stanem stałym a ciekłym, a ciągnięta ręką pod palcem.
function cel(id) {
  const c = miedzy(staly.prostokaty.get(id), ciekly.get(id), lagodnie(t));
  if (ciagnie && ciagnie.id === id && ciagnie.ruszyl) return { x: ciagnie.x - c.w / 2, y: ciagnie.y - c.h / 2, w: c.w, h: c.h };
  return c;
}

// --- rysowanie --------------------------------------------------------------------------------------------------------
function popros() { if (!zaplanowana) { zaplanowana = true; requestAnimationFrame(klatka); } }
const pamiecLinii = new Map();
// Zawijanie tekstu po słowach (nazwa nie jest cięta w środku słowa); wynik pamiętany, bo liczy się w każdej klatce.
function zawin(tekst, czcionka, szer, ileLinii) {
  const klucz = czcionka + '|' + Math.round(szer) + '|' + ileLinii + '|' + tekst;
  let w = pamiecLinii.get(klucz);
  if (w) return w;
  ctx.font = czcionka;
  const slowa = String(tekst).split(/\s+/).filter(Boolean), linie = [];
  let linia = '', ucieto = false;
  for (const s of slowa) {
    // słowo, które samo nie mieści się w linii, zostaje ucięte z wielokropkiem, a nie ściśnięte
    if (!linia && ctx.measureText(s).width > szer) {
      let k = s;
      while (k.length > 1 && ctx.measureText(k + '…').width > szer) k = k.slice(0, -1);
      linie.push(k + '…'); ucieto = true; linia = '';
      break;
    }
    const proba = linia ? linia + ' ' + s : s;
    if (ctx.measureText(proba).width <= szer || !linia) { linia = proba; continue; }
    linie.push(linia); linia = s;
    if (linie.length === ileLinii) { ucieto = true; break; }
  }
  if (!ucieto && linia) linie.push(linia);
  if (linie.length > ileLinii) { linie.length = ileLinii; ucieto = true; }
  const zaSzeroka = linie.some((l) => ctx.measureText(l).width > szer);
  if (ucieto && linie.length && !linie[linie.length - 1].endsWith('…')) linie[linie.length - 1] = linie[linie.length - 1].replace(/[\s.,;:]*$/, '') + '…';
  w = { linie, zaSzeroka, ucieto };
  if (pamiecLinii.size > 4000) pamiecLinii.clear();
  pamiecLinii.set(klucz, w);
  return w;
}
const plynnie = (w, od, doo) => Math.max(0, Math.min(1, (w - od) / (doo - od))); // szczegół wchodzi płynnie, bez progu
function zaokraglony(x, y, w, h, r) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y); ctx.arcTo(x + w, y, x + w, y + h, k); ctx.arcTo(x + w, y + h, x, y + h, k); ctx.arcTo(x, y + h, x, y, k); ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function klatka(teraz) {
  zaplanowana = false;
  const dt = Math.min(64, teraz - (ostatniaKlatka || teraz));
  ostatniaKlatka = teraz;
  if (!swiat || !K.tlo) return;
  let wRuchu = false;
  if (animT) {
    const k = Math.min(1, (teraz - animT.od) / animT.ms);
    t = animT.z + (animT.na - animT.z) * lagodnie(k);
    $('suwak').value = String(Math.round(t * 100));
    if (k >= 1) { animT = null; zapiszOko(); rysujPasek(); } else wRuchu = true;
  }
  if (animKam) {
    const k = lagodnie(Math.min(1, (teraz - animKam.od) / animKam.ms));
    kam = { x: animKam.z.x + (animKam.na.x - animKam.z.x) * k, y: animKam.z.y + (animKam.na.y - animKam.z.y) * k, k: Math.exp(Math.log(animKam.z.k) + (Math.log(animKam.na.k) - Math.log(animKam.z.k)) * k) };
    if (k >= 1) animKam = null; else wRuchu = true;
  }
  // Rzeczy doganiają swój cel łagodnie, gdy układ zmienił się skokiem (puszczenie, zamiana, cudza zmiana na żywo).
  // Gdy cel sam płynie (suwak, przełącznik) albo rzecz jest pod palcem, idą za nim od razu.
  const wprost = suwakWRuchu || animT !== null;
  const wsp = 1 - Math.exp(-dt / 80);
  for (const p of swiat.projekty) {
    const c = cel(p.id), s = pokazane.get(p.id);
    if (!s || wprost || (ciagnie && ciagnie.id === p.id)) { pokazane.set(p.id, c); continue; }
    const d = Math.max(Math.abs(c.x - s.x), Math.abs(c.y - s.y), Math.abs(c.w - s.w), Math.abs(c.h - s.h));
    if (d * kam.k < 0.5) pokazane.set(p.id, c);
    else { pokazane.set(p.id, { x: s.x + (c.x - s.x) * wsp, y: s.y + (c.y - s.y) * wsp, w: s.w + (c.w - s.w) * wsp, h: s.h + (c.h - s.h) * wsp }); wRuchu = true; }
  }
  for (const id of [...pokazane.keys()]) if (!staly.prostokaty.has(id)) pokazane.delete(id);
  rysuj();
  if (wRuchu) popros();
}

function rysuj() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = K.tlo;
  ctx.fillRect(0, 0, okno.w, okno.h);
  strefy = [];
  const teraz = Date.now();
  const st = lagodnie(t);
  // Podpisy rodzin: w stanie stałym nad rzeczami rodziny; w ciekłym gasną, bo tam o rodzinie mówi karta.
  const alfaRodzin = (1 - st) * 0.9;
  if (alfaRodzin > 0.02) {
    ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
    for (const r of staly.rodziny) {
      const e = naEkran(kam, okno, r);
      if (e.x > okno.w || e.y > okno.h || e.x + e.w < 0 || e.y + e.h < 0) continue;
      const rozmiar = Math.max(11, Math.min(30, 46 * kam.k));
      ctx.globalAlpha = alfaRodzin * plynnie(e.w, 60, 160);
      ctx.fillStyle = K.ciche;
      ctx.font = `600 ${rozmiar}px system-ui, sans-serif`;
      // podpis rodziny nie wychodzi poza swoje rzeczy: z daleka skraca się, zamiast wchodzić na sąsiednie karty
      const podpis = zawin(r.nazwa.toUpperCase(), ctx.font, Math.max(24, e.w), 1);
      ctx.fillText(podpis.linie[0] || '', e.x, e.y - 6);
    }
    ctx.globalAlpha = 1;
  }
  kolejnosc = kolejnoscRysowania(pokazane);
  if (ciagnie && ciagnie.ruszyl) kolejnosc = [...kolejnosc.filter((id) => id !== ciagnie.id), ciagnie.id];
  for (const id of kolejnosc) {
    const p = poId(id), s = pokazane.get(id);
    if (!p || !s) continue;
    const e = naEkran(kam, okno, s);
    if (e.x > okno.w || e.y > okno.h || e.x + e.w < 0 || e.y + e.h < 0 || e.w < 1 || e.h < 1) continue; // rysujemy tylko to, co widać
    rysujProjekt(p, e, teraz);
  }
  if (!swiat.projekty.length) {
    ctx.fillStyle = K.ciche; ctx.font = '15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('W tym Miejscu nie ma jeszcze projektów. Przynosi je obserwator faktów albo ruch poloz (opis: /co-tu-jest).', okno.w / 2, okno.h / 2, okno.w - 40);
  }
}

function rysujProjekt(p, e, teraz) {
  const z = zywosc(p.zycie, teraz);
  const ciagniety = ciagnie && ciagnie.ruszyl && ciagnie.id === p.id;
  const r = Math.min(12, e.w * 0.06, e.h * 0.1);
  ctx.save();
  if (ciagniety) { ctx.shadowColor = 'rgba(0, 0, 0, .45)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; ctx.globalAlpha = 0.94; }
  // Kolor znaczy: im żywszy projekt, tym bardziej zielony; spokojny zostaje w kolorze płyty.
  zaokraglony(e.x, e.y, e.w, e.h, r);
  ctx.fillStyle = z === null ? K.plyta : mieszaj(K.plyta, K.zywe, 0.06 + z * 0.3);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = wybrany === p.id || celZamiany === p.id ? 2.5 : 1;
  ctx.strokeStyle = celZamiany === p.id ? K.znak : (wybrany === p.id ? K.akcent : K.linia);
  if (celZamiany === p.id) ctx.setLineDash([7, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (e.w > 26 && e.h > 20) {
    ctx.save();
    zaokraglony(e.x, e.y, e.w, e.h, r);
    ctx.clip();
    // pasek życia przy lewej krawędzi
    ctx.fillStyle = z === null ? K.stare : mieszaj(K.stare, K.zywe, z);
    ctx.fillRect(e.x, e.y, Math.max(3, Math.min(6, e.w * 0.02)), e.h);
    rysujTresc(p, e, teraz);
    ctx.restore();
  }
  ctx.restore();
}

function rysujTresc(p, e, teraz) {
  const pad = Math.max(6, Math.min(16, e.w * 0.05));
  const szer = e.w - 2 * pad - 4;
  let y = e.y + pad;
  // Nazwa: tak duża, jak pozwala działka, do trzech linii, bez cięcia w środku słowa. Gdy nie mieści się nawet
  // najmniejsza, zostaje jej początek z wielokropkiem: żadna rzecz nie stoi bez imienia.
  let rozmiar = Math.max(9, Math.min(34, e.w / 9, e.h / 3.4));
  let nazwa = null;
  const ileLinii = (roz) => Math.max(1, Math.min(3, Math.floor((e.h - 2 * pad) / (roz * 1.18))));
  for (; rozmiar >= 9; rozmiar -= 1.5) {
    const proba = zawin(p.tytul, `650 ${rozmiar}px system-ui, sans-serif`, szer, ileLinii(rozmiar));
    if (!proba.zaSzeroka && !proba.ucieto) { nazwa = proba; break; }
  }
  // Z daleka (działka węższa niż 64 px) zostaje sam kolor życia: trzy litery z wielokropkiem niczego nie mówią.
  // Imię wraca przy pierwszym przybliżeniu albo po dotknięciu (karta rzeczy).
  if (!nazwa && e.w > 64 && e.h > 20) { rozmiar = 9.5; nazwa = zawin(p.tytul, `650 ${rozmiar}px system-ui, sans-serif`, szer, ileLinii(rozmiar)); }
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  if (nazwa) {
    // Gdy projekt jest większy niż okno, jego imię trzyma się widocznego rogu, żeby było wiadomo, w czym się jest.
    const wys = nazwa.linie.length * rozmiar * 1.18;
    const nx = Math.max(e.x + pad + 4, Math.min(8, e.x + e.w - 120)), ny = Math.max(y, Math.min(gora + 8, e.y + e.h - pad - wys));
    const przyklejone = nx > e.x + pad + 4.5 || ny > y + 0.5;
    ctx.font = `650 ${rozmiar}px system-ui, sans-serif`;
    if (przyklejone) {
      const sz = Math.max(...nazwa.linie.map((l) => ctx.measureText(l).width));
      ctx.fillStyle = mieszaj(K.plyta, K.tlo, 0.5); ctx.globalAlpha *= 0.9;
      zaokraglony(nx - 6, ny - 4, sz + 12, wys + 6, 6); ctx.fill();
      ctx.globalAlpha /= 0.9;
    }
    ctx.fillStyle = K.tekst;
    let ly = ny;
    for (const l of nazwa.linie) { ctx.fillText(l, nx, ly, przyklejone ? undefined : szer); ly += rozmiar * 1.18; }
    y += wys;
  }
  // Obecność: kto z uczestników jest teraz przy tej rzeczy (prawdziwe połączenie, nie ozdoba).
  const przyTym = drzwi.obecni.lista.filter((o) => o.przy === p.id && o.kto !== drzwi.imie);
  if (przyTym.length && e.w > 70) {
    ctx.font = '600 11px system-ui, sans-serif';
    const napis = przyTym.map((o) => o.kto).join(', ');
    const sz = Math.min(szer, ctx.measureText(napis).width + 14);
    ctx.fillStyle = K.akcent;
    zaokraglony(e.x + e.w - pad - sz, e.y + pad, sz, 18, 9); ctx.fill();
    ctx.fillStyle = K.tlo; ctx.textBaseline = 'middle';
    ctx.fillText(napis, e.x + e.w - pad - sz + 7, e.y + pad + 9.5, sz - 12);
    ctx.textBaseline = 'top';
  }
  const dol = e.y + e.h - pad;
  // Wiersz na dole: kiedy żyło, ile gałęzi, ile słów; wchodzi płynnie, gdy działka rośnie.
  const alfaMeta = plynnie(Math.min(e.w / 1.5, e.h), 62, 96);
  let metaGora = dol;
  if (alfaMeta > 0.02) {
    const cz = [];
    if (p.zycie) cz.push('żyje: ' + kiedy(p.zycie));
    if (p.stan) cz.push(p.stan);
    const ileG = (swiat.galezie.get(p.id) || []).length || p.ileGalezi;
    if (ileG) cz.push(lp(ileG, 'gałąź', 'gałęzie', 'gałęzi'));
    const slow = swiat.ileSlow.get(p.id);
    if (slow) cz.push('słowa: ' + slow);
    ctx.globalAlpha *= alfaMeta;
    ctx.fillStyle = K.ciche; ctx.font = '12px system-ui, sans-serif'; ctx.textBaseline = 'bottom';
    const zagrajSzer = p.zagraj && e.w > 150 ? 84 : 0;
    const meta = zawin(cz.join(' · '), '12px system-ui, sans-serif', szer - zagrajSzer, 1);
    ctx.font = '12px system-ui, sans-serif';
    if (meta.linie.length) ctx.fillText(meta.linie[0], e.x + pad + 4, dol);
    ctx.globalAlpha /= alfaMeta;
    ctx.textBaseline = 'top';
    metaGora = dol - 18;
    // Wejście do grania: pigułka w rogu, którą da się dotknąć.
    if (zagrajSzer) {
      const pw = 74, ph = 24, px = e.x + e.w - pad - pw, py = dol - ph + 3;
      ctx.globalAlpha *= alfaMeta;
      ctx.fillStyle = K.akcent; zaokraglony(px, py, pw, ph, 12); ctx.fill();
      ctx.fillStyle = K.tlo; ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.wKarcie ? 'Zagraj ↗' : 'Zagraj', px + pw / 2, py + ph / 2 + 0.5);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.globalAlpha /= alfaMeta;
      strefy.push({ typ: 'zagraj', id: p.id, x: px - 8, y: py - 10, w: pw + 16, h: ph + 20 });
    }
  }
  // Jedno zdanie, czym projekt jest.
  const alfaOpis = plynnie(Math.min(e.w / 1.4, e.h), 100, 150);
  if (alfaOpis > 0.02 && p.opis && nazwa) {
    const wys = 13.5 * 1.35, miejsce = metaGora - y - 6;
    const ile = Math.max(0, Math.min(e.h > 420 ? 4 : 6, Math.floor(miejsce / wys)));
    if (ile >= 1) {
      const o = zawin(p.opis, '13.5px system-ui, sans-serif', szer, ile);
      ctx.globalAlpha *= alfaOpis;
      ctx.fillStyle = K.ciche; ctx.font = '13.5px system-ui, sans-serif';
      y += 4;
      for (const l of o.linie) { ctx.fillText(l, e.x + pad + 4, y, szer); y += wys; }
      ctx.globalAlpha /= alfaOpis;
    }
  }
  // Z bliska projekt otwiera się: gałęzie jako działki w środku, świeższe większe. Wchodzą płynnie, w trakcie
  // przybliżania, a nie po nim.
  const gal = swiat.galezie.get(p.id);
  const alfaGal = plynnie(Math.min(e.w, e.h * 1.3), 300, 460);
  if (gal && gal.length && alfaGal > 0.02) {
    const g0 = y + 10, g1 = metaGora - 6;
    if (g1 - g0 > 60) {
      ctx.globalAlpha *= alfaGal;
      for (const [g, pr] of galezieWPolu(gal, { x: e.x + pad + 4, y: g0, w: szer, h: g1 - g0 }, teraz)) {
        if (pr.x > okno.w || pr.y > okno.h || pr.x + pr.w < 0 || pr.y + pr.h < 0 || pr.w < 2 || pr.h < 2) continue;
        const zg = zywosc(g.kiedy, teraz);
        ctx.fillStyle = zg === null ? mieszaj(K.tlo, K.stare, 0.25) : mieszaj(K.tlo, K.zywe, 0.12 + zg * 0.5);
        zaokraglony(pr.x + 1, pr.y + 1, pr.w - 2, pr.h - 2, 4); ctx.fill();
        if (pr.w > 54 && pr.h > 16) {
          const roz = Math.max(9.5, Math.min(13, pr.h / 2.6));
          const im = zawin(krotkieImie(g.nazwa), `${roz}px system-ui, sans-serif`, pr.w - 10, pr.h > roz * 2.8 ? 2 : 1);
          ctx.fillStyle = K.tekst; ctx.font = `${roz}px system-ui, sans-serif`;
          // imię gałęzi trzyma się widocznego rogu jej działki
          const gx = Math.max(pr.x + 6, Math.min(10, pr.x + pr.w - 60));
          let gy = Math.max(pr.y + 5, Math.min(gora + 46, pr.y + pr.h - im.linie.length * roz * 1.2 - 4));
          for (const l of im.linie) { ctx.fillText(l, gx, gy, pr.x + pr.w - gx - 4); gy += roz * 1.2; }
        }
      }
      ctx.globalAlpha /= alfaGal;
    }
  }
}

// --- pasek: stan, przełącznik, wejście --------------------------------------------------------------------------------
function rysujPasek() {
  if (!drzwi.opis) return;
  const d = drzwi.opis, ja = d.czytasz_jako.imie;
  const inni = drzwi.obecni.lista.filter((x) => x.kto !== ja);
  let tu = '';
  if (inni.length) tu = ' · są też: ' + inni.map((x) => x.kto).join(', ');
  else if (drzwi.obecni.ilu) tu = ' · z kluczem jest tu: ' + drzwi.obecni.ilu;
  // Karta repozytorium to fakt przyniesiony przez obserwatora, a nie dzieło wniesione do środka: liczymy je osobno,
  // żeby pasek nie mówił "28 projektów" tam, gdzie licznik przeniesienia mówi "0" (uwaga drugiej linii, 17 XI).
  const repo = swiat ? swiat.projekty.filter((p) => p.fakt).length : 0;
  const dziel = swiat ? swiat.projekty.length - repo : 0;
  const co = [dziel ? lp(dziel, 'dzieło', 'dzieła', 'dzieł') : null, repo || !dziel ? lp(repo, 'repozytorium', 'repozytoria', 'repozytoriów') : null].filter(Boolean).join(' i ');
  const obce = swiat && swiat.obce ? ` · ${lp(swiat.obce, 'położenie leży', 'położenia leżą', 'położeń leży')} poza obszarem widoku i nie jest pokazane` : '';
  $('stan').textContent = `${co} · akt ${d.miejsce.akt} · ${ja || 'zwiedzający'} · ${drzwi.zywe ? 'na żywo' : 'bez połączenia na żywo'}${tu}${obce}`;
  $('stan').title = drzwi.zywe ? 'Połączenie stoi: zmiany przychodzą same.' : 'Połączenie na żywo nie stoi: strona pyta o zmiany co kilka sekund.';
  // To, co czeka na właściciela (propozycje agentów, także położeń, i prośby), widać od razu; rozstrzyga się na
  // stronie gospodarza, bo szkielet nie ma jeszcze warstwy propozycji na płótnie.
  const ileCzeka = d.czeka.propozycje.length + d.czeka.prosby.length;
  $('czeka').hidden = !ileCzeka;
  $('czeka').textContent = 'czeka: ' + ileCzeka;
  $('czeka').title = 'Propozycje i prośby, które czekają na właściciela. Rozstrzyga się je na stronie gospodarza.';
  $('przelacz').textContent = t >= 0.5 ? 'połóż' : 'nadmuchaj';
  $('przelacz').title = t >= 0.5 ? 'Wróć do stanu stałego: rzeczy płyną tam, gdzie je położyłeś' : 'Nadmuchaj: rzeczy wypełniają okno, ważniejsze większe';
  const g = $('wejscie'), p = $('wejscie-panel');
  g.textContent = drzwi.klucz && ja ? ja + ' · wyjdź' : 'Wejdź';
  if (drzwi.klucz && ja) { g.onclick = () => drzwi.wejdz('').then(() => komunikat('Wyszedłeś. Oglądasz jako zwiedzający.')); p.hidden = true; return; }
  g.onclick = () => { p.hidden = !p.hidden; };
  if (p.dataset.akt === String(d.klucz_probny_wlasciciela) + '|' + String(d.klucz_probny)) return;
  p.dataset.akt = String(d.klucz_probny_wlasciciela) + '|' + String(d.klucz_probny);
  p.textContent = '';
  const wejdz = (k) => drzwi.wejdz(k).then(() => { p.hidden = true; komunikat('Jesteś jako ' + (drzwi.imie || '?') + '.'); }, (b) => komunikat('Nie udało się wejść: ' + b.message, true));
  const poleKlucza = el('input', { type: 'password', placeholder: 'Twój klucz', autocomplete: 'current-password', 'aria-label': 'Klucz uczestnika' });
  wloz(p, el('p', { tekst: 'Wejście jest potrzebne tylko do układania. Klucz zostaje w tej przeglądarce.' }),
    d.klucz_probny_wlasciciela ? el('button', { klasa: 'glowny', tekst: 'Wejdź jako właściciel próbny', klik: () => wejdz(d.klucz_probny_wlasciciela) }) : null,
    d.klucz_probny ? el('button', { tekst: 'Wejdź jako agent próbny', klik: () => wejdz(d.klucz_probny) }) : null,
    poleKlucza, el('button', { tekst: 'Wejdź kluczem', klik: () => wejdz(poleKlucza.value) }));
}
function zapiszOko() { try { localStorage.setItem(OKO, JSON.stringify({ t: Math.round(t * 100) / 100 })); } catch { /* stan oka to wygoda */ } }
$('suwak').value = String(Math.round(t * 100));
$('suwak').addEventListener('input', () => { animT = null; suwakWRuchu = true; t = Number($('suwak').value) / 100; rysujPasek(); popros(); });
$('suwak').addEventListener('change', () => { suwakWRuchu = false; zapiszOko(); popros(); });
$('przelacz').addEventListener('click', () => {
  const na = t >= 0.5 ? 0 : 1;
  animT = { z: t, na, od: performance.now(), ms: 700 };
  // przy nadmuchaniu kamera płynie tak, żeby mozaika wypełniła okno; przy powrocie zostaje, gdzie była
  if (na === 1 && pole) animKam = { z: kam, na: kameraNa(pole, okno, 8, gora), od: performance.now(), ms: 700 };
  popros();
});
$('caly').addEventListener('click', () => { if (!swiat) return; animKam = { z: kam, na: kameraNa(t >= 0.5 ? pole : staly.granice, okno, t >= 0.5 ? 8 : 28, gora), od: performance.now(), ms: 450 }; popros(); });
$('pomoc-guzik').addEventListener('click', () => { const p = $('pomoc'); p.hidden = !p.hidden; $('pomoc-guzik').setAttribute('aria-expanded', p.hidden ? 'false' : 'true'); });

// --- karta wybranej rzeczy: czym jest, skąd się tu wzięła, co da się z nią zrobić --------------------------------------
function wybierz(id) {
  wybrany = id;
  drzwi.przy(id);
  rysujKarte(); popros();
}
function rysujKarte() {
  const k = $('karta');
  const p = wybrany ? poId(wybrany) : null;
  if (!p) { k.hidden = true; return; }
  const szkic = k.querySelector('textarea') && k.dataset.id === p.id ? k.querySelector('textarea').value : '';
  const m = swiat.miejsca.get(p.id);
  const rodzina = p.rodzina && swiat.rodziny.get(p.rodzina);
  const slowa = [...drzwi.rzeczy.values()].filter((r) => r.rodzaj.startsWith('slowo/') && Array.isArray(r.cechy.dotyczy) && r.cechy.dotyczy.includes(p.id)).sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
  k.textContent = '';
  k.dataset.id = p.id;
  k.hidden = false;
  const tekstSlowa = el('textarea', { placeholder: 'Twoje słowo przy tej rzeczy', 'aria-label': 'Twoje słowo przy tej rzeczy' });
  tekstSlowa.value = szkic;
  wloz(k,
    el('button', { klasa: 'zamknij', tekst: '×', 'aria-label': 'Zamknij kartę', klik: () => wybierz(null) }),
    el('h2', { tekst: p.tytul }),
    el('p', { klasa: 'rodzina', tekst: (rodzina ? rodzina.nazwa : 'bez rodziny') + (p.stan ? ' · ' + p.stan : '') + (p.zycie ? ' · żyje: ' + kiedy(p.zycie) : '') }),
    p.opis ? el('p', { tekst: p.opis }) : null,
    p.wejscie ? el('p', { klasa: 'ciche', tekst: p.wejscie }) : null,
    // "tu, bo": każde miejsce wie, skąd się wzięło
    el('p', { klasa: 'bo', tekst: m && m.kto ? `Leży tu, bo położył ją ${m.kto} ${kiedy(m.kiedy)}${m.skala !== 1 ? ' (wielkość z ręki: ' + Math.round(m.skala * 100) + '%)' : ''}.` : (m ? 'Właśnie ją kładziesz.' : 'Leży w siatce domyślnej: nikt jej jeszcze nie położył.') }),
    el('div', { klasa: 'ruchy' },
      p.zagraj ? (p.wKarcie ? el('a', { klasa: 'guzik glowny', href: p.zagraj, target: '_blank', rel: 'noopener', tekst: 'Zagraj w karcie' }) : el('button', { klasa: 'glowny', tekst: 'Zagraj', klik: () => otworzGre(p) })) : null,
      el('button', { tekst: 'większa', title: 'Powiększ tę rzecz (w stanie ciekłym: ważniejsza)', klik: () => zmienSkale(p.id, 1.25) }),
      el('button', { tekst: 'mniejsza', title: 'Pomniejsz tę rzecz', klik: () => zmienSkale(p.id, 0.8) }),
      m && m.id ? el('button', { tekst: 'oddaj siatce', title: 'Zdejmij miejsce z ręki: rzecz wraca do siatki domyślnej', klik: () => oddajSiatce(p.id) }) : null,
      p.zrodlo ? el('a', { klasa: 'guzik', href: p.zrodlo, target: '_blank', rel: 'noopener', tekst: 'źródło' }) : null,
      el('a', { klasa: 'guzik', href: '/#rzecz=' + p.id, title: 'Cała karta rzeczy na stronie gospodarza: cechy, historia, wskazujące', tekst: 'cała karta' })),
    tekstSlowa,
    el('div', { klasa: 'ruchy' }, el('button', { tekst: 'Zostaw słowo', klik: async (e) => {
      const w = tekstSlowa.value.trim(); if (!w) return;
      e.currentTarget.disabled = true;
      const o = await drzwi.ruch({ co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: w, dotyczy: [p.id] } });
      if (!o.ok) { e.currentTarget.disabled = false; komunikat(o.blad, true); return; }
      tekstSlowa.value = '';
      await drzwi.dogon().catch(() => {});
      komunikat(o.dane.skutek === 'propozycja' ? 'Słowo poszło jako propozycja.' : 'Słowo zostawione przy: ' + p.tytul);
    } })),
    slowa.length ? el('ul', {}, slowa.slice(0, 5).map((s) => el('li', {}, s.cechy.tresc, ' ', el('span', { tekst: s.utworzyl + ' · ' + kiedy(s.utworzono) })))) : null);
}
// Lista tego samego, co na płótnie, dla czytnika ekranu, klawiatury i agenta czytającego tekst strony.
function rysujListe() {
  const l = $('lista');
  l.textContent = '';
  for (const p of swiat.projekty) l.append(el('a', { href: '/rzecz/' + p.id, tekst: p.tytul + (p.opis ? ': ' + p.opis : ''), klik: (e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) return; e.preventDefault(); wybierz(p.id); naRzecz(p.id); } }));
}
function naRzecz(id) {
  const s = pokazane.get(id) || cel(id);
  const e = naEkran(kam, okno, s);
  if (e.x >= 0 && e.y >= gora && e.x + e.w <= okno.w && e.y + e.h <= okno.h) return;
  animKam = { z: kam, na: { ...kam, x: s.x + s.w / 2, y: s.y + s.h / 2 }, od: performance.now(), ms: 350 };
  popros();
}

// --- ruchy ręki, które trafiają do Miejsca (zapis przy puszczeniu, nigdy przy ruchu) -----------------------------------
// Położenie rzeczy to rzecz rodzaju miejsce z kluczem (widok, rzecz): każde przesunięcie jest nową wersją tego samego
// miejsca. "dowolna" to świadoma zgoda na nadpisanie: ręka jest najsilniejszym prawem, ostatnie położenie wygrywa.
async function poloz(id, miejsce, zdanie) {
  if (!widok) { komunikat('W tym Miejscu nie ma jeszcze widoku Start (rodzaj widok): nie ma gdzie zapisać położenia.', true); return false; }
  const bylo = swiat.miejsca.get(id) || null;
  const m = { x: Math.round(miejsce.x), y: Math.round(miejsce.y), skala: miejsce.skala ?? (bylo ? bylo.skala : 1) };
  wToku.set(id, m);
  swiat.miejsca.set(id, { ...(bylo || {}), ...m });
  przelicz(); rysujKarte(); popros();
  const o = await drzwi.ruch({ co: 'poloz', rodzaj: 'miejsce/1', wersja: 'dowolna', cechy: { widok: widok.id, rzecz: id, x: m.x, y: m.y, ...(m.skala !== 1 ? { skala: Math.round(m.skala * 100) / 100 } : {}) } });
  wToku.delete(id);
  const propozycja = o.ok && o.dane.skutek === 'propozycja';
  if (!o.ok || propozycja) {
    // nie weszło (albo czeka jako propozycja): rzecz wraca tam, gdzie leży naprawdę
    if (bylo) swiat.miejsca.set(id, bylo); else swiat.miejsca.delete(id);
    przelicz(); rysujKarte(); popros();
    komunikat(propozycja ? 'Położenie poszło jako propozycja (' + (o.dane.powod || 'czeka na właściciela') + '). Rzecz zostaje na miejscu, dopóki nie zostanie przyjęta.' : o.blad, !propozycja);
    return false;
  }
  await drzwi.dogon().catch(() => {});
  if (zdanie) komunikat(zdanie);
  return true;
}
function srodekStaly(id) { const s = staly.prostokaty.get(id); return { x: s.x + s.w / 2, y: s.y + s.h / 2 }; }
async function zmienSkale(id, mnoznik) {
  const bylo = swiat.miejsca.get(id), s = srodekStaly(id);
  const skala = Math.max(SKALA.min, Math.min(SKALA.max, (bylo ? bylo.skala : 1) * mnoznik));
  await poloz(id, { x: s.x, y: s.y, skala }, 'Wielkość z ręki: ' + Math.round(skala * 100) + '%.');
}
async function oddajSiatce(id) {
  const m = swiat.miejsca.get(id);
  if (!m || !m.id) return;
  const o = await drzwi.ruch({ co: 'odloz', rzecz: m.id, wersja: 'dowolna', powod: 'oddane siatce domyślnej na Starcie' });
  if (!o.ok) { komunikat(o.blad, true); return; }
  await drzwi.dogon().catch(() => {});
  komunikat(o.dane.skutek === 'propozycja' ? 'Poszło jako propozycja.' : 'Rzecz wróciła do siatki domyślnej. Jej położenie z ręki jest odłożone, nie skasowane.');
}
async function zamien(a, b) {
  const sa = srodekStaly(a), sb = srodekStaly(b);
  const pa = poId(a), pb = poId(b);
  const ok = await poloz(a, sb, null);
  if (!ok) return;
  if (await poloz(b, sa, null)) komunikat(`Zamienione miejscami: ${pa.tytul} i ${pb.tytul}.`);
}

// --- okno gry -----------------------------------------------------------------------------------------------------------
// Poziomy zaufania jak na stronie gospodarza: adres z rzeczy, którą dołożył i ostatnio zmienił właściciel albo
// obserwator faktów, dostaje własną pamięć pod swoim adresem; każdy inny otwiera się bez niej.
const PIASKOWNICE = { obcy: 'allow-scripts allow-pointer-lock', swoj: 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups' };
function otworzGre(p) {
  if (!p.zagraj) return;
  if (p.wKarcie) { window.open(p.zagraj, '_blank', 'noopener'); return; }
  const zaufani = [drzwi.opis.wlasciciel, 'obserwator'];
  let swoj = zaufani.includes(p.utworzyl) && zaufani.includes(p.zmienil);
  // adres pod własnym adresem Miejsca nigdy nie dostaje pełnych praw: w ramce mógłby zdjąć z siebie piaskownicę
  try { if (new URL(p.zagraj).origin === location.origin) swoj = false; } catch { swoj = false; }
  const ramka = el('iframe', { src: p.zagraj, title: p.tytul, referrerpolicy: 'no-referrer', allow: 'fullscreen; gamepad', sandbox: swoj ? PIASKOWNICE.swoj : PIASKOWNICE.obcy });
  $('okno-ramka').replaceChildren(ramka);
  $('okno-tytul').textContent = p.tytul;
  $('okno-karta').href = p.zagraj;
  $('okno-gry').hidden = false;
  drzwi.przy(p.id);
}
function zamknijGre() { $('okno-gry').hidden = true; $('okno-ramka').replaceChildren(); drzwi.przy(wybrany); }
$('okno-zamknij').addEventListener('click', zamknijGre);

// --- ręka na płótnie ----------------------------------------------------------------------------------------------------
const palce = new Map();   // identyfikator wskaźnika -> { x, y }
let gest = null;           // { typ: 'czeka' | 'widok' | 'rzecz' | 'szczypta', … }
const wPlotnie = (e) => { const r = plotno.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function podPunktem(x, y) {
  for (let i = strefy.length - 1; i >= 0; i--) { const s = strefy[i]; if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return { strefa: s, id: s.id }; }
  const w = naSwiat(kam, okno, x, y);
  return { strefa: null, id: trafienie(pokazane, kolejnosc || [], w.x, w.y) };
}
plotno.addEventListener('pointerdown', (e) => {
  if (!swiat || !kam) return;
  if (e.button === 1) e.preventDefault(); // środkowy przycisk przesuwa widok, a nie włącza przewijanie przeglądarki
  try { plotno.setPointerCapture(e.pointerId); } catch { /* wskaźnik bez przechwycenia dalej działa nad płótnem */ }
  const p = wPlotnie(e);
  palce.set(e.pointerId, p);
  animKam = null;
  if (palce.size === 2) {
    const [a, b] = [...palce.values()];
    if (ciagnie) { ciagnie = null; celZamiany = null; }
    gest = { typ: 'szczypta', odl: Math.hypot(a.x - b.x, a.y - b.y), sx: (a.x + b.x) / 2, sy: (a.y + b.y) / 2 };
    return;
  }
  const pod = podPunktem(p.x, p.y);
  gest = { typ: 'czeka', x0: p.x, y0: p.y, x: p.x, y: p.y, id: e.button === 1 ? null : pod.id, strefa: pod.strefa, srodkowy: e.button === 1 };
});
plotno.addEventListener('pointermove', (e) => {
  const p = wPlotnie(e);
  if (!palce.has(e.pointerId)) {
    // sam ruch myszy: kursor mówi, czy pod nim jest rzecz
    if (swiat && kam && !gest) { const pod = podPunktem(p.x, p.y); if (pod.id !== nad) { nad = pod.id; plotno.classList.toggle('nad-rzecza', !!nad); } }
    return;
  }
  palce.set(e.pointerId, p);
  if (!gest) return;
  if (gest.typ === 'szczypta' && palce.size >= 2) {
    const [a, b] = [...palce.values()];
    const odl = Math.hypot(a.x - b.x, a.y - b.y), sx = (a.x + b.x) / 2, sy = (a.y + b.y) / 2;
    kam = przybliz(kam, okno, sx, sy, odl / Math.max(1, gest.odl));
    kam = { ...kam, x: kam.x - (sx - gest.sx) / kam.k, y: kam.y - (sy - gest.sy) / kam.k };
    gest.odl = odl; gest.sx = sx; gest.sy = sy;
    popros();
    return;
  }
  const dx = p.x - gest.x, dy = p.y - gest.y;
  if (gest.typ === 'czeka' && Math.hypot(p.x - gest.x0, p.y - gest.y0) > 6) {
    // Rusza się rzecz, jeśli palec ją trzyma i wolno układać; inaczej rusza się widok.
    if (gest.id && !gest.srodkowy && drzwi.klucz) {
      const s = pokazane.get(gest.id), w = naSwiat(kam, okno, gest.x0, gest.y0);
      // punkt chwytu zostaje pod palcem: rzecz nie przeskakuje środkiem pod kursor
      ciagnie = { id: gest.id, dx: s.x + s.w / 2 - w.x, dy: s.y + s.h / 2 - w.y, x: s.x + s.w / 2, y: s.y + s.h / 2, ruszyl: true };
      gest.typ = 'rzecz';
    } else {
      if (gest.id && !gest.srodkowy && !drzwi.klucz && !gest.powiedziane) { gest.powiedziane = true; komunikat('Żeby układać rzeczy, najpierw wejdź (guzik Wejdź u góry). Teraz przesuwasz widok.'); }
      gest.typ = 'widok';
    }
    plotno.classList.add('chwyt');
  }
  if (gest.typ === 'widok') { kam = { ...kam, x: kam.x - dx / kam.k, y: kam.y - dy / kam.k }; popros(); }
  else if (gest.typ === 'rzecz' && ciagnie) {
    const w = naSwiat(kam, okno, p.x, p.y);
    ciagnie.x = w.x + ciagnie.dx; ciagnie.y = w.y + ciagnie.dy;
    // w stanie ciekłym upuszczenie na inną rzecz zamienia je miejscami: pokazujemy, na którą
    celZamiany = t >= 0.5 ? trafienie(pokazane, (kolejnosc || []).filter((id) => id !== ciagnie.id), w.x, w.y) : null;
    popros();
  }
  gest.x = p.x; gest.y = p.y;
});
function koniecGestu(e, anulowany = false) {
  palce.delete(e.pointerId);
  plotno.classList.remove('chwyt');
  const g = gest;
  if (!g) return;
  if (g.typ === 'szczypta') { gest = palce.size ? { typ: 'widok', x: [...palce.values()][0].x, y: [...palce.values()][0].y } : null; return; }
  gest = null;
  if (g.typ === 'czeka' && !anulowany) {
    // dotknięcie bez ruchu: wejście do grania, wybór rzeczy albo zdjęcie wyboru
    if (g.strefa && g.strefa.typ === 'zagraj') { const p = poId(g.strefa.id); if (p) otworzGre(p); }
    else wybierz(g.id || null);
    return;
  }
  if (g.typ === 'rzecz' && ciagnie) {
    const c = ciagnie, zamiana = celZamiany;
    ciagnie = null; celZamiany = null;
    if (anulowany) { popros(); return; }
    if (t >= 0.5) { if (zamiana) zamien(c.id, zamiana); else komunikat('W stanie ciekłym upuść rzecz na inną, żeby zamieniły się miejscami. Dowolne miejsce wybierasz w stanie stałym.'); }
    else poloz(c.id, { x: c.x, y: c.y }, null);
    popros();
  }
}
plotno.addEventListener('pointerup', (e) => koniecGestu(e));
plotno.addEventListener('pointercancel', (e) => koniecGestu(e, true));
plotno.addEventListener('wheel', (e) => {
  if (!kam) return;
  e.preventDefault();
  const p = wPlotnie(e);
  animKam = null;
  kam = przybliz(kam, okno, p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016)));
  popros();
}, { passive: false });
plotno.addEventListener('dblclick', (e) => {
  const p = wPlotnie(e), pod = podPunktem(p.x, p.y), pr = pod.id ? poId(pod.id) : null;
  if (pr && pr.zagraj) otworzGre(pr);
});
plotno.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('okno-gry').hidden) zamknijGre(); else if (!$('pomoc').hidden) { $('pomoc').hidden = true; $('pomoc-guzik').setAttribute('aria-expanded', 'false'); } else if (wybrany) wybierz(null);
});

// --- okno przeglądarki ---------------------------------------------------------------------------------------------------
function wymiar() {
  dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
  const zmiana = w !== okno.w || h !== okno.h;
  okno.w = w; okno.h = h;
  gora = Math.ceil($('pasek').getBoundingClientRect().height);
  plotno.width = Math.round(w * dpr); plotno.height = Math.round(h * dpr);
  if (zmiana && swiat) przelicz();
  popros();
}
addEventListener('resize', wymiar);
wymiar();
wczytajKolory();
drzwi.start().catch((blad) => { $('stan').textContent = 'brak połączenia'; komunikat('Nie udało się przeczytać Miejsca: ' + blad.message, true); });
