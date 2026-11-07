# R1 — minimalny rdzeń zapisów z trzema konsumentami naraz

**Status: próba.** Sprawdza szkic z [docs/rdzen-zapisow-szkic.md](../../docs/rdzen-zapisow-szkic.md). Rdzeń zawiera tylko trzy rzeczy: niezmienne zapisy z tożsamością z treści, głowy przesuwane metodą porównaj i zamień, z prawami według stopni, oraz dziennik. Pytanie brzmi, czy trzej różni konsumenci mieszczą się na nim bez dopisywania pojęć.

## Wynik (4 XI 2026, Opus w czacie)

Cztery testy przechodzą. Rdzeń ma ok. 70 linii.

| Pytanie | Wynik |
| --- | --- |
| Czy ustawienia pojazdu, uwagi z biurka i własna próba agenta mieszczą się na jednym rdzeniu bez nowych pojęć? | tak; propozycja agenta to zwykły zapis ze wskazaniem podstawy, uwaga to zapis wskazujący poprzednią uwagę i wersję ustawień |
| Czy stopnie prawa do skutku da się wymusić na głowach? | tak; agent nie przesunie głowy właściciela ani cudzej próby, a w swojej przestrzeni działa bez pytania |
| Czy karta ze starym stanem może nadpisać nowszy? | nie; przesunięcie z nieaktualnego miejsca zwraca `ok: false`, a moduł biurka przebudowuje uwagę i ponawia. Obie uwagi zostają |
| Czy dziennik odpowiada na pytanie *co się działo pod moją nieobecność*? | tak; 20 kroków agenta to 20 zapisów i 20 przesunięć od znacznika |
| Czy eksport i import zachowują tożsamości? | tak, a podrobiona treść jest odrzucana przy imporcie |

## Granice

- Dwie karty są tu symulowane w jednym procesie. Prawdziwy adapter trwałości musi wykonać *porównaj i zamień* atomowo między kartami (na przykład transakcją IndexedDB albo blokadą Web Locks). To nie jest jeszcze sprawdzone.
- Porównanie pól, przypięcia i werdykty ustawień nie są tu przeniesione. Należą do modułu ustawień, czyli kodu z `e1-wersje`.
- **Poprawione 8 XI:** treść zapisu nie była zamrożona w głąb, więc zapis oddany przez referencję dało się zmienić pod tym samym id, bez zdarzenia w dzienniku (błąd odtworzyła Astra 5 XI w swojej rundzie sprawdzającej). Teraz treść jest zamrożona przy zapisie i imporcie, a test powtarza jej przypadek.
- Dwie granice, które Astra nazwała, nie są błędami, tylko pytaniami do umowy rdzenia. Pierwsza: dwie osoby zapisujące tę samą treść dają jeden zapis przypisany pierwszej, więc akt wkładu trzeba by zapisywać osobno, jeśli ma nieść historię. Druga: głowa A → B → A przepuszcza klienta, który pamięta pierwsze A, więc tam, gdzie liczy się świeżość, potrzebny jest numer pokolenia głowy.
- Rdzeń importuje `sha256hex` i `canonical` z próby `e1-wersje`. Jedna próba zależy od drugiej, co jest dopuszczalne tylko między próbami.

**Zburzymy ją, gdy** porównanie z rdzeniem dokumentu z Feniks-Studio albo prawdziwy konsument pokaże, że trzeba dopisać pojęcie, które naprawdę jest wspólne, albo gdy rdzeń zapisów wybrany w etapie 1B ją zastąpi.
