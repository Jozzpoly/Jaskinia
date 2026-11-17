// Punkt wejścia Workera Jaskini. Status: tymczasowe (TYMCZASOWE.md).
// Nazwane eksporty modułu głównego workerd bierze za punkty wejścia (stała typu string zatrzymała start, 10 XI 2026),
// więc stąd wychodzi tylko obiekt domyślny i klasa Durable Object Miejsca; trasy i stałe są w osobnych plikach.
import { json, zdrowie, dom } from './trasy.mjs';
import { odpowiedz, wCronie } from './fakty.mjs';
import { ktoTo, wczytajKlucze } from './klucze.mjs';
import { skrot } from './miejsce.mjs';
import { cialoTekstem, ZLE_KODOWANIE } from './srodowisko-http.mjs';
import { ADRES_ZYWEGO } from './zywe.mjs';
export { Miejsce } from './miejsce-do.mjs';

// /api/miejsce/…: wspólny stan po stronie serwera, tylko z kluczem (krok 1 rdzenia, 15 XI 2026; wzięte z dawcy
// `claude/miejsce-wspolne-2026-11-11`). Worker ustala wykonawcę z klucza i nadpisuje x-kto: nagłówki do Miejsca
// buduje od zera, więc nic, co przysłał klient, nie przejdzie jako tożsamość.
async function miejsce(request, env) {
  if (!env.MIEJSCE) return json({ blad: 'Miejsce nie jest podłączone (brak wiązania MIEJSCE)' }, 503);
  const k = await ktoTo(request, env);
  if (!k.ok) return json({ blad: k.blad }, k.status);
  const naglowki = new Headers({ 'x-kto': k.kto });
  const ct = request.headers.get('content-type');
  if (ct) naglowki.set('content-type', ct);
  const doMiejsca = new Request(request.url, { method: request.method, headers: naglowki, body: request.method === 'GET' ? undefined : await request.text() });
  return obiektMiejsca(env).fetch(doMiejsca);
}

// Które Miejsce: nazwa obiektu przychodzi z ustawienia MIEJSCE_NAZWA (domyślnie `dom`). Inna nazwa to inne, puste
// Miejsce pod tym samym adresem; poprzednie zostaje nietknięte pod swoją nazwą.
const obiektMiejsca = (env) => env.MIEJSCE.get(env.MIEJSCE.idFromName(typeof env.MIEJSCE_NAZWA === 'string' && /^[a-z0-9-]{1,40}$/.test(env.MIEJSCE_NAZWA) ? env.MIEJSCE_NAZWA : 'dom'));

// Środowisko (17 XI 2026): rzeczy tekstem pod adresem, jako dane i jedne drzwi do ruchu. Czytanie bez klucza działa
// tylko na podglądzie (PODGLAD = tak), gdzie wszystko jest publiczne; ruch zawsze wymaga klucza. Kod gościa (/gosc/…)
// jest jawny z natury: wykonuje go przeglądarka tego, kto otworzył okno.
const SRODOWISKO_TEKSTEM = ['/co-tu-jest', '/umowa-okna', '/rodzaje', '/rzeczy', '/ustawienia'];
const doSrodowiska = (p) => p.startsWith('/api/srodowisko/') || SRODOWISKO_TEKSTEM.includes(p) || p.startsWith('/rzecz/') || p.startsWith('/rodzaj/') || p.startsWith('/gosc/');

