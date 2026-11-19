// Drabina przedstawień: kiedy karta (i blok rodziny) pokazuje imię, podpis rodziny, wiersz życia, opis i gałęzie.
// Czyste funkcje, bez DOM. Wartość domyślna to rachunek Startu z pnia 057c9a5 (start.mjs: podpis rodziny w. 242,
// imię w. 301–310, wiersz życia w. 343, opis w. 375, gałęzie w. 391), więc Start z nią rysuje to samo co przedtem.
// Opis wartości, sprawdzania i podziału pracy: wspólna pamięć agentów, wplywy/2026-11-19-opus-czat-orientacja-i-klocek-drabina.md.
// Gdy zaplecze dostanie typ `drabina`, ta wartość stanie się domyślną pokrętła `wyglad.karta.drabina`
// (public/pokretla.mjs), a Start weźmie drabinę z ustawień. Do tego czasu jedynym źródłem jest ta stała.
// Napisał Opus czatu, 19 XI 2026.

const zamroz = (o) => Object.freeze(o);

// Liczby w pełnej precyzji: 1/9, 1/3,4, 1/1,5 i 1/1,4 to te same liczby, które stoją w opisie wartości.
export const DRABINA_DOMYSLNA = zamroz({
  szczeble: zamroz([
    zamroz({ co: 'imie', miara: zamroz({ szer: 1 / 9, wys: 1 / 3.4 }), rozmiar: zamroz({ od: 9, do: 34 }),
      ucinaj: zamroz({ szer_od: 64, wys_od: 20, rozmiar: 9.5 }) }),
    zamroz({ co: 'podpis_rodziny', miara: zamroz({ szer: 1 }), od: 60, do: 160 }),
    zamroz({ co: 'zycie', miara: zamroz({ szer: 1 / 1.5, wys: 1 }), od: 62, do: 96 }),
    zamroz({ co: 'opis', miara: zamroz({ szer: 1 / 1.4, wys: 1 }), od: 100, do: 150 }),
    zamroz({ co: 'galezie', miara: zamroz({ szer: 1, wys: 1.3 }), od: 300, do: 460 }),
  ]),
});

// Szczebel o danym `co`: z podanej drabiny, a gdy go w niej nie ma (albo drabiny nie ma), z wartości domyślnej.
// Szczebel o `co`, którego twarz nie zna, po prostu nigdy nie jest pytany.
export function szczebel(drabina, co) {
  const z = drabina && Array.isArray(drabina.szczeble) ? drabina.szczeble.find((s) => s && s.co === co) : null;
  return z || DRABINA_DOMYSLNA.szczeble.find((s) => s.co === co) || null;
}

// Miara elementu dla szczebla: mniejsza z (szerokość × szer, wysokość × wys); wymiar bez pola nie ogranicza.
export function miara(s, w, h) {
  const m = (s && s.miara) || {};
  let x = Infinity;
  if (typeof m.szer === 'number') x = Math.min(x, w * m.szer);
  if (typeof m.wys === 'number') x = Math.min(x, h * m.wys);
  return x;
}

// Widoczność szczebla od 0 do 1. Przenika liniowo od `od` do `do` (jak dawne `plynnie`); gdy `od` = `do`, to próg;
// `od` = `do` = 0 znaczy „zawsze”.
export function alfa(s, w, h) {
  if (!s) return 0;
  const m = miara(s, w, h);
  if (!(s.do > s.od)) return m >= s.od ? 1 : 0;
  return Math.max(0, Math.min(1, (m - s.od) / (s.do - s.od)));
}

// Rozmiar, od którego imię zaczyna próbować: miara przycięta do [rozmiar.od, rozmiar.do]. Start schodzi z niego
// co 1,5 px (do rozmiar.od), aż imię zmieści się w najwyżej trzech liniach; krok i linie zostają w twarzy.
export function rozmiarStartowy(s, w, h) {
  const r = s.rozmiar;
  return Math.max(r.od, Math.min(r.do, miara(s, w, h)));
}

// Rozmiar wersji uciętej wielokropkiem, gdy imię nie mieści się nawet w rozmiar.od; null, gdy karta jest za wąska
// albo za niska (albo szczebel nie ma `ucinaj`): wtedy zostaje sam kolor życia.
export function ucieta(s, w, h) {
  const u = s && s.ucinaj;
  return u && w > u.szer_od && h > u.wys_od ? u.rozmiar : null;
}
