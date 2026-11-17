// Drzwi środowiska: te same rzeczy tekstem pod adresem (dla ciała, które umie tylko czytać) i jako dane (JSON),
// oraz jedne drzwi do ruchu (17 XI 2026). Status: próba (TYMCZASOWE.md).
// Worker ustalił wykonawcę z klucza i podał go w x-kto (pusty: zwiedzający bez klucza); z zewnątrz do Durable Object
// nie da się wejść inaczej niż przez Workera.
import { coTuJest, opisDane, listaRzeczy, listaRodzajow, stronaRodzaju, stronaRzeczy, umowaOkna } from './opis.mjs';
import { poprawneImie } from './miejsce.mjs';

const TEKST = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const tekst = (t, status = 200) => new Response(t, { status, headers: TEKST });
const json = (o) => new Response(JSON.stringify(o, null, 2), { status: o && o.ok === false ? o.status || 400 : 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });

// Kod gościa wychodzi z nagłówkiem, który sam zamyka go w piaskownicy: bez własnego adresu (więc bez pamięci
// i bez dostępu do czegokolwiek pod adresem Miejsca) i bez sieci. Izolacja jest brakiem wiązania, nie uważnym kodem.
// Znana luka próby: gość może sam przejść pod obcy adres i wynieść to, co przeczytał przez okno. Dlatego gość ma
// dostawać tylko to, co wolno zobaczyć gościowi (plan budowy, par. 0b, pkt 7), a nie to, co widzi właściciel.
export const CSP_GOSCIA = "sandbox allow-scripts allow-pointer-lock; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; webrtc 'block'";

// Ciało czytamy jako bajty i dekodujemy ściśle: zły zapis znaków odbija się od drzwi, a poprawna treść, w której
// ktoś celowo użył znaku zastępczego, przechodzi (zmierzone 17 XI: curl z konsoli Windows wysłał polskie litery
// w innej stronie kodowej, a pięć takich znaków weszło do niezmiennych zapisów, zanim drzwi zaczęły sprawdzać).
export const ZLE_KODOWANIE = { ok: false, status: 400, blad: 'treść nie jest w UTF-8: wyślij ciało żądania jako UTF-8, najprościej z pliku, np. curl --data-binary @ruch.json' };
export async function cialoTekstem(request) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(await request.arrayBuffer()); } catch { return null; }
}

const liczba = (x) => (x !== null && /^\d{1,15}$/.test(x) ? Number(x) : null);

// Wybór rzeczy z adresu: rodzaj, obszar, gdzie.<cecha>=<wartość>, szukaj, odlozone. Wartość cechy dostaje typ
// z kształtu rodzaju (liczba, tak-nie), a bez kształtu jest napisem.
function filtrZAdresu(s, p) {
  const rodzaj = p.get('rodzaj');
  const f = { rodzaj, ...(p.has('obszar') ? { obszar: p.get('obszar') || null } : {}) };
  const ksztalt = rodzaj && rodzaj.includes('/') ? s.ksztaltDla(rodzaj) : null;
  const gdzie = {};
  for (const [k, v] of p) {
    if (!k.startsWith('gdzie.')) continue;
    const n = k.slice(6);
    const def = ksztalt && ksztalt.cechy ? ksztalt.cechy[n] : null;
    const typ = typeof def === 'string' ? def : def && def.typ;
    if (typ === 'liczba') { if (v !== '' && Number.isFinite(Number(v))) gdzie[n] = Number(v); }
    else if (typ === 'tak-nie') gdzie[n] = v === 'true';
    else gdzie[n] = v;
  }
  if (Object.keys(gdzie).length) f.gdzie = gdzie;
  if (p.get('szukaj')) f.szukaj = p.get('szukaj').slice(0, 200);
  if (['tak', 'razem'].includes(p.get('odlozone'))) f.odlozone = p.get('odlozone');
  // po=<akt>: tylko to, co zmieniło się po tym akcie; tak otwarta strona dogania Miejsce bez czytania całego spisu
  if (liczba(p.get('po')) !== null) f.po = liczba(p.get('po'));
  return f;
}

