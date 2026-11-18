// Czasowniki ręki (18 XI 2026; wiersz 10 listy wyjścia z gruntu). Status: próba (TYMCZASOWE.md).
// JEDNA tablica tego, co ręka może zrobić na twarzy. Z niej rysuje się pomoc ("?") na samej twarzy i z niej środowisko
// mówi agentom, co umie ręka (spis czasowników w opisie Miejsca): agent, który czyta słowo "przeciągnąłem i nic", wie,
// który to gest i co on zapisuje. Nazwy są umową: <twarz>.<czasownik>.
// Czego tu nie ma: przypisania gestu albo klawisza do czasownika jako ustawienia (dziś gest stoi w kodzie twarzy, a tu
// jest opisany zdaniem) i palety poleceń.
// Ten plik nie zna ani przeglądarki, ani Workera.

export const CZASOWNIKI_REKI = [
  { nazwa: 'start.przesun-widok', twarz: 'start', co: 'Przesuwanie widoku', jak: 'przeciągnij puste miejsce (albo środkowym przyciskiem); na dotyku jednym palcem' },
  { nazwa: 'start.przybliz', twarz: 'start', co: 'Przybliżanie', jak: 'kółko w miejscu kursora; na dotyku dwa palce. Z bliska projekt pokazuje swoje gałęzie' },
  { nazwa: 'start.stan', twarz: 'start', co: 'Stan stały albo ciekły', jak: 'suwak u góry: stały to położenia z ręki, ciekły liczy się z położeń stałego' },
  { nazwa: 'start.poloz-projekt', twarz: 'start', co: 'Położenie projektu (stan stały)', jak: 'przeciągnij projekt, żeby go położyć; zapis idzie dopiero, gdy puścisz, i nic nie rusza się samo', zapisuje: 'miejsce/1' },
  { nazwa: 'start.zamien-projekty', twarz: 'start', co: 'Zamiana miejscami (stan ciekły)', jak: 'upuść projekt na inny; to jeden gest z dwóch zapisów', zapisuje: 'miejsce/1' },
  { nazwa: 'start.karta', twarz: 'start', co: 'Karta projektu', jak: 'dotknij projekt: czym jest, skąd się tu wziął, wejście do grania i miejsce na słowo' },
  { nazwa: 'start.zagraj', twarz: 'start', co: 'Otwarcie gry', jak: 'dwuklik na projekcie, który ma wejście' },
  { nazwa: 'start.slowo', twarz: 'start', co: 'Słowo przy projekcie', jak: 'w karcie projektu napisz i zostaw; słowo niesie stan oka, czyli to, co było widać', zapisuje: 'slowo/1' },
  { nazwa: 'start.cofnij', twarz: 'start', co: 'Cofnięcie ostatniego gestu', jak: 'guzik ↶ albo Ctrl+Z', klawisz: 'Ctrl+Z', ruch: 'cofnij-gest' },
  { nazwa: 'start.ponow', twarz: 'start', co: 'Ponowienie cofniętego gestu', jak: 'guzik ↷ albo Ctrl+Shift+Z', klawisz: 'Ctrl+Shift+Z', ruch: 'cofnij-gest' },
  { nazwa: 'start.zapisz-uklad', twarz: 'start', co: 'Zapis układu', jak: 'guzik „układy”, potem „Zapisz obecny układ”', zapisuje: 'chwila/1' },
  { nazwa: 'start.wroc-do-ukladu', twarz: 'start', co: 'Powrót do zapisanego układu', jak: 'guzik „układy”, potem „wróć” przy nazwie; powrót da się cofnąć', ruch: 'przywroc-uklad' },
  { nazwa: 'start.caly-widok', twarz: 'start', co: 'Cały widok', jak: 'guzik „cały widok”' },
  { nazwa: 'start.wyglad-domyslny', twarz: 'start', co: 'Wygląd domyślny', jak: 'guzik ◐ u góry: wyjście z każdego nieczytelnego wyglądu' },
];

// Czasowniki jednej twarzy, w kolejności tablicy.
export const czasownikiTwarzy = (twarz) => CZASOWNIKI_REKI.filter((c) => c.twarz === twarz);
