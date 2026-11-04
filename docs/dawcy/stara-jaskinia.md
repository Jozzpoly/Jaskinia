# Dawca: stara Jaskinia (v6.4.1) — pierwsza mapa modułów

Szkic do etapu 1A planu budowy, 4 XI 2026. Źródło: publiczne repo `Jozzpoly/Jozz-Cave-Workbench`, gałąź `main`, katalog `src/jaskinia/`. Moduły są skrypcjami składanymi w jeden plik HTML (`dist/biblioteka-web.html`, ok. 940 KB) i dzielą wspólny zakres globalny. Mapę zrobiono maszynowo: nagłówki modułów, klucze `localStorage` i odwołania między modułami po nazwach. Do sprawdzenia uruchomieniem.

**Status: dawca, nie fundament.** Przenosimy zachowania i sprawdzone pomysły. Struktury nie kopiujemy w ciemno.

## Moduły

| Moduł | Rozmiar | Co robi (według nagłówka) | Klucze w przeglądarce |
| --- | --- | --- | --- |
| `00-base` | 10 KB | wspólne narzędzia, preferencje | `jaskinia:prefs` |
| `05-i18n` | 84 KB | angielskie teksty obok polskich (`t()`, `tn()`) | — |
| `10-model` | 11 KB | model układu okien, czysty, bez DOM | — |
| `15-store` | 28 KB | magazyn: co Jaskinia trzyma i jak nic nie ginie | `jaskinia:v3`, `v2`, `v1`, `kopie`, `ratunek` |
| `20-stats` | 22 KB | statystyki liczone z migawki (słoje) | — |
| `30-wall` | 58 KB | ściana projektów | — |
| `40-types` | 25 KB | co może pokazać okno (rejestr typów okien) | — |
| `45-settings` | 32 KB | motywy i okno ustawień | — |
| `50-shell` | 95 KB | przestrzenie, okna i ręka, która je układa | `jaskinia:hint` |
| `52-przyrzady` | 24 KB | laby i gry właściciela w oknie | `jaskinia:przyrzady` |
| `55-feedback` | 22 KB | dziennik zdarzeń, uwaga przypięta do chwili (*To mnie uwiera*), paczka dla Claude'a | `jaskinia:dziennik`, `jaskinia:uwagi`, `jaskinia-paczka` |
| `56-swiat` | 35 KB | wspólny silnik 3D okien 3D | — |
| `56b-blockbench` | 9 KB | czytanie plików `.bbmodel` | — |
| `57-materialy` | 58 KB | modele i tekstury właściciela trzymane w przeglądarce | `jaskinia-materialy` i inne |
| `57b-ruch` | 55 KB | Ruch: części poruszane ręką (w v6.4 próba, a nie język Studio) | — |
| `58-api` | 5 KB | `window.Jaskinia`: co mogą używać inne narzędzia | — |
| `59-adresy` | 11 KB | adresy: wszystko, co wskazuje właściciel albo agent, ma link | — |
| `90-start` | — | start | — |

## Szwy, czyli gdzie ciąć przy przenoszeniu

1. **Liście bez zależności w dół:** `00-base`, `05-i18n` i `10-model`. Model układu jest czysty, więc można go przenieść pierwszy i od razu objąć testami.
2. **Magazyn.** Kształt stanu (`store.spaces`, uwagi, zapisane układy, kosz, widoki okien) jest używany wprost: sama powłoka odwołuje się do `store` ok. 120 razy. Taniej jest zostawić kształt stanu w pamięci i wymienić tylko trwałość pod spodem: `persist`, `makeBackup`, `readBackups`, `lsGet`, `lsSet` i `storageOK`. Nowy rdzeń zapisów wchodzi właśnie tu, z wersjami i bezpieczeństwem wielu kart.
3. **Zasady starego magazynu, które zostają** (z nagłówka `15-store`):
   - automatyczne kopie przed każdym ryzykownym krokiem;
   - surowa kopia ratunkowa wszystkiego, czego nie dało się odczytać;
   - dane pierwszej wersji nigdy nie są kasowane;
   - wczytanie naprawia, co może, a resztę odkłada do kosza; nic nie jest podmieniane po cichu;
   - uwagi żyją poza układami, więc cofnięcie układu nie cofa tego, co zostało napisane.
4. **Uwagi i biurko.** API uwag (`noteNew`, `noteSet`, `noteText`, `noteTitle`, `notesReferenced`, `orphanNotes`) i `55-feedback` (dziennik, uwagi, paczka dla Claude'a) to szew, z którego wyrasta biurko v0.
5. **Rejestr typów okien** (`40-types`) to miejsce, w które wpinają się nowe pracownie, tak jak Studio z Feniks-Studio rejestrowało się jako nowy typ okna.
6. **Powłoka** (`50-shell`) korzysta z 11 innych modułów. Przenosimy ją ostatnią z rdzenia Domu i przy okazji dzielimy na mniejsze części.
7. **Biblioteka i *Zagraj*:** `30-wall`, `20-stats`, `52-przyrzady` i `59-adresy`.
8. **Później:** `56-swiat`, `56b-blockbench` i `57-materialy`. Przenosimy tylko kod: modele i tekstury właściciela nie trafiają do tego repo.
9. **Nie przenosimy** `57b-ruch` jako narzędzia (właściciel dał mu FAIL: adnotacja części zamiast budowania relacji). Zostaje lekcją.
10. **`58-api`** to zalążek wejścia agentów do Jaskini.

## Znany błąd w miejscu szwu 2

Uwaga usunięta w jednej karcie potrafi wrócić ze starego stanu drugiej karty. Najpewniej każda karta zapisuje cały stan, a nie zmianę. Nowa trwałość musi to wykluczyć. Test: dwie karty, usunięcie w pierwszej, zapis w drugiej, uwaga nie wraca.

## Lista *bez regresji* (szkic, do potwierdzenia przez właściciela i Astrę)

Przestrzenie (karty); układy zapisywane, przełączane i resetowane; gotowe układy Przegląd, Granie, Statystyki, Projekt i Ściana; dzielenie okna obok i pod spodem; wyjmowanie okna, żeby pływało; pełny ekran i powiększanie zawartości; cofnij i ponów; rodziny projektów i *Zagraj*; słoje aktywności; sygnały; *To mnie uwiera*; dziennik; paczka dla Claude'a; kopie i ratunek; polski i angielski; motywy; materiały, świat 3D i import z Blockbench.

## Kolejność przenoszenia (propozycja do sprawdzenia)

1. Liście (`00-base`, `05-i18n`, `10-model`) z testami.
2. Interfejs trwałości i nowy rdzeń zapisów pod kształtem stanu, z testem wielu kart.
3. `40-types` i `45-settings`.
4. `50-shell`, podzielona na części.
5. `30-wall`, `20-stats`, `52-przyrzady` i `59-adresy`, czyli biblioteka i *Zagraj*.
6. `55-feedback` na nowym rdzeniu, czyli biurko v0.
7. `58-api`.
8. Później 3D i materiały.
