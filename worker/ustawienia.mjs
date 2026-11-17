// Ustawienia jako dane (17 XI 2026, grunt pod warstwę odczuwalną). Status: próba (TYMCZASOWE.md).
// Po co: w starej Jaskini motywy były kodem (zamknięta lista czterech), a ustawienia leżały w pamięci jednej
// przeglądarki (moduł 45-settings): bez historii, bez autora, niewidoczne dla agentów i dla drugiego urządzenia.
// Każda zmiana wyglądu albo odczucia kończyła się więc wydaniem kodu. Tutaj wszystko, co da się stroić, jest rzeczą:
//   - pokretlo/1: DEKLARACJA jednej strojonej rzeczy (nazwa, typ, wartość domyślna, zakres suwaka, twarda klamra,
//     zdanie, co zmienia). Dokłada ją każdy: twarz, narzędzie w oknie, agent. Nowe pokrętło to ruch, nie wydanie kodu;
//   - wartosc/1: WARTOŚĆ pokrętła w zasięgu. Zasięgiem jest dowolna rzecz: obszar (także główny, czyli całe Miejsce),
//     widok, okno, uczestnik, profil urządzenia. Jedna wartość na parę (pokrętło, zasięg), więc każda zmiana jest
//     nową wersją tej samej rzeczy: historia, autor i cofnięcie przychodzą z samego środowiska. Wartość leży tam,
//     gdzie jej zasięg, więc prawo do strojenia jest prawem obszaru (w szkicu agent stroi sam, w głównym proponuje);
//   - zestaw/1: nazwany ZESTAW wartości (motyw, preset). Włącza się go wartością pokrętła `srodowisko.zestawy`
//     w zasięgu; zestawy nakładają się warstwami, późniejszy na liście wygrywa;
//   - profil/1: nazwany zasięg bez własnej treści (to urządzenie, ten sposób pracy), podawany jako nakładka.
// Liczenie: dla każdego pokrętła idziemy po zasięgach od najbliższego (nakładki, rzecz, jej obszar i obszary w górę,
// Miejsce). W każdym: najpierw wartość wprost, potem zestawy włączone w tym zasięgu. Na końcu wartość domyślna
// z deklaracji. Wartość, która nie przechodzi dzisiejszej deklaracji, jest pomijana i wymieniona z nazwy: zepsuta
// wartość nie dochodzi do twarzy.
// Twarda klamra chroni tylko przed rozpadem (liczba, której twarz nie umie narysować); zakres suwaka jest podpowiedzią
// i wartość spoza niego wolno zapisać (zasada 5 z AGENTS.md).
// Czego tu nie ma: czterech ustawień obszaru (ile_wolno, uwaga, widzi, uklada). To prawo i granica, nie pokrętło;
// zostają cechami obszaru. Ten plik nie zna Cloudflare ani drzwi: dostaje środowisko albo jego widok dla czytającego.

export const FORMAT_USTAWIEN = 'ustawienia-1';
export const POKRETLO_ZESTAWOW = 'srodowisko.zestawy';
const NAZWA = /^[a-z][a-z0-9_]{0,39}(\.[a-z][a-z0-9_]{0,39}){1,5}$/;
const ID = /^[0-9a-z]{26}$/;
const KOLOR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
export const KRZYWE = ['liniowa', 'gladka', 'wejscie', 'wyjscie', 'wejscie-wyjscie'];
export const TYPY_POKRETEL = {
  kolor: 'napis #rrggbb albo #rrggbbaa',
  liczba: 'liczba skończona; deklaracja może podać zakres suwaka {od, do, krok} i twardą klamrę {od, do}',
  czas: 'czas w milisekundach, liczba skończona nie mniejsza niż 0; zakres i klamra jak przy liczbie',
  wybor: 'jedna z wartości wymienionych w deklaracji (wartosci)',
  'tak-nie': 'true albo false',
  tekst: 'napis do 2000 znaków',
  krzywa: `krzywa ruchu: jedna z nazw (${KRZYWE.join(', ')}) albo cztery liczby krzywej Béziera [x1, y1, x2, y2], x od 0 do 1`,
  sprezyna: 'sprężyna: {sztywnosc > 0, tlumienie >= 0, masa > 0 (niewymagana)}',
  rampa: 'rampa barw: lista od 2 do 16 przystanków {w: 0..1, kolor}, w kolejności rosnącego w',
  kroj: 'krój pisma: {rodzina (napis jak w CSS), grubosc 1..1000 (niewymagana), osie {wght: 600, …} (niewymagane)}',
  cien: 'cień: {x, y, rozmycie >= 0, kolor}',
  zestawy: 'lista identyfikatorów rzeczy rodzaju zestaw/1 (najwyżej 8); późniejszy na liście wygrywa',
  dowolne: 'dowolna wartość JSON; środowisko jej nie sprawdza (wyjście dla narzędzi z własną strukturą)',
};
const liczba = (x) => typeof x === 'number' && Number.isFinite(x);
const obiekt = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

