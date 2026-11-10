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

// /dom/: the Home in use today (the old Jaskinia on GitHub Pages, refreshed by its own workflow), served from this
// Worker's address. Its browser memory then belongs to this address, not to the one shared with every lab on
// GitHub Pages. A bridge, not the new Jaskinia: status tymczasowe (TYMCZASOWE.md). Only these paths, so it is no
// open proxy.
export const DOM_ZRODLO = 'https://jozzpoly.github.io/Jozz-Cave-Workbench/';
const DOM_PLIKI = new Set(['', 'index.html', 'status.json']);

export async function dom(url, env = {}, doFetch = fetch) {
  if (url.pathname === '/dom') return Response.redirect(url.origin + '/dom/', 301);
  const reszta = url.pathname.slice('/dom/'.length);
  if (!DOM_PLIKI.has(reszta)) return json({ blad: 'nie ma takiego pliku Domu' }, 404);
  const zrodlo = (env.DOM_ZRODLO || DOM_ZRODLO) + reszta;
  let odp;
  try {
    odp = await doFetch(zrodlo, { cf: { cacheTtl: 120 } });
  } catch {
    return json({ blad: 'Dom nie odpowiada', zrodlo }, 502);
  }
  if (!odp.ok) return json({ blad: 'Dom nie odpowiada', zrodlo, status: odp.status }, 502);
  return new Response(odp.body, {
    status: 200,
    headers: {
      'content-type': odp.headers.get('content-type') || (reszta === 'status.json' ? 'application/json' : 'text/html; charset=utf-8'),
      'cache-control': 'public, max-age=60',
      'x-jaskinia-zrodlo': zrodlo,
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/dom' || url.pathname.startsWith('/dom/')) return dom(url, env);
    if (url.pathname === '/api/zdrowie') {
      if (request.method !== 'GET') return json({ blad: 'tylko GET' }, 405);
      return json(zdrowie(request, env));
    }
    if (url.pathname.startsWith('/api/')) return json({ blad: 'nie ma takiej ścieżki' }, 404);
    if (env && env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Nie znaleziono', { status: 404 });
  },
};
