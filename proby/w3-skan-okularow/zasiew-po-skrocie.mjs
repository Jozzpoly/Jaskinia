// Czy skrot po odcisku calosci zasiewu nie wylacza niczego po cichu (druga linia, 18 XI 2026).
//
// POWOD. Fable dolozyl do zasiewu odcisk CALOSCI (`zasiew:calosc`): gdy lista ziaren jest ta sama co przy
// ostatnim pelnym przejsciu, obudzenie Miejsca pyta bazy raz zamiast 243 razy. Sam poprosil o cudze oczy
// wlasnie tutaj, swoimi slowami: "to jest mechanizm, ktory milczy, kiedy sie myli". Pytanie nie bylo, czy
// dziala, a GDZIE moze cicho nie zadzialac.
//
// WYNIK (na glowie PR 62, a84d560): trzyma w czterech probach, takze w kształcie jego wlasnego wczesniejszego
// bledu (ziarno liczone funkcja). Przy okazji wyszlo cos starszego i wazniejszego: KSZTALT raz zmieniony reka
// wlasciciela nie dostanie zadnej nowej reguly sprawdzania z kodu - po cichu (proba 5).
//
// Uruchomienie:  KOPIA=<katalog repozytorium> node proby/w3-skan-okularow/zasiew-po-skrocie.mjs

// Druga linia, 18 XI: czy skrot po odcisku calosci zasiewu (PR 61/62 Fable) nie wylacza naprawy,
// ktora pelne przejscie robilo przy KAZDYM obudzeniu. Uruchom: KOPIA=<katalog> node odcisk-zasiewu.mjs
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const KOPIA = process.env.KOPIA;
const imp = (p) => import(pathToFileURL(join(KOPIA, p)).href);
const { Rdzen } = await imp('worker/miejsce.mjs');
const { sqlZNode } = await imp('worker/sql-node.mjs');
const { Srodowisko } = await imp('worker/srodowisko.mjs');
const { ziarna } = await imp('worker/ziarna.mjs');
let d = 0, t = 0;
const sprawdz = (dziura, opis, szcz = '') => { if (dziura) { d++; console.log('DZIURA: ' + opis + (szcz ? '\n   ' + szcz : '')); } else { t++; console.log('TRZYMA: ' + opis + (szcz ? '\n   ' + szcz : '')); } };

// Jedna baza, dwa "obudzenia": drugie srodowisko na tej samej bazie to Miejsce po usnieciu.
const sql = sqlZNode();
let zegar = Date.UTC(2026, 10, 18, 12, 0, 0);
const nowe = () => new Srodowisko(new Rdzen(sql, { wlasciciel: 'jozz', teraz: () => (zegar += 1000) }));
const Z = () => ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] });

const s1 = nowe();
const pierwszy = await s1.zasiej(Z());
console.log(`pierwsze zasianie: ${pierwszy.length} ziaren`);
const s2 = nowe();
const drugi = await s2.zasiej(Z());
sprawdz(drugi.length !== 0, `drugie obudzenie bez zmian nic nie sieje (${drugi.length})`);

// Rzecz zasiana: bierzemy obszar glowny i cos, co ma ksztalt z ziarna.
const glowny = s2.rzecz(s2.r.meta('obszar_glowny'));
console.log('obszar glowny:', glowny.id, JSON.stringify(glowny.cechy).slice(0, 120));

// AGENT ZAJMUJE RZECZ ZASIANA: zmienia ja wlasna reka (nie wlasciciel, nie automat).
const zm = await s2.ruch('agent-a', { op: 'proba-zajecia-obszaru-glownego', co: 'poloz', rzecz: glowny.id, wersja: glowny.wersja,
  rodzaj: 'obszar/1', obszar: glowny.obszar, cechy: { ...glowny.cechy, nazwa: 'Zajete przez agenta', widzi: 'wszyscy' } });
console.log('agent zmienia obszar glowny:', zm.ok ? 'przeszlo' : 'odmowa: ' + zm.blad);

if (zm.ok) {
  const s3 = nowe();
  const trzeci = await s3.zasiej(Z());
  const po = s3.rzecz(glowny.id);
  sprawdz(po.cechy.nazwa === 'Zajete przez agenta',
    `po obudzeniu zasiew naprawia rzecz zajeta przez agenta (ziarna bez zmian)`,
    `zrobione: ${trzeci.length}; nazwa teraz: ${po.cechy.nazwa}; widzi: ${po.cechy.widzi}; zmienil: ${po.zmienil}`);
}

// DRUGI PRZYPADEK: ziarno, ktorego rzecz ktos ODLOZYL - zasiew ma ustepowac rece. To ma zostac odlozone.
const s4 = nowe();
const ks = s4.spis({ rodzaj: 'ksztalt/1', limit: 200 }).find((k) => k.cechy.dla === 'projekt/1');
if (ks) {
  const o = await s4.ruch('jozz', { op: 'proba-odlozenia-ksztaltu-projektu', co: 'odloz', rzecz: ks.id, wersja: 'dowolna' });
  console.log('wlasciciel odklada ksztalt projekt/1:', o.ok ? 'ok' : o.blad);
  const s5 = nowe();
  await s5.zasiej(Z());
  const poOdl = s5.rzecz(ks.id, { odlozone: 'razem' }) || s5.spis({ rodzaj: 'ksztalt/1', odlozone: 'razem', limit: 200 }).find((k) => k.id === ks.id);
  sprawdz(poOdl && poOdl.odlozone === false, 'zasiew ustepuje rece takze po skrocie (odlozony ksztalt zostaje odlozony)',
    `odlozone: ${poOdl ? poOdl.odlozone : 'nie ma rzeczy'}`);
}
console.log(`-- razem: ${d} DZIURA, ${t} TRZYMA`);
