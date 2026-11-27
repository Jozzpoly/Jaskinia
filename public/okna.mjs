// Reguły okien po stronie twarzy (18 XI 2026, po trzecim niezależnym ataku). Status: próba (TYMCZASOWE.md, wiersz o oknie
// jako rzeczy). Osobny plik, żeby regułę dało się sprawdzić bez przeglądarki i żeby atakujący nie musiał jej przepisywać.
// Ten plik nie zna ani przeglądarki, ani Workera.

// Oba pokolenia okna: okno/1 strony gospodarza i okno/2 na płótnie (z widokiem i rolą, od 27 XI 2026). Reguła powrotu
// jest dla nich ta sama.
export const POKOLENIA_OKNA = ['okno/1', 'okno/2'];

// Czy okno (rzecz okno/1 albo okno/2) ma się po przeładowaniu strony otworzyć samo. Tylko wtedy, gdy:
//   - jest moje (cecha czyje), otwarte i nieodłożone,
//   - ja sam je zapisałem (założyłem i ostatnio zmieniłem): cudza ręka przy moim oknie niczego u mnie nie otwiera,
//   - narzędzie istnieje, nie jest odłożone i jest DOKŁADNIE w tej wersji, w której otworzyła je moja ręka: zgoda na
//     otwarcie dotyczy tego, co otworzyłem, a nie tego, co ktoś potem pod tę samą rzecz podstawił.
// Zwraca { wraca, powiedz }: `powiedz` to zdanie dla człowieka, gdy okno nie wraca, a powinien o tym wiedzieć.
export function oknoWracaSamo(okno, gosc, ja) {
  const nie = (powiedz = null) => ({ wraca: false, powiedz });
  if (!okno || !POKOLENIA_OKNA.includes(okno.rodzaj) || okno.odlozone || typeof ja !== 'string' || !ja) return nie();
  const c = okno.cechy || {};
  if (c.czyje !== ja || c.otwarte !== true) return nie();
  if (okno.utworzyl !== ja || okno.zmienil !== ja) return nie();
  if (!gosc || gosc.id !== c.gosc || gosc.odlozone || typeof gosc.rodzaj !== 'string' || !gosc.rodzaj.startsWith('gosc/')) return nie();
  if (!Number.isInteger(c.wersja_goscia)) return nie();
  if (gosc.wersja !== c.wersja_goscia) return nie(`Narzędzie "${gosc.tytul || c.nazwa || 'bez nazwy'}" zmieniło się, odkąd je otwarto, więc nie otwieram go samo. Otwórz je ręcznie, jeśli chcesz.`);
  return { wraca: true, powiedz: null };
}
