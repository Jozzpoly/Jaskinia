# Próba E1 — tożsamość wersji i propozycje

**Status: próba.** Nie jest fundamentem Jaskini i nie wolno na niej budować rzeczy trwałych bez awansu.

- **Pytanie:** czy tożsamość wersji z treści (SHA-256 z kanonicznego JSON), szkic z jawnym zapisem, propozycje agentów na starszej podstawie z wykrywaniem konfliktów, przypięcia wersji w świecie i werdykty przy dokładnej wersji działają jednakowo w Node i w przeglądarce.
- **Wynik:** testy przechodzą (`node --test`), a celowo wprowadzone błędy je wywracają.
- **Granice:** tablice są porównywane w całości; brak synchronizacji urządzeń, uwierzytelnienia i interfejsu; brak porównania z innymi rdzeniami dokumentu i sesjami edycji.
- **Zburzymy ją, gdy:** porównanie z innym rdzeniem pokaże lepsze rozwiązanie tej samej warstwy albo prawdziwy przypadek wykaże, że model wersji nie pasuje.
