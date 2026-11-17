// Świat Startu: z rzeczy Miejsca liczy, co leży gdzie (17 XI 2026). Status: próba (TYMCZASOWE.md).
// Czyste funkcje bez DOM i bez sieci: rysowanie tylko to czyta, a testy sprawdzają to w Node.
// Dwa stany tych samych rzeczy (materiał Ściany, par. 3.1; jego słowa z 16 i 17 XI):
//   stały  : rzecz leży tam, gdzie ją położył (rzecz rodzaju miejsce w widoku), a niepołożona w siatce domyślnej;
//            nic nie rusza się samo;
//   ciekły : te same rzeczy wypełniają okno, ważniejsze większe, a liczone Z POŁOŻEŃ stanu stałego (nadmuchanie
//            z miejsca), więc co leżało na lewo, zostaje na lewo.
// Stan pośredni to liczba od 0 do 1 w oku, nie zapis. Zapisem jest tylko położenie z ręki, przy puszczeniu.
import { nadmuchaj, squarify } from './uklad.mjs';

export const KARTA = { w: 240, h: 150, odstep: 28, naglowek: 72, miedzyRodzinami: 96 };
export const SKALA = { min: 0.4, max: 4 };
const DZIEN = 86400000;
const tekst = (w) => (typeof w === 'string' && w.trim() ? w.trim() : null);
const adres = (w) => (typeof w === 'string' && /^https:\/\//.test(w) ? w : null);

// Projekt to dzieło (rodzaj projekt) albo fakt o repozytorium, który przyniósł obserwator (rodzaj repo).
// Start czyta jedno i drugie tak samo: nazwa, jedno zdanie, gdzie zagrać, kiedy ostatnio żyło, do której rodziny należy.
export function jakoProjekt(r) {
  const c = r.cechy || {};
  const fakt = r.rodzaj.startsWith('repo/');
  return {
    id: r.id, rodzaj: r.rodzaj, fakt,
    tytul: (fakt && tekst(c.ladna_nazwa)) || tekst(r.tytul) || tekst(c.nazwa) || r.id.slice(0, 6),
    opis: (fakt && tekst(c.tozsamosc)) || tekst(c.opis) || '',
    zagraj: adres(fakt ? c.strona : c.zagraj), wKarcie: c.karta === true, wejscie: tekst(c.wejscie),
    zrodlo: adres(fakt ? c.adres : c.zrodlo),
    zycie: tekst(fakt ? c.ostatni_push : c.zycie), stan: fakt ? tekst(c.zycie) : null,
    rodzina: typeof c.rodzina === 'string' ? c.rodzina : null,
    commity: Number.isFinite(c.commity) ? c.commity : 0,
    ileGalezi: Number.isFinite(c.galezie) ? c.galezie : null,
    utworzyl: r.utworzyl, zmienil: r.zmienil, wersja: r.wersja,
  };
}

// Z listy rzeczy: projekty, rodziny, gałęzie po projekcie i miejsca z ręki w podanym widoku.
export function zbudujSwiat(rzeczy, { widok = null } = {}) {
  const projekty = [], rodziny = new Map(), galezie = new Map(), miejsca = new Map();
  let ileSlow = new Map();
  for (const r of rzeczy) {
    const c = r.cechy || {};
    if (r.rodzaj.startsWith('repo/') || r.rodzaj.startsWith('projekt/')) projekty.push(jakoProjekt(r));
    else if (r.rodzaj.startsWith('rodzina/')) rodziny.set(r.id, { id: r.id, nazwa: tekst(c.nazwa) || 'Rodzina', pytanie: tekst(c.pytanie) });
    else if (r.rodzaj.startsWith('galaz/') && typeof c.repo === 'string') {
      if (!galezie.has(c.repo)) galezie.set(c.repo, []);
      galezie.get(c.repo).push({ id: r.id, nazwa: tekst(c.nazwa) || '?', kiedy: tekst(c.kiedy), temat: tekst(c.temat) });
    } else if (r.rodzaj.startsWith('miejsce/') && widok && c.widok === widok && typeof c.rzecz === 'string' && Number.isFinite(c.x) && Number.isFinite(c.y)) {
      miejsca.set(c.rzecz, { id: r.id, wersja: r.wersja, x: c.x, y: c.y, skala: Number.isFinite(c.skala) ? Math.max(SKALA.min, Math.min(SKALA.max, c.skala)) : 1, kto: r.zmienil, kiedy: r.zmieniono });
    } else if (r.rodzaj.startsWith('slowo/') && Array.isArray(c.dotyczy)) {
      for (const id of c.dotyczy) if (typeof id === 'string') ileSlow.set(id, (ileSlow.get(id) || 0) + 1);
    }
  }
  projekty.sort((a, b) => a.tytul.localeCompare(b.tytul, 'pl') || (a.id < b.id ? -1 : 1));
  return { projekty, rodziny, galezie, miejsca, ileSlow, widok };
}

// Ważność projektu w stanie ciekłym: pierwiastek z liczby commitów plus stała (tak mierzyła kampania Skala), razy
// mnożnik z ręki. To jest miara do wymiany: docelowo dana, nie stała w kodzie.
export function waga(p, miejsce = null) {
  return (Math.sqrt(Math.max(0, p.commity)) + 4) * (miejsce ? miejsce.skala : 1);
}

// Siatka domyślna: gdzie leży rzecz, której nikt jeszcze nie położył. Rodziny po nazwie, projekty w rodzinie po
// nazwie, więc siatka nie przestawia się, gdy projekt dostanie nowe commity; zmienia ją tylko dojście albo zniknięcie
// rzeczy. Zwraca Map id -> {x, y, w, h}.
export function siatkaDomyslna(swiat) {
  const grupy = new Map();
  for (const p of swiat.projekty) {
    const k = p.rodzina && swiat.rodziny.has(p.rodzina) ? p.rodzina : '';
    if (!grupy.has(k)) grupy.set(k, []);
    grupy.get(k).push(p);
  }
  // rodziny po nazwie, a rzeczy bez rodziny na końcu
  const kolejnosc = [...grupy.keys()].sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || (a && b ? swiat.rodziny.get(a).nazwa.localeCompare(swiat.rodziny.get(b).nazwa, 'pl') : 0) || (a < b ? -1 : 1));
  const bloki = kolejnosc.map((k) => {
    const n = grupy.get(k).length, kolumn = Math.max(1, Math.ceil(Math.sqrt(n * 1.5)));
    const rzedow = Math.ceil(n / kolumn);
    return { k, kolumn, w: kolumn * (KARTA.w + KARTA.odstep) - KARTA.odstep, h: KARTA.naglowek + rzedow * (KARTA.h + KARTA.odstep) - KARTA.odstep };
  });
  const pole = bloki.reduce((a, b) => a + (b.w + KARTA.miedzyRodzinami) * (b.h + KARTA.miedzyRodzinami), 0);
  const szerokosc = Math.max(...bloki.map((b) => b.w), Math.sqrt(pole * 1.7));
  const wynik = new Map();
  let x = 0, y = 0, wysokoscRzedu = 0;
  for (const b of bloki) {
    if (x > 0 && x + b.w > szerokosc) { x = 0; y += wysokoscRzedu + KARTA.miedzyRodzinami; wysokoscRzedu = 0; }
    grupy.get(b.k).forEach((p, i) => {
      wynik.set(p.id, { x: x + (i % b.kolumn) * (KARTA.w + KARTA.odstep), y: y + KARTA.naglowek + Math.floor(i / b.kolumn) * (KARTA.h + KARTA.odstep), w: KARTA.w, h: KARTA.h });
    });
    x += b.w + KARTA.miedzyRodzinami;
    wysokoscRzedu = Math.max(wysokoscRzedu, b.h);
  }
  return wynik;
}

