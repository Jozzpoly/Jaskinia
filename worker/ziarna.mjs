// Zasiew środowiska: rzeczy, bez których Miejsce nie umie opisać samego siebie (17 XI 2026). Status: próba.
// To są DANE, nie kod: po zasianiu każdą z tych rzeczy zmienia się ruchem, a zasiew jej nie nadpisze.
// Kolejność ma znaczenie: najpierw kształt kształtu, potem kształty, potem rzeczy tych rodzajów.
import { STOPNIE, UWAGI, WIDZI, UKLADA, szybkiOdcisk } from './srodowisko.mjs';
import { TYPY_POKRETEL, POKRETLO_ZESTAWOW } from './ustawienia.mjs';
import { TYPY_PLIKOW } from './pliki.mjs';
import { POKRETLA } from '../public/pokretla.mjs';

const k = (nazwa, cechy) => ({ nazwa: 'ksztalt-' + nazwa, rodzaj: 'ksztalt/1', cechy });
// Etapy budowy, w tej kolejności: grunt ma być solidny, zanim staną ściany; wykończenie jest na końcu; tworzenie jest
// celem. Każda zdolność mówi, na którym etapie jest potrzebna, żeby stan budowy pokazywał też, czego brakuje i kiedy.
export const ETAPY = [
  { id: 'grunt', nazwa: 'Etap 1, grunt', opis: 'środowisko pod dom i jego mieszkańców: pamięć, tożsamość, prawa, drzwi, umowy i fakty, które odświeżają się same. Ma być solidny, zanim cokolwiek na nim stanie.' },
  { id: 'sciany-i-kable', nazwa: 'Etap 2, ściany i kable', opis: 'organy jako konstrukcja (Start, okna, narzędzia), połączenia z agentami i światem, sprawdzenie, czy grunt unosi szerokie wymagania.' },
  { id: 'wykonczenie', nazwa: 'Etap 3, wykończenie', opis: 'ręka i oko, wygląd, przytulność i treść w środku. Na końcu, po podstawach.' },
  { id: 'tworzenie', nazwa: 'Etap 4, tworzenie', opis: 'wspólne budowanie światów w środku: to, po co jest całe Miejsce.' },
];
// Zdolności, które stały przed podziałem na etapy, a nie należą do gruntu.
const ETAP_DAWNYCH = { start: 'sciany-i-kable', 'wolanie-czasownikow': 'sciany-i-kable', 'najety-mozg': 'sciany-i-kable', 'licznik-przeniesienia': 'wykonczenie' };
const zd = (nazwa, stan, opis, jak, etap) => ({ nazwa: 'zdolnosc-' + nazwa, rodzaj: 'zdolnosc/1', cechy: { nazwa: opis.split(':')[0], stan, opis: opis.split(':').slice(1).join(':').trim(), ...(jak ? { jak } : {}), etap: etap || ETAP_DAWNYCH[nazwa] || 'grunt' } });

// Wygląd od gospodarza (wiadomość look): narzędzie ubiera się w motyw Miejsca w biegu, bez przeładowania.
// Ten kawałek wchodzi do obu przykładowych gości; cudze narzędzie może go skopiować z /umowa-okna.
const GOSC_WYGLAD = `function ubierz(m) {
  const k = m.kolory || {}, s = document.documentElement.style, b = document.body.style;
  s.setProperty('color-scheme', m.ciemny ? 'dark' : 'light');
  // każda rola palety, także ta, której to narzędzie nie zna z nazwy, trafia do zmiennej --<rola>
  for (const rola of Object.keys(k)) if (/^[a-z][a-z0-9_]*$/.test(rola) && typeof k[rola] === 'string') s.setProperty('--' + rola, k[rola]);
  if (k.tlo) b.background = k.tlo;
  if (k.tekst) b.color = k.tekst;
  if (k.akcent) s.setProperty('accent-color', k.akcent);
  const kr = m.kroj && typeof m.kroj === 'object' ? m.kroj.tekst : null;
  if (kr && typeof kr.rodzina === 'string') {
    b.fontFamily = kr.rodzina;
    b.fontWeight = kr.grubosc ? String(kr.grubosc) : '';
    b.fontVariationSettings = kr.osie ? Object.keys(kr.osie).map((n) => '"' + n + '" ' + kr.osie[n]).join(', ') : '';
  }
}`;