export async function obsluzSrodowisko(s, request, { podglad = false, kluczProbny = null, kluczProbnyWlasciciela = null, obejdz = null, budzet = null } = {}) {
  const url = new URL(request.url);
  const kto = request.headers.get('x-kto') || null;
  const slad = request.headers.get('x-cialo');
  const origin = request.headers.get('x-origin') || url.origin;
  const sciezka = url.pathname;
  const p = url.searchParams;
  // ?jako=<imię> to perspektywa bez dowodu, tylko na podglądzie; cokolwiek innego niż imię pomijamy, żeby nie dało
  // się tędy wpisać własnych wierszy do tekstu, który czytają agenci.
  const jako = poprawneImie(p.get('jako')) ? p.get('jako') : null;
  const opcje = { kto, jako, od: liczba(p.get('od')), origin, podglad, kluczProbny, kluczProbnyWlasciciela, probnyImie: request.headers.get('x-probny-imie') || null, budzet };

  if (request.method === 'GET') {
    if (sciezka.startsWith('/gosc/')) {
      const kod = s.kodGoscia(sciezka.slice(6));
      if (kod === null) return tekst('Nie ma takiego kodu gościa (kod wychodzi pod adresem dopiero wtedy, gdy wskazuje go rzecz rodzaju gosc).\n', 404);
      return new Response(kod, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': CSP_GOSCIA, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'public, max-age=600' } });
    }
    if (sciezka === '/co-tu-jest') return tekst(coTuJest(s, opcje));
    if (sciezka === '/umowa-okna') return tekst(umowaOkna());
    if (sciezka === '/rodzaje') return tekst(listaRodzajow(s));
    if (sciezka.startsWith('/rodzaj/')) {
      let rodzaj = null;
      try { rodzaj = decodeURIComponent(sciezka.slice(8)); } catch { /* zły zapis adresu */ }
      return rodzaj === null ? tekst('Zły zapis adresu rodzaju. Wszystkie rodzaje: /rodzaje\n', 400) : tekst(stronaRodzaju(s, rodzaj));
    }
    if (sciezka === '/rzeczy') return tekst(listaRzeczy(s, { ...filtrZAdresu(s, p), pomin: liczba(p.get('pomin')) || 0, ile: liczba(p.get('ile')) || 300 }));
    if (sciezka.startsWith('/rzecz/')) { const t = stronaRzeczy(s, sciezka.slice(7), { kto: opcje.kto || (podglad ? opcje.jako : null) }); return t === null ? tekst('Nie ma takiej rzeczy. Lista wszystkich: /rzeczy\n', 404) : tekst(t); }
    if (sciezka === '/api/srodowisko/opis') return json({ ok: true, ...opisDane(s, opcje) });
    if (sciezka === '/api/srodowisko/puls') return json({ ok: true, akt: s.ostatniNr() });
    if (sciezka === '/api/srodowisko/spis') {
      const filtr = filtrZAdresu(s, p);
      const pomin = liczba(p.get('pomin')) || 0;
      const rz = s.spis({ ...filtr, limit: liczba(p.get('ile')) || 1000, pomin });
      const razem = s.ile(filtr);
      return json({ ok: true, rzeczy: rz.map((x) => ({ ...x, tytul: s.tytul(x) })), razem, pokazane: rz.length, pominiete: pomin, wszystko: pomin + rz.length >= razem, akt: s.ostatniNr() });
    }
    if (sciezka === '/api/srodowisko/rzecz') {
      const rz = s.rzecz(p.get('id') || '');
      return rz ? json({ ok: true, rzecz: { ...rz, tytul: s.tytul(rz) }, historia: s.historia(rz.id), wskazuja: s.wskazujaNa(rz.id) }) : json({ ok: false, status: 404, blad: 'nie ma takiej rzeczy' });
    }
    if (sciezka === '/api/srodowisko/wersja') {
      const w = s.wersja(p.get('id') || '', liczba(p.get('akt')));
      return w ? json({ ok: true, wersja: w }) : json({ ok: false, status: 404, blad: 'nie ma takiej wersji; znaczniki wersji (pole akt) stoją w historii rzeczy: /api/srodowisko/rzecz?id=<id>' });
    }
    if (sciezka === '/api/srodowisko/ksztalty') return json({ ok: true, ksztalty: [...s.ksztalty().values()].map((k) => ({ ...k.cechy, rzecz: k.id, wersja: k.wersja })) });
  }
  if (request.method === 'POST') {
    if (sciezka === '/api/srodowisko/ruch') {
      const surowe = await cialoTekstem(request);
      if (surowe === null) return json(ZLE_KODOWANIE);
      let c = null;
      try { c = JSON.parse(surowe); } catch { /* zostaje null */ }
      if (c === null) return json({ ok: false, status: 400, blad: 'ciało żądania ma być obiektem JSON (nagłówek Content-Type: application/json)' });
      return json(await s.ruch(kto, c, { slad }));
    }
    if (sciezka === '/api/srodowisko/kod') {
      const kod = await cialoTekstem(request);
      if (kod === null) return json(ZLE_KODOWANIE);
      return json(await s.kod(kto, kod, { op: p.get('op'), slad }));
    }
    // Ręczne obejście obserwatora faktów: tylko właściciel. Funkcję `obejdz` podaje Miejsce, już związaną z ustawieniami
    // (właściciel na GitHubie, token), bo drzwi nie znają env; bez niej obserwator nie jest włączony.
    if (sciezka === '/api/srodowisko/obejdz') {
      if (!kto) return json({ ok: false, status: 401, blad: 'ręczne obejście wymaga klucza właściciela' });
      if (s.rola(kto) !== 'wlasciciel') return json({ ok: false, status: 403, blad: 'obserwatora faktów budzi ręcznie tylko właściciel' });
      if (typeof obejdz !== 'function') return json({ ok: false, status: 503, blad: 'obserwator nie chodzi w tym Miejscu: nie jest włączony (ustawienie OBSERWATOR=tak) albo nie ma wstępu pod ten adres (ustawienie OBSERWATOR_ADRESY)' });
      // ?ile=<1..50>: ile repozytoriów ma dostać sprawdzone gałęzie w tym obejściu; wartość spoza zakresu pomijamy
      const ile = Number(p.get('ile'));
      const w = await obejdz(Number.isInteger(ile) && ile >= 1 && ile <= 50 ? { ileRepoNaRaz: ile } : {});
      return json({ ...w, ...(w && w.ok === false ? { status: 502 } : {}) });
    }
    if (sciezka === '/api/srodowisko/widzialem') {
      if (!kto) return json({ ok: false, status: 401, blad: 'zapisanie wizyty wymaga klucza; bez klucza wróć pod adres /co-tu-jest?od=<numer aktu>' });
      let c = null;
      try { c = JSON.parse((await cialoTekstem(request)) || 'null'); } catch { /* zostaje null */ }
      return json(s.r.widzialem(kto, c && Number.isInteger(c.akt) ? c.akt : s.ostatniNr()));
    }
  }
  if (sciezka.startsWith('/api/')) return json({ ok: false, status: 404, blad: 'nie ma takiej ścieżki; wszystkie są opisane pod /co-tu-jest' });
  return tekst('Nie ma takiego adresu. Wszystko o tym Miejscu: /co-tu-jest\n', 404);
}