const obejmij = (prostokaty) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of prostokaty) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + p.w); y1 = Math.max(y1, p.y + p.h); }
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: KARTA.w, h: KARTA.h };
};

// Stan stały: miejsce z ręki wygrywa z siatką. Zwraca prostokąt każdego projektu, podpisy rodzin (nad rzeczami,
// które do nich należą, gdziekolwiek leżą) i granice całości.
export function ukladStaly(swiat) {
  const siatka = siatkaDomyslna(swiat);
  const prostokaty = new Map();
  for (const p of swiat.projekty) {
    const m = swiat.miejsca.get(p.id);
    if (m) prostokaty.set(p.id, { x: m.x - (KARTA.w * m.skala) / 2, y: m.y - (KARTA.h * m.skala) / 2, w: KARTA.w * m.skala, h: KARTA.h * m.skala, zReki: true });
    else prostokaty.set(p.id, { ...siatka.get(p.id), zReki: false });
  }
  const wgRodziny = new Map();
  for (const p of swiat.projekty) {
    const k = p.rodzina && swiat.rodziny.has(p.rodzina) ? p.rodzina : '';
    if (!wgRodziny.has(k)) wgRodziny.set(k, []);
    wgRodziny.get(k).push(prostokaty.get(p.id));
  }
  const rodziny = [...wgRodziny].map(([k, lista]) => ({ id: k || null, nazwa: k ? swiat.rodziny.get(k).nazwa : 'Bez rodziny', pytanie: k ? swiat.rodziny.get(k).pytanie : null, ile: lista.length, ...obejmij(lista) }));
  return { prostokaty, rodziny, granice: obejmij([...prostokaty.values()]) };
}

// Prostokąt o proporcjach okna, który obejmuje cały stan stały: w nim liczy się stan ciekły, więc przejście między
// stanami rozsuwa rzeczy w miejscu, zamiast przenosić je przez pół świata.
export function poleCieklego(granice, proporcje) {
  const pr = Number.isFinite(proporcje) && proporcje > 0 ? proporcje : 1.6;
  let w = granice.w, h = granice.h;
  if (w / h < pr) w = h * pr; else h = w / pr;
  return { x: granice.x + granice.w / 2 - w / 2, y: granice.y + granice.h / 2 - h / 2, w, h };
}

