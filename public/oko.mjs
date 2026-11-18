// Stan oka (18 XI 2026; wiersz 12 listy wyjścia z gruntu): to, co widział piszący, gdy zostawiał słowo. Twarz dopisuje
// go do słowa, żeby agent mógł odtworzyć widok (opis po stronie środowiska: worker/oko.mjs).
// Wersja twarzy to odcisk plików, które naprawdę chodzą w tej przeglądarce: zmienia się sam z każdą zmianą kodu, bez
// numeru wpisywanego ręką. Liczy się dopiero wtedy, gdy ktoś zostawia słowo, więc zwykłe otwarcie strony nic nie kosztuje.

const odciski = new Map();
export function odciskTwarzy(adresy) {
  const klucz = adresy.join('|');
  if (!odciski.has(klucz)) odciski.set(klucz, (async () => {
    try {
      const teksty = await Promise.all(adresy.map(async (a) => { const o = await fetch(a); if (!o.ok) throw new Error(a); return o.text(); }));
      const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(teksty.join('\n')));
      return [...new Uint8Array(h)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch { odciski.delete(klucz); return null; }
  })());
  return odciski.get(klucz);
}

// Ekran podajemy z grubsza: szerokość i wysokość okna zaokrąglone do 10, czy to dotyk, i klasa szerokości.
export async function stanOka({ twarz, pliki, akt, widok = null, ciemny = null, bezpiecznie = false, stan = null }) {
  const wersja = await odciskTwarzy(pliki);
  const szer = Math.round(innerWidth / 10) * 10, wys = Math.round(innerHeight / 10) * 10;
  return {
    twarz, wersja: wersja || 'nieznana', akt: Number.isInteger(akt) ? akt : 0, ...(widok ? { widok } : {}),
    ekran: { szer, wys, klasa: szer < 600 ? 'waski' : szer < 1100 ? 'sredni' : 'szeroki', dotyk: matchMedia('(pointer: coarse)').matches },
    ...(ciemny === null ? {} : { ciemny: !!ciemny }), ...(bezpiecznie ? { bezpiecznie: true } : {}), ...(stan ? { stan } : {}),
  };
}
