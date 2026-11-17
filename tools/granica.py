# -*- coding: utf-8 -*-
# Czy granica widocznosci jeszcze trzyma? Atak na ZYWY adres, nie na kod.
#
# POWOD. Granice buduje sie raz, a omija sie ja potem po cichu: nowa trasa czytajaca, nowe pole w opisie, nowa
# droga do dziennika. Sprawdziany w Node pilnuja tego, o czym ktos pomyslal; ten plik pyta pod adresem, czy
# cokolwiek wyszlo. Trzy z jedenastu prob ponizej powstaly PO tym, jak zlapaly prawdziwa dziure 17 XI 2026:
#   - trasa /api/srodowisko/wersja wywracala sie na kazdym zadaniu (zaslonieta nazwa; node --check i 339
#     sprawdzianow byly zielone, bo zaden nie szedl przez te drzwi);
#   - obszar zamkniety byl wymieniony z nazwy i identyfikatora, bo sam lezy w obszarze NADRZEDNYM;
#   - lista "co sie zmienilo" pytala wprost dziennik, wiec okulary czytajacego jej nie dotyczyly.
#
# ZASADA. Filtrowanie spisu nie wystarcza, dopoki jakakolwiek trasa pyta dziennik albo liczniki wprost.
# Kazda taka trasa jest osobna droga i trzeba ja zamknac osobno.
#
# CZEGO TEN PLIK NIE SPRAWDZI. Na podgladzie czytajacy bez klucza jest uczestnikiem (klucz stoi tam jawnie
# na stronie), wiec przypadek "zwiedzajacy bez klucza" jest tu niesprawdzalny z zalozenia; pilnuje go
# sprawdzian W6 w worker/widocznosc.test.mjs. Tutaj najostrzejszym czytelnikiem jest uczestnik z kluczem.
#
# Uruchomienie:  python tools/granica.py <adres https>
# Po sobie sprzata: obszar i rzecz probna zostaja odlozone z powodem.
import json, sys, time, urllib.request
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass
B = sys.argv[1]
WL, AG = 'podglad-jozz-klucz-publiczny', 'podglad-agent-klucz-publiczny'
UA = {'User-Agent': 'jaskinia-druga-linia/1'}
wyniki = []
def pokaz(nr, co, dobrze, szcz=''):
    wyniki.append(dobrze)
    print(f"{'OK  ' if dobrze else 'WYCIEK'} W{nr}. {co}" + (f"\n        {szcz}" if szcz else ''))

def zad(klucz, sciezka, cialo=None, surowy=False):
    h = {'Content-Type': 'application/json', **UA}
    if klucz: h['Authorization'] = 'Bearer ' + klucz
    r = urllib.request.Request(B + sciezka, data=(json.dumps(cialo).encode('utf-8') if cialo else None), headers=h, method=('POST' if cialo else 'GET'))
    try:
        with urllib.request.urlopen(r) as o:
            t = o.read().decode('utf-8'); return o.status, (t if surowy else json.loads(t))
    except urllib.error.HTTPError as e:
        t = e.read().decode('utf-8')
        try: return e.code, (t if surowy else json.loads(t))
        except Exception: return e.code, t

for _ in range(40):
    s, _d = zad(WL, '/api/srodowisko/puls')
    if s == 200: break
    time.sleep(15)

P = 'atak-widocznosc-d-'
TAJNE = 'TAJNA-NAZWA-DRUGIEJ-LINII'
s, o = zad(WL, '/api/srodowisko/ruch', {'op': P+'obszar', 'co': 'poloz', 'rodzaj': 'obszar/1',
                                        'cechy': {'nazwa': 'Skarbiec', 'ile_wolno': 'proponowac', 'widzi': 'wlasciciel'}})
OB = o.get('rzecz'); print('obszar widzi=wlasciciel:', OB, '|', o.get('skutek') or o)
s, r = zad(WL, '/api/srodowisko/ruch', {'op': P+'rzecz', 'co': 'poloz', 'rodzaj': 'projekt/1', 'obszar': OB,
                                        'cechy': {'nazwa': TAJNE}})
RZ = r.get('rzecz'); print('rzecz w srodku:', RZ, '|', r.get('skutek') or r, '\n')

s, d = zad(AG, '/api/srodowisko/spis?rodzaj=projekt/1&ile=2000')
pokaz(1, 'spis rzeczy', not any(x['cechy'].get('nazwa') == TAJNE for x in d.get('rzeczy', [])), f"rzeczy w odpowiedzi: {len(d.get('rzeczy',[]))}")
s, d2 = zad(AG, '/api/srodowisko/spis?obszar=' + OB)
pokaz(2, 'spis pytany wprost o ten obszar', isinstance(d2, dict) and d2.get('razem') == 0, f"razem={d2.get('razem')}")
s, d3 = zad(AG, '/api/srodowisko/rzecz?id=' + RZ)
pokaz(3, 'adres jednej rzeczy', isinstance(d3, dict) and d3.get('blad') == 'nie ma takiej rzeczy', f"odpowiedz: {json.dumps(d3, ensure_ascii=False)[:120]}")
s, d4 = zad(AG, '/api/srodowisko/wersja?id=' + RZ + '&akt=2')
pokaz(4, 'dawna wersja po akcie', not (isinstance(d4, dict) and d4.get('ok') is True), f"status={s}")
s, t5 = zad(AG, '/rzecz/' + RZ, surowy=True)
pokaz(5, 'tekstowa strona rzeczy', s == 404 and TAJNE not in t5, f"status={s}")
s, t6 = zad(AG, '/rzeczy?ile=2000', surowy=True)
pokaz(6, 'tekstowa lista rzeczy', TAJNE not in t6, f"dlugosc tekstu: {len(t6)}")
s, t7 = zad(AG, '/co-tu-jest', surowy=True)
pokaz(7, 'tekst dla agenta NIE zdradza nazwy rzeczy', TAJNE not in t7)
pokaz(8, 'tekst dla agenta NIE zdradza nazwy obszaru ani jego identyfikatora', ('Skarbiec' not in t7) and (OB not in t7),
      f"'Skarbiec' w tekscie: {'Skarbiec' in t7}; identyfikator obszaru w tekscie: {OB in t7}")
s, d9 = zad(AG, '/api/srodowisko/spojnosc?ile=5000')
pokaz(9, 'sprawdzian spojnosci nie wypisuje rzeczy z zamknietego obszaru', isinstance(d9, dict) and not any(n.get('obszar') == OB for n in d9.get('niezgodne', [])), f"przejrzane={d9.get('sprawdzone')}")
s, d10 = zad(AG, '/api/srodowisko/opis')
tekstOpisu = json.dumps(d10, ensure_ascii=False)
pokaz(10, 'dane opisu nie niosa nazwy rzeczy', TAJNE not in tekstOpisu)
pokaz(11, 'dane opisu nie niosa obszaru zamknietego', OB not in tekstOpisu,
      f"identyfikator obszaru w danych opisu: {OB in tekstOpisu}")

for i in (RZ, OB):
    s, rr = zad(WL, '/api/srodowisko/rzecz?id=' + i)
    if rr.get('ok'):
        zad(WL, '/api/srodowisko/ruch', {'op': P+'u-'+i[:8], 'co': 'odloz', 'rzecz': i, 'wersja': rr['rzecz']['wersja'], 'powod': 'atak drugiej linii na wlasna granice'})
print('\npodsumowanie:', f"{sum(1 for x in wyniki if x)} z {len(wyniki)} trzyma")
