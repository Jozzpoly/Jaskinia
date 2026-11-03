// Szkielet Workera Jaskini. Status: tymczasowe (TYMCZASOWE.md).
// Pliki statyczne obsługuje Cloudflare z public/; tu trafiają tylko ścieżki bez pliku.
// /api/zdrowie mówi, czy wdrożenie jest skonfigurowane, i nigdy nie pokazuje wartości sekretów.

export const WERSJA_SZKIELETU = 'szkielet-1';

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export function zdrowie(request, env = {}) {
  return {
    jaskinia: 'pusty podgląd',
    wersja: WERSJA_SZKIELETU,
    // Cloudflare Access dokleja ten nagłówek po zalogowaniu. Szkielet go jeszcze nie weryfikuje.
    access: request.headers.has('cf-access-jwt-assertion'),
    zmienneAccess: Boolean(env.POLICY_AUD && env.TEAM_DOMAIN),
    sekretDanych: Boolean(env.GITHUB_DANE_TOKEN),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/zdrowie') {
      if (request.method !== 'GET') return json({ blad: 'tylko GET' }, 405);
      return json(zdrowie(request, env));
    }
    if (url.pathname.startsWith('/api/')) return json({ blad: 'nie ma takiej ścieżki' }, 404);
    if (env && env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Nie znaleziono', { status: 404 });
  },
};
