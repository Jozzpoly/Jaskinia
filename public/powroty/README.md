# Powroty

Agent dostaje wolny czas, idzie gdzieś, coś znajduje i wraca opowiedzieć. To działa — robimy
to od 29 września. Nie działa to, co **potem**: 29 IX 2026 agent Codexa zrobił pięć wypraw,
wrócił i opowiedział, o co był proszony, a wyniki przeleżały sześć tygodni w skompresowanym
pliku sesji i w folderze, do którego nikt nie zaglądał. Dwie z pięciu wypraw nie zostawiły
po sobie **żadnego** pliku.

To nie jest problem autonomii. Autonomię mamy. Brakuje **drogi powrotnej**.

## Jedna reguła

> **Wyprawa wróciła, kiedy Jozz może ją otworzyć i ruszyć — a nie kiedy agent o niej opowiedział.**

Opowieść jest dowodem, że agent gdzieś był. Nie jest dowodem, że ktokolwiek poza nim
kiedykolwiek to zobaczy.

## Co to znaczy w praktyce

Powrót to jeden katalog i w nim rzecz, która **działa z dwukliku**: bez serwera, bez budowania,
bez sieci, bez zależności. Na telefonie też. Tak wracały najlepsze rzeczy w historii tych
projektów (PRZESMYK, Tibia w jednym pliku, pliki `.cmd` do dwukliku) i tak wraca
[`2026-09-29-wolny-czas/`](2026-09-29-wolny-czas/index.html).

**I musi być pod adresem, nie tylko na dysku.** Pierwsza wersja tego katalogu leżała
w korzeniu repo, a `wrangler.jsonc` podaje pliki wyłącznie z `public/`. Plik otwierał się
z dwukliku i **zwracał 404 pod adresem podglądu** — sprawdziłem zapytaniem, nie domysłem.
Złamałem własną regułę jednym katalogiem: powrót, do którego trzeba mieć dysk, nie jest
powrotem, tylko kopią zapasową. Dlatego powroty mieszkają tu, obok `public/miejsce/`
i `public/osada/`, i pilnuje tego osobny test — czyta katalog wprost z `wrangler.jsonc`,
więc gdy Dom zmieni adres, test to zauważy, a nie ja po fakcie.

Nie wystarczy, że rzecz się otwiera. Ma dać się **ruszyć**: pokrętła, które liczą od nowa,
a nie obrazek z wynikiem. Pętla `zbuduj → uruchom → poczuj → popraw` jest tym, czego Jozz
szuka we wszystkich swoich projektach; powrót, którego nie da się dotknąć, wypada z niej
na pierwszym kroku.

## Dwie rzeczy, bez których to jest pocztówka

**Liczby muszą być te same.** Jeśli powrót przelicza coś od nowa — a powinien, bo inaczej
nie da się tym ruszać — to musi dawać dokładnie to, co dał oryginał. Pilnuje tego
[`zgodnosc.test.mjs`](zgodnosc.test.mjs): wyjmuje matematykę wprost ze strony i stawia ją
obok wyników zapisanych tamtego dnia. Sprawdzone ingerencją — zmiana jednego znaku we wzorze
przewraca test.

**Trzeba powiedzieć, czego się nie przywiozło.** Pięć wypraw, trzy artefakty. Strona mówi to
wprost i test tego pilnuje. Powrót, który milczy o brakach, wygląda na kompletny — a to jest
gorsze niż brak powrotu, bo nikt już nie pójdzie szukać.

## Czego tu nie ma

Nie ma procedury, formularza ani obowiązku. Nikt nie musi robić powrotu, żeby mieć wolny czas.
To jest **kształt**, nie brama: jeśli następna wyprawa wróci tak samo, Jozz nie będzie musiał
nikogo prosić o odkopanie jej za sześć tygodni.

Nie ma też tu oryginałów z 29 IX — leżą na dysku Jozza. Wniesienie ich do publicznego repo
byłoby publikacją, a publikacja należy do niego (zasada 4). Pełne porównanie z nimi uruchamia
się przez `POWROT_ZRODLO=<katalog>`; bez tej zmiennej test mówi wprost, że porównuje tylko
z przepisanymi stałymi.
