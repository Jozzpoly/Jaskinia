// Czy kanal na zywo zdradza rzecz z obszaru, ktorego czytelnik nie widzi? Atak pod ZYWYM adresem, 17 XI 2026.
//
// POWOD. Granica widocznosci (front B) filtruje spis, adres rzeczy, dziennik i liczniki. Kanal na zywo nie pyta
// spisu: obecnosc buduje sie z zalacznikow gniazd. Pole `przy` niesie IDENTYFIKATOR rzeczy, przy ktorej ktos
// siedzi, a identyfikator jest uchwytem. Tak to wygladalo przed poprawka: wlasciciel siadal przy rzeczy w obszarze
// `widzi: wlasciciel`, a uczestnik dostawal jej identyfikator w wiadomosci `obecni`.
//
// DLACZEGO OSOBNY PLIK. `atak.mjs` z zalozenia nic nie zapisuje do Miejsca, a ta proba musi najpierw ZROBIC
// zamkniety obszar i rzecz w nim. Po sobie sprzata (oba odlozone z powodem).
//
// CZEGO NIE SPRAWDZI. Tylko podglad: oba klucze probne sa tam jawne na stronie. Poza podgladem trzebaby dwoch
// prawdziwych kluczy, ktorych druga linia nie ma i miec nie powinna. Sprawdzian W11 w worker/widocznosc.test.mjs
// pilnuje tego samego na udawanych gniazdach, razem z kontrola "bez okularow wyciek jest".
//
// Uruchomienie:  node proby/z3-kanal-na-zywo/atak-obecnosc.mjs <adres https>
const B = process.argv[2] || 'https://fable-srodowisko-jaskinia.jozzpoly.workers.dev';
const WL = process.argv[3] || 'podglad-jozz-klucz-publiczny';
const AG = process.argv[4] || 'podglad-agent-klucz-publiczny';
const P = 'atak-obecnosc-' + Date.now().toString(36) + '-';
const spij = (ms) => new Promise((r) => setTimeout(r, ms));

async function zad(klucz, sciezka, cialo) {
  const h = { 'Content-Type': 'application/json', 'User-Agent': 'jaskinia-druga-linia/1' };
  if (klucz) h.Authorization = 'Bearer ' + klucz;
  const r = await fetch(B + sciezka, { method: cialo ? 'POST' : 'GET', headers: h, body: cialo ? JSON.stringify(cialo) : undefined });
  const t = await r.text();
  try { return [r.status, JSON.parse(t)]; } catch { return [r.status, t]; }
}

function polacz(nazwa, klucz) {
  const ws = new WebSocket(B.replace(/^http/, 'ws') + '/api/srodowisko/zywe');
  const s = { nazwa, ws, odebrane: [], otwarte: false, zamkniete: null };
  ws.addEventListener('open', () => { s.otwarte = true; });
  ws.addEventListener('message', (e) => s.odebrane.push(String(e.data)));
  ws.addEventListener('close', (e) => { s.zamkniete = e.code; });
  ws.addEventListener('error', () => { s.blad = true; });
  s.przedstaw = () => { try { ws.send(JSON.stringify({ t: 'jestem', klucz })); } catch { /* zamkniete */ } };
  return s;
}

// obiekt Miejsca moze spac: pierwsze zadanie go budzi
for (let i = 0; i < 40; i++) { const [s] = await zad(WL, '/api/srodowisko/puls'); if (s === 200) break; await spij(15000); }

const [, o] = await zad(WL, '/api/srodowisko/ruch', { op: P + 'obszar', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Skarbiec kanalu', ile_wolno: 'proponowac', widzi: 'wlasciciel' } });
const [, r] = await zad(WL, '/api/srodowisko/ruch', { op: P + 'rzecz', co: 'poloz', rodzaj: 'projekt/1', obszar: o.rzecz, cechy: { nazwa: 'TAJNA-NAZWA-KANALU' } });
const OB = o.rzecz, RZ = r.rzecz;
if (!OB || !RZ) { console.log('nie udalo sie przygotowac swiata:', JSON.stringify(o), JSON.stringify(r)); process.exit(2); }
console.log('obszar widzi=wlasciciel:', OB, '| rzecz w srodku:', RZ);

const wl = polacz('wlasciciel', WL), ag = polacz('agent', AG);
for (let i = 0; i < 160 && !(wl.otwarte && ag.otwarte); i++) await spij(50);
if (!(wl.otwarte && ag.otwarte)) { console.log('polaczenia nie stoja:', wl.otwarte, ag.otwarte); process.exit(2); }
wl.przedstaw(); ag.przedstaw();
await spij(1500);
ag.odebrane.length = 0;
wl.ws.send(JSON.stringify({ t: 'przy', rzecz: RZ }));
await spij(2000);

const uAgenta = ag.odebrane.join(' ');
const wyciek = uAgenta.includes(RZ);
const widziObecnosc = /"kto":"[^"]*wlasciciel/.test(uAgenta);
console.log(wyciek ? 'WYCIEK: agent dostal identyfikator rzeczy z obszaru, ktorego nie widzi' : 'OK: identyfikatora rzeczy nie ma w tym, co dostal agent');
console.log(widziObecnosc ? 'OK: sama obecnosc wlasciciela jest nadal widoczna (ukrywamy rzecz, nie czlowieka)' : 'UWAGA: agent nie widzi nawet obecnosci - to za duzo');
console.log('co dostal agent:', JSON.stringify(ag.odebrane));

wl.ws.close(); ag.ws.close();
for (const i of [RZ, OB]) {
  const [, rr] = await zad(WL, '/api/srodowisko/rzecz?id=' + i);
  if (rr && rr.ok) await zad(WL, '/api/srodowisko/ruch', { op: P + 'u-' + i.slice(0, 8), co: 'odloz', rzecz: i, wersja: rr.rzecz.wersja, powod: 'atak drugiej linii na obecnosc w kanale' });
}
console.log('posprzatane');
process.exit(wyciek || !widziObecnosc ? 1 : 0);
