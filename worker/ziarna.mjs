// Zasiew środowiska: rzeczy, bez których Miejsce nie umie opisać samego siebie (17 XI 2026). Status: próba.
// To są DANE, nie kod: po zasianiu każdą z tych rzeczy zmienia się ruchem, a zasiew jej nie nadpisze.
// Kolejność ma znaczenie: najpierw kształt kształtu, potem kształty, potem rzeczy tych rodzajów.
import { STOPNIE, UWAGI, WIDZI, UKLADA, szybkiOdcisk } from './srodowisko.mjs';

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
addEventListener('message', (e) => {
  const m = e.data;
  if (e.source !== gospodarz || !m || m.jaskinia !== 1) return;
  if (m.type === 'hi') { powiedz({ type: 'hello', name: 'Lista rzeczy', version: '1', wants: ['rzeczy'] }); pokaz(); }
  else if (m.type === 'result') { const c = czekaja.get(m.id); if (c) { czekaja.delete(m.id); if (m.ok) c.tak(m.data); else c.nie(new Error(m.error)); } }
  else if (m.type === 'changed') pokaz();
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
addEventListener('message', (e) => {
  const m = e.data;
  if (e.source !== gospodarz || !m || m.jaskinia !== 1) return;
  if (m.type === 'hi') { powiedz({ type: 'hello', name: 'Słowa', version: '1', wants: ['rzeczy'] }); pokaz(); }
  else if (m.type === 'result') { const c = czekaja.get(m.id); if (c) { czekaja.delete(m.id); if (m.ok) c.tak(m.data); else c.nie(new Error(m.error)); } }
  else if (m.type === 'changed') pokaz();
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

export function ziarna({ wlasciciel }) {
  return [
    k('ksztalt', { dla: 'ksztalt/1', tytul: 'dla', opis: 'Kształt: opis rodzaju rzeczy, czyli jakie cechy ma rzecz tego rodzaju. Sam jest rzeczą, więc nowy rodzaj dokłada się ruchem, bez zmiany kodu.',
      cechy: {
        dla: { typ: 'tekst', wymagana: true, opis: 'rodzaj z pokoleniem, który ten kształt opisuje, np. postac/1' },
        opis: { typ: 'tekst', wymagana: true, opis: 'jedno zdanie: czym jest rzecz tego rodzaju' },
        cechy: { typ: 'dowolne', wymagana: true, opis: 'obiekt {nazwa cechy: {typ, opis, wymagana}}; może być pusty' },
        tytul: { typ: 'tekst', opis: 'nazwa cechy, która jest nazwą rzeczy; domyślnie cecha nazwa' },
        klucz: { typ: 'lista', z: 'tekst', opis: 'nazwy cech, z których liczy się tożsamość rzeczy: druga rzecz o tym samym kluczu nie powstanie' },
        uklad: { typ: 'tak-nie', opis: 'true, gdy rzeczy tego rodzaju są układaniem, a nie treścią; ustala to tylko właściciel' },
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
    { nazwa: 'obszar-fakty', rodzaj: 'obszar/1', meta: 'obszar_fakty', cechy: { nazwa: 'Fakty', opis: 'Rzeczy w tym obszarze przynosi obserwator: to fakty z zewnątrz (repozytoria, gałęzie i rodziny projektów: z GitHuba albo z pliku starej Jaskini), nie dzieła właściciela. Obserwator prowadzi tu sam; właściciel je czyta.', ile_wolno: 'prowadzic', uwaga: 'cisza' } },
    { nazwa: 'uczestnik-wlasciciel', rodzaj: 'uczestnik/1', cechy: { imie: wlasciciel, rola: 'wlasciciel', opis: 'Właściciel Miejsca. Jego ruchy zawsze mają skutek; nieodwracalne decyzje należą tylko do niego.' } },
    { nazwa: 'uczestnik-srodowisko', rodzaj: 'uczestnik/1', cechy: { imie: 'srodowisko', rola: 'automat', opis: 'Samo środowisko: zasiewa rzeczy, bez których nie umie opisać siebie.' } },
    { nazwa: 'uczestnik-obserwator', rodzaj: 'uczestnik/1', cechy: { imie: 'obserwator', rola: 'automat', opis: 'Przynosi fakty z GitHuba (publiczne repozytoria i ich gałęzie) albo, gdy GitHub odmawia, z pliku faktów starej Jaskini. Nikt nie ma jego klucza: imię jest zastrzeżone, więc z zewnątrz nie da się pod nim robić ruchów.' } },
    zd('rzeczy', 'stoi', 'Rzeczy z tożsamością i historią: każda rzecz ma identyfikator niezależny od nazwy i repozytorium, adres /rzecz/<id> i zapis każdej zmiany z autorem.'),
    zd('ksztalty', 'stoi', 'Rodzaj jako dana: nowy rodzaj rzeczy dokłada się ruchem (rzecz rodzaju ksztalt/1); sprawdzanie jest przy zapisie, nieznana cecha zostaje zachowana.'),
    zd('trasa', 'stoi', 'Trasa: jedno żądanie do drzwi i rzecz jest w Miejscu, widać ją w spisie i zostaje.'),
    zd('samowyjasnianie', 'stoi', 'Samowyjaśnianie pod adresem: /co-tu-jest mówi gołym tekstem, co tu jest, co się zmieniło, co komu wolno i jak coś dołożyć; powstaje z danych.'),
    zd('obszary', 'cienko', 'Obszary i prawo do skutku z danych: ten sam ruch daje skutek, propozycję albo odmowę zależnie od ustawienia obszaru.', 'Działa ile_wolno, liczone w obszarze, w którym rzecz leży, i w tym, do którego trafia. Ustawienia uwaga, widzi i uklada są zapisane, ale nic jeszcze z nich nie wynika. Wszyscy agenci mają w obszarze to samo prawo.'),
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
    zd('reka-na-stronie', 'cienko', 'Ręka na stronie: właściciel przyjmuje i odrzuca propozycje, odpowiada na prośby, zostawia słowo przy rzeczy i ustawia, ile wolno agentom w obszarze, bez wychodzenia ze strony.', 'Wejście kluczem zapamiętanym w przeglądarce; na podglądzie jednym guzikiem jako właściciel próbny. Prawdziwe drzwi właściciela (bez klucza do wklejania) jeszcze nie stoją.'),
    zd('drzwi-wlasciciela', 'brak', 'Drzwi dla właściciela: wejście z komputera i telefonu jednym dotknięciem.', 'Na podglądzie są jawne klucze próbne. Metoda: teczka kabelków w pamięci wspólnej.'),
    zd('widocznosc', 'brak', 'Widoczność: kto widzi którą rzecz.', 'Na podglądzie wszystko jest publiczne do czytania. W prawdziwym Miejscu czytanie będzie wymagać klucza albo ustawienia widzi: wszyscy. Stare drzwi /api/miejsce, które widoczności nie znają, są tylko dla właściciela. Gość w oknie czyta dziś tyle, co strona, która go otworzyła; ma dostać własną tożsamość, zanim wejdzie pierwsza rzecz prywatna.'),
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
    zd('uczestnicy-z-danych', 'brak', 'Uczestnicy z danych: imię, rolę i klucz uczestnika dokłada właściciel ruchem, bez wdrożenia; role obejmują drugiego człowieka i agentów różnych dostawców.', 'Dziś klucze stoją w ustawieniach wdrożenia, a role są trzy (właściciel, agent, automat). Rzecz rodzaju uczestnik/1 opisuje uczestnika, ale nie daje mu dostępu.'),
    zd('tozsamosc-po-zmianie', 'brak', 'Tożsamość, która przeżywa zmianę: rzecz zostaje sobą po zmianie nazwy u źródła, a dwie rzeczy da się połączyć albo jedną rozdzielić, z rodowodem i bez gubienia wskazań.', 'Dziś zmiana nazwy repozytorium u źródła daje nową rzecz, a stara jest odkładana (kluczem jest nazwa). Łączenia i dzielenia nie ma.'),
    zd('ustawienia', 'brak', 'Ustawienia jako dane: wszystko, co da się stroić, ma deklarację (typ, zakres), wartość z zasięgiem i historią oraz nazwane zestawy, zmieniane w działającym Miejscu.', 'Dziś są cztery ustawienia obszaru wpisane w kod, z czego działa jedno (ile_wolno). Wszystko, co stroi się na Starcie, jest stałą w kodzie.'),
    zd('gosc-pisze', 'cienko', 'Gość, który pisze: narzędzie w oknie zakłada i zmienia rzeczy pod własnym imieniem (domyślnie jako propozycja) i czyta tylko to, co gościowi wolno.', 'Ruch z okna (umowa okno/3) zapisuje się pod imieniem gosc-<id>, a ten, kto otworzył okno, stoi przy nim jako kontekst. Gość ma w obszarze tyle prawa co agent i nigdy więcej niż otwierający. Nie ma jeszcze zgody dla wskazanego narzędzia we wskazanym obszarze, a czyta dalej tyle, co strona, która go otworzyła.'),
    zd('narzedzia-agenta', 'brak', 'Narzędzia Miejsca w ręku agenta: czasowniki ze spisu stoją na liście narzędzi agenta (serwer narzędzi), więc agent używa ich bez czytania opisu i bez adresu w poleceniu.', 'Dziś spis czasowników jest tekstem wpisanym w kod, a agent musi przeczytać /co-tu-jest i sam złożyć żądanie.'),
    zd('wersje-do-uruchomienia', 'brak', 'Wersje i buildy przychodzą same: nowa wersja labu albo działający build staje się rzeczą ze znakiem nowe i wejściem do uruchomienia.', 'Dziś same przychodzą fakty o repozytoriach i gałęziach, tak świeże jak odświeżenie starej Jaskini; wersji do uruchomienia nie ma, a znak nowe nie istnieje.'),
    zd('doreczenie-slowa', 'brak', 'Słowo dociera do agenta: słowo zostawione przy rzeczy trafia do agentów, którzy się nią zajmują, od razu albo po ich obudzeniu, a odpowiedź wraca w to samo miejsce.', 'Dziś słowo jest rzeczą przy rzeczy i widać je na stronie, ale żaden agent się o nim nie dowie, dopóki sam nie zajrzy.'),
    zd('wygasanie', 'brak', 'Wygasanie: prośba albo propozycja, na którą nikt nie musi odpowiadać, przedawnia się sama i zostawia ślad.', 'Dziś wszystko, co czeka, czeka bez końca; propozycja do rzeczy zmienionej w międzyczasie stoi na liście, choć nie da się jej już przyjąć.'),
    zd('pokolenia', 'cienko', 'Pokolenia obok siebie: rodzaj, gość i umowa okna mają pokolenie w nazwie, a nowe staje obok starego, bez przepisywania zapisów.', 'Kształt pod rzeczami wolno tylko poszerzać; ostrzejszy opis to następne pokolenie. Nie ma pomiaru, ile rzeczy i gości stoi jeszcze na starym, ani przełączenia jednym ruchem (dowód D4 niezrobiony).'),
    zd('duze-tresci', 'brak', 'Duże treści poza zapisem: build, model albo asset leży w magazynie, a rzecz trzyma wskazanie z odciskiem i rozmiarem.', 'Dziś rzecz może nosić tylko adres w sieci. Nie ma ani formatu wskazania, ani magazynu.'),
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
