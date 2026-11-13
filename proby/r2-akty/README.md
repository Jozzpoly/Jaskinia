# R2 — rdzeń, w którym AKT jest osobny od ZAPISU

**Status: próba.** Stoi **obok** [R1](../r1-rdzen-minimalny/README.md), nie zamiast niego. R1 zostaje nietknięty: nadpisanie go zniszczyłoby porównanie dawców (zasada 7) i unieważniłoby falsyfikatory z [#5](https://github.com/Jozzpoly/Jaskinia/pull/5) i [#6](https://github.com/Jozzpoly/Jaskinia/pull/6), które opisują właśnie jego stan.

## Pytanie

Czy rozdzielenie **trzech tożsamości** — treści, operacji i aktu — zdejmuje znane granice R1, nie dopisując do rdzenia żadnego nowego pojęcia domenowego i nie tracąc żadnego zachowania, które R1 już ma?

## Skąd to się wzięło — uczciwie

Kierunek nie jest mój. README R1 od 8 XI mówi wprost: *„dwie osoby zapisujące tę samą treść dają jeden zapis przypisany pierwszej, więc **akt wkładu trzeba by zapisywać osobno**, jeśli ma nieść historię"*. Granicę wskazał **Browser GPT 4 XI** z lektury kodu, **Astra odtworzyła ją uruchomieniem 5 XI**. Drugą — głowa A → B → A przepuszczająca klienta z pierwszym A — wskazała **Astra 5 XI**.

Mój wkład to: policzenie tego falsyfikatorami (F1–F6 i P1–P5), implementacja, i **tożsamość operacji**, której w tamtym opisie nie było.

Tożsamość operacji postawiła **Astra 10 XI**, w pracy odzyskanej z wiadomości Jozza po tym, jak urwało jej dostęp: *„Zapis każdego wywołania nie powinien automatycznie zmieniać retry po utraconej odpowiedzi w drugą autorską decyzję."* Bez tego moja poprawka zamieniłaby jedną wadę na drugą, lustrzaną. Jej trzy obserwacje odtworzyłem uruchomieniem na `f33a851`: 3/3 potwierdzone.

## Co się zmieniło

| | pytanie, na które odpowiada | jak |
| --- | --- | --- |
| **tożsamość treści** (`recordId`) | czy to ta sama rzecz | skrót rodzaju, treści i odnośników — jak w R1 |
| **tożsamość operacji** (`op`) | czy to ta sama **czynność** | podaje wywołujący; dwa dostarczenia = jeden akt |
| **akt** (zdarzenie dziennika) | kto i kiedy to zrobił | jeden na odrębną operację, nigdy deduplikowany po treści |

Najważniejsza poprawka **usuwa pole, a nie dodaje**: `kto` schodzi z rekordu. Rekord adresowany treścią nie ma jednego autora, bo dwie osoby mogą dojść do tej samej treści niezależnie. Autor należy do aktu. W R1 `kto` siedziało w rekordzie i było zamrażane z *pierwszym* piszącym.

Doszło też `pokolenie` głowy (rośnie przy każdym przesunięciu, nigdy nie wraca) i `czas` w każdym akcie.

## Wynik (10 XI 2026)

**53 testy w repo, wszystkie zielone, zero `todo`.** Z tego 20 w tej próbie.

| | wynik |
| --- | --- |
| trzej konsumenci R1 (ustawienia, uwagi, próba agenta) na tym samym rdzeniu | tak, bez nowych pojęć |
| F1, F2, F3, F4, F5 z #5 | przechodzą |
| P1, P2, P4, P5 z #6 | przechodzą |
| retry: dwa dostarczenia jednej operacji | jeden akt |
| ta sama operacja z inną treścią | błąd, nie cicha zmiana |
| obs. 1 Astry: dwa wywołania tego samego autora bez `op` | dwa akty, dwie chwile |
| granica Astry z 5 XI: głowa A → B → A | z `pokolenie` klient z pierwszym A przegrywa |
| droga migracji z formatu R1 (zasada 8) | autor zostaje (był w dzienniku), pokolenie odtworzone z historii, **czas `null` + `czasNieznany`** |

Czasu w R1 nie było, więc go **nie wymyślam**. Zmyślona data byłaby gorsza od przyznanej luki.

## Granice — czego to nie rozwiązuje

Obie zostają w kodzie jako **przechodzące testy nazwane `NIEROZWIĄZANE`**, żeby nie dało się ich przemilczeć:

- **obs. 2 Astry / F6 z #5:** spójna podmiana autora w rekordzie **i** dzienniku naraz przechodzi import. Zgodność tych pól nie jest dowodem pochodzenia. Potrzebna jest zewnętrzna, uwierzytelniona podstawa (podpisy); ten rdzeń jej nie ma. Moje F6 podmieniało tylko dziennik, więc kontrola krzyżowa by to złapała — **jej przypadek jest mocniejszy i pokazuje, że kontrola krzyżowa nie wystarcza.**
- **obs. 3 Astry:** dwie niezależne kopie magazynu przyjmują własne zmiany od tej samej bazy. Oczekiwane dla kopii lokalnych, ale rdzeń nie ma wspólnej trwałości ani rozstrzygania między originami.

Dalej:

- Kolejność zatwierdzenia daje `n`, nie `czas`. Zegary się cofają, akty nie. Astra: *„Czas ścienny pomaga odnaleźć kopię; sam nie zastępuje tożsamości operacji ani kolejności zatwierdzenia."*
- Dwie karty są symulowane w jednym procesie. Prawdziwy adapter trwałości musi wykonać *porównaj i zamień* atomowo (transakcja IndexedDB albo Web Locks). Niesprawdzone, tak samo jak w R1.
- `op` jest **dobrowolne**, żeby powierzchnia została wspólna z R1. Konsument, który go nie podaje, nie ma ochrony przed retry. Czy ma być obowiązkowe, to pytanie do umowy, nie do tej próby.
- Rdzeń importuje `sha256hex` i `canonical` z próby `e1-wersje`, jak R1. Zależność między próbami, dopuszczalna tylko tam.
- Zielone testy nie są Owner UX i nie są dowodem na prawdziwym przypadku.

**Zburzymy ją, gdy** pierwszy prawdziwy konsument pokaże, że rozdzielenie trzech tożsamości jest za drogie albo że brakuje pojęcia naprawdę wspólnego; gdy wynik Fable 5.2 da lepszy fundament; albo gdy porównanie z rdzeniem dokumentu z Feniks-Studio wypadnie na jego korzyść.
