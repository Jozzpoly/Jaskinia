// Drzwi środowiska: te same rzeczy tekstem pod adresem (dla ciała, które umie tylko czytać) i jako dane (JSON),
// oraz jedne drzwi do ruchu (17 XI 2026). Status: próba (TYMCZASOWE.md).
// Worker ustalił wykonawcę z klucza i podał go w x-kto (pusty: zwiedzający bez klucza); z zewnątrz do Durable Object
// nie da się wejść inaczej niż przez Workera.
import { coTuJest, opisDane, listaRzeczy, listaRodzajow, stronaRodzaju, stronaRzeczy, umowaOkna } from './opis.mjs';

const TEKST = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const tekst = (t, status = 200) => new Response(t, { status, headers: TEKST });
const json = (o) => new Response(JSON.stringify(o, null, 2), { status: o && o.ok === false ? o.status || 400 : 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });

// Kod gościa wychodzi z nagłówkiem, który sam zamyka go w piaskownicy: bez własnego adresu (więc bez pamięci
// i bez dostępu do czegokolwiek pod adresem Miejsca) i bez sieci. Izolacja jest brakiem wiązania, nie uważnym kodem.
// Znana luka próby: gość może sam przejść pod obcy adres i wynieść to, co przeczytał przez okno. Na podglądzie
// wszystko jest publiczne; w prawdziwym Miejscu listę adresów dozwolonych w ramkach ustawi właściciel.
export const CSP_GOSCIA = "sandbox allow-scripts allow-pointer-lock; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";

// Ciało, które nie przyszło w UTF-8, dekoduje się ze znakami zastępczymi. Bez tej odmowy śmieć wszedłby po cichu
// (zmierzone 17 XI: curl z konsoli Windows wysłał polskie litery w innej stronie kodowej).
const ZASTEPCZY = String.fromCharCode(0xfffd);
const ZLE_KODOWANIE = { ok: false, status: 400, blad: 'treść nie jest w UTF-8 (są w niej znaki zastępcze): wyślij ciało żądania jako UTF-8, najprościej z pliku, np. curl --data-binary @ruch.json' };

export async function obsluzSrodowisko(s, request, { podglad = false, kluczProbny = null } = {}) {
  const url = new URL(request.url);
  const kto = request.headers.get('x-kto') || null;
  const slad = request.headers.get('x-cialo');
  const origin = request.headers.get('x-origin') || url.origin;
  const sciezka = url.pathname;
  const p = url.searchParams;
  const liczba = (x) => (x !== null && /^\d{1,12}$/.test(x) ? Number(x) : null);
  const opcje = { kto, jako: p.get('jako'), od: liczba(p.get('od')), origin, podglad, kluczProbny };

  if (request.method === 'GET') {
    if (sciezka.startsWith('/gosc/')) {
      const kod = s.kodGoscia(sciezka.slice(6));
      if (kod === null) return tekst('Nie ma takiego kodu gościa.\n', 404);
      return new Response(kod, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': CSP_GOSCIA, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'public, max-age=600' } });
    }
    if (sciezka === '/co-tu-jest') return tekst(coTuJest(s, opcje));
    if (sciezka === '/umowa-okna') return tekst(umowaOkna());
    if (sciezka === '/rodzaje') return tekst(listaRodzajow(s));
    if (sciezka.startsWith('/rodzaj/')) return tekst(stronaRodzaju(s, decodeURIComponent(sciezka.slice(8))));
    if (sciezka === '/rzeczy') return tekst(listaRzeczy(s, { rodzaj: p.get('rodzaj'), ...(p.has('obszar') ? { obszar: p.get('obszar') || null } : {}) }));
    if (sciezka.startsWith('/rzecz/')) { const t = stronaRzeczy(s, sciezka.slice(7), { kto: opcje.kto || (podglad ? opcje.jako : null) }); return t === null ? tekst('Nie ma takiej rzeczy. Lista wszystkich: /rzeczy\n', 404) : tekst(t); }
    if (sciezka === '/api/srodowisko/opis') return json({ ok: true, ...opisDane(s, opcje) });
    if (sciezka === '/api/srodowisko/puls') return json({ ok: true, akt: s.ostatniNr() });
    if (sciezka === '/api/srodowisko/spis') {
      const rz = s.spis({ rodzaj: p.get('rodzaj'), ...(p.has('obszar') ? { obszar: p.get('obszar') || null } : {}) });
      return json({ ok: true, rzeczy: rz.map((x) => ({ ...x, tytul: s.tytul(x) })), razem: rz.length, akt: s.ostatniNr() });
    }
    if (sciezka === '/api/srodowisko/rzecz') {
      const rz = s.rzecz(p.get('id') || '');
      return rz ? json({ ok: true, rzecz: { ...rz, tytul: s.tytul(rz) }, historia: s.historia(rz.id), wskazuja: s.wskazujaNa(rz.id) }) : json({ ok: false, status: 404, blad: 'nie ma takiej rzeczy' });
    }
    if (sciezka === '/api/srodowisko/ksztalty') return json({ ok: true, ksztalty: [...s.ksztalty().values()].map((k) => ({ ...k.cechy, rzecz: k.id, wersja: k.wersja })) });
  }
  if (request.method === 'POST') {
    if (sciezka === '/api/srodowisko/ruch') {
      const surowe = await request.text();
      if (surowe.includes(ZASTEPCZY)) return json(ZLE_KODOWANIE);
      let c = null;
      try { c = JSON.parse(surowe); } catch { /* zostaje null */ }
      if (c === null) return json({ ok: false, status: 400, blad: 'ciało żądania ma być obiektem JSON (nagłówek Content-Type: application/json)' });
      return json(await s.ruch(kto, c, { slad }));
    }
    if (sciezka === '/api/srodowisko/kod') {
      const kod = await request.text();
      if (kod.includes(ZASTEPCZY)) return json(ZLE_KODOWANIE);
      return json(await s.kod(kto, kod, { op: p.get('op'), slad }));
    }
  }
  if (sciezka.startsWith('/api/')) return json({ ok: false, status: 404, blad: 'nie ma takiej ścieżki; wszystkie są opisane pod /co-tu-jest' });
  return tekst('Nie ma takiego adresu. Wszystko o tym Miejscu: /co-tu-jest\n', 404);
}
