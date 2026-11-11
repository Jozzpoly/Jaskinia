// Punkt wejścia Workera Jaskini. Status: tymczasowe (TYMCZASOWE.md).
// Nazwane eksporty modułu głównego workerd bierze za punkty wejścia (stała typu string zatrzymała start, 10 XI 2026),
// więc stąd wychodzi tylko obiekt domyślny i klasa Durable Object Miejsca; trasy i stałe są w osobnych plikach.
import { json, zdrowie, dom } from './trasy.mjs';
import { odpowiedz, wCronie } from './fakty.mjs';
import { ktoTo } from './klucze.mjs';
export { Miejsce } from './miejsce-do.mjs';
export { Swiat } from './swiat-do.mjs';

// /api/miejsce/…: wspólny stan po stronie serwera, tylko z kluczem. Worker ustala wykonawcę i nadpisuje x-kto.
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

// /api/swiat: Osada, świat żyjący po stronie serwera. Odczyt i gesty z kluczem jak w Miejscu; WebSocket bez
// sprawdzania tutaj, bo przeglądarka nie poda nagłówka przy WebSockecie: klucz idzie w pierwszej wiadomości.
async function swiat(request, env, url) {
  if (!env.SWIAT) return json({ blad: 'Osada nie jest podłączona (brak wiązania SWIAT)' }, 503);
  const obiekt = env.SWIAT.get(env.SWIAT.idFromName('osada'));
  if (url.pathname === '/api/swiat/ws') return obiekt.fetch(request);
  const k = await ktoTo(request, env);
  if (!k.ok) return json({ blad: k.blad }, k.status);
  const naglowki = new Headers({ 'x-kto': k.kto, 'content-type': 'application/json' });
  return obiekt.fetch(new Request(request.url, { method: request.method, headers: naglowki, body: request.method === 'GET' ? undefined : await request.text() }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
    if (url.pathname === '/api/swiat' || url.pathname === '/api/swiat/ws') return swiat(request, env, url);
    if (url.pathname.startsWith('/api/')) return json({ blad: 'nie ma takiej ścieżki' }, 404);
    if (env && env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Nie znaleziono', { status: 404 });
  },
  // cron (gdy jest ustawiony w wrangler.jsonc): zbiera fakty do KV, żeby strona czytała je bez czekania
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(wCronie(env));
  },
};
