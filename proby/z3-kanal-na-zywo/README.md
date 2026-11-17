# Z3: kanał na żywo

**Pytanie.** Czy otwarta strona może dowiadywać się o zmianach w Miejscu od razu i bez pytania, nie dostając kanałem
niczego, czego nie przeczytałaby zwykłymi drzwiami?

**Co sprawdza skrypt.** Trzy prawdziwe połączenia pod adresem podglądu (zwiedzający bez klucza, właściciel próbny
i agent próbny), ruchy przez zwykłe drzwi i czas, po którym każde połączenie wie o zmianie; obecność (imiona tylko dla
połączeń z kluczem, rzecz, przy której ktoś jest, wyłącznik); ping; zły klucz; czytanie samych zmian (`spis` z
`po=<akt>`); koszt czytania z nagłówka `x-koszt`. Słowa dołożone do próby skrypt na końcu odkłada.

**Jak powtórzyć.** `node proby/z3-kanal-na-zywo/proba.mjs <adres podglądu> [ile ruchów]` (Node 22 albo nowszy, bo
skrypt używa wbudowanego `WebSocket`). Klucze próbne podglądów są jawne i stoją w `wrangler.jsonc`.
Odmowy drzwi osobno: `curl -s -o /dev/null -w '%{http_code}' <adres>/api/srodowisko/zywe` daje 426 (to nie jest
połączenie), a to samo z nagłówkami `Upgrade: websocket` i `Origin: https://obca.test` daje 403 (obca strona).

**Wynik (17 XI 2026, podgląd gałęzi `fable/zywe`, jedna maszyna, obiekt rozgrzany).** 14 z 14 sprawdzeń.

| Co | Wynik |
| --- | --- |
| sygnał o zmianie od wysłania ruchu do odebrania w połączeniu (mediana z 5 ruchów) | zwiedzający 148 ms, właściciel 137 ms, agent 137 ms (od 89 do 203 ms) |
| sama odpowiedź drzwi na ten sam ruch | 155 ms |
| jeden ruch (słowo) | 20 wierszy zapisanych, 6 czytanych |
| czytanie zmian po akcie: jedna zmieniona rzecz / nic się nie zmieniło | 47 / 3 wiersze czytane |
| opis przy 48 rzeczach: pierwszy raz po zmianie / drugi raz | 423 / 121 wierszy czytanych |
| strona w przeglądarce: żądania przez kilkanaście sekund z jedną cudzą zmianą i jednym obejściem obserwatora | cztery (dwa razy opis i dwa razy `spis?po=`), żadnego pytania o puls |

W przeglądarce nagłówek strony pokazał `na żywo` i `są też: agent-probny (przy: Lista rzeczy)`, słowo agenta pojawiło
się na karcie bez przeładowania, a obejście obserwatora faktów (71 nowych rzeczy) przyszło tym samym sygnałem.

**Granice.**

- Jedna maszyna, jedno miejsce na świecie, obiekt Miejsca rozgrzany. Nie zmierzyłem pierwszej wiadomości po długim
  śnie obiektu ani zachowania przy wdrożeniu (wtedy wszystkie połączenia się zrywają; strona ma wrócić do pytania
  o puls i połączyć się ponownie).
- Prawdziwy telefon, słaba sieć i karta w tle: niesprawdzone.
- Kanał niesie sam numer ostatniego aktu, więc widoczność zostaje przy drzwiach. Ceną jest jedno czytanie po każdym
  sygnale.
- Imię połączenia jest sprawdzane przy przedstawieniu się, nie przy każdej wiadomości: po odebraniu klucza połączenie
  zachowuje imię do zerwania (najpóźniej do następnego wdrożenia). Słyszy wtedy numery aktów i obecność, nic więcej.
- Najwyżej 100 połączeń naraz i 60 wiadomości na minutę z jednego; gdy jest pełno, ustępuje najstarsze bez klucza.

**Kiedy burzymy.** Gdy pomiar z tygodnia użycia pokaże, że kanał kosztuje więcej niż pytanie o puls (np. przez
obecność, która budzi obiekt przy każdym otwarciu okna); gdy właściciel dostanie sesję zamiast klucza i przedstawianie
się kluczem w pierwszej wiadomości przestanie być potrzebne; albo gdy zdarzenia będą musiały nieść treść zmiany,
co wymaga prawa czytania liczonego dla każdego połączenia osobno.