async function srodowisko(request, env, url) {
  if (!env.MIEJSCE) return json({ blad: 'Miejsce nie jest podłączone (brak wiązania MIEJSCE)' }, 503);
  const zywe = url.pathname === ADRES_ZYWEGO && request.method === 'GET';
  let kto = '';
  if (request.headers.has('authorization')) {
    const k = await ktoTo(request, env);
    if (!k.ok) return json({ blad: k.blad }, k.status);
    kto = k.kto;
  } else if (request.method !== 'GET') {
    return json({ blad: 'do ruchu potrzebny jest klucz: nagłówek Authorization: Bearer <klucz>' }, 401);
  } else if (env.PODGLAD !== 'tak' && !url.pathname.startsWith('/gosc/') && !zywe) {
    return json({ blad: 'to Miejsce nie jest publiczne: do czytania potrzebny jest klucz (nagłówek Authorization: Bearer <klucz>)' }, 401);
  }
  const naglowki = new Headers({ 'x-kto': kto, 'x-origin': url.origin });
  if (zywe) {
    // Kanał na żywo. Przeglądarka nie umie dołączyć klucza do otwarcia połączenia, więc wolno je otworzyć bez klucza:
    // takie połączenie poza podglądem niczego nie słyszy, dopóki nie przedstawi się kluczem pierwszą wiadomością.
    // Obca strona nie otworzy go z przeglądarki uczestnika: przyjmujemy własny adres albo brak adresu (agent bez przeglądarki).
    if ((request.headers.get('upgrade') || '').toLowerCase() !== 'websocket') return json({ blad: 'to są drzwi kanału na żywo: potrzebne połączenie WebSocket (nagłówek Upgrade: websocket)' }, 426);
    const skad = request.headers.get('origin');
    if (skad && skad !== url.origin) return json({ blad: 'kanał na żywo przyjmuje połączenia tylko ze strony tego Miejsca' }, 403);
    naglowki.set('upgrade', 'websocket');
  }
  const klucze = wczytajKlucze(env);
  if (klucze.ok) {
    naglowki.set('x-imiona', klucze.wpisy.map(([imie]) => imie).join(','));
    if (env.PODGLAD === 'tak' && env.KLUCZ_PROBNY_AGENTA) {
      const s = await skrot(env.KLUCZ_PROBNY_AGENTA);
      const traf = klucze.wpisy.find(([, h]) => h === s);
      if (traf) naglowki.set('x-probny-imie', traf[0]);
    }
  }
  const cialo = request.headers.get('x-cialo');
  if (cialo) naglowki.set('x-cialo', cialo.slice(0, 80));
  // ruch z okna gościa: identyfikator gościa przechodzi dalej tak, jak przyszedł; czy taki gość jest i czy wolno mu
  // pisać, sprawdza Miejsce
  const gosc = request.headers.get('x-gosc');
  if (gosc !== null) naglowki.set('x-gosc', gosc.slice(0, 40));
  const ct = request.headers.get('content-type');
  if (ct) naglowki.set('content-type', ct);
  let cialoZadania;
  if (request.method !== 'GET') {
    // Ścisłe dekodowanie tutaj, zanim treść pójdzie dalej jako tekst: po zwykłym dekodowaniu zły zapis znaków
    // byłby już nie do odróżnienia od poprawnej treści.
    cialoZadania = await cialoTekstem(request);
    if (cialoZadania === null) return json({ blad: ZLE_KODOWANIE.blad }, 400);
  }
  const dalej = new Request(request.url, { method: request.method, headers: naglowki, body: cialoZadania });
  return obiektMiejsca(env).fetch(dalej);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (doSrodowiska(url.pathname)) return srodowisko(request, env, url);
    if (url.pathname === '/dom' || url.pathname.startsWith('/dom/')) return dom(url, env);
    if (url.pathname === '/api/zdrowie') {
      if (request.method !== 'GET') return json({ blad: 'tylko GET' }, 405);
      return json(zdrowie(request, env));
    }
    if (url.pathname === '/api/fakty') {
      if (request.method !== 'GET') return json({ blad: 'tylko GET' }, 405);
      return json(await odpowiedz(env));
    }
    if (url.pathname === '/api/miejsce' || url.pathname.startsWith('/api/miejsce/')) return miejsce(request, env);
    if (url.pathname.startsWith('/api/')) return json({ blad: 'nie ma takiej ścieżki' }, 404);
    if (env && env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Nie znaleziono', { status: 404 });
  },
  // cron (gdy jest ustawiony w wrangler.jsonc): zbiera fakty do KV, żeby strona czytała je bez czekania
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(wCronie(env));
  },
};
