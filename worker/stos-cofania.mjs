// Stos cofania: czysta funkcja z samych aktow przesuniec jednej przestrzeni (docs/krok-1-umowa.md, 5.3).
// Nic nie jest trzymane poza wywolaniem, dzieki czemu cofanie dziala po przeladowaniu i z drugiego urzadzenia.
import { rozbierzOp } from './ksztalty.mjs';

export function stos(akty, { obciete = false } = {}) {
  const zrobione = [];
  const cofniete = [];
  const niespojne = [];
  // Numer pierwszego aktu okna: cel mniejszy od niego jest poza oknem, a nie bledny.
  const poczatekOkna = akty.length ? akty[0].nr : null;

  // Zdejmuje wpis o danym `trzyma`; inna glowa to brak wpisu, a wpis tamtej glowy zostaje na miejscu.
  const zdejmij = (kupka, trzyma, glowa) => {
    const i = kupka.findIndex((w) => w.trzyma === trzyma && w.glowa === glowa);
    return i < 0 ? null : kupka.splice(i, 1)[0];
  };

  for (const akt of akty) {
    const wpis = { glowa: akt.glowa, trzyma: akt.nr, wroc_na: akt.z };
    const { rodzaj, akt: cel } = rozbierzOp(akt.op);

    if (rodzaj === 'zwykly') {
      zrobione.push(wpis);
      cofniete.length = 0;
      continue;
    }

    const [skad, dokad] = rodzaj === 'cofnij' ? [zrobione, cofniete] : [cofniete, zrobione];
    if (zdejmij(skad, cel, akt.glowa)) {
      dokad.push(wpis);
    } else if (obciete && cel < poczatekOkna) {
      // Cel jest starszy niz okno, wiec jego wpisu nie widzimy; akt niesie glowe i `z`, z ktorych
      // da sie odtworzyc wpis po drugiej stronie, i nie ma powodu czyscic niczego innego.
      dokad.push(wpis);
    } else {
      // Brak wpisu w oknie jest niespojnoscia: liczymy akt jak zwykly ruch, zeby stos dalej zgadzal sie z glowami.
      niespojne.push(akt.nr);
      zrobione.push(wpis);
      cofniete.length = 0;
    }
  }

  return {
    doCofniecia: zrobione.at(-1) ?? null,
    doPonowienia: cofniete.at(-1) ?? null,
    glebokosc: { cofnij: zrobione.length, ponow: cofniete.length },
    niespojne,
  };
}
