// Punkt wejścia Workera Jaskini. Status: tymczasowe (TYMCZASOWE.md).
// Tylko domyślny eksport: nazwane eksporty modułu głównego workerd bierze za punkty wejścia (stała typu string
// zatrzymała start, 10 XI 2026), więc trasy i stałe są w trasy.mjs i fakty.mjs.
import { json, zdrowie, dom } from './trasy.mjs';
import { odpowiedz, wCronie } from './fakty.mjs';

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
    if (url.pathname.startsWith('/api/')) return json({ blad: 'nie ma takiej ścieżki' }, 404);
    if (env && env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Nie znaleziono', { status: 404 });
  },
  // cron (gdy jest ustawiony w wrangler.jsonc): zbiera fakty do KV, żeby strona czytała je bez czekania
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(wCronie(env));
  },
};
