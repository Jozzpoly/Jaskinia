// Trasy Workera Jaskini: wszystko poza samym punktem wejścia. Status: tymczasowe (TYMCZASOWE.md).
// Osobny plik, bo moduł główny Workera nie może eksportować niczego poza domyślnym obiektem: workerd traktuje
// nazwane eksporty jako punkty wejścia i nie startuje przy stałej typu string (sprawdzone wrangler dev, 10 XI 2026).

export const WERSJA_SZKIELETU = 'szkielet-1';

export function json(body, status = 200) {
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
    pamiecFaktow: Boolean(env.FAKTY),
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
  const naglowki = {
    'content-type': odp.headers.get('content-type') || (reszta === 'status.json' ? 'application/json' : 'text/html; charset=utf-8'),
    'cache-control': 'public, max-age=60',
    'x-jaskinia-zrodlo': zrodlo,
  };
  if (reszta === 'status.json') return new Response(odp.body, { status: 200, headers: naglowki });
  // Strona Domu dostaje jeden odnosnik od nas: z jego codziennego okna da sie dojsc do paska
  // "Do obejrzenia" jednym kliknieciem. Stara Jaskinia zostaje nietknieta - to jest obwoluta
  // nowej Jaskini wokol cudzej strony, dokladana tu i tylko tu.
  const html = await odp.text();
  return new Response(wstawOdnosnik(html), { status: 200, headers: naglowki });
}

// Maly odnosnik wstawiany w strone Domu. Osobna funkcja, zeby dalo sie go sprawdzic testem bez sieci.
export const ODNOSNIK_PASEK = `<a href="/do-obejrzenia/" id="jaskinia-do-obejrzenia" title="Nowa Jaskinia: co agenci dla Ciebie zrobili"`
  + ` style="position:fixed;right:12px;bottom:12px;z-index:2147483000;padding:.45rem .7rem;border-radius:.5rem;`
  + `background:#9a5b1e;color:#fff;font:600 13px/1.2 system-ui,sans-serif;text-decoration:none;opacity:.88;`
  + `box-shadow:0 1px 6px rgba(0,0,0,.35)">Do obejrzenia ▸</a>`;

export function wstawOdnosnik(html) {
  if (typeof html !== 'string' || html.includes('id="jaskinia-do-obejrzenia"')) return html;
  const i = html.lastIndexOf('</body>');
  // Gdy strona nie ma </body> (albo przyjdzie cos innego niz HTML), nie zgadujemy: oddajemy ja bez zmian.
  return i === -1 ? html : html.slice(0, i) + ODNOSNIK_PASEK + html.slice(i);
}

