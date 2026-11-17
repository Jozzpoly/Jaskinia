// Punkt wejścia Workera Jaskini. Status: tymczasowe (TYMCZASOWE.md).
// Nazwane eksporty modułu głównego workerd bierze za punkty wejścia (stała typu string zatrzymała start, 10 XI 2026),
// więc stąd wychodzi tylko obiekt domyślny i klasa Durable Object Miejsca; trasy i stałe są w osobnych plikach.
import { json, zdrowie, dom } from './trasy.mjs';
import { odpowiedz, wCronie } from './fakty.mjs';
import { ktoTo } from './klucze.mjs';
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
  return env.MIEJSCE.get(env.MIEJSCE.idFromName('dom')).fetch(doMiejsca);
}

// Środowisko (17 XI 2026): rzeczy tekstem pod adresem, jako dane i jedne drzwi do ruchu. Czytanie bez klucza działa
// tylko na podglądzie (PODGLAD = tak), gdzie wszystko jest publiczne; ruch zawsze wymaga klucza. Kod gościa (/gosc/…)
// jest jawny z natury: wykonuje go przeglądarka tego, kto otworzył okno.
const SRODOWISKO_TEKSTEM = ['/co-tu-jest', '/umowa-okna', '/rodzaje', '/rzeczy'];
const doSrodowiska = (p) => p.startsWith('/api/srodowisko/') || SRODOWISKO_TEKSTEM.includes(p) || p.startsWith('/rzecz/') || p.startsWith('/rodzaj/') || p.startsWith('/gosc/');

async function srodowisko(request, env, url) {
  if (!env.MIEJSCE) return json({ blad: 'Miejsce nie jest podłączone (brak wiązania MIEJSCE)' }, 503);
  let kto = '';
  if (request.headers.has('authorization')) {
    const k = await ktoTo(request, env);
    if (!k.ok) return json({ blad: k.blad }, k.status);
    kto = k.kto;
  } else if (request.method !== 'GET') {
    return json({ blad: 'do ruchu potrzebny jest klucz: nagłówek Authorization: Bearer <klucz>' }, 401);
  } else if (env.PODGLAD !== 'tak' && !url.pathname.startsWith('/gosc/')) {
    return json({ blad: 'to Miejsce nie jest publiczne: do czytania potrzebny jest klucz (nagłówek Authorization: Bearer <klucz>)' }, 401);
  }
  const naglowki = new Headers({ 'x-kto': kto, 'x-origin': url.origin });
  const cialo = request.headers.get('x-cialo');
  if (cialo) naglowki.set('x-cialo', cialo.slice(0, 80));
  const ct = request.headers.get('content-type');
  if (ct) naglowki.set('content-type', ct);
  const dalej = new Request(request.url, { method: request.method, headers: naglowki, body: request.method === 'GET' ? undefined : await request.text() });
  return env.MIEJSCE.get(env.MIEJSCE.idFromName('dom')).fetch(dalej);
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
