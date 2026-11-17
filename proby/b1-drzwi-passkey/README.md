# B1: drzwi właściciela (passkey)

**Pytanie.** Czy właściciel może wejść do Miejsca **jednym dotknięciem telefonu**, bez hasła, bez klucza
w schowku i bez cudzej usługi tożsamości — a my sprawdzimy to u siebie, w Workerze?

**Status: falsyfikator, nie budowa.** Zanim powstała jedna linia drzwi, zadaliśmy dwa pytania, które mogły
całą drogę przewrócić. Oba mają dziś odpowiedź.

## Pytanie 1: czy sprawdzenie podpisu da się zrobić samym WebCrypto?

```
node proby/b1-drzwi-passkey/falsyfikator.mjs
```

**Tak.** Cały łańcuch — CBOR z klucza COSE → import P-256 → zamiana podpisu DER na surowy `r||s` →
`subtle.verify` — to **28 linii własnego kodu i zero zależności**. Node ma to samo API co Workers, więc
to, co przechodzi tutaj, przechodzi tam.

Falsyfikator ma cztery punkty, w tym dwa, które łatwo przeoczyć:

| sprawdzenie | po co |
| --- | --- |
| CBOR + import klucza COSE | gdyby to wymagało biblioteki, drzwi w Workerze robią się ciężkie |
| **podpis DER podany wprost do WebCrypto jest odrzucany** | to jest pułapka, nie błąd: authenticator przysyła ASN.1 DER, a WebCrypto chce surowego `r‖s`. Kto tego nie wie, dostaje „podpis się nie zgadza" i szuka w złym miejscu |
| po zamianie DER → surowy podpis przechodzi | właściwa droga |
| **kontrola przeciwna: podmieniony licznik NIE przechodzi** | bez niej poprzednia linia nic nie znaczy — mechanizm, który przepuszcza wszystko, przeszedłby trzy pierwsze punkty |

## Pytanie 2: czy jego telefon założy passkey dla adresu `workers.dev`?

**Po stronie protokołu nic tego nie blokuje — i przy okazji wyszła granica bezpieczeństwa, którą trzeba
postawić od pierwszego dnia.**

`workers.dev` **jest na publicznej liście sufiksów** (`publicsuffix.org/list/public_suffix_list.dat`,
wiersz 12806). Czyli domeną rejestrowalną dla `cokolwiek.jozzpoly.workers.dev` jest
`jozzpoly.workers.dev`, a nie `workers.dev`. Wniosek praktyczny: passkey dla naszego adresu **da się**
założyć, bo przeglądarka ma dla niego poprawną domenę nadrzędną.

**Ale właśnie dlatego nazwa strony (`rp.id`) musi być DOKŁADNYM adresem Miejsca, nigdy
`jozzpoly.workers.dev`.** Reguła WebAuthn pozwala stronie podać jako `rp.id` własny host **albo** domenę
rejestrowalną. Gdyby jego passkey powstał dla `jozzpoly.workers.dev`, to **każdy podgląd gałęzi na tym
koncie** — a podglądy są publiczne i mają jawne klucze — mógłby poprosić jego authenticator o podpis dla
tej samej nazwy strony. Prawdziwe drzwi i tak odrzuciłyby taki podpis (w `clientDataJSON` stoi adres
pytającego, a drzwi go sprawdzają), więc to nie jest gotowy atak na wejście — ale jest to **jedno
poświadczenie dzielone przez wszystko, co kiedykolwiek wdrożymy na tym koncie**, i prośba o dotknięcie,
którą musiałby umieć odrzucić. Zawężenie `rp.id` do jednego hosta kosztuje zero i usuwa to całe pytanie.

Czego **nie** wiemy i czego nie da się sprawdzić bez niego: czy jego konkretny telefon i przeglądarka
założą passkey dla tego adresu w praktyce. To jest jedno dotknięcie z jego strony i jedyny moment, w
którym drzwi potrzebują jego ręki.

## Warunek zburzenia tej próby

Gdyby odpowiedź na pytanie 2 okazała się u niego „nie", drzwi jednym dotknięciem nie powstaną pod tym
adresem i trzeba będzie **przynieść mu cenę własnej domeny** — a to jest decyzja dla niego, nie dla nas.
Ten katalog znika wtedy razem z kierunkiem, a nie zostaje jako „mamy już przecież kod".