// Co jest nie tak z wartością względem deklaracji; null, gdy nic. `maRzecz(id)` oddaje rzecz albo null (dla typu zestawy).
export function wadaWartosci(d, w, maRzecz = () => null) {
  const klamra = () => {
    const t = obiekt(d.twarde) ? d.twarde : {};
    if (liczba(t.od) && w < t.od) return `jest poniżej twardej klamry (${t.od}); klamra chroni tylko przed rozpadem, zakres suwaka jest od niej węższy`;
    if (liczba(t.do) && w > t.do) return `jest powyżej twardej klamry (${t.do}); klamra chroni tylko przed rozpadem, zakres suwaka jest od niej węższy`;
    return null;
  };
  switch (d.typ) {
    case 'kolor': return typeof w === 'string' && KOLOR.test(w) ? null : 'ma być kolorem w zapisie #rrggbb albo #rrggbbaa';
    case 'liczba': return liczba(w) ? klamra() : 'ma być liczbą skończoną';
    case 'czas': return liczba(w) && w >= 0 ? klamra() : 'ma być czasem w milisekundach (liczba nie mniejsza niż 0)';
    case 'wybor': return Array.isArray(d.wartosci) && d.wartosci.includes(w) ? null : `ma być jedną z wartości: ${(d.wartosci || []).join(', ')}`;
    case 'tak-nie': return typeof w === 'boolean' ? null : 'ma być true albo false';
    case 'tekst': return typeof w === 'string' && w.length <= 2000 ? null : 'ma być napisem do 2000 znaków';
    case 'krzywa':
      if (typeof w === 'string') return KRZYWE.includes(w) ? null : `ma być jedną z krzywych: ${KRZYWE.join(', ')}, albo czterema liczbami [x1, y1, x2, y2]`;
      return Array.isArray(w) && w.length === 4 && w.every(liczba) && w[0] >= 0 && w[0] <= 1 && w[2] >= 0 && w[2] <= 1 ? null : 'krzywa Béziera to cztery liczby [x1, y1, x2, y2], x1 i x2 od 0 do 1';
    case 'sprezyna':
      return obiekt(w) && liczba(w.sztywnosc) && w.sztywnosc > 0 && liczba(w.tlumienie) && w.tlumienie >= 0 && (w.masa === undefined || (liczba(w.masa) && w.masa > 0)) ? null : 'sprężyna to {sztywnosc > 0, tlumienie >= 0, masa > 0 (niewymagana)}';
    case 'rampa': {
      if (!Array.isArray(w) || w.length < 2 || w.length > 16) return 'rampa to lista od 2 do 16 przystanków {w, kolor}';
      let poprzedni = -Infinity;
      for (const p of w) {
        if (!obiekt(p) || !liczba(p.w) || p.w < 0 || p.w > 1 || p.w < poprzedni || typeof p.kolor !== 'string' || !KOLOR.test(p.kolor)) return 'każdy przystanek rampy to {w: 0..1, kolor: #rrggbb}, w kolejności rosnącego w';
        poprzedni = p.w;
      }
      return null;
    }
    case 'kroj':
      if (!obiekt(w) || typeof w.rodzina !== 'string' || !w.rodzina.trim() || w.rodzina.length > 300) return 'krój to {rodzina: napis jak w CSS, do 300 znaków, …}';
      if (w.grubosc !== undefined && !(liczba(w.grubosc) && w.grubosc >= 1 && w.grubosc <= 1000)) return 'grubość kroju to liczba od 1 do 1000';
      if (w.osie !== undefined && !(obiekt(w.osie) && Object.keys(w.osie).length <= 8 && Object.entries(w.osie).every(([n, x]) => /^[A-Za-z]{4}$/.test(n) && liczba(x)))) return 'osie kroju to obiekt {czteroliterowa nazwa osi: liczba}, najwyżej 8 osi';
      return null;
    case 'cien': return obiekt(w) && liczba(w.x) && liczba(w.y) && liczba(w.rozmycie) && w.rozmycie >= 0 && typeof w.kolor === 'string' && KOLOR.test(w.kolor) ? null : 'cień to {x, y, rozmycie >= 0, kolor: #rrggbb albo #rrggbbaa}';
    case 'zestawy': {
      if (!Array.isArray(w) || w.length > 8) return 'ma być listą najwyżej 8 identyfikatorów zestawów';
      for (const id of w) {
        if (typeof id !== 'string' || !ID.test(id)) return 'każdy element ma być identyfikatorem rzeczy rodzaju zestaw/1 (26 znaków)';
        const z = maRzecz(id);
        if (!z) return `nie ma rzeczy ${id}`;
        if (z.rodzaj !== 'zestaw/1') return `rzecz ${id} jest rodzaju ${z.rodzaj}, a ma być zestaw/1`;
      }
      return null;
    }
    case 'dowolne': return null;
    default: return `deklaracja podaje nieznany typ ${JSON.stringify(d.typ)}`;
  }
}

