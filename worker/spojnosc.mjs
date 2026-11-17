// Sprawdzian spójności: co w tym Miejscu NIE zgadza się ze swoim własnym kształtem (17 XI 2026, druga linia).
// Status: próba (TYMCZASOWE.md).
//
// Po co. Środowisko umie powiedzieć, ile ma rzeczy, ile kosztuje czytanie i co czeka na właściciela. Nie umie
// powiedzieć, co w nim samym jest zepsute. Kształt rodzaju `miejsce/1` mówi o sobie "leży ZAWSZE w obszarze swojego
// widoku", ale `lezy_z` jest przeliczane tylko przy zapisie przez `poloz`; przeniesienie rzeczy, od której obszar
// pochodzi, a także `cofnij` i `przyjmij`, zostawiają rzecz w stanie, który kształt uznaje za niemożliwy — i robią to
// po cichu (zmierzone na podglądzie gałęzi Startu, 17 XI, zapisane w Commons: rundy/2026-11-17-dowody-srodowiska.md).
// To nie jest usterka jednego rodzaju. `lezy_z` jest PIERWSZĄ regułą mówiącą "zawsze" o związku dwóch rzeczy i nie
// będzie ostatnią (gość ze swoim kodem, słowo ze swoją rzeczą). Każda taka reguła ma ten sam kształt dziury.
//
// Dlatego to jest przebieg TYLKO DO CZYTANIA, który liczy niezgodności i nazywa je po imieniu. Niczego nie naprawia:
// naprawa rzeczy jest ruchem, a ruch ma autora i prawo. Sprawdzian ma mówić, nie rządzić.
//
// Trzy zasady wzięte wprost od obserwatora (worker/obserwator.mjs), bo są tam słuszne:
//   1. NIEZNANE TO NIE ZERO. Gdy przebieg urwał się na budżecie, mówi `urwane: true` i nie twierdzi, że jest czysto.
//   2. WYNIK MÓWI SWÓJ WIEK: niesie numer aktu, przy którym liczył, więc widać, czy jest z dzisiaj czy sprzed zmian.
//   3. LICZBA BEZ POLECENIA NIE JEST POMIAREM: koszt przebiegu wychodzi w nagłówku x-koszt tak samo jak każdy inny.
//
// Czego ten sprawdzian NIE wie: czy rzecz jest prawdziwa, sensowna albo potrzebna. Zna tylko kształty i obszary.

import { sprawdzCechy } from './srodowisko.mjs';

const KAWALEK = 500;
export const DOMYSLNIE_ILE = 3000;   // ile rzeczy naraz; cała reszta czeka na następne wywołanie z `pomin`

// Jedna niezgodność: co to za rzecz, która reguła nie trzyma i co dokładnie jest nie tak.
const zgloszenie = (rz, rodzina, mowi) => ({
  rzecz: rz.id, rodzaj: rz.rodzaj, obszar: rz.obszar ?? null, odlozone: !!rz.odlozone,
  zmienil: rz.zmienil ?? null, wersja: rz.wersja ?? null, rodzina, mowi,
});