// Przykładowy gość: jedna strona HTML, która rozmawia z gospodarzem umową okna (pokolenie 2).
export const GOSC_LISTA = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lista rzeczy</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 12px 14px; font: 15px/1.45 system-ui, sans-serif; }
  h1 { font-size: 1.05rem; margin: 0 0 2px; }
  #stan { margin: 0 0 10px; opacity: .7; font-size: .9rem; }
  h2 { font-size: .8rem; letter-spacing: .04em; text-transform: uppercase; opacity: .6; margin: 14px 0 4px; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 5px 0; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
  small { opacity: .6; }
</style>
</head>
<body>
<h1>Lista rzeczy</h1>
<p id="stan">Czekam na gospodarza…</p>
<div id="lista"></div>
<script>
// Gość Jaskini: przykład umowy okna, pokolenie 2. Pełny opis umowy: adres /umowa-okna.
// Cała rozmowa idzie przez postMessage z oknem, które tę stronę otworzyło. Gość nie ma sieci ani pamięci.
const gospodarz = window.parent;
let nr = 0;
const czekaja = new Map();
const powiedz = (m) => gospodarz.postMessage({ jaskinia: 1, ...m }, '*');
function czytaj(what, wiecej) {
  return new Promise((tak, nie) => {
    const id = ++nr;
    czekaja.set(id, { tak, nie });
    powiedz({ type: 'read', id, what, ...wiecej });
    setTimeout(() => { if (czekaja.delete(id)) nie(new Error('gospodarz nie odpowiedział')); }, 8000);
  });
}
${GOSC_WYGLAD}
addEventListener('message', (e) => {
  const m = e.data;
  if (e.source !== gospodarz || !m || m.jaskinia !== 1) return;
  if (m.type === 'hi') { powiedz({ type: 'hello', name: 'Lista rzeczy', version: '1', wants: ['rzeczy'] }); pokaz(); }
  else if (m.type === 'result') { const c = czekaja.get(m.id); if (c) { czekaja.delete(m.id); if (m.ok) c.tak(m.data); else c.nie(new Error(m.error)); } }
  else if (m.type === 'changed') pokaz();
  else if (m.type === 'look') ubierz(m);
});
async function pokaz() {
  const stan = document.getElementById('stan');
  try {
    const d = await czytaj('spis', {});
    const grupy = new Map();
    for (const r of d.rzeczy) { if (!grupy.has(r.rodzaj)) grupy.set(r.rodzaj, []); grupy.get(r.rodzaj).push(r); }
    const lista = document.getElementById('lista');
    lista.textContent = '';
    for (const [rodzaj, rzeczy] of [...grupy].sort((a, b) => a[0].localeCompare(b[0]))) {
      const h = document.createElement('h2'); h.textContent = rodzaj + ' (' + rzeczy.length + ')'; lista.append(h);
      const ul = document.createElement('ul');
      for (const r of rzeczy) { const li = document.createElement('li'); li.textContent = r.tytul + ' '; const s = document.createElement('small'); s.textContent = r.id.slice(0, 6); li.append(s); ul.append(li); }
      lista.append(ul);
    }
    stan.textContent = d.rzeczy.length + ' rzeczy, ' + grupy.size + ' rodzajów';
    powiedz({ type: 'state', text: d.rzeczy.length + ' rzeczy na liście' });
  } catch (err) { stan.textContent = 'Nie udało się: ' + err.message; }
}
powiedz({ type: 'hello', name: 'Lista rzeczy', version: '1', wants: ['rzeczy'] });
</script>
</body>
</html>
`;

const GOSC_SLOWA = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Słowa</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 12px 14px; font: 15px/1.45 system-ui, sans-serif; }
  h1 { font-size: 1.05rem; margin: 0 0 2px; }
  #stan { margin: 0 0 10px; opacity: .75; font-size: .9rem; }
  #wynik { margin: 0; font-size: .9rem; min-height: 1.3em; }
  #nowe { display: grid; gap: 6px; margin: 0 0 12px; }
  select, textarea, button { font: inherit; font-size: 16px; padding: 6px 8px; }
  textarea { min-height: 3.4rem; }
  button { justify-self: start; min-height: 44px; padding: 6px 14px; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 6px 0; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
  small { opacity: .65; }
</style>
</head>
<body>
<h1>Słowa</h1>
<p id="stan">Czekam na gospodarza…</p>
<div id="nowe">
  <select id="przy" aria-label="Przy której rzeczy"></select>
  <textarea id="tresc" aria-label="Twoje słowo" placeholder="Słowo przy tej rzeczy"></textarea>
  <button type="button" id="zostaw">Zostaw słowo</button>
  <p id="wynik" role="status"></p>
</div>
<ul id="lista"></ul>
<script>
// Gość Jaskini, który pisze: przykład umowy okna, pokolenie 3 (ruch z okna). Pełny opis: adres /umowa-okna.
// Ruch zapisuje się pod imieniem tego gościa, nie tego, kto otworzył okno. Tam, gdzie gościowi wolno tylko
// proponować, wynik to {skutek: "propozycja"}: czeka na właściciela i to jest poprawny wynik, nie błąd.
const gospodarz = window.parent;
let nr = 0;
const czekaja = new Map();
const powiedz = (m) => gospodarz.postMessage({ jaskinia: 1, ...m }, '*');
function zapytaj(typ, wiecej, ms) {
  return new Promise((tak, nie) => {
    const id = ++nr;
    czekaja.set(id, { tak, nie });
    powiedz({ type: typ, id, ...wiecej });
    setTimeout(() => { if (czekaja.delete(id)) nie(new Error('gospodarz nie odpowiedział')); }, ms);
  });
}
const czytaj = (what, wiecej) => zapytaj('read', { what, ...wiecej }, 8000);
const rusz = (move) => zapytaj('move', { move }, 15000);
const stan = document.getElementById('stan'), wynik = document.getElementById('wynik');
const ile = (n) => n + (n === 1 ? ' słowo' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? ' słowa' : ' słów'));
${GOSC_WYGLAD}
addEventListener('message', (e) => {
  const m = e.data;
  if (e.source !== gospodarz || !m || m.jaskinia !== 1) return;
  if (m.type === 'hi') { powiedz({ type: 'hello', name: 'Słowa', version: '1', wants: ['rzeczy'] }); pokaz(); }
  else if (m.type === 'result') { const c = czekaja.get(m.id); if (c) { czekaja.delete(m.id); if (m.ok) c.tak(m.data); else c.nie(new Error(m.error)); } }
  else if (m.type === 'changed') pokaz();
  else if (m.type === 'look') ubierz(m);
});
async function pokaz() {
  try {
    const [slowa, rzeczy] = await Promise.all([czytaj('spis', { rodzaj: 'slowo' }), czytaj('spis', {})]);
    const tytuly = new Map(rzeczy.rzeczy.map((r) => [r.id, r.tytul]));
    const przy = document.getElementById('przy');
    const wybrane = przy.value;
    przy.textContent = '';
    for (const r of rzeczy.rzeczy.filter((x) => /^(projekt|repo|gosc|widok)\\//.test(x.rodzaj)).slice(0, 200)) {
      const o = document.createElement('option'); o.value = r.id; o.textContent = r.tytul + ' [' + r.rodzaj + ']'; przy.append(o);
    }
    if (wybrane) przy.value = wybrane;
    const lista = document.getElementById('lista');
    lista.textContent = '';
    for (const s of slowa.rzeczy.slice(0, 30)) {
      const li = document.createElement('li');
      li.textContent = s.cechy.tresc + ' ';
      const m = document.createElement('small');
      // autor: narzędzie stoi w dzienniku pod imieniem gosc-<id swojej rzeczy>, więc pokazujemy jego nazwę
      const autor = s.utworzyl.startsWith('gosc-') && tytuly.get(s.utworzyl.slice(5)) ? 'narzędzie ' + tytuly.get(s.utworzyl.slice(5)) : s.utworzyl;
      m.textContent = 'przy: ' + (s.cechy.dotyczy || []).map((id) => tytuly.get(id) || id.slice(0, 6)).join(', ') + ' · ' + autor;
      li.append(m); lista.append(li);
    }
    stan.textContent = ile(slowa.razem) + ' w Miejscu';
    powiedz({ type: 'state', text: ile(slowa.razem) });
  } catch (err) { stan.textContent = 'Nie udało się przeczytać: ' + err.message; }
}
// Zwykły guzik, nie formularz: w piaskownicy gościa formularze są wyłączone, więc zdarzenie submit by nie przyszło.
document.getElementById('zostaw').addEventListener('click', async () => {
  const tresc = document.getElementById('tresc'), przy = document.getElementById('przy').value;
  if (!tresc.value.trim() || !przy) { wynik.textContent = 'Wybierz rzecz i wpisz słowo.'; return; }
  try {
    const w = await rusz({ co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: tresc.value.trim(), dotyczy: [przy] } });
    tresc.value = '';
    // zdanie o skutku ma własne miejsce: lista odświeża się sama po każdej zmianie i nie może go zamazać
    wynik.textContent = w.skutek === 'propozycja' ? 'Poszło jako propozycja (' + (w.powod || 'czeka na właściciela') + ').' : 'Zapisane pod imieniem tego narzędzia.';
    pokaz();
  } catch (err) { wynik.textContent = 'Nie zapisało się: ' + err.message; }
});
powiedz({ type: 'hello', name: 'Słowa', version: '1', wants: ['rzeczy'] });
</script>
</body>
</html>
`;

// `uczestnicy` to imiona, które właściciel ustawił jako klucze. Od 17 XI 2026 prawa bierze się z rzeczy rodzaju
// uczestnik/1, więc imię bez takiej rzeczy nie jest uczestnikiem - dlatego zasiew musi je znać. W Workerze podaje
// je `_poznaj` z nagłówka zbudowanego z ustawienia KLUCZE; w sprawdzianie świat podaje je sam.
export function ziarna({ wlasciciel, uczestnicy = [] }) {
  return [
    ...uczestnicy.filter((i) => i && i !== wlasciciel).map((imie) => ({ nazwa: 'uczestnik-' + imie, rodzaj: 'uczestnik/1', cechy: { imie, rola: 'agent', opis: 'Uczestnik znany z klucza ustawionego przez właściciela.' } })),
    k('ksztalt', { dla: 'ksztalt/1', tytul: 'dla', opis: 'Kształt: opis rodzaju rzeczy, czyli jakie cechy ma rzecz tego rodzaju. Sam jest rzeczą, więc nowy rodzaj dokłada się ruchem, bez zmiany kodu.',
      cechy: {
        dla: { typ: 'tekst', wymagana: true, opis: 'rodzaj z pokoleniem, który ten kształt opisuje, np. postac/1' },
        opis: { typ: 'tekst', wymagana: true, opis: 'jedno zdanie: czym jest rzecz tego rodzaju' },
        cechy: { typ: 'dowolne', wymagana: true, opis: 'obiekt {nazwa cechy: {typ, opis, wymagana}}; może być pusty' },
        tytul: { typ: 'tekst', opis: 'nazwa cechy, która jest nazwą rzeczy; domyślnie cecha nazwa' },
        klucz: { typ: 'lista', z: 'tekst', opis: 'nazwy cech, z których liczy się tożsamość rzeczy: druga rzecz o tym samym kluczu nie powstanie' },
        uklad: { typ: 'tak-nie', opis: 'true, gdy rzeczy tego rodzaju są układaniem, a nie treścią; ustala to tylko właściciel' },
        lezy_z: { typ: 'tekst', opis: 'nazwa wymaganej cechy typu rzecz: rzecz tego rodzaju leży zawsze w obszarze rzeczy, na którą wskazuje ta cecha; ustala to tylko właściciel' },
      } }),
    k('obszar', { dla: 'obszar/1', tytul: 'nazwa', opis: 'Obszar: miejsce z własnymi ustawieniami. Rzecz leży w jednym obszarze, obszar może leżeć w obszarze. Pole na Starcie to obszar z wyglądem.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        opis: { typ: 'tekst' },
        ile_wolno: { typ: 'wybor', wartosci: STOPNIE, opis: 'ile wolno tu agentom: nic, proponować, porządkować (tylko układ), prowadzić samodzielnie' },
        uwaga: { typ: 'wybor', wartosci: UWAGI, opis: 'ile uwagi właściciela: cisza, skrót co jakiś czas, znak, budzi' },
        widzi: { typ: 'wybor', wartosci: WIDZI, opis: 'kto widzi: właściciel, uczestnicy z kluczem, wszyscy' },
        uklada: { typ: 'wybor', wartosci: UKLADA, opis: 'kto układa rzeczy: ręka właściciela, reguła, agent' },
      } }),
    k('poswiadczenie', { dla: 'poswiadczenie/1', tytul: 'nazwa', opis: 'Poświadczenie (passkey) właściciela: czym wchodzi do Miejsca jednym dotknięciem. Zapisany jest tylko klucz publiczny i identyfikator poświadczenia; klucz prywatny nie opuszcza urządzenia.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true, opis: 'czym to jest w jego słowach, np. "telefon" albo "laptop"' },
        imie: { typ: 'tekst', wymagana: true, opis: 'uczestnik, którego to poświadczenie; dziś zawsze właściciel' },
        poswiadczenie: { typ: 'tekst', wymagana: true, opis: 'identyfikator poświadczenia (base64url), ten sam, który podaje przeglądarka' },
        klucz_publiczny: { typ: 'tekst', wymagana: true, opis: 'klucz publiczny jako surowy punkt P-256 (base64url); nie jest sekretem' },
        licznik: { typ: 'liczba', opis: 'ostatni licznik podpisów z authenticatora; wiele urządzeń zawsze podaje 0' },
        nazwa_strony: { typ: 'tekst', wymagana: true, opis: 'host, dla którego poświadczenie powstało; dokładny, nigdy domena nadrzędna' },
        dodano: { typ: 'czas', opis: 'kiedy właściciel je założył' },
        uzyte: { typ: 'czas', opis: 'kiedy weszło ostatni raz' },
        // Trzy cechy od 19 XI 2026 (niezależny atak na drzwi): niewymagane, więc to ten sam rodzaj w tym samym pokoleniu.
        skrot: { typ: 'tekst', opis: 'skrót SHA-256 identyfikatora poświadczenia (base64url); tym skrótem sesja mówi, czym ją otwarto' },
        pieczec: { typ: 'tekst', opis: 'pieczęć drzwi: podpis Miejsca na imieniu, identyfikatorze i kluczu publicznym, przybity przy założeniu; poświadczenie bez niej drzwi nie otwiera' },
        pokolenie: { typ: 'liczba', opis: 'pokolenie wyjść: krok wyjdz podbija je, więc sesje otwarte tym poświadczeniem wcześniej przestają działać' },
      } }),
    k('uczestnik', { dla: 'uczestnik/1', tytul: 'imie', opis: 'Uczestnik: ktoś, kto robi ruchy. Imię jest tym samym, pod którym właściciel ustawił jego klucz.',
      cechy: {
        imie: { typ: 'tekst', wymagana: true },
        rola: { typ: 'wybor', wartosci: ['wlasciciel', 'agent', 'automat'], wymagana: true },
        cialo: { typ: 'tekst', opis: 'czym ten uczestnik zwykle działa (jego własny opis, nie dowód)' },
        opis: { typ: 'tekst' },
      } }),
    k('propozycja', { dla: 'propozycja/1', tytul: 'rodzaj', opis: 'Propozycja: ruch uczestnika, który nie ma prawa do skutku. Leży tam, gdzie rzecz, której dotyczy, i czeka, aż ktoś z prawem ją przyjmie albo odrzuci.',
      cechy: {
        od: { typ: 'tekst', wymagana: true, opis: 'kto proponuje' },
        przez: { typ: 'tekst', opis: 'gdy proponuje gość z okna: kto otworzył to okno' },
        co: { typ: 'wybor', wartosci: ['poloz', 'odloz', 'przywroc', 'cofnij'], wymagana: true },
        rodzaj: { typ: 'tekst', wymagana: true, opis: 'rodzaj rzeczy, której dotyczy ruch' },
        tresc: { typ: 'dowolne', wymagana: true, opis: '{obszar, cechy}: to, co ruch chciał zapisać' },
        rzecz: { typ: 'rzecz', opis: 'zmieniana rzecz; brak, gdy propozycja dokłada nową' },
        nowa: { typ: 'tekst', opis: 'identyfikator, który dostanie nowa rzecz po przyjęciu' },
        wersja: { typ: 'liczba', opis: 'wersja zmienianej rzeczy z chwili propozycji' },
        wymaga: { typ: 'wybor', wartosci: ['wlasciciel'], opis: 'gdy ruch dotyczy czegoś, co zmienia tylko właściciel: przyjąć może tylko on' },
        przypiete: { typ: 'dowolne', opis: '{id zestawu: wersja} z chwili propozycji, gdy ruch włącza zestawy: przyjęcie odmawia, jeśli któryś zmienił się potem' },
        stan: { typ: 'wybor', wartosci: ['czeka', 'przyjeta', 'odrzucona', 'wycofana', 'wygasla'], wymagana: true },
        powod: { typ: 'tekst' },
        rozstrzygnal: { typ: 'tekst' },
        rozstrzygnieto: { typ: 'czas' },
        wynik: { typ: 'rzecz', opis: 'rzecz, która powstała albo zmieniła się po przyjęciu' },
      } }),
    k('prosba', { dla: 'prosba/1', tytul: 'tresc', opis: 'Prośba do właściciela: coś, co czeka na jego słowo albo decyzję.',
      cechy: {
        tresc: { typ: 'tekst', wymagana: true },
        dotyczy: { typ: 'lista', z: 'rzecz', opis: 'rzeczy, których prośba dotyczy' },
        tryb: { typ: 'wybor', wartosci: ['czeka', 'budzi'], opis: 'czeka: może poczekać; budzi: potrzebna szybko' },
        stan: { typ: 'wybor', wartosci: ['czeka', 'zalatwiona'], wymagana: true },
        odpowiedz: { typ: 'tekst' },
      } }),
    k('slowo', { dla: 'slowo/1', tytul: 'tresc', opis: 'Słowo przy rzeczy: uwaga albo odpowiedź zostawiona przy jednej albo kilku rzeczach.',
      cechy: {
        tresc: { typ: 'tekst', wymagana: true },
        dotyczy: { typ: 'lista', z: 'rzecz', wymagana: true },
        odpowiada_na: { typ: 'rzecz', rodzaj: 'slowo' },
        oko: { typ: 'dowolne', opis: 'stan oka, gdy słowo zostawiła ręka: {twarz, wersja (odcisk plików twarzy), akt (który twarz znała), widok, ekran {szer, wys, klasa, dotyk}, ciemny, bezpiecznie, stan (kamera, układ)}; położenia z tamtej chwili: /api/srodowisko/widok-w-chwili?widok=<widok>&akt=<akt>' },
      } }),
    k('gosc', { dla: 'gosc/1', tytul: 'nazwa', opis: 'Gość: organ albo narzędzie. Kod żyje poza jądrem: jako zapis podawany w piaskownicy (cecha kod) albo pod własnym adresem (cecha adres).',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        opis: { typ: 'tekst', wymagana: true, opis: 'co ten gość pokazuje albo robi' },
        kod: { typ: 'zapis', rodzaj: 'kod/1', opis: 'zapis rodzaju kod/1 z jednym plikiem HTML; powstaje przez POST /api/srodowisko/kod' },
        adres: { typ: 'adres', opis: 'adres strony, która żyje poza Jaskinią (np. gra)' },
        umowa: { typ: 'tekst', opis: 'pokolenie umowy okna, którym gość mówi: okno/2 (czyta rzeczy) albo okno/3 (czyta i pisze: ruch z okna pod własnym imieniem gościa)' },
        czasowniki: { typ: 'dowolne', opis: 'lista {nazwa, opis, wejscie, wynik}: co ten gość umie zrobić na prośbę' },
      } }),
    k('zdolnosc', { dla: 'zdolnosc/1', tytul: 'nazwa', opis: 'Zdolność środowiska: co ono już umie, co umie cienko, a czego jeszcze nie. Stan budowy mieszka tu, a nie w czyjejś głowie.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        stan: { typ: 'wybor', wartosci: ['stoi', 'cienko', 'brak'], wymagana: true },
        opis: { typ: 'tekst', wymagana: true },
        jak: { typ: 'tekst', opis: 'jak tego użyć albo czego brakuje' },
        dowod: { typ: 'tekst', opis: 'kto i jak to sprawdził' },
        etap: { typ: 'wybor', wartosci: ['grunt', 'sciany-i-kable', 'wykonczenie', 'tworzenie'], opis: 'na którym etapie budowy ta zdolność jest potrzebna: grunt (środowisko pod dom i jego mieszkańców), ściany i kable (organy jako konstrukcja i połączenia), wykończenie (ręka, oko, treść), tworzenie (wspólne budowanie światów)' },
      } }),
    k('projekt', { dla: 'projekt/1', tytul: 'nazwa', opis: 'Projekt: jedno z dzieł właściciela (gra, lab, narzędzie). Nie musi mieć repozytorium.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        opis: { typ: 'tekst' },
        zrodlo: { typ: 'adres', opis: 'gdzie leży źródło, np. repozytorium' },
        zagraj: { typ: 'adres', opis: 'adres, pod którym da się to uruchomić' },
        zycie: { typ: 'czas', opis: 'ostatnia zmiana u źródła' },
        stan_na: { typ: 'czas', opis: 'kiedy te fakty zebrano' },
      } }),
    k('relacja', { dla: 'relacja/1', tytul: 'jaka', opis: 'Relacja: nazwane powiązanie dwóch rzeczy. Sama jest rzeczą, więc ma adres i da się przy niej zostawić słowo.',
      cechy: {
        skad: { typ: 'rzecz', wymagana: true },
        dokad: { typ: 'rzecz', wymagana: true },
        jaka: { typ: 'tekst', wymagana: true, opis: 'np. wersja-czego, nalezy-do-rodziny, robi-to-samo-co, pochodzi-z' },
        opis: { typ: 'tekst' },
      } }),
    k('miara', { dla: 'miara/1', tytul: 'nazwa', opis: 'Miara: jedna liczba o świecie na zewnątrz Miejsca, z datą i źródłem (np. ile rzeczy właściciela jeszcze nie jest w środku).',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        wartosc: { typ: 'liczba', wymagana: true },
        stan_na: { typ: 'czas', wymagana: true },
        zrodlo: { typ: 'tekst', opis: 'skąd liczba pochodzi i jak ją powtórzyć' },
      } }),
    k('widok', { dla: 'widok/1', tytul: 'nazwa', opis: 'Widok: nazwane ułożenie rzeczy w przestrzeni (np. Start). Sam widok nie trzyma położeń: każde położenie jest osobną rzeczą rodzaju miejsce, więc ma własną historię i autora. Widok leży w obszarze, a jego ustawienia mówią, kto może w nim układać.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        opis: { typ: 'tekst' },
      } }),
    k('miejsce', { dla: 'miejsce/1', klucz: ['widok', 'rzecz'], uklad: true, lezy_z: 'widok', opis: 'Miejsce rzeczy w widoku: gdzie leży i jak duża jest z ręki. Jedna rzecz ma w jednym widoku jedno miejsce (klucz: widok i rzecz), więc każde przesunięcie jest nową wersją tego samego miejsca, a historia mówi, kto i kiedy ją tam położył. Rzecz bez miejsca leży w siatce domyślnej widoku. Miejsce leży zawsze w obszarze swojego widoku (lezy_z), więc to ustawienie tego obszaru mówi, czy agent układa sam, czy proponuje; to jest układanie, nie treść (uklad).',
      cechy: {
        widok: { typ: 'rzecz', rodzaj: 'widok/1', wymagana: true },
        rzecz: { typ: 'rzecz', wymagana: true, opis: 'rzecz, która tu leży' },
        x: { typ: 'liczba', wymagana: true, opis: 'środek rzeczy w jednostkach świata (karta ma 240 na 150)' },
        y: { typ: 'liczba', wymagana: true },
        skala: { typ: 'liczba', opis: 'mnożnik wielkości z ręki, od 0.4 do 4; bez niej 1' },
      } }),
    k('okno', { dla: 'okno/1', tytul: 'nazwa', klucz: ['czyje', 'gosc'], opis: 'Okno: narzędzie otwarte przez jednego uczestnika. Mówi, które narzędzie, z czym, czy jest otwarte, a gdy twarz układa okna w przestrzeni, także gdzie i jak duże. Wraca po przeładowaniu strony i na drugim urządzeniu. Jest też zasięgiem: wartość pokrętła z zasięgiem okna zmienia wygląd tylko w nim.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        czyje: { typ: 'tekst', wymagana: true, opis: 'imię uczestnika, którego to okno; okno kładzie i zmienia tylko on sam, swoim kluczem' },
        gosc: { typ: 'rzecz', rodzaj: 'gosc', wymagana: true, opis: 'narzędzie otwarte w tym oknie' },
        z_czym: { typ: 'rzecz', opis: 'rzecz, przy której narzędzie otwarto' },
        otwarte: { typ: 'tak-nie', wymagana: true },
        wersja_goscia: { typ: 'liczba', opis: 'wersja narzędzia z chwili otwarcia; strona wraca do okna sama tylko wtedy, gdy narzędzie od tego czasu się nie zmieniło' },
        zwiniete: { typ: 'tak-nie' },
        x: { typ: 'liczba' }, y: { typ: 'liczba' }, szer: { typ: 'liczba' }, wys: { typ: 'liczba' },
      } }),
    k('plik', { dla: 'plik/1', tytul: 'nazwa', opis: 'Plik: duża treść (krój pisma, obraz, dźwięk), której bajty leżą poza rzeczą jako niezmienny zapis. Rzecz niesie wskazanie: odcisk zapisu (cecha tresc), typ i rozmiar. Treść pliku jest niezmienna: nowe bajty to nowy plik, zmieniać można nazwę i opis; kto wskazuje plik razem z odciskiem, dostaje zawsze te same bajty, także po odłożeniu pliku. Bajty: GET /api/srodowisko/bajty?rzecz=<id>.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        typ: { typ: 'wybor', wymagana: true, wartosci: Object.keys(TYPY_PLIKOW), opis: 'typ treści; strony i obrazy ze skryptem nie są plikami (kod wchodzi jako gość)' },
        rozmiar: { typ: 'liczba', wymagana: true, opis: 'rozmiar w bajtach; musi się zgadzać z zapisem' },
        tresc: { typ: 'zapis', rodzaj: 'bajty/1', wymagana: true, opis: 'odcisk zapisu z bajtami; zapis powstaje przez POST /api/srodowisko/bajty?op=<identyfikator czynności> z bajtami w ciele żądania. Wskazać go może ten, kto go sam wgrał, albo ten, kto widzi plik, który już go niesie; cudzy odcisk brzmi jak zapis, którego nie ma' },
        opis: { typ: 'tekst', opis: 'skąd plik jest i na jakiej licencji' },
      } }),
    k('pokretlo', { dla: 'pokretlo/1', tytul: 'nazwa', klucz: ['nazwa'], opis: 'Pokrętło: deklaracja jednej rzeczy, którą da się stroić (kolor, czas ruchu, próg gestu). Mówi, jak się nazywa, jakiego jest typu, jaką ma wartość domyślną i co zmienia. Dokłada je każdy: twarz, narzędzie w oknie, agent. Wartości i wszystkie pokrętła naraz: /ustawienia.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true, opis: 'od dwóch do sześciu członów rozdzielonych kropką, np. wyglad.paleta.jasna.tlo; pierwszy człon mówi, czym to jest dla człowieka (wyglad, odczucie, nazwa narzędzia); nazwa jest tożsamością pokrętła' },
        typ: { typ: 'wybor', wymagana: true, wartosci: Object.keys(TYPY_POKRETEL), opis: 'typ wartości; co każdy znaczy: /ustawienia' },
        domyslna: { typ: 'dowolne', wymagana: true, opis: 'wartość, dopóki nikt pokrętła nie ruszył; może iść za innym pokrętłem tego samego typu: {"z": "<nazwa>"}' },
        opis: { typ: 'tekst', wymagana: true, opis: 'jedno zdanie o tym, co pokrętło zmienia; czyta je ręka i agent' },
        grupa: { typ: 'tekst', opis: 'gdzie stoi w oknie ustawień, np. Wygląd / Paleta jasna' },
        zakres: { typ: 'dowolne', opis: 'zakres suwaka {od, do, krok} dla liczby i czasu; podpowiedź, nie granica' },
        twarde: { typ: 'dowolne', opis: 'twarda klamra {od, do} dla liczby i czasu; chroni tylko przed rozpadem, wartość poza nią jest odrzucana' },
        wartosci: { typ: 'lista', z: 'tekst', opis: 'dozwolone wartości przy typie wybor' },
        jednostka: { typ: 'tekst', opis: 'np. px albo ×; czas jest zawsze w milisekundach' },
        dotyczy: { typ: 'lista', z: 'tekst', opis: 'których elementów twarzy dotyczy (np. karta, kamera, ciagniecie): twarz może pokazać te pokrętła przy elemencie' },
        zrodlo: { typ: 'tekst', opis: 'kto zadeklarował: twarz, narzędzie albo tablica pokręteł w kodzie' },
      } }),
    k('wartosc', { dla: 'wartosc/1', tytul: 'pokretlo', klucz: ['pokretlo', 'zasieg'], uklad: true, lezy_z: 'zasieg', opis: 'Wartość pokrętła w zasięgu. Zasięgiem jest dowolna rzecz: obszar (główny znaczy całe Miejsce), widok, okno, uczestnik, profil. Jedna wartość na parę pokrętło i zasięg, więc każda zmiana jest nową wersją z autorem, a cofnięcie wraca poprzednią. Leży tam, gdzie jej zasięg (gdy zasięgiem jest obszar: w nim), więc prawo do strojenia jest prawem obszaru.',
      cechy: {
        pokretlo: { typ: 'tekst', wymagana: true, opis: 'nazwa zadeklarowanego pokrętła' },
        zasieg: { typ: 'rzecz', wymagana: true, opis: 'rzecz, dla której wartość obowiązuje; pominięta przy zapisie znaczy obszar główny, czyli całe Miejsce' },
        wartosc: { typ: 'dowolne', wymagana: true, opis: 'wartość zgodna z typem pokrętła albo odwołanie {"z": "<nazwa pokrętła tego samego typu>"}' },
      } }),
    k('zestaw', { dla: 'zestaw/1', tytul: 'nazwa', opis: 'Zestaw: nazwany komplet wartości pokręteł, czyli motyw albo preset. Włącza się go w zasięgu wartością pokrętła srodowisko.zestawy (lista zestawów; późniejszy wygrywa). Zmiana zestawu dociera od razu wszędzie, gdzie jest włączony.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        opis: { typ: 'tekst' },
        po_co: { typ: 'wybor', wartosci: ['motyw', 'preset', 'inne'], opis: 'motyw (wygląd), preset (odczucie, zachowanie) albo inne; tylko do porządku w oknie ustawień' },
        wartosci: { typ: 'dowolne', wymagana: true, opis: 'obiekt {nazwa pokrętła: wartość}; każda wartość jest sprawdzana jak wartość wprost' },
      } }),
    k('profil', { dla: 'profil/1', tytul: 'nazwa', opis: 'Profil: nazwany zasięg ustawień bez własnej treści, np. to urządzenie albo ten sposób pracy. Wartości przypięte do profilu obowiązują tę twarz, która poda go jako nakładkę (ustawienia?nakladki=<id>).',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        opis: { typ: 'tekst' },
      } }),
    k('chwila', { dla: 'chwila/1', tytul: 'nazwa', uklad: true, lezy_z: 'widok', opis: 'Zapisany układ: nazwana chwila widoku. Pamięta tylko widok i numer aktu; powrót do niej (co: przywroc-uklad) ustawia położenia tak, jak wtedy leżały, i sam daje się cofnąć. Leży tam, gdzie jej widok.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        widok: { typ: 'rzecz', rodzaj: 'widok', wymagana: true, opis: 'widok, którego układ jest zapisany' },
        akt: { typ: 'liczba', wymagana: true, opis: 'numer aktu z chwili zapisu (pole akt z każdego odczytu)' },
        opis: { typ: 'tekst' },
      } }),
    // Warianty (19 XI 2026, jego presety, rejestr poz. 193 i 204): kopia pamięta, z czego powstała, a dowolna rzecz
    // może mieć nazwany punkt zapisu. Oba leżą z rzeczą, której dotyczą, więc widać je tam, gdzie widać ją samą.
    k('pochodzenie', { dla: 'pochodzenie/1', klucz: ['kopia'], lezy_z: 'kopia', opis: 'Pochodzenie kopii: z jakiej rzeczy i z której jej wersji kopia ostatnio wzięła treść. Kładzie je tylko ruch kopiuj, razem z kopią: ręką nikt, także właściciel (odłożyć i przywrócić wolno); z niego bierze się powrót kopii do dzisiejszej treści źródła (ruch domyslny) i znak, że źródło ma nowszą wersję. Kopia zrobiona do obszaru jawniejszego niż źródło (publikacja: tylko właściciel i tylko jawnie, z publikuj: true) pochodzenia nie dostaje, żeby nie zdradzało źródła.',
      cechy: {
        kopia: { typ: 'rzecz', wymagana: true, opis: 'kopia' },
        z: { typ: 'rzecz', wymagana: true, opis: 'rzecz, z której zrobiono kopię (domyślny)' },
        wersja: { typ: 'liczba', wymagana: true, opis: 'wersja źródła (numer aktu), z której kopia ostatnio wzięła treść' },
      } }),
    k('punkt', { dla: 'punkt/1', tytul: 'nazwa', lezy_z: 'czego', opis: 'Punkt zapisu: nazwana wersja dowolnej rzeczy (zestawu, widoku, czegokolwiek), do której wraca się jednym ruchem (co: wroc-do-punktu). Rzecz sama trzyma całą swoją historię; punkt pamięta tylko, która wersja była ciekawa.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        czego: { typ: 'rzecz', wymagana: true, opis: 'rzecz, której wersję punkt zapamiętuje' },
        wersja: { typ: 'liczba', wymagana: true, opis: 'wersja tej rzeczy (pole wersja z odczytu, numer aktu)' },
        opis: { typ: 'tekst' },
      } }),
    k('rodzina', { dla: 'rodzina/1', tytul: 'nazwa', klucz: ['znak'], opis: 'Rodzina projektów: pytanie, wokół którego krąży kilka repozytoriów. Fakt przyniesiony przez obserwatora ze starej Jaskini.',
      cechy: {
        znak: { typ: 'tekst', wymagana: true, opis: 'krótki identyfikator rodziny w pliku faktów starej Jaskini, np. zywe; z niego liczy się tożsamość rzeczy' },
        nazwa: { typ: 'tekst', wymagana: true },
        pytanie: { typ: 'tekst', opis: 'pytanie, wokół którego krąży rodzina' },
        stan_na: { typ: 'czas', wymagana: true, opis: 'jak stare są te fakty: chwila zebrania pliku, z którego pochodzą' },
      } }),
    // Klucz repozytorium to pełna nazwa małymi literami (<właściciel>/<nazwa>), nie numer z GitHuba: dwa źródła faktów
    // (API GitHuba i plik starej Jaskini) znają nazwę, a numer zna tylko API. Cena: zmiana nazwy u źródła to dziś NOWA
    // rzecz, a stara zostaje odłożona (znane ograniczenie, TYMCZASOWE.md). Numer zostaje zwykłą cechą.
    // tytul zostaje 'nazwa': kształt ma jedną cechę tytułu i musi ona być zawsze wypełniona, a ladna_nazwa (z pliku) bywa pusta;
    // stronę gospodarza uczy się brać ladna_nazwa, gdy jest.
    k('repo', { dla: 'repo/1', tytul: 'nazwa', klucz: ['pelna_nazwa'], opis: 'Repozytorium na GitHubie: fakt przyniesiony przez obserwatora (z API GitHuba albo z pliku faktów starej Jaskini), nie dzieło.',
      cechy: {
        pelna_nazwa: { typ: 'tekst', wymagana: true, opis: '<właściciel>/<nazwa> małymi literami; z tego liczy się tożsamość rzeczy, więc to samo repozytorium z dwóch źródeł trafia w jedną rzecz' },
        github_id: { typ: 'liczba', opis: 'numer repozytorium na GitHubie, gdy źródło go zna (API tak, plik starej Jaskini nie)' },
        nazwa: { typ: 'tekst', wymagana: true },
        adres: { typ: 'adres', wymagana: true, opis: 'strona repozytorium' },
        opis: { typ: 'tekst' },
        strona: { typ: 'adres', opis: 'gdzie da się to uruchomić, gdy repozytorium ma stronę' },
        jezyk: { typ: 'tekst' },
        archiwum: { typ: 'tak-nie' },
        ostatni_push: { typ: 'czas' },
        utworzone: { typ: 'czas' },
        galezie: { typ: 'liczba', opis: 'ile gałęzi widział obserwator; brak, gdy jeszcze ich nie sprawdził' },
        ladna_nazwa: { typ: 'tekst', opis: 'nazwa dla ludzi, z pliku faktów starej Jaskini' },
        tozsamosc: { typ: 'tekst', opis: 'jedno zdanie: czym to jest (z pliku faktów starej Jaskini)' },
        rodzina: { typ: 'rzecz', rodzaj: 'rodzina/1', opis: 'rodzina projektów, do której repozytorium należy według pliku starej Jaskini' },
        zycie: { typ: 'tekst', opis: 'jak żywe jest repozytorium według pliku starej Jaskini, np. żywe, stygnące' },
        commity: { typ: 'liczba', opis: 'ile commitów według pliku starej Jaskini (na chwilę jego zebrania)' },
        stos: { typ: 'lista', z: 'tekst', opis: 'technologie według pliku starej Jaskini' },
        karta: { typ: 'tak-nie', opis: 'prawda tylko dla gier, które mają się otwierać w osobnej karcie (ramka dzieli pamięć gry); z pliku starej Jaskini' },
        wejscie: { typ: 'tekst', opis: 'jedno zdanie o wejściu, np. dlaczego nie ma guzika albo co trzeba wiedzieć przed grą (z pliku starej Jaskini, do 600 znaków)' },
        zrodlo_faktow: { typ: 'tekst', opis: 'skąd są te fakty: GitHub API, plik faktów starej Jaskini albo oba' },
        stan_na: { typ: 'czas', wymagana: true, opis: 'jak stare są te fakty: chwila zebrania u źródła (dla API chwila obejścia, dla pliku jego estate.generated)' },
      } }),
    k('galaz', { dla: 'galaz/1', tytul: 'nazwa', klucz: ['repo', 'nazwa'], opis: 'Gałąź repozytorium: fakt przyniesiony przez obserwatora.',
      cechy: {
        repo: { typ: 'rzecz', rodzaj: 'repo/1', wymagana: true },
        nazwa: { typ: 'tekst', wymagana: true },
        commit: { typ: 'tekst', opis: 'skrót ostatniego commita' },
        kiedy: { typ: 'czas', opis: 'kiedy był ostatni commit tej gałęzi (z pliku faktów starej Jaskini)' },
        temat: { typ: 'tekst', opis: 'temat ostatniego commita, obcięty do 200 znaków (z pliku faktów starej Jaskini)' },
        stan_na: { typ: 'czas', wymagana: true, opis: 'jak stare są te fakty: chwila zebrania u źródła' },
      } }),
    { nazwa: 'obszar-glowny', rodzaj: 'obszar/1', meta: 'obszar_glowny', cechy: { nazwa: 'Miejsce', opis: 'Obszar główny. Jego ustawienia obowiązują wszędzie tam, gdzie obszar nie mówi inaczej.', ile_wolno: 'proponowac', uwaga: 'znak', widzi: 'uczestnicy', uklada: 'reka' } },
    { nazwa: 'obszar-nowe', rodzaj: 'obszar/1', meta: 'obszar_nowe', cechy: { nazwa: 'Nowe', opis: 'Tu lądują rzeczy dołożone przez agentów i automaty, gdy nie wskażą obszaru. Agenci prowadzą tu sami; właściciel przenosi stąd rzeczy tam, gdzie chce.', ile_wolno: 'prowadzic', uwaga: 'znak' } },
    // Obszar drzwi: leżą tu poświadczenia (passkeye) właściciela. Zamknięty z obu stron - agenci nie mają tu
    // nic do roboty, a identyfikator poświadczenia jest uchwytem, więc nie wychodzi nawet jako nazwa.
    { nazwa: 'obszar-drzwi', rodzaj: 'obszar/1', meta: 'obszar_drzwi', cechy: { nazwa: 'Drzwi', opis: 'Poświadczenia, którymi właściciel wchodzi jednym dotknięciem (passkey). Leży tu sam klucz PUBLICZNY; klucz prywatny nie opuszcza jego telefonu.', ile_wolno: 'nic', uwaga: 'cisza', widzi: 'wlasciciel' } },
    { nazwa: 'obszar-fakty', rodzaj: 'obszar/1', meta: 'obszar_fakty', cechy: { nazwa: 'Fakty', opis: 'Rzeczy w tym obszarze przynosi obserwator: to fakty z zewnątrz (repozytoria, gałęzie i rodziny projektów: z GitHuba albo z pliku starej Jaskini), nie dzieła właściciela. Obserwator prowadzi tu sam; właściciel je czyta.', ile_wolno: 'prowadzic', uwaga: 'cisza' } },
    { nazwa: 'uczestnik-wlasciciel', rodzaj: 'uczestnik/1', cechy: { imie: wlasciciel, rola: 'wlasciciel', opis: 'Właściciel Miejsca. Jego ruchy zawsze mają skutek; nieodwracalne decyzje należą tylko do niego.' } },
    { nazwa: 'uczestnik-srodowisko', rodzaj: 'uczestnik/1', cechy: { imie: 'srodowisko', rola: 'automat', opis: 'Samo środowisko: zasiewa rzeczy, bez których nie umie opisać siebie.' } },
    { nazwa: 'uczestnik-obserwator', rodzaj: 'uczestnik/1', cechy: { imie: 'obserwator', rola: 'automat', opis: 'Przynosi fakty z GitHuba (publiczne repozytoria i ich gałęzie) albo, gdy GitHub odmawia, z pliku faktów starej Jaskini. Nikt nie ma jego klucza: imię jest zastrzeżone, więc z zewnątrz nie da się pod nim robić ruchów.' } },
    zd('rzeczy', 'stoi', 'Rzeczy z tożsamością i historią: każda rzecz ma identyfikator niezależny od nazwy i repozytorium, adres /rzecz/<id> i zapis każdej zmiany z autorem.'),
    zd('ksztalty', 'stoi', 'Rodzaj jako dana: nowy rodzaj rzeczy dokłada się ruchem (rzecz rodzaju ksztalt/1); sprawdzanie jest przy zapisie, nieznana cecha zostaje zachowana.'),
    // Pierwsze pokrętła: jedna tablica (public/pokretla.mjs), z której twarz bierze wartości domyślne, a zasiew rzeczy.
    { nazwa: 'pokretlo-' + POKRETLO_ZESTAWOW, rodzaj: 'pokretlo/1', cechy: { nazwa: POKRETLO_ZESTAWOW, typ: 'zestawy', domyslna: [], grupa: 'Zestawy', opis: 'Które zestawy (motywy, presety) są włączone w tym zasięgu; późniejszy na liście wygrywa. Lista nie dziedziczy się: każdy zasięg włącza swoje.', zrodlo: 'środowisko' } },
    { nazwa: 'pokretlo-srodowisko.twarz_domyslna', rodzaj: 'pokretlo/1', cechy: { nazwa: 'srodowisko.twarz_domyslna', typ: 'wybor', wartosci: ['gospodarz', 'start'], domyslna: 'gospodarz', grupa: 'Środowisko', opis: 'Która twarz otwiera się pod głównym adresem: strona gospodarza (zaplecze) albo Start. Przełączenie jest zwykłą wartością: ma autora, historię i cofnięcie; pod adresem /?zostan zawsze zostaje strona gospodarza.' } },
    ...POKRETLA.map((d) => ({ nazwa: 'pokretlo-' + d.nazwa, rodzaj: 'pokretlo/1', cechy: { ...d, zrodlo: 'tablica pokręteł (public/pokretla.mjs)' } })),
    zd('trasa', 'stoi', 'Trasa: jedno żądanie do drzwi i rzecz jest w Miejscu, widać ją w spisie i zostaje.'),
    zd('samowyjasnianie', 'stoi', 'Samowyjaśnianie pod adresem: /co-tu-jest mówi gołym tekstem, co tu jest, co się zmieniło, co komu wolno i jak coś dołożyć; powstaje z danych.'),
    zd('obszary', 'cienko', 'Obszary i prawo do skutku z danych: ten sam ruch daje skutek, propozycję albo odmowę zależnie od ustawienia obszaru.', 'Działa ile_wolno, liczone w obszarze, w którym rzecz leży, i w tym, do którego trafia, oraz widzi (osobna zdolność: widocznosc). Ustawienia uwaga i uklada są zapisane, ale nic jeszcze z nich nie wynika. Wszyscy agenci mają w obszarze to samo prawo.'),
    zd('uczestnicy', 'cienko', 'Uczestnicy z danych: kto ma tu prawa, mówi rzecz rodzaju uczestnik/1, którą właściciel widzi i zmienia w Miejscu; klucz w ustawieniu Workera dowodzi tylko, KIM ktoś jest.', 'Rola (agent albo automat) jest cechą tej rzeczy; roli właściciela nadać nie może, bo właściciel to jedno imię z ustawienia Workera. Uczestnik odłożony traci prawa, a przywrócony je odzyskuje - i to jest dziś jedyny sposób odebrania wstępu bez zmiany ustawień. Imię, które nie ma swojej rzeczy uczestnika, nie jest uczestnikiem i słyszy to wprost, zamiast "podaj klucz" do kogoś, kto klucz właśnie podał. Czego nie ma: zaproszeń, zakładania kluczy w Miejscu (klucz nigdy nie jest daną), ani RÓŻNYCH praw dla różnych uczestników w tym samym obszarze - ile_wolno mówi o wszystkich agentach naraz. Nie ma też roli dla drugiego człowieka: role są trzy (właściciel, agent, automat).'), 
    zd('propozycje', 'cienko', 'Propozycje: ruch bez prawa do skutku czeka, aż przyjmie go albo odrzuci właściciel albo ktoś, kto sam mógłby zrobić ten ruch ze skutkiem; autor może swoją wycofać.', 'Ruch, który zmienia coś zastrzeżonego dla właściciela, też staje się propozycją, tylko do niego. Nie ma wygasania ani warstwy do obejrzenia przed przyjęciem.'),
    zd('goscie', 'cienko', 'Goście z kodem w piaskownicy: jeden plik HTML zapisany w Miejscu, podawany bez dostępu do sieci i do adresu Miejsca.', 'Gość czyta rzeczy przez umowę okna, a z umową okno/3 także pisze pod własnym imieniem. Nie ma własnej pamięci.'),
    zd('umowa-okna', 'cienko', 'Umowa okna, pokolenia 2 i 3: przyrząd starej Jaskini (hello, state, signals, event, flag), czytanie rzeczy (okno/2) i ruch z okna (okno/3); oba pokolenia działają obok siebie.', 'Opis: /umowa-okna. Brakuje czytania jako gość, wołania czasowników gościa, osadzania gościa w gościu i okna w przestrzeni Startu.'),
    zd('czasowniki', 'cienko', 'Spis czasowników: jedna lista tego, co da się zrobić, z wejściem i wynikiem.', 'Są czasowniki drzwi i okna. Czasowniki gości są tylko wypisane; wołać ich jeszcze się nie da.'),
    zd('na-zywo', 'cienko', 'Zmiany na żywo: otwarta strona dowiaduje się o cudzej zmianie od razu, bez przeładowania i bez pytania.', 'Kanał: połączenie pod /api/srodowisko/zywe niesie sam numer ostatniego aktu, a strona doczytuje tylko to, co się zmieniło (spis z po=<akt>). Gdy połączenie nie stoi, strona pyta o puls co kilka sekund. Niesprawdzone na prawdziwym telefonie ani przy słabej sieci.'),
    zd('wywoz', 'cienko', 'Wywóz i wwóz całości: właściciel dostaje wszystko jako jeden plik spod /api/miejsce/eksport; plik sam mówi, jak go czytać, a wwieziony do pustego Miejsca odtwarza to samo środowisko.', 'Obcy czytnik odtworzył spis z samego pliku (dowód D3, 17 XI, sędzia: Opus Code). Powrót do siebie pilnuje sprawdzian budowniczego; nikt obcy go jeszcze nie sądził.'),
    zd('licznik-przeniesienia', 'cienko', 'Dzieła i fakty policzone osobno: ile dzieł wniesiono do środka (rodzaj projekt/1) i o ilu repozytoriach obserwator przyniósł fakty.', 'To nie jest miara postępu. Wcześniejszy licznik "N na 28" stawiał cel (wnieść wszystkie repozytoria), którego nikt nie zamawiał; zdjęty 17 XI. Nie ma jeszcze miary tego, co naprawdę ma się przenieść: rzeczy, których właściciel używa.'),
    zd('cofanie', 'cienko', 'Odkładanie i cofanie: rzecz da się odłożyć i przywrócić, a jej treść cofnąć do wcześniejszej wersji; każde jest nową wersją, więc nic nie znika.', 'Działa przez drzwi (co: odloz, przywroc, cofnij). Nie ma jeszcze cofania całego gestu jednym krokiem ani guzika na stronie.'),
    zd('szukanie', 'cienko', 'Pytanie po cechach i szukanie: listę rzeczy da się zawęzić do wartości cechy i do słowa.', 'Adresy: /rzeczy?rodzaj=…&gdzie.<cecha>=<wartość> i /rzeczy?szukaj=<słowo>. Szukanie patrzy na napisy w cechach, bez odmiany słów.'),
    zd('klucz-rzeczy', 'cienko', 'Tożsamość z cech: kształt może wskazać klucz, czyli cechy, z których liczy się tożsamość rzeczy; to, co przychodzi z zewnątrz wiele razy, trafia zawsze w tę samą rzecz.', 'Opis: /co-tu-jest, punkt 5c. Używają go repo/1 (klucz pelna_nazwa), rodzina/1 (klucz znak) i galaz/1 (klucz repo + nazwa), które przynosi obserwator faktów.'),
    zd('reka-na-stronie', 'cienko', 'Ręka na stronie: właściciel przyjmuje i odrzuca propozycje, odpowiada na prośby, zostawia słowo przy rzeczy i ustawia, ile wolno agentom w obszarze, bez wychodzenia ze strony.', 'Wejście kluczem zapamiętanym w przeglądarce, na podglądzie jednym guzikiem jako właściciel próbny, albo dotknięciem przez drzwi właściciela (osobna zdolność). Guzik "Dodaj to urządzenie" widzi tylko wpuszczony właściciel.'),
    zd('drzwi-wlasciciela', 'cienko', 'Drzwi właściciela: wejście jednym dotknięciem (passkey), bez wklejania klucza i bez konta u nikogo obcego. Urządzenie trzyma klucz prywatny, Miejsce sprawdza podpis własnym kodem, a wejście zostaje w przeglądarce na miesiąc.', 'Cztery kroki pod adresem: /api/drzwi/stan, zacznij, zapisz, wejdz, wyjdz (i wyjdz zabiera też klucz z tej przeglądarki). Poświadczenie jest RZECZĄ rodzaju poswiadczenie/1 w obszarze Drzwi (widzi: wlasciciel), więc właściciel je widzi, nazywa i może odłożyć - odłożone brzmi dokładnie jak nieznane. Leży tam sam klucz publiczny; klucz prywatny nie opuszcza urządzenia. Wyzwanie jest ważne pięć minut i niesie swój termin oraz podpis Miejsca, więc nie trzeba go pamiętać i przeżywa uśpienie obiektu (ten przyszedł po ok. 10 s ciszy i zabierał wyzwania trzymane w pamięci: tak padły pierwsze próby Jozza na telefonie 18 XI). Jest jednorazowe: lista użytych powstaje dopiero po podpisie, który przeszedł, bo licznik podpisów bywa zawsze zerowy i sam nie obroni przed powtórzeniem. Nazwa strony to DOKŁADNY host, nigdy domena nadrzędna (inaczej jedno poświadczenie dzieliłoby się z każdym podglądem na tym koncie). Wymaga ustawienia SEKRET_SESJI w Cloudflare; bez niego drzwi mówią wprost, czego brakuje, i nic nie udają. Sześć rzeczy, których te drzwi NIE robiły do 18 XI 2026, a robią od ataku drugiej linii na nie (narzedzia/atak_drzwi.mjs): pukającemu nie wydają już listy poświadczeń (nikomu, nawet pod kluczem w kroku wejścia - przeglądarka odnajduje swoje sama); wymagają flagi sprawdzenia człowieka, więc podniesione cudze urządzenie nie wchodzi; tożsamość z ciastka liczą tylko na stronie tego Miejsca, bo workers.dev jest na publicznej liście sufiksów i SameSite=Strict NIE rozdziela podglądów tego konta (to samo zamknęło stare drzwi /api/miejsce); pukanie nie zostawia w Miejscu żadnego zapisu, bo ctx.storage nie zna opcji expirationTtl i każde pukanie obcego zostawiało wpis bez końca życia; a sesja NIESIE poświadczenie, którym ją otwarto, więc odłożenie urządzenia naprawdę zamyka wejście - wcześniej ciastko dalej pisało jako właściciel. Jego telefon założył passkey dla adresu podglądu drzwi 18 XI wieczorem. Po niezależnym ataku z 19 XI drzwi otwiera tylko poświadczenie, które same założyły (pieczęć Miejsca, obszar Drzwi, imię właściciela), a ruch agenta z poświadczeniem jest odmową, nie propozycją; próg liczy tylko nieudane próby, osobno dla poświadczenia i dla adresu, więc obcy nie zamknie drzwi właścicielowi; ciastko nosi przedrostek __Host-, więc strona z innej gałęzi nie podrzuci własnego; obcy nie dowiaduje się, ile urządzeń ma właściciel ani jak ma na imię; sesja niesie skrót poświadczenia i pokolenie wyjść, więc wyjście zamyka też skopiowany żeton; błąd pamięci obiektu jest odmową. Urządzenie założone przed 19 XI trzeba dodać jeszcze raz. Czego nie ma: drugiej drogi, gdy zgubi urządzenie (dziś zostaje klucz z ustawień), nazwania urządzenia po fakcie ze strony, i wejścia dotknięciem dla uczestników - to są drzwi właściciela.'),
    zd('widocznosc', 'cienko', 'Widoczność z danych: kto widzi którą rzecz, mówi ustawienie widzi obszaru (wlasciciel, uczestnicy albo wszyscy), dziedziczone w głąb; "nie ma" i "nie dla ciebie" brzmią tak samo.', 'Okulary czytającego zakłada się raz (srodowisko.dla(kto)) i przechodzą przez nie spis, liczby, adres jednej rzeczy, dawne wersje, odniesienia, strony tekstowe, sprawdzian spójności, dziennik zmian i obecność w kanale na żywo. Obszar zamknięty nie jest wymieniony nawet z nazwy; z dziennika zostaje po ukrytej zmianie sama liczba, bo numer aktu i tak jest słyszalny. Dawna wersja rzeczy jest widoczna tylko dla tego, kto widzi obszar z JEJ zapisu i dzisiejszy, więc przeniesienie rzeczy do jawnego obszaru nie publikuje jej przeszłości; sam fakt, że akt był, zostaje słyszalny. Czego nie ma: widoczności POJEDYNCZEJ rzeczy (prywatna rzecz w jawnym obszarze wymaga własnego obszaru), różnych praw dla różnych uczestników, i żetonu tylko do czytania. Ustawienie widzi: wszyscy nie ma jeszcze KTÓRĘDY zadziałać: poza podglądem Worker odmawia każdemu bez klucza, zanim widoczność cokolwiek policzy. To jest wybór, nie przeoczenie - granica ma najpierw wytrzymać dwa cudze ataki, a nie zamieniać własny błąd w publiczny wyciek. Kod gościa (/gosc/<zapis>) jest jawny po odcisku także poza podglądem, więc prywatne narzędzie miałoby publiczny kod. Zapis pyta o istnienie oczami piszącego: rzecz z obszaru, którego piszący nie widzi, brzmi dla ruchu tak samo jak rzecz, której nie ma (zmiana po identyfikatorze, odniesienie, obszar docelowy, dawna wersja, propozycja, gość w oknie), a przy ruchu z okna patrzą i gość, i ten, kto okno otworzył. Zostaje jeden bit: przy rodzaju z kluczem uczestnik z prawem zapisu, który zgadnie wartość klucza, dowie się z odmowy, że taka rzecz gdzieś jest - bez identyfikatora, wersji i obszaru. Dwie rzeczy z drugiego ataku są otwarte: kształt rodzaju położony w zamkniętym obszarze widzi każdy czytający (lista rodzajów nie przechodzi przez okulary), a kanał na żywo wita kluczem także uczestnika z odebranym wstępem i podaje mu imiona obecnych. Stare drzwi /api/miejsce (wywóz i wwóz całości) widoczności nie znają i są tylko dla właściciela. Gość w oknie czyta tyle, co strona, która go otworzyła. Na podglądzie czytający bez klucza jest uczestnikiem, bo klucz uczestnika stoi tam jawnie na stronie. Granicę atakowano pod żywym adresem, nie tylko w sprawdzianach: tools/granica.py i proby/z3-kanal-na-zywo/atak-obecnosc.mjs; cztery dziury wyszły z tego ataku, nie z czytania kodu.'),
    zd('adres-czytania', 'brak', 'Adres czytania dla ciała bez rąk: osobny żeton tylko do czytania, żeby agent bez nagłówków widział swoją perspektywę.', 'Na podglądzie zastępuje go ?jako=<imię>, bez dowodu tożsamości.'),
    zd('obecnosc', 'cienko', 'Obecność: kto jest teraz gdzie i nad czym pracuje, w obie strony, z wyłącznikiem.', 'Uczestnicy połączeni kanałem na żywo widzą swoje imiona i rzecz, przy której każdy jest (otwarte okno albo karta); zwiedzający widzi samą liczbę. Wyłącznik na stronie (widać mnie): uczestnik słucha zmian, nie pokazując się. Nic z tego nie trafia do dziennika. Agent bez przeglądarki łączy się z kluczem w nagłówku. Nad czym kto pracuje, mówi tylko rzecz, przy której jest.'),
    zd('budzet-wierszy', 'cienko', 'Budżet wierszy: Miejsce mierzy u źródła, ile wierszy bazy przeczytało i zapisało, i może mieć dobowy limit zapisów.', 'Koszt każdego żądania stoi w nagłówku odpowiedzi x-koszt, suma doby w /co-tu-jest. Po dojściu do limitu ruch dostaje odmowę ze zdaniem dlaczego, a czytanie działa dalej. Licznik zna tylko to Miejsce: wspólnego limitu konta nie widzi.'),
    zd('fakty-automatem', 'cienko', 'Fakty automatem: obserwator sam przynosi publiczne repozytoria i ich gałęzie jako rzeczy repo/1 i galaz/1 (oraz rodziny projektów jako rodzina/1) w obszarze Fakty, z dwóch źródeł: z API GitHuba i z pliku faktów starej Jaskini. Budzi go alarm (tylko tam, gdzie ustawiono OBSERWATOR=tak) i ręczne obejście (POST /api/srodowisko/obejdz, tylko właściciel).', 'Źródła: API GitHuba idzie pierwsze; gdy odmawia (bez tokenu GitHub często odmawia z adresów Cloudflare, 403), obejście bierze fakty z pliku starej Jaskini (adres z OBSERWATOR_BIBLIOTEKA), który stara Jaskinia sama odświeża zwykle dwa razy na dobę (fakty są tak świeże, jak jej ostatnie odświeżenie; z tokenem obserwator czytałby GitHuba sam i częściej) i który NIE zna numeru repozytorium. Gdy API działa, plik tylko dokłada to, czego API nie zna (rodzina, tożsamość, ładna nazwa, życie, stos, commity, temat gałęzi). Każda rzecz mówi swój wiek (stan_na) i źródło (zrodlo_faktow); nowszy fakt nie jest cofany starszym. Z pliku odkłada się tylko ostrożnie i odwracalnie: plik musi być pełny (estate.coverage bez braków) i nowszy niż fakty odkładanej rzeczy, a bezpiecznik wstrzymuje odkładanie, gdy zniknęłaby ponad połowa repozytoriów; odłożone przez obserwatora przywraca nowszy plik, odłożonych cudzą ręką obserwator nie rusza. Czego nie ma: wdrożeń i wersji do uruchomienia (tylko adres strony), repozytoriów prywatnych, zdarzeń na żywo zamiast odpytywania, rozpoznania zmiany nazwy repozytorium (to dziś nowa rzecz i odłożona stara). Gałęzie sprawdza po pięć repozytoriów na obejście, więc pełne koło trwa kilka obejść. Awaria źródła niczego nie odkłada i zostawia lukę w mierze obserwator-faktow. Nikt jeszcze nie sprawdził tego na prawdziwym GitHubie ani na Cloudflare.'),
    { nazwa: 'widok-start', rodzaj: 'widok/1', cechy: { nazwa: 'Start', opis: 'Widok, od którego właściciel zaczyna: jego projekty w przestrzeni, w stanie stałym (tam, gdzie je położył) albo ciekłym (wypełniają okno, ważniejsze większe).' } },
    zd('start', 'cienko', 'Start: Przegląd ze Ścianą w jednym, pierwszy organ dla ręki właściciela.', 'Szkielet pod /start/: projekty na płótnie w stanie stałym (położenia z ręki jako rzeczy rodzaju miejsce w widoku Start, zapis przy puszczeniu) i ciekłym (wypełniają okno, liczone z położeń stałego), przełącznik i suwak między nimi, przybliżanie z gałęziami w środku projektu, karta rzeczy ze zdaniem, skąd się tu wzięła, wejście do grania, zmiany na żywo. Nie ma jeszcze: odpychania się rzeczy, grup, zaznaczania wielu, nazwanych ułożeń, Pól na płótnie, narzędzi w przestrzeni ani motywów. Niesprawdzone jego ręką.'),
    zd('wolanie-czasownikow', 'brak', 'Wołanie czasowników gościa: agent bez przeglądarki prosi otwartego gościa, żeby coś zrobił, i dostaje wynik.'),
    zd('drugie-miejsce', 'brak', 'Drugie Miejsce: osobne Miejsce obok tego (na pokaz, dla labu), odniesienia między nimi i jedno otwierane w drugim jak gość.'),
    zd('najety-mozg', 'brak', 'Mózg najęty przez Jaskinię: agent działający w środku za API właściciela, z pułapem kosztu jako ustawieniem obszaru.', 'Kierunek, nie plan na teraz. Klucz nigdy nie jest daną: zapis trzyma nazwę sekretu.'),
    // Czego brakuje do pełnej szerokości, nazwane wprost (17 XI, po rachunku budowniczego i sądzie drugiej linii).
    // Stan budowy ma mówić nie tylko, co stoi, ale też czego nie ma i na którym etapie jest potrzebne.
    zd('uwaga', 'brak', 'Uwaga z danych: ustawienie obszaru mówi, czy zdarzenie ma być ciszą, skrótem, znakiem czy budzeniem; uwaga i sprawczość są osobnymi ustawieniami.', 'Ustawienie uwaga jest zapisane w każdym obszarze, ale nic go jeszcze nie czyta: wszystko, co czeka, wygląda tak samo.'),
    zd('tozsamosc-po-zmianie', 'brak', 'Tożsamość, która przeżywa zmianę: rzecz zostaje sobą po zmianie nazwy u źródła, a dwie rzeczy da się połączyć albo jedną rozdzielić, z rodowodem i bez gubienia wskazań.', 'Dziś zmiana nazwy repozytorium u źródła daje nową rzecz, a stara jest odkładana (kluczem jest nazwa). Łączenia i dzielenia nie ma.'),
    // Wiersze dołożone 17 XI po sprawdzeniu, czy grunt przyjmie wykończenie (wygląd, ręka, mięsistość): to, czego warstwa
    // odczuwalna potrzebuje od gruntu, ma stać tutaj, a nie w czyjejś głowie.
    zd('cofniecie-gestu', 'cienko', 'Cofnięcie gestu: jeden gest ręki, który dotyka wielu rzeczy, cofa się jednym krokiem, a zapisany układ da się przywołać.', 'Ruch może nieść znak gestu; co: cofnij-gest wraca wszystko, co gest ruszył (to, co w nim powstało, odkłada), wszystko albo nic, i samo jest gestem, więc da się je ponowić. Cofa się tylko to, czego nikt po geście nie ruszył. Widok da się odczytać w wybranej chwili (/api/srodowisko/widok-w-chwili), a zapisany układ (chwila/1) przywrócić jedną czynnością (co: przywroc-uklad), którą też da się cofnąć. Start ma guziki cofnij i ponów oraz zapis i powrót do układu; stos gestów leży w pamięci przeglądarki, więc przeżywa przeładowanie. Czego nie ma: czynności zbiorczej w jednym żądaniu (gest z wielu ruchów nie jest atomowy przy zapisie, tylko przy cofaniu), cofania cudzej zmiany stojącej na drodze, suwaka czasu.'),
    zd('klocki-konstrukcji', 'cienko', 'Klocki konstrukcji w danych: reguła układu, drabina przedstawień i Pole są rzeczami, a twarz tylko je czyta i rysuje.', 'Drabina (kiedy karta pokazuje podpis, opis, gałęzie) jest wartością pokrętła wyglad.karta.drabina: domyślna leży w kodzie Startu, a reguła, którą każda wartość musi spełnić, w public/drabina.mjs, wspólnym dla zaplecza i twarzy. Reguła układu ciekłego jest w kodzie Startu, a położenie nie ma ramy ani pochodzenia (ręka, reguła, propozycja). Druga twarz musiałaby przepisać układ, ale nie drabinę.'),
    zd('twarz-obok-twarzy', 'cienko', 'Twarz obok twarzy: nowa twarz staje obok starej na tych samych rzeczach, a to, która jest codzienna, jest ustawieniem do cofnięcia.', 'Dwie strony (gospodarz i Start) czytają te same rzeczy i te same pokrętła, a to, która otwiera się pod głównym adresem, mówi pokrętło srodowisko.twarz_domyslna: wartość z autorem, historią i cofnięciem. Lista twarzy jest wpisana w to pokrętło na sztywno, więc trzecia twarz wymaga zmiany kodu. Nie ma twarzy jako danej ani wersji twarzy widocznej pod adresem.'),
    zd('wyglad-w-oknie', 'cienko', 'Wygląd przechodzi do okien: narzędzie w oknie dostaje paletę, krój i natężenie ruchu od gospodarza, w biegu, bez przeładowania.', 'Wiadomość look w umowie okna (wersja 2), zaraz po hi i po każdej zmianie ustawień: wszystkie role palety, także te zadeklarowane w Miejscu po wydaniu kodu, kroje dwóch ról jako wartości typu kroj i natężenie ruchu; obaj przykładowi goście się w nią ubierają. Narzędzie czyta pokrętła po nazwie, także własne (read ustawienia). Okno otwarte przez uczestnika jest rzeczą (okno/1), którą kładzie i zmienia tylko on sam: wraca po przeładowaniu strony (samo tylko wtedy, gdy narzędzie nie zmieniło się od otwarcia), a wartość pokrętła z zasięgiem okna zmienia wygląd tylko w nim (strona pyta wtedy drzwi o ustawienia dla tego okna). Czego nie ma: położenia i rozmiaru okna w przestrzeni (strona układa okna jedno pod drugim), okna jako zasięgu w panelu ustawień, pilnowania, że okno zapisuje tylko jego właściciel. Ramka nie była jeszcze sprawdzona w przeglądarce pod adresem.'),
    zd('tania-petla', 'cienko', 'Tania pętla: zmiana dociera do otwartych stron tak tanio, żeby strojenie mogło trwać cały dzień w limicie konta.', 'Start po zmianie czyta samą różnicę i pyta o ustawienia tylko wtedy, gdy zmieniło się ustawienie; granica wejścia (20000 rzeczy) ma znak ucięcia. Twarze pytają o ustawienia po nazwach, więc koszt nie rośnie z tym, co ktoś zadeklarował obok; strona gospodarza czyta opis i pełną listę pokręteł najwyżej raz na kilkanaście sekund (od razu tylko po własnym zapisie). Podgląd w trakcie kręcenia idzie z karty do karty i nie kosztuje nic. Wejście dalej czyta całe Miejsce zamiast wycinka, a rozgłoszenia nie są zbierane.'),
    zd('stan-oka', 'cienko', 'Stan oka przy słowie: uwaga zostawiona ręką niesie to, co widział ten, kto ją zostawił (numer aktu, wersja twarzy, widok, urządzenie).', 'Słowo ze Startu i ze strony gospodarza niesie cechę oko: nazwę twarzy, odcisk plików, które naprawdę chodziły w przeglądarce (zmienia się sam z każdą zmianą kodu), numer aktu, widok, ekran z grubsza, paletę i to, co twarz uważa za ważne (kamera, układ). Położenia z tamtej chwili daje widok w chwili. Czego nie ma: ustawień (wyglądu) z tamtej chwili jednym pytaniem, narzędzia, które z odcisku twarzy znajduje zapis w repozytorium, i doręczenia słowa agentowi.'),
    zd('ustawienia', 'cienko', 'Ustawienia jako dane: wszystko, co da się stroić, ma deklarację (typ, zakres), wartość z zasięgiem i historią oraz nazwane zestawy, zmieniane w działającym Miejscu.', 'Pokrętło (pokretlo/1) to deklaracja z typem, wartością domyślną, zakresem suwaka i twardą klamrą; wartość (wartosc/1) obowiązuje w zasięgu, którym jest dowolna rzecz, i leży tam, gdzie zasięg, więc prawo do strojenia jest prawem obszaru; zestaw (zestaw/1) to motyw albo preset włączany w zasięgu; profil (profil/1) to nakładka dla urządzenia albo sposobu pracy. Liczenie idzie od najbliższego zasięgu w górę do Miejsca, a wartość niezgodna z deklaracją nie dochodzi do twarzy. Wszystko naraz: /ustawienia i /api/srodowisko/ustawienia. Pierwsze pokrętła (palety, kroje dwóch ról, czasy ruchu, próg przeciągania, cień) biorą się z jednej tablicy w kodzie. Wartość może iść za innym pokrętłem ({z: nazwa}), więc motyw ustawia kilka barw bazowych, a role idą za nimi i nowa rola nie rozjeżdża motywu; nazwy mówią, czym rzecz jest dla człowieka (wyglad, odczucie), a nie która twarz ją rysuje (umowa po ataku linii wyglądu, 18 XI 2026). Czego nie ma: okna ustawień z suwakami dla ręki (jest tylko prosty panel na stronie gospodarza), kroju jako pliku (rzecz nosi tylko nazwę kroju z urządzenia), reguły układu i drabiny przedstawień jako danych, zasięgu osoby dla właściciela. Cztery ustawienia obszaru (ile_wolno, uwaga, widzi, uklada) zostają cechami obszaru. Format (ustawienia-1) nie przeszedł jeszcze ataku linii wyglądu. Od 19 XI warianty dla jego presetów: ruch kopiuj robi jednym gestem kopię dowolnej rzeczy (zestawu) i jej pochodzenie (pochodzenie/1); ruch domyslny na kopii wraca do dzisiejszej treści źródła i zostawia nazwę kopii; punkt zapisu (punkt/1) pamięta ciekawą wersję dowolnej rzeczy, a ruch wroc-do-punktu wraca do niej; odczyt rzeczy mówi przy kopii, czy źródło ma nowszą wersję (pole pochodzenie). Każdy ruch pośredni (kopia, powrót kopii do źródła, powrót do punktu, cofnięcie, cofnięcie gestu, powrót do układu), po którym coś widzi więcej osób niż przedtem, to publikacja: robi ją tylko właściciel i tylko jawnie (publikuj: true), a kopia nie dostaje wtedy pochodzenia; jego kopia bez podanego obszaru nigdy nie publikuje. Pochodzenie kładzie tylko kopiuj (niezależny atak, 20 XI 2026).'),
    zd('gosc-pisze', 'cienko', 'Gość, który pisze: narzędzie w oknie zakłada i zmienia rzeczy pod własnym imieniem (domyślnie jako propozycja) i czyta tylko to, co gościowi wolno.', 'Ruch z okna (umowa okno/3) zapisuje się pod imieniem gosc-<id>, a ten, kto otworzył okno, stoi przy nim jako kontekst. Gość ma w obszarze tyle prawa co agent i nigdy więcej niż otwierający. Nie ma jeszcze zgody dla wskazanego narzędzia we wskazanym obszarze, a czyta dalej tyle, co strona, która go otworzyła.'),
    zd('narzedzia-agenta', 'brak', 'Narzędzia Miejsca w ręku agenta: czasowniki ze spisu stoją na liście narzędzi agenta (serwer narzędzi), więc agent używa ich bez czytania opisu i bez adresu w poleceniu.', 'Dziś spis czasowników jest tekstem wpisanym w kod, a agent musi przeczytać /co-tu-jest i sam złożyć żądanie.'),
    zd('wersje-do-uruchomienia', 'brak', 'Wersje i buildy przychodzą same: nowa wersja labu albo działający build staje się rzeczą ze znakiem nowe i wejściem do uruchomienia.', 'Dziś same przychodzą fakty o repozytoriach i gałęziach, tak świeże jak odświeżenie starej Jaskini; wersji do uruchomienia nie ma, a znak nowe nie istnieje.'),
    zd('doreczenie-slowa', 'brak', 'Słowo dociera do agenta: słowo zostawione przy rzeczy trafia do agentów, którzy się nią zajmują, od razu albo po ich obudzeniu, a odpowiedź wraca w to samo miejsce.', 'Dziś słowo jest rzeczą przy rzeczy i widać je na stronie, ale żaden agent się o nim nie dowie, dopóki sam nie zajrzy.'),
    zd('wygasanie', 'brak', 'Wygasanie: prośba albo propozycja, na którą nikt nie musi odpowiadać, przedawnia się sama i zostawia ślad.', 'Dziś wszystko, co czeka, czeka bez końca; propozycja do rzeczy zmienionej w międzyczasie stoi na liście, choć nie da się jej już przyjąć.'),
    zd('pokolenia', 'cienko', 'Pokolenia obok siebie: rodzaj, gość i umowa okna mają pokolenie w nazwie, a nowe staje obok starego, bez przepisywania zapisów.', 'Kształt pod rzeczami wolno tylko poszerzać; ostrzejszy opis to następne pokolenie. Nie ma pomiaru, ile rzeczy i gości stoi jeszcze na starym, ani przełączenia jednym ruchem (dowód D4 niezrobiony).'),
    zd('duze-tresci', 'cienko', 'Duże treści poza zapisem: build, model albo asset leży w magazynie, a rzecz trzyma wskazanie z odciskiem i rozmiarem.', 'Plik (plik/1) jest rzeczą ze wskazaniem: odcisk, typ z zamkniętej listy i rozmiar. Bajty leżą w niezmiennym zapisie (do 1,5 MB na plik), wchodzą drzwiami POST /api/srodowisko/bajty, a wychodzą GET /api/srodowisko/bajty?rzecz=<id> oczami czytającego, nigdy jako strona. Treść pliku jest niezmienna (nowe bajty to nowy plik), a plik wskazany z odciskiem oddaje bajty także po odłożeniu; wartość kroju wskazuje tak plik kroju. Czego nie ma: magazynu na rzeczy większe niż 1,5 MB (build, model), obrazu i dźwięku w żadnej twarzy, bajtów kroju podawanych oknom narzędzi.'),
    zd('czas-wstecz', 'cienko', 'Czas wstecz: każda rzecz ma historię wersji z autorem i da się ją cofnąć do dowolnej z nich.', 'Nie da się obejrzeć całego Miejsca w stanie z wybranej chwili.'),
    zd('spojnosc', 'cienko', 'Spójność: środowisko mówi, co w nim samym jest krzywe (rzeczy niezgodne z własnym kształtem).', 'Przebieg na żądanie: GET /api/srodowisko/spojnosc. Dwie reguły w kodzie; docelowo sprawdzian wyprowadzony z kształtów. Zbudowała i sprawdziła druga linia.'),
    zd('okna-w-przestrzeni', 'brak', 'Okna gości w przestrzeni: narzędzie albo gra leży na Starcie obok rzeczy, przesuwa się i skaluje razem z przestrzenią, zasypia poza ekranem; okno jest rzeczą, a widok da się położyć w widoku.', 'Dziś Start otwiera jedno okno gry nad płótnem, bez umowy okna.', 'sciany-i-kable'),
    zd('pola', 'brak', 'Pola na Starcie: strefy przestrzeni z własnym ustawieniem, kto układa, ile wolno agentom i ile uwagi, zakładane i przestawiane ręką.', 'Mechanizm obszarów stoi i działa dla położeń; na płótnie nie ma jeszcze ani jednego Pola.', 'sciany-i-kable'),
    zd('granie-i-wersje', 'brak', 'Granie i wszystko do odpalenia: buildy, wersje najnowsze, milowe i historyczne, kilka naraz obok siebie.', 'Dziś karta repozytorium ma jedno wejście do strony projektu.', 'sciany-i-kable'),
    zd('statystyki', 'brak', 'Statystyki: organ, który pokazuje fakty z datą i źródłem i odświeża się sam.', 'Fakty leżą w Miejscu jako rzeczy; nic ich jeszcze nie pokazuje jako liczb w czasie.', 'sciany-i-kable'),
    zd('zywe-swiaty', 'brak', 'Żywe światy w przestrzeni: gra albo symulacja działa w oknie, da się na nią patrzeć i ingerować na żywo; żywa instancja jest osobną rzeczą niż wersja i dzieło.', 'Dziś gra otwiera się w zwykłej ramce i nic o sobie nie mówi.', 'sciany-i-kable'),
    zd('budzenie', 'brak', 'Budzenie: wpis może obudzić wskazanego agenta albo poczekać, aż obudzi się sam; agent może obudzić agenta.', 'W Miejscu nie ma jeszcze nic; poza nim działa jeden budzik u jednego dostawcy.', 'sciany-i-kable'),
    zd('reka-i-oko', 'brak', 'Ręka i oko Startu: grupy, zaznaczanie wielu, reakcja sąsiadów od miejsca chwytu, notatki, powiązania, szukanie na płótnie, zapisane układy, motywy.', 'Szkielet ma w całości 5 z 27 punktów podłogi poprzedniej Ściany (osąd budowniczego, nie pomiar cudzą ręką). Świadomie na końcu, po podstawach.', 'wykonczenie'),
    zd('tresc', 'brak', 'Treść w środku: dzieła właściciela z jego znaczeniem (rodziny, powiązania, opisy, historia), wnoszone i destylowane stopniowo.', 'Świadomie odłożone: ważniejsze jest, żeby fakty odświeżały się same i poprawnie, niż żeby od razu mieć w środku wszystko.', 'wykonczenie'),
    zd('dla-zwiedzajacych', 'brak', 'Wejście dla zwiedzających: publiczna strona z wybranymi dziełami do obejrzenia i zagrania; publikacja jest gestem właściciela.', 'Wymaga widoczności z danych.', 'wykonczenie'),
    zd('tworzenie', 'brak', 'Tworzenie: pracownie i narzędzia, w których właściciel i agenci razem budują światy (edytory obok działającego świata, wspólny rdzeń, biblioteka).', 'Po to jest całe Miejsce. Zaczyna się, gdy grunt, ściany i wykończenie stoją.', 'tworzenie'),
    { nazwa: 'gosc-lista', rodzaj: 'gosc/1',
      cechy: async (s) => {
        // op niesie odcisk treści: gdy kod przykładu zmieni się w źródle, powstaje nowy zapis zamiast konfliktu op
        const w = await s.r.wykonaj('srodowisko', { op: 'zasiew-kod-lista-' + szybkiOdcisk(GOSC_LISTA), co: 'zapisz', rodzaj: 'kod/1', tresc: GOSC_LISTA }, { slad: 'zasiew' });
        if (!w.ok) throw new Error('kod gościa: ' + w.blad);
        return { nazwa: 'Lista rzeczy', opis: 'Najprostszy gość: wszystkie rzeczy pogrupowane według rodzaju. Przykład umowy okna do skopiowania.', kod: w.zapis ?? w.akt.zapis, umowa: 'okno/2' };
      } },
    { nazwa: 'gosc-slowa', rodzaj: 'gosc/1',
      cechy: async (s) => {
        const w = await s.r.wykonaj('srodowisko', { op: 'zasiew-kod-slowa-' + szybkiOdcisk(GOSC_SLOWA), co: 'zapisz', rodzaj: 'kod/1', tresc: GOSC_SLOWA }, { slad: 'zasiew' });
        if (!w.ok) throw new Error('kod gościa: ' + w.blad);
        return { nazwa: 'Słowa', opis: 'Gość, który pisze: zostawia słowo przy wybranej rzeczy i pokazuje ostatnie słowa. Przykład ruchu z okna (umowa okno/3) do skopiowania.', kod: w.zapis ?? w.akt.zapis, umowa: 'okno/3' };
      } },
  ];
}
