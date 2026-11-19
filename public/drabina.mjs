// Drabina przedstawień jako wartość pokrętła (typ `drabina`, 19 XI 2026): od jakiej miary karty na ekranie pojawia się
// który element (imię, podpis rodziny, wiersz życia, opis, gałęzie). Specyfikacja: Opus czatu, 19 XI 18:26 (Commons,
// wplywy/2026-11-19-opus-czat-orientacja-i-klocek-drabina.md, § 2). Po co: poziom szczegółu ma być do strojenia ręką
// bez wydania kodu, z zasięgiem (Miejsce, widok, profil telefonu, jedna rzecz), historią i cofnięciem jak każda wartość.
//
// JEDNA REGUŁA DLA DWÓCH STRON. Sprawdza ją zaplecze przy zapisie (worker/ustawienia.mjs, wadaWartosci) i twarz przy
// odczycie (public/pokretla.mjs, pasuje). Dwie kopie tej samej reguły rozjechałyby się przy pierwszej zmianie, a wartość,
// którą zaplecze przyjęło, a twarz odrzuciła, cicho wracałaby do domyślnej. Dlatego reguła mieszka tu, w module bez
// zależności, który wolno wczytać i w Workerze, i w przeglądarce.
//
// Kształt wartości: { szczeble: [ szczebel, ... ] }, od 1 do 24 szczebli. Szczebel:
//   co      napis jak człon nazwy pokrętła (/^[a-z][a-z0-9_]{0,39}$/), bez powtórzeń; twarz pomija `co`, którego nie zna,
//           więc nowa twarz i nowy element nie psują starych wartości;
//   miara   {szer?, wys?}: mniejsza z (szerokość karty na ekranie × szer, wysokość × wys); przynajmniej jedno pole,
//           liczby większe od 0; brak pola znaczy, że ten wymiar nie ogranicza;
//   albo od, do       (px miary, 0 ≤ od ≤ do): szczebel przenika od niewidocznego do pełnego; od = do = 0 znaczy "zawsze";
//   albo rozmiar      {od > 0, do ≥ od} (px pisma): szczebel ciągły, rozmiar startowy to miara przycięta do zakresu;
//        ucinaj       {szer_od ≥ 0, wys_od ≥ 0, rozmiar > 0} (niewymagane, tylko przy rozmiar): wersja ucięta
//                     wielokropkiem tylko na karcie szerszej niż szer_od i wyższej niż wys_od;
//   krzywa  (niewymagana) kształt przenikania: nazwa krzywej albo cztery liczby Béziera, jak w typie `krzywa`.
// Nieznane pole (w wartości, w szczeblu, w mierze, w rozmiarze, w ucinaj) jest odrzucane: pole, którego nikt nie czyta,
// wyglądałoby jak ustawienie, a nie robiłoby nic.

export const NAJWIECEJ_SZCZEBLI = 24;
// Te same nazwy co KRZYWE w worker/ustawienia.mjs (pilnuje tego sprawdzian w worker/drabina.test.mjs).
export const KRZYWE_DRABINY = ['liniowa', 'gladka', 'wejscie', 'wyjscie', 'wejscie-wyjscie'];
const CO = /^[a-z][a-z0-9_]{0,39}$/;
const liczba = (x) => typeof x === 'number' && Number.isFinite(x);
const obiekt = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const obce = (o, wolno) => Object.keys(o).find((k) => !wolno.includes(k));

// Wartość domyślna = dzisiejszy kod Startu (pień 057c9a5, public/start/start.mjs w. 242, 301, 310, 343, 375, 391), więc
// po przejściu Startu na drabinę rysuje on dokładnie to samo. Ułamki w pełnej precyzji JavaScriptu (1/9, 1/3,4, 1/1,5,
// 1/1,4): przy czterech cyfrach rozmiar imienia różniłby się o ok. 0,01 px na 1000 px szerokości (pomiar Opusa czatu).
export const DRABINA_DOMYSLNA = Object.freeze({
  szczeble: Object.freeze([
    Object.freeze({ co: 'imie', miara: Object.freeze({ szer: 0.1111111111111111, wys: 0.29411764705882354 }), rozmiar: Object.freeze({ od: 9, do: 34 }), ucinaj: Object.freeze({ szer_od: 64, wys_od: 20, rozmiar: 9.5 }) }),
    Object.freeze({ co: 'podpis_rodziny', miara: Object.freeze({ szer: 1 }), od: 60, do: 160 }),
    Object.freeze({ co: 'zycie', miara: Object.freeze({ szer: 0.6666666666666666, wys: 1 }), od: 62, do: 96 }),
    Object.freeze({ co: 'opis', miara: Object.freeze({ szer: 0.7142857142857143, wys: 1 }), od: 100, do: 150 }),
    Object.freeze({ co: 'galezie', miara: Object.freeze({ szer: 1, wys: 1.3 }), od: 300, do: 460 }),
  ]),
});