// Co jest nie tak z deklaracją pokrętła (lista zdań; pusta, gdy nic).
export function wadyDeklaracji(c) {
  const b = [];
  if (typeof c.nazwa !== 'string' || !NAZWA.test(c.nazwa)) b.push('nazwa: od dwóch do sześciu członów z małych liter, cyfr i _, rozdzielonych kropką, np. wyglad.kolor.tlo albo moje_narzedzie.siatka.odstep');
  if (!Object.hasOwn(TYPY_POKRETEL, c.typ)) { b.push(`typ: jeden z: ${Object.keys(TYPY_POKRETEL).join(', ')}`); return b; }
  if (typeof c.opis !== 'string' || !c.opis.trim()) b.push('opis: jedno zdanie o tym, co to pokrętło zmienia (czyta je ręka i agent)');
  const zakres = (n, pelny) => {
    if (!(n in c) || c[n] === null) return;
    const z = c[n];
    if (!obiekt(z) || (pelny ? !(liczba(z.od) && liczba(z.do) && z.od < z.do && (z.krok === undefined || (liczba(z.krok) && z.krok > 0))) : !((z.od === undefined || liczba(z.od)) && (z.do === undefined || liczba(z.do)) && (z.od === undefined || z.do === undefined || z.od <= z.do))))
      b.push(pelny ? 'zakres: {od, do, krok} z liczb, od mniejsze niż do; to zakres suwaka, nie granica' : 'twarde: {od, do} z liczb; to klamra, poza którą wartość jest odrzucana');
    else if (!['liczba', 'czas'].includes(c.typ)) b.push(`${n} ma sens tylko przy typie liczba albo czas`);
  };
  zakres('zakres', true);
  zakres('twarde', false);
  if (c.typ === 'wybor' && !(Array.isArray(c.wartosci) && c.wartosci.length >= 1 && c.wartosci.length <= 60 && c.wartosci.every((x) => typeof x === 'string' && x.length <= 80) && new Set(c.wartosci).size === c.wartosci.length))
    b.push('wartosci: przy typie wybor lista od 1 do 60 różnych napisów');
  if (!b.length) {
    if (!('domyslna' in c)) b.push('domyslna: wartość, którą pokrętło ma, dopóki nikt go nie ruszył');
    else { const w = wadaWartosci(c, c.domyslna, () => null); if (w && c.typ !== 'zestawy') b.push('domyslna: ' + w); else if (c.typ === 'zestawy' && !(Array.isArray(c.domyslna) && c.domyslna.length === 0)) b.push('domyslna: przy typie zestawy pusta lista'); }
  }
  return b;
}

