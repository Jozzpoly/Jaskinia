// Puka pod zywy adres Jaskini i sprawdza to, czego testy w Node sprawdzic nie moga.
//
// Powod: trase `/dom/` w prawdziwym Workerze obsluguje `HTMLRewriter`, ktorego Node nie ma
// (`worker/trasy.mjs`), wiec `node --test` chodzi po wersji zapasowej. Ten skrypt sprawdza rzecz
// tam, gdzie Jozz ja otwiera. Uruchamiany z zegara (`.github/workflows/dom-pod-adresem.yml`)
// i recznie: `node tools/pod-adresem.mjs [adres]`.
//
// Kazda nieudana proba jest powtarzana, zeby chwilowa czkawka sieci nie malowala CI na czerwono.

const BAZA = process.argv[2] || process.env.JASKINIA_ADRES || 'https://jaskinia.jozzpoly.workers.dev';
const PROBY = 3;
const PRZERWA = 5000;

const bledy = [];
const spis = [];

async function pobierz(sciezka) {
  let ostatni;
  for (let i = 1; i <= PROBY; i++) {
    try {
      const t0 = Date.now();
      const odp = await fetch(BAZA + sciezka, { redirect: 'follow' });
      const tresc = await odp.text();
      return { status: odp.status, tresc, ms: Date.now() - t0 };
    } catch (e) {
      ostatni = e;
      if (i < PROBY) await new Promise((r) => setTimeout(r, PRZERWA));
    }
  }
  throw ostatni;
}

function sprawdz(nazwa, warunek, szczegol) {
  spis.push(`${warunek ? 'OK  ' : 'ZLE '} ${nazwa}${szczegol ? ' — ' + szczegol : ''}`);
  if (!warunek) bledy.push(`${nazwa}${szczegol ? ' — ' + szczegol : ''}`);
}

const ZNACZNIK = 'id="jaskinia-do-obejrzenia"';

// 1. Dom: odpowiada, jest caly, i ma dokladnie jeden nasz odnosnik.
{
  const { status, tresc, ms } = await pobierz('/dom/');
  sprawdz('Dom odpowiada 200', status === 200, `status ${status}`);
  sprawdz('Dom przyszedl caly', tresc.length > 1_000_000, `${tresc.length} B`);
  const ile = tresc.split(ZNACZNIK).length - 1;
  sprawdz('odnosnik do paska jest dokladnie raz', ile === 1, `znalezione: ${ile}`);
  if (ile === 1) {
    sprawdz('odnosnik stoi przed koncem strony',
      tresc.lastIndexOf(ZNACZNIK) < tresc.lastIndexOf('</body>'), 'po </body> przegladarka go przeniesie');
  } else {
    spis.push('--   odnosnik stoi przed koncem strony — pominiete, bo odnosnika nie ma');
  }
  sprawdz('Dom odpowiada szybciej niz 5 s', ms < 5000, `${ms} ms`);
}

// 2. status.json Domu idzie bez zmiany i daje sie sparsowac.
{
  const { status, tresc } = await pobierz('/dom/status.json');
  sprawdz('status.json Domu odpowiada 200', status === 200, `status ${status}`);
  let dane = null;
  try { dane = JSON.parse(tresc); } catch (e) { /* nizej */ }
  sprawdz('status.json Domu parsuje sie', dane !== null);
  sprawdz('status.json nie dostal naszej wstawki', !tresc.includes(ZNACZNIK));
}

// 3. Pasek stoi i ma karty, ktore strona umie przeczytac.
{
  const { status, tresc } = await pobierz('/do-obejrzenia/');
  sprawdz('pasek odpowiada 200', status === 200, `status ${status}`);
  sprawdz('pasek czyta plik kart', tresc.includes('zgloszenia.json'));
}
{
  const { status, tresc } = await pobierz('/do-obejrzenia/zgloszenia.json');
  sprawdz('plik kart odpowiada 200', status === 200, `status ${status}`);
  let dane = null;
  try { dane = JSON.parse(tresc); } catch (e) { /* nizej */ }
  sprawdz('plik kart parsuje sie', dane !== null, 'jeden zbedny przecinek gasi caly pasek');
  const karty = dane && Array.isArray(dane.zgloszenia) ? dane.zgloszenia : null;
  sprawdz('sa jakies karty', karty !== null && karty.length > 0, karty ? `${karty.length}` : 'brak listy');
  if (karty) {
    const brak = karty.filter((k) => !k || !k.co || !k.adres || !k.agent).length;
    sprawdz('kazda karta ma co, adres i agenta', brak === 0, `bez kompletu: ${brak}`);
  }
}

console.log(`Pod adresem ${BAZA}:`);
for (const l of spis) console.log('  ' + l);
if (bledy.length) {
  console.error(`\nNie zgadza sie ${bledy.length} z ${spis.length}:`);
  for (const b of bledy) console.error('  - ' + b);
  process.exit(1);
}
console.log(`\nZgadza sie ${spis.length} z ${spis.length}.`);