export function sprawdzSpojnosc(s, { ile = DOMYSLNIE_ILE, pomin = 0, rodzaj = null, najwyzej = 200 } = {}) {
  const granica = Math.max(1, Math.min(20000, Math.trunc(Number(ile)) || DOMYSLNIE_ILE));
  const odKtorej = Math.max(0, Math.trunc(Number(pomin)) || 0);
  const ksztalty = s.ksztalty();
  // Te dwa pytania zadaje też jądro przy każdym zapisie (`_sprawdzTresc`); tutaj zadajemy je rzeczom, które już leżą.
  const maRzecz = (id) => s.rzecz(id);
  const maZapis = s._maZapis;
  const niezgodne = [];
  const rodziny = { lezy_z: 0, ksztalt: 0 };
  let sprawdzone = 0, bezKsztaltu = 0, odlozonych = 0, urwane = false;

  for (let p = odKtorej; !urwane; p += KAWALEK) {
    const kawalek = s.spis({ ...(rodzaj ? { rodzaj } : {}), odlozone: 'razem', limit: KAWALEK, pomin: p });
    for (const rz of kawalek) {
      if (sprawdzone >= granica) { urwane = true; break; }
      sprawdzone++;
      const k = ksztalty.get(rz.rodzaj);
      // Rzecz bez kształtu nie jest niezgodna: jądro mówi przy zapisie, że niczego w niej nie sprawdzono. Liczymy ją
      // osobno, bo to jest miara tego, ile środowiska stoi poza własnym opisem.
      if (!k) { bezKsztaltu++; continue; }
      const przedtem = niezgodne.length;

      // 1. lezy_z: rzecz leży ZAWSZE w obszarze rzeczy wskazanej przez cechę — albo nie leży i wtedy jest sierotą.
      const nazwa = typeof k.cechy.lezy_z === 'string' ? k.cechy.lezy_z : null;
      if (nazwa) {
        const cel = rz.cechy ? rz.cechy[nazwa] : null;
        const dom = typeof cel === 'string' ? s.rzecz(cel) : null;
        if (!dom) {
          rodziny.lezy_z++;
          niezgodne.push(zgloszenie(rz, 'lezy_z', `cecha ${nazwa} nie wskazuje istniejącej rzeczy, a od niej rzecz tego rodzaju bierze obszar`));
        } else if ((dom.obszar ?? null) !== (rz.obszar ?? null)) {
          rodziny.lezy_z++;
          niezgodne.push(zgloszenie(rz, 'lezy_z', `leży w obszarze ${rz.obszar ?? 'głównym'}, a rzecz z cechy ${nazwa} (${dom.id}) leży w ${dom.obszar ?? 'głównym'}; kształt mówi, że mają leżeć razem`));
        }
      }

      // 2. kształt: rzecz zapisana wczoraj ma przejść dzisiejsze sprawdzenie treści. Ta zasada jest w jądrze już
      // przyjęta (`cofnij` i `przyjmij` mówią "nie przechodzi dzisiejszego sprawdzenia"); tu pytamy o to leżące.
      const { bledy } = sprawdzCechy(k.cechy, rz.cechy || {}, maRzecz, maZapis);
      if (bledy.length) {
        rodziny.ksztalt++;
        niezgodne.push(zgloszenie(rz, 'ksztalt', bledy.join('; ')));
      }
      if (niezgodne.length > przedtem && rz.odlozone) odlozonych++;
    }
    if (kawalek.length < KAWALEK) break;
  }

  const n = Math.max(1, Math.min(1000, Math.trunc(Number(najwyzej)) || 200));
  // Rzecz odłożona jest poza drogą: nie liczy się do zdania o tym, co dziś jest krzywe. Ale `przywroc` wraca do
  // obszaru sprzed odłożenia, a nie przelicza go z `lezy_z` (tak samo jak `cofnij`), więc odłożona niezgodność
  // WRÓCI krzywa. Dlatego stoi w osobnej liczbie i w osobnym zdaniu, a nie znika i nie miesza się z żywymi.
  // Znalezione pod żywym adresem 17 XI: po odłożeniu rzeczy sprawdzian dalej mówił "1 kłóci się", co brzmiało
  // jak nienaprawiona usterka, a było rzeczą schowaną.
  const zywych = niezgodne.length - odlozonych;
  const ogon = odlozonych ? ` Osobno ${odlozonych} odłożonych rzeczy jest niezgodnych: dziś nie przeszkadzają, ale przywrócenie odda je w tym samym, złym obszarze.` : '';
  return {
    akt: s.ostatniNr(),
    sprawdzone, urwane, nastepne: urwane ? odKtorej + sprawdzone : null,
    bez_ksztaltu: bezKsztaltu,
    ile_niezgodnych: niezgodne.length,
    ile_niezgodnych_zywych: zywych,
    niezgodnych_odlozonych: odlozonych,
    rodziny,
    niezgodne: niezgodne.slice(0, n),
    wszystkie_wypisane: niezgodne.length <= n,
    // Zdanie dla człowieka i dla agenta, który nie będzie czytał pól po kolei.
    mowi: urwane
      ? `Przejrzane ${sprawdzone} rzeczy i to NIE jest całość; niezgodnych ${niezgodne.length} (żywych ${zywych}). Dalszy ciąg: pomin=${odKtorej + sprawdzone}. Dopóki przebieg jest urwany, "zero niezgodności" nic nie znaczy.`
      : zywych === 0
        ? `Przejrzane wszystkie ${sprawdzone} rzeczy przy akcie ${s.ostatniNr()}; żadna żywa nie kłóci się ze swoim kształtem.${ogon}${bezKsztaltu ? ` ${bezKsztaltu} leży poza jakimkolwiek kształtem, więc o nich sprawdzian nic nie wie.` : ''}`
        : `Przejrzane wszystkie ${sprawdzone} rzeczy przy akcie ${s.ostatniNr()}; ${zywych} kłóci się ze swoim kształtem (lezy_z: ${rodziny.lezy_z}, treść: ${rodziny.ksztalt}).${ogon}`,
  };
}