const deklaracja = (s, nazwa) => (typeof nazwa === 'string' && NAZWA.test(nazwa) ? s.spis({ rodzaj: 'pokretlo/1', gdzie: { nazwa }, limit: 1 })[0] || null : null);

// Sprawdzenie rzeczy, które środowisko rozumie jako ustawienia, przy zapisie. `widzi(id)`: rzecz oczami piszącego.
// Zwraca null albo { blad, bledy }.
export function sprawdzUstawienie(s, rodzaj, cechy, widzi) {
  if (rodzaj === 'pokretlo/1') {
    const b = wadyDeklaracji(cechy);
    return b.length ? { blad: 'deklaracja pokrętła nie przeszła sprawdzenia: ' + b.join('; '), bledy: b } : null;
  }
  if (rodzaj === 'wartosc/1') {
    const d = deklaracja(s, cechy.pokretlo);
    if (!d || !widzi(d.id)) return { blad: `nie ma pokrętła o nazwie ${JSON.stringify(cechy.pokretlo)}; zadeklarowane pokrętła: /ustawienia` };
    // Zasięgiem jest rzecz, której wygląd albo odczucie się stroi, a nie samo ustawienie: wartość przypięta do wartości
    // nie ma sensu, a pozwalała budować dowolnie długie łańcuchy rzeczy leżących "z natury" jedna z drugą.
    const z = typeof cechy.zasieg === 'string' ? widzi(cechy.zasieg) : null;
    if (z && ['wartosc', 'pokretlo', 'zestaw', 'propozycja'].includes(String(z.rodzaj).split('/')[0])) return { blad: `zasięgiem wartości nie może być rzecz rodzaju ${z.rodzaj}; zasięg to rzecz, którą się stroi: obszar, widok, okno, uczestnik, profil` };
    const w = wadaWartosci(d.cechy, cechy.wartosc, widzi);
    return w ? { blad: `wartość pokrętła ${cechy.pokretlo} (typ ${d.cechy.typ}) ${w}` } : null;
  }
  if (rodzaj === 'zestaw/1') {
    if (!obiekt(cechy.wartosci) || Object.keys(cechy.wartosci).length > 400) return { blad: 'wartosci: obiekt {nazwa pokrętła: wartość}, najwyżej 400 pozycji' };
    const b = [];
    for (const [n, w] of Object.entries(cechy.wartosci)) {
      if (n === POKRETLO_ZESTAWOW) { b.push(`${n}: zestaw nie włącza innych zestawów`); continue; }
      const d = deklaracja(s, n);
      if (!d || !widzi(d.id)) { b.push(`${n}: nie ma takiego pokrętła`); continue; }
      const wada = wadaWartosci(d.cechy, w, widzi);
      if (wada) b.push(`${n} (typ ${d.cechy.typ}) ${wada}`);
    }
    return b.length ? { blad: 'zestaw nie przeszedł sprawdzenia: ' + b.slice(0, 12).join('; ') + (b.length > 12 ? `; i ${b.length - 12} dalszych` : ''), bledy: b } : null;
  }
  return null;
}

// Zasięgi od najbliższego: nakładki, rzecz `dla`, obszar, w którym leży, obszary w górę, na końcu obszar główny (Miejsce).
export function lancuchZasiegow(w, dla = null, nakladki = []) {
  const lancuch = [];
  const dodaj = (rz) => { if (rz && !lancuch.some((x) => x.id === rz.id)) lancuch.push({ id: rz.id, rodzaj: rz.rodzaj, nazwa: w.tytul(rz) }); };
  for (const id of nakladki) dodaj(w.rzecz(id));
  const start = dla ? w.rzecz(dla) : null;
  if (dla && !start) return null;
  if (start) {
    dodaj(start);
    let ob = start.obszar, kroki = 0;
    while (ob && kroki++ < 64) { const o = w.rzecz(ob); if (!o) break; dodaj(o); ob = o.obszar; }
  }
  const glowny = w.r.meta('obszar_glowny');
  if (glowny) dodaj(w.rzecz(glowny));
  return lancuch;
}

