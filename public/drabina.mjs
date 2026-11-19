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
//                     wielokropkiem tylko na karcie szerszej niż szer_od i wyższej niż wys_od.
// Nieznane pole (w wartości, w szczeblu, w mierze, w rozmiarze, w ucinaj) jest odrzucane: pole, którego nikt nie czyta,
// wyglądałoby jak ustawienie, a nie robiłoby nic. Dlatego na razie odrzucana jest też `krzywa` (kształt przenikania),
// choć stoi w specyfikacji: czytelnik Startu przenika liniowo i jej nie czyta, a kształt przenikania to wykończenie
// (druga linia Opusa czatu, 19 XI 19:56). Dopisanie jej później jest zgodne wstecz; usunięcie po zapisaniu nie byłoby.

export const NAJWIECEJ_SZCZEBLI = 24;
const CO = /^[a-z][a-z0-9_]{0,39}$/;
const liczba = (x) => typeof x === 'number' && Number.isFinite(x);
const obiekt = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const obce = (o, wolno) => Object.keys(o).find((k) => !wolno.includes(k));

// Wartości domyślnej tu nie ma: mieszka przy czytelniku Startu (public/start/drabina.mjs, Opus czatu, PR 69), razem
// z rachunkiem, który z niej korzysta, i stamtąd bierze ją pokrętło wyglad.karta.drabina. Jedna stała, jedno miejsce.

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
    const pole = obce(s, ['co', 'miara', 'od', 'do', 'rozmiar', 'ucinaj']);
    if (pole !== undefined) return `${tu}: pola ${JSON.stringify(pole)} nikt nie czyta; szczebel ma co, miara, od i do albo rozmiar, i ucinaj`;
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
  }
  return null;
}
