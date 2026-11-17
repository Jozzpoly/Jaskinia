// Ile wierszy bazy kosztuje kazda trasa - POD ZYWYM ADRESEM, z naglowka x-koszt (17 XI 2026, Opus Code).
//
// POWOD. 17 XI o 17:53 UTC stanely wszystkie podglady naraz: dobowy limit darmowego planu Cloudflare liczy
// wiersze dla CALEGO KONTA (5 000 000 czytanych, 100 000 zapisanych) i zeruje sie o 00:00 UTC. Bezpiecznik
// w budzet.mjs pilnuje ZAPISOW jednego Miejsca; padl limit ODCZYTOW konta. Zeby planowac, trzeba wiedziec,
// co ile kosztuje - a wie to tylko baza Cloudflare. tools/koszt.mjs mowi, ILE ZAPYTAN idzie do bazy; ten
// plik mowi, ILE WIERSZY te zapytania naprawde czytaja.
//
// SAM TEZ KOSZTUJE. Kilkanascie zadan, kazde ze swoim kosztem - i tyle tez zabiera z dobowej puli. Dlatego
// na koniec wypisuje, ile sam zjadl. Nie puszczaj go w petli.
//
// Uruchomienie:  node tools/koszt-pod-adresem.mjs <adres https> [klucz]
const B = (process.argv[2] || '').replace(/\/$/, '');
const KLUCZ = process.argv[3] || 'podglad-agent-klucz-publiczny';
if (!B) { console.log('podaj adres: node tools/koszt-pod-adresem.mjs <adres https> [klucz]'); process.exit(2); }
const LIMIT_KONTA = { czytane: 5000000, zapisane: 100000 };

const TRASY = [
  ['/api/srodowisko/puls', 'puls: sam numer ostatniego aktu'],
  ['/api/srodowisko/opis', 'opis: wszystko, czym strona sie rysuje'],
  ['/co-tu-jest', 'co-tu-jest: ten sam opis tekstem dla agenta'],
  ['/api/srodowisko/spis?ile=50', 'spis: pierwsze 50 rzeczy'],
  ['/api/srodowisko/spis?ile=1000', 'spis: tysiac rzeczy naraz'],
  ['/api/srodowisko/spis?rodzaj=galaz/1&ile=50', 'spis zawezony rodzajem'],
  ['/api/srodowisko/spis?szukaj=jaskinia&ile=50', 'szukanie po slowie'],
  ['/api/srodowisko/ksztalty', 'ksztalty: spis rodzajow'],
  ['/api/srodowisko/spojnosc?ile=200', 'sprawdzian spojnosci'],
  ['/rzeczy?ile=200', 'lista rzeczy tekstem'],
];

const liczby = (naglowek) => {
  // Naglowek stawia worker/budzet.mjs: "wiersze-czytane=123; wiersze-zapisane=4".
  const t = String(naglowek || '');
  const z = (co) => { const m = new RegExp('wiersze-' + co + '=(\\d+)').exec(t); return m ? Number(m[1]) : null; };
  return { czytane: z('czytane'), zapisane: z('zapisane'), surowy: t };
};

async function zmierz(sciezka) {
  const o = await fetch(B + sciezka, { headers: { 'User-Agent': 'jaskinia-druga-linia/1', Authorization: 'Bearer ' + KLUCZ } });
  const naglowek = o.headers.get('x-koszt');
  await o.text();
  return { status: o.status, ...liczby(naglowek) };
}

const fmt = (n) => (n === null || n === undefined ? '?' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '));

// Pierwsze zadanie budzi obiekt i placi za rozgrzanie pamieci; mierzymy DRUGIE, bo tak wyglada zwykly ruch.
await zmierz('/api/srodowisko/puls');

const wyniki = [];
for (const [sciezka, opis] of TRASY) {
  const w = await zmierz(sciezka);
  wyniki.push([opis, sciezka, w]);
  if (w.status !== 200) continue;
}

console.log(`\nKoszt tras pod adresem ${B}\n`);
console.log('trasa                                  status   wierszy czytanych   zapisanych   takich zadan na dobe (cale konto)');
let razemCzytane = 0;
for (const [opis, , w] of wyniki) {
  razemCzytane += w.czytane || 0;
  const naDobe = w.czytane ? fmt(Math.floor(LIMIT_KONTA.czytane / w.czytane)) : (w.czytane === 0 ? 'bez limitu' : '?');
  console.log(`${opis.slice(0, 36).padEnd(38)} ${String(w.status).padStart(5)} ${fmt(w.czytane).padStart(17)} ${fmt(w.zapisane).padStart(12)} ${naDobe.padStart(28)}`);
}
if (wyniki.every(([, , w]) => w.czytane === null)) {
  console.log('\nZADNA odpowiedz nie miala naglowka x-koszt. Albo to Miejsce go nie podaje, albo trasy odmawiaja:');
  console.log('surowy naglowek z pierwszej trasy:', JSON.stringify(wyniki[0][2].surowy));
}
console.log(`\nTen pomiar sam zjadl okolo ${fmt(razemCzytane)} wierszy z dobowej puli ${fmt(LIMIT_KONTA.czytane)}.`);
console.log('Limit jest wspolny dla CALEGO konta - wszystkich podgladow naraz - i zeruje sie o 00:00 UTC.');