// Wartości wszystkich pokręteł dla zasięgu, policzone oczami czytającego (`w` to widok z srodowisko.dla albo samo
// środowisko). Jedno żądanie daje twarzy wszystko, czego potrzebuje do narysowania się.
export function policzUstawienia(w, { dla = null, nakladki = [], deklaracje = false, zrodlo = null } = {}) {
  if (dla !== null && !(typeof dla === 'string' && ID.test(dla))) return { ok: false, status: 400, blad: 'dla: identyfikator rzeczy, dla której liczyć ustawienia (26 znaków); bez niego liczy się dla całego Miejsca' };
  const nakl = (Array.isArray(nakladki) ? nakladki : []).filter((x) => typeof x === 'string' && ID.test(x)).slice(0, 4);
  const lancuch = zrodlo ? zrodlo.lancuch : lancuchZasiegow(w, dla, nakl);
  if (lancuch === null) return { ok: false, status: 404, blad: `nie ma rzeczy ${dla}` };
  // `zrodlo`: deklaracje i wartości już wybrane po nazwach (policzUstawieniaDlaNazw); bez niego wszystko, co leży w Miejscu
  const dekl = zrodlo ? zrodlo.dekl : w.pamietaj('ustawienia:deklaracje', () => { const m = new Map(); for (const d of w.wszystkie({ rodzaj: 'pokretlo/1' })) if (typeof d.cechy.nazwa === 'string' && !m.has(d.cechy.nazwa)) m.set(d.cechy.nazwa, d); return m; });
  const wart = zrodlo ? zrodlo.wart : w.pamietaj('ustawienia:wartosci', () => { const m = new Map(); for (const x of w.wszystkie({ rodzaj: 'wartosc/1' })) m.set(x.cechy.pokretlo + '|' + x.cechy.zasieg, x); return m; });
  const pominiete = [];
  // zestawy włączone w zasięgu: tylko wartość wprost w tym zasięgu, od ostatniego na liście (ten wygrywa)
  const dZestawow = dekl.get(POKRETLO_ZESTAWOW);
  const zestawyW = new Map();
  for (const z of lancuch) {
    const x = dZestawow ? wart.get(POKRETLO_ZESTAWOW + '|' + z.id) : null;
    const lista = [];
    if (x && Array.isArray(x.cechy.wartosc)) for (const id of x.cechy.wartosc) { const rz = typeof id === 'string' ? w.rzecz(id) : null; if (rz && rz.rodzaj === 'zestaw/1' && !rz.odlozone && obiekt(rz.cechy.wartosci)) lista.push(rz); }
    zestawyW.set(z.id, lista.reverse());
  }
  const wartosci = {};
  for (const [nazwa, d] of dekl) {
    let wynik = null;
    for (const z of lancuch) {
      const x = wart.get(nazwa + '|' + z.id);
      if (x) {
        const wada = wadaWartosci(d.cechy, x.cechy.wartosc, (id) => w.rzecz(id));
        if (!wada) { wynik = { wartosc: x.cechy.wartosc, skad: 'wartosc', zasieg: z.id, rzecz: x.id, wersja: x.wersja }; break; }
        pominiete.push({ pokretlo: nazwa, rzecz: x.id, dlaczego: wada });
      }
      if (nazwa === POKRETLO_ZESTAWOW) continue; // lista zestawów nie dziedziczy się: każdy zasięg włącza swoje
      for (const zs of zestawyW.get(z.id)) {
        if (!Object.hasOwn(zs.cechy.wartosci, nazwa)) continue;
        const wada = wadaWartosci(d.cechy, zs.cechy.wartosci[nazwa], (id) => w.rzecz(id));
        if (!wada) { wynik = { wartosc: zs.cechy.wartosci[nazwa], skad: 'zestaw', zasieg: z.id, rzecz: zs.id, zestaw: w.tytul(zs) }; break; }
        pominiete.push({ pokretlo: nazwa, rzecz: zs.id, dlaczego: wada });
      }
      if (wynik) break;
    }
    wartosci[nazwa] = wynik || { wartosc: d.cechy.domyslna, skad: 'domyslna' };
  }
  return { ok: true, format: FORMAT_USTAWIEN, akt: w.ostatniNr(), dla, nakladki: nakl, lancuch, wartosci, ...(pominiete.length ? { pominiete } : {}),
    ...(deklaracje ? { deklaracje: [...dekl.values()].map((d) => ({ ...d.cechy, rzecz: d.id, wersja: d.wersja })).sort((a, b) => String(a.grupa || '').localeCompare(String(b.grupa || '')) || a.nazwa.localeCompare(b.nazwa)) } : {}) };
}