// Stan ciekły: mozaika, która wypełnia pole, liczona z położeń stanu stałego. Między działkami zostaje wąski odstęp.
export function ukladCiekly(swiat, staly, pole, { odstep = 6 } = {}) {
  const poId = new Map(swiat.projekty.map((p) => [p.id, p]));
  const wynik = nadmuchaj(swiat.projekty, pole, {
    polozenie: (id) => { const p = staly.prostokaty.get(id); return { cx: p.x + p.w / 2, cy: p.y + p.h / 2 }; },
    waga: (id) => waga(poId.get(id), swiat.miejsca.get(id)),
  });
  for (const [id, p] of wynik) {
    const o = Math.min(odstep, p.w / 4, p.h / 4);
    wynik.set(id, { x: p.x + o / 2, y: p.y + o / 2, w: Math.max(0, p.w - o), h: Math.max(0, p.h - o) });
  }
  return wynik;
}

// Punkt pośredni między stanami: t = 0 to stały, t = 1 to ciekły.
export function miedzy(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k };
}
// Wygładzenie przejścia: rusza łagodnie, kończy łagodnie.
export const lagodnie = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// Krótkie imię gałęzi: nazwy gałęzi są maszynowe i długie (mediana 37 znaków), więc do rysowania idzie ostatni
// człon bez daty na końcu. Pełna nazwa zostaje w danych.
export function krotkieImie(nazwa) {
  const czlon = String(nazwa).split('/').pop() || String(nazwa);
  return czlon.replace(/[-_]?20\d{2}[-_]\d{2}[-_]\d{2}$/, '').replace(/[-_]+$/, '') || czlon;
}

// Jak żywa jest rzecz: 1 dla dzisiejszej, 0 dla starszej niż pół roku (skala logarytmiczna, jak na stronie gospodarza).
export function zywosc(iso, teraz = Date.now()) {
  const dni = (teraz - Date.parse(iso)) / DZIEN;
  if (!Number.isFinite(dni)) return null;
  return Math.max(0, Math.min(1, 1 - Math.log10(1 + Math.max(0, dni)) / Math.log10(181)));
}

// Gałęzie wewnątrz działki projektu: świeższa gałąź większa. Zwraca [[gałąź, prostokąt]] w podanym polu.
export function galezieWPolu(galezie, pole, teraz = Date.now()) {
  if (!galezie || !galezie.length || pole.w <= 0 || pole.h <= 0) return [];
  const el = galezie
    .map((g, i) => ({ i, v: 1 + 5 * (zywosc(g.kiedy, teraz) ?? 0) }))
    .sort((a, b) => b.v - a.v || (galezie[a.i].nazwa < galezie[b.i].nazwa ? -1 : 1));
  return squarify(el, pole.x, pole.y, pole.w, pole.h).map(([i, p]) => [galezie[i], p]);
}

// Która rzecz leży pod punktem: ostatnia narysowana (czyli na wierzchu) wygrywa. `kolejnosc` to identyfikatory
// w kolejności rysowania.
export function trafienie(prostokaty, kolejnosc, x, y) {
  for (let i = kolejnosc.length - 1; i >= 0; i--) {
    const p = prostokaty.get(kolejnosc[i]);
    if (p && x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return kolejnosc[i];
  }
  return null;
}

// Kolejność rysowania: większe pod spodem, mniejsze na wierzchu, żeby mała rzecz nie znikała pod dużą.
export function kolejnoscRysowania(prostokaty) {
  return [...prostokaty.keys()].sort((a, b) => { const A = prostokaty.get(a), B = prostokaty.get(b); return B.w * B.h - A.w * A.h || (a < b ? -1 : 1); });
}

// Kamera: środek świata w środku okna i powiększenie. Te dwie funkcje to cała zamiana świat <-> ekran.
export const naEkran = (kam, okno, p) => ({ x: (p.x - kam.x) * kam.k + okno.w / 2, y: (p.y - kam.y) * kam.k + okno.h / 2, w: (p.w || 0) * kam.k, h: (p.h || 0) * kam.k });
export const naSwiat = (kam, okno, x, y) => ({ x: (x - okno.w / 2) / kam.k + kam.x, y: (y - okno.h / 2) / kam.k + kam.y });
// Kamera, która pokazuje cały prostokąt z marginesem (w pikselach ekranu). `gora` to pas u góry okna zajęty przez
// obsługę: prostokąt mieści się pod nim.
export function kameraNa(prostokat, okno, margines = 24, gora = 0) {
  const k = Math.max(0.01, Math.min((okno.w - 2 * margines) / Math.max(1, prostokat.w), (okno.h - gora - 2 * margines) / Math.max(1, prostokat.h)));
  return { x: prostokat.x + prostokat.w / 2, y: prostokat.y + prostokat.h / 2 - gora / 2 / k, k };
}
// Przybliżenie w miejscu kursora: punkt świata pod kursorem zostaje pod kursorem.
export function przybliz(kam, okno, x, y, mnoznik, { min = 0.03, max = 12 } = {}) {
  const k = Math.max(min, Math.min(max, kam.k * mnoznik));
  const pod = naSwiat(kam, okno, x, y);
  return { k, x: pod.x - (x - okno.w / 2) / k, y: pod.y - (y - okno.h / 2) / k };
}
