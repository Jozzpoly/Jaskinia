# C2 — natywne okna starej Jaskini jako minimalny standard doświadczenia

**Status: prototyp integracyjny i droga odtworzenia; NIE ukończony test w prawdziwym buildzie starej Jaskini.** C2 żyje w izolowanej [gałęzi badawczej C1](https://github.com/Jozzpoly/Jaskinia/tree/experiment/coopege-studio-donor-2026-11-05/proby/c1-coopege-studio-donor). Zero zmian main, oryginalnej Jaskini, oryginalnego Coopege i danych Ownera.

## Dlaczego

**Owner, 6 XI:** pierwsze, co próbował zrobić w udostępnionym C1, to **przeciągnąć granicę okna gry i edytora**. Nie mógł. Odczuł to jako regres względem Jaskini, której okna Opus doprowadził już do jakości będącej dla Ownera **minimalnym standardem**. Zwrócił uwagę, że agenci systematycznie tworzą własne uproszczone powłoki mimo istnienia Jaskini. Nowa Jaskinia ma docelowo znacznie przekroczyć obecną, nie tylko odwzorować jej dzisiejsze funkcje.

Z tego wynika praktyczna korekta: krótki jednorazowy test transportu API może mieć prymitywną powłokę, lecz **eksperyment oddany Ownerowi do realnej pracy powinien używać natywnej kompozycji starej Jaskini albo udowodnionego co najmniej równorzędnego rozwiązania.** Nie traktować tego jako zamrożenia jednego toolkit/hosta na lata.

## Jak C2 wykorzystuje prawdziwe okna

- **Nie tworzy powłoki okien**: rejestruje przez publiczne `window.Jaskinia.ext.type` dwa typy `C2 · Gra` i `C2 · Pracownia`, otwiera je przez `Jaskinia.ext.open` w istniejącym warsztacie starej Jaskini.
- Oba typy mają `live:true` i stały `liveKey`: zmiana podziału, skalowanie, float/dock/restore, układu i motywu powinny zachować działający instrument **według obecnego kontraktu Jaskini**. To *oczekiwanie wynikające z kodu Jaskini*, a nie przebadany wynik C2.
- Cienki edytor komunikuje się przez host z **jedną** historyczną Tibią v14.1 w osobnym oknie. Obie ramki mają opaque sandbox origins, a host przekazuje tylko komunikaty swojego jednego publicznego testu. Kliknięcie `Wróć do gry` ma aktywować natywne okno gry.
- Kontener celowo nie zapisuje nic do `localStorage` użytkownika ani nie importuje prywatnych notatek: wykonuje tylko odwracalne zmiany testowej mapy w pamięci. W pełni prywatną/długowieczną pracę należy zbadać osobno.
- To **nie** jest docelowe Tibia Studio. Potrzebna jest właściwa pracownia domenowa i konsekwencje zmian w świecie, a nie tylko wysyłanie raw `setTile`. Negatywny test z uzdrowicielem w murze nadal obowiązuje.

## Pliki i odtworzenie przez następnego agenta

Uruchamiaj wyłącznie na publicznych źródłach i w *tymczasowym folderze roboczym*, nie w aktualnej prywatnej instancji ani magazynie właściciela. Nie kopiować do main automatycznie.

1. Zbuduj oryginalną, publiczną [starą Jaskinię](https://github.com/Jozzpoly/Jozz-Cave-Workbench) v6.4.1 z `tools/render.py --app jaskinia --host web`. Publiczny `dist/jaskinia-web.html` również może posłużyć, jeżeli odpowiada konkretnej rewizji.
2. Odczytaj historycznego dawcę `Jozzpoly/Coopege/main/legacy/reference/Tibia_Enhanced_v14_1_DevAPI.html`, nigdy prywatny save.
3. Uruchom w katalogu z niniejszymi plikami i istniejącymi `live_game_bridge_snippet.html`, `live_editor_template.html`: `python build_native_c2.py /tymczasowy/jaskinia-web.html /tymczasowy/Tibia_Enhanced_v14_1_DevAPI.html --out /tymczasowy/jaskinia-c2-test.html`.
4. Otwórz wynik jako **oddzielny profil/incognito**, najlepiej pod lokalnym adresem HTTP zamiast `file://`. Nie mieszać z prawdziwym `localStorage` Jaskini.
5. Owner-facing test: **przeciągnij separator / zmień rozmiar natywnego pływającego okna / zadokuj / maksymalizuj / przesuń / zapisz układ → sprawdź, czy jedna żywa gra nadal trwa → edytuj → cofnij → wróć do ruchu bez przypadkowego kliknięcia gry**. Nie twierdzić PASS, dopóki Playwright lub Owner tego nie potwierdzi.

**Wstępny zakres dowodu** na dzień przygotowania: `node --check` skryptu rozszerzenia, `py_compile` generatora, lokalny Chromium smoke z **syntetyczną atrapą publicznego `Jaskinia.ext`**: dwa typy okien, edytor–gra–cofanie–fokus, brak JS errors — PASS. Ten smoke **nie testuje autentycznego dockingu/resizing/persistence Jaskini**. Skrypt `smoke_native_c2_synthetic.py` jest testem zachowania pomostu, nie standardu UX.

## Co należy dalej obalić

- Czy prawdziwe `ext.type` z `live:true` i `ext.open` zachowują sesję przy przeciąganiu dividera, float/dock i zmianie układu? Odnotować dokładną rewizję.
- Czy obsługa globalnych klawiszy i fokusu rzeczywiście nie koliduje z WASD w Coopege? W tym prototypie focus custom window jest tylko próbą.
- Czy nie ma regresji przy telefonie, minimalnej szerokości okna, zmianie motywu i powrocie do sesji?
- Czy projekt świata ma własną tożsamość i trwałość, niezależnie od okien i bieżącej gry?
- Czy tworzenie jest faktycznie łatwiejsze dla Ownera i pomaga zabawie? **Sam ruch separatora nie jest finalnym poziomem UX — to minimalna baza**.

**Nie używać C2 jako pretekstu do rozwijania starej Tibii zamiast Coopege 26 X**, ani jako finalnej architektury nowej Jaskini. Bezpieczne, odwracalne, eksperymentalne donory mają pomagać odkrywać możliwości, a nie zamrażać produkt.

Odniesienie do [Owner UX verdict i evidence](https://github.com/Jozzpoly/Jaskinia/issues/2).