// Liczenie dla twarzy: tylko pokrętła o podanych nazwach. Deklaracje i wartości czyta po tożsamości z klucza (nazwa;
// nazwa i zasięg), więc koszt zależy od liczby nazw i długości drogi zasięgów, a nie od tego, ile pokręteł i wartości
// leży w całym Miejscu. Liczenie wszystkiego czytało każdą deklarację i każdą wartość, także z cudzych profili, przy
// każdej zmianie ustawień i w każdej otwartej twarzy: kto dokładał pokrętła tam, gdzie prowadzi, podnosił koszt wszystkim
// (niezależny atak, 17 XI 2026; limit wierszy jest wspólny dla całego konta).
export const NAJWIECEJ_NAZW = 200;
export async function policzUstawieniaDlaNazw(w, { dla = null, nakladki = [], nazwy = [] } = {}) {
  if (dla !== null && !(typeof dla === 'string' && ID.test(dla))) return policzUstawienia(w, { dla });
  const lista = [...new Set((Array.isArray(nazwy) ? nazwy : []).filter((n) => typeof n === 'string' && NAZWA.test(n)))];
  if (lista.length > NAJWIECEJ_NAZW) return { ok: false, status: 400, blad: `nazwy: najwyżej ${NAJWIECEJ_NAZW} nazw pokręteł w jednym pytaniu` };
  const nakl = (Array.isArray(nakladki) ? nakladki : []).filter((x) => typeof x === 'string' && ID.test(x)).slice(0, 4);
  const lancuch = lancuchZasiegow(w, dla, nakl);
  if (lancuch === null) return { ok: false, status: 404, blad: `nie ma rzeczy ${dla}` };
  const kP = w.ksztaltDla('pokretlo/1'), kW = w.ksztaltDla('wartosc/1');
  const dekl = new Map(), wart = new Map();
  for (const n of [POKRETLO_ZESTAWOW, ...lista.filter((x) => x !== POKRETLO_ZESTAWOW)]) {
    const d = w.rzecz(await w._idZKlucza('pokretlo/1', kP, { nazwa: n }));
    if (!d || d.rodzaj !== 'pokretlo/1' || d.odlozone || d.cechy.nazwa !== n) continue;
    dekl.set(n, d);
    for (const z of lancuch) {
      const x = w.rzecz(await w._idZKlucza('wartosc/1', kW, { pokretlo: n, zasieg: z.id }));
      if (x && x.rodzaj === 'wartosc/1' && !x.odlozone) wart.set(n + '|' + z.id, x);
    }
  }
  const u = policzUstawienia(w, { dla, nakladki: nakl, zrodlo: { dekl, wart, lancuch } });
  if (u.ok && !lista.includes(POKRETLO_ZESTAWOW)) delete u.wartosci[POKRETLO_ZESTAWOW];
  return u;
}

const pokaz = (x) => { const t = JSON.stringify(x); return t.length > 90 ? t.slice(0, 89) + '…' : t; };