function wadaKrzywej(k) {
  if (typeof k === 'string') return KRZYWE_DRABINY.includes(k) ? null : `krzywa: jedna z nazw (${KRZYWE_DRABINY.join(', ')}) albo cztery liczby [x1, y1, x2, y2]`;
  return Array.isArray(k) && k.length === 4 && k.every(liczba) && k[0] >= 0 && k[0] <= 1 && k[2] >= 0 && k[2] <= 1 ? null : 'krzywa Béziera to cztery liczby [x1, y1, x2, y2], x1 i x2 od 0 do 1';
}

// Co jest nie tak z wartością drabiny; null, gdy nic. Jedno zdanie, które mówi, który szczebel i co poprawić.
export function wadaDrabiny(w) {
  if (!obiekt(w) || !Array.isArray(w.szczeble)) return `drabina to {szczeble: lista od 1 do ${NAJWIECEJ_SZCZEBLI} szczebli}`;
  const zle = obce(w, ['szczeble']);
  if (zle !== undefined) return `drabina ma tylko pole szczeble; pola ${JSON.stringify(zle)} nikt nie czyta`;
  if (w.szczeble.length < 1 || w.szczeble.length > NAJWIECEJ_SZCZEBLI) return `drabina ma od 1 do ${NAJWIECEJ_SZCZEBLI} szczebli, a ta ma ${w.szczeble.length}`;
  const byly = new Set();
  for (const [i, s] of w.szczeble.entries()) {
    const gdzie = `szczebel ${i + 1}`;
    if (!obiekt(s)) return `${gdzie}: ma być obiektem {co, miara, od i do albo rozmiar}`;
    if (typeof s.co !== 'string' || !CO.test(s.co)) return `${gdzie}: co to nazwa elementu z małych liter, cyfr i _ (do 40 znaków, na początku litera), np. opis`;
    const tu = `szczebel ${i + 1} (${s.co})`;
    if (byly.has(s.co)) return `${tu}: ten element ma już szczebel wyżej; jeden element, jeden szczebel`;
    byly.add(s.co);
    const pole = obce(s, ['co', 'miara', 'od', 'do', 'rozmiar', 'ucinaj', 'krzywa']);
    if (pole !== undefined) return `${tu}: pola ${JSON.stringify(pole)} nikt nie czyta; szczebel ma co, miara, od i do albo rozmiar, ucinaj i krzywa`;
    if (!obiekt(s.miara)) return `${tu}: miara to {szer, wys}, przynajmniej jedno pole`;
    const wMierze = obce(s.miara, ['szer', 'wys']);
    if (wMierze !== undefined) return `${tu}: miara ma tylko szer i wys; pola ${JSON.stringify(wMierze)} nikt nie czyta`;
    if (!('szer' in s.miara) && !('wys' in s.miara)) return `${tu}: miara potrzebuje przynajmniej jednego pola (szer albo wys); bez nich nie ma czego mierzyć`;
    for (const k of ['szer', 'wys']) if (k in s.miara && !(liczba(s.miara[k]) && s.miara[k] > 0)) return `${tu}: miara.${k} ma być liczbą większą od 0`;
    const przenika = 'od' in s || 'do' in s;
    const ciagly = 'rozmiar' in s;
    if (przenika && ciagly) return `${tu}: szczebel ma albo od i do (przenikanie), albo rozmiar (szczebel ciągły), nie oba naraz`;
    if (!przenika && !ciagly) return `${tu}: brakuje od i do (przenikanie) albo rozmiar (szczebel ciągły)`;
    if (przenika) {
      if (!(liczba(s.od) && liczba(s.do) && s.od >= 0 && s.do >= 0)) return `${tu}: od i do to liczby nie mniejsze niż 0 (px miary); od = do = 0 znaczy "zawsze"`;
      if (s.od > s.do) return `${tu}: od (${s.od}) jest większe niż do (${s.do}); przenikanie idzie od mniejszej miary do większej`;
      if ('ucinaj' in s) return `${tu}: ucinaj ma sens tylko przy szczeblu ciągłym (rozmiar)`;
    } else {
      const r = s.rozmiar;
      if (!obiekt(r) || obce(r, ['od', 'do']) !== undefined || !(liczba(r.od) && liczba(r.do) && r.od > 0 && r.do >= r.od)) return `${tu}: rozmiar to {od, do} w px pisma, od większe od 0, do nie mniejsze niż od`;
      if ('ucinaj' in s) {
        const u = s.ucinaj;
        if (!obiekt(u) || obce(u, ['szer_od', 'wys_od', 'rozmiar']) !== undefined || !(liczba(u.szer_od) && u.szer_od >= 0 && liczba(u.wys_od) && u.wys_od >= 0 && liczba(u.rozmiar) && u.rozmiar > 0))
          return `${tu}: ucinaj to {szer_od >= 0, wys_od >= 0, rozmiar > 0} w px; wszystkie trzy pola`;
      }
    }
    if ('krzywa' in s) { const k = wadaKrzywej(s.krzywa); if (k) return `${tu}: ${k}`; }
  }
  return null;
}