// To samo tekstem, dla ciała, które umie tylko czytać.
export function stronaUstawien(w, { dla = null, origin = '' } = {}) {
  const u = policzUstawienia(w, { dla, deklaracje: true });
  if (!u.ok) return u.blad + '\n';
  const glowny = w.r.meta('obszar_glowny');
  const wiersze = [
    'USTAWIENIA: wszystko, co da się tu stroić, i jaką ma teraz wartość',
    `Policzone dla: ${dla ? 'rzeczy ' + dla : 'całego Miejsca'}; zasięgi od najbliższego: ${u.lancuch.map((z) => `${z.nazwa} [${z.rodzaj}]`).join(' -> ') || 'brak'}.`,
    'Pokrętło to deklaracja (rzecz rodzaju pokretlo/1). Wartość to rzecz rodzaju wartosc/1 w zasięgu, którym jest dowolna rzecz;',
    'bez podanego zasięgu wartość dotyczy całego Miejsca. Zestaw (zestaw/1) to nazwany komplet wartości: motyw albo preset.',
    'Kolejność: wartość wprost w zasięgu, potem zestawy włączone w tym zasięgu (późniejszy na liście wygrywa), potem zasięg wyżej, na końcu wartość domyślna.',
    '',
  ];
  let grupa = null;
  for (const d of u.deklaracje) {
    if ((d.grupa || 'Inne') !== grupa) { grupa = d.grupa || 'Inne'; wiersze.push(grupa.toUpperCase()); }
    const x = u.wartosci[d.nazwa];
    const skad = x.skad === 'domyslna' ? 'domyślna' : x.skad === 'zestaw' ? `z zestawu "${x.zestaw}"` : `ustawiona wprost (rzecz ${x.rzecz})`;
    wiersze.push(`  ${d.nazwa} = ${pokaz(x.wartosc)}   [${d.typ}${d.jednostka ? ', ' + d.jednostka : ''}; ${skad}]`);
    wiersze.push(`      ${d.opis}${d.zakres ? ` Zakres suwaka: ${d.zakres.od} do ${d.zakres.do}.` : ''}${d.typ === 'wybor' ? ` Wartości: ${d.wartosci.join(', ')}.` : ''}`);
  }
  if (u.pominiete) wiersze.push('', 'POMINIĘTE (wartość nie przechodzi dzisiejszej deklaracji, więc nie dochodzi do twarzy):', ...u.pominiete.map((p) => `  ${p.pokretlo}: ${p.dlaczego} -> /rzecz/${p.rzecz}`));
  wiersze.push('',
    'JAK ZMIENIĆ (ten sam ruch co każdy inny; skutek albo propozycja zależy od obszaru, w którym leży zasięg):',
    `  POST ${origin}/api/srodowisko/ruch`,
    `  {"op":"<Twój identyfikator czynności>","co":"poloz","rodzaj":"wartosc/1","cechy":{"pokretlo":"wyglad.kolor.akcent","wartosc":"#336699"}}`,
    `  Zasięg inny niż całe Miejsce: dopisz "zasieg":"<id rzeczy>" (całe Miejsce to obszar główny${glowny ? ', id ' + glowny : ''}). Zmiana istniejącej wartości: ten sam ruch z "wersja" z odczytu albo "dowolna".`,
    '  Powrót do wartości odziedziczonej: co: odloz na rzeczy wartości. Poprzednia wartość: co: cofnij. Historia: /rzecz/<id wartości>.',
    '  Nowe pokrętło: rzecz rodzaju pokretlo/1 (nazwa, typ, domyslna, opis; kształt: /rodzaj/pokretlo/1).',
    '  Zestaw: rzecz rodzaju zestaw/1 z cechą wartosci {nazwa pokrętła: wartość}; włączenie w zasięgu: wartość pokrętła srodowisko.zestawy = [id zestawu, …].',
    `Jako dane: ${origin}/api/srodowisko/ustawienia?dla=<id rzeczy>&deklaracje=tak   Typy wartości:`,
    ...Object.entries(TYPY_POKRETEL).map(([t, o]) => `  ${t}: ${o}`),
    '');
  return wiersze.join('\n');
}
