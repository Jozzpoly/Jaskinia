// Polgodzinny falsyfikator drzwi (passkey) - zanim powstanie jedna linia drzwi.
// Pytanie: czy caly lancuch sprawdzenia passkeya da sie zrobic w Workerze SAMYM WebCrypto, bez biblioteki?
// Node ma to samo API co Workers (globalThis.crypto.subtle), wiec to, co tu przejdzie, przejdzie tam.
// Trzy miejsca, w ktorych ludzie sie wywracaja: CBOR (klucz COSE), DER->raw (podpis), i kolejnosc bajtow do podpisu.
const ok = (co, war, szcz='') => console.log(`${war ? 'OK  ' : 'ZLE '} ${co}${szcz ? '\n      ' + szcz : ''}`);
const b = (...a) => new Uint8Array(a);

// --- 1. Minimalny czytnik CBOR: tyle, ile potrzeba na klucz COSE (mapa z kluczami calkowitymi i bajtami) ---
function cbor(u8, i = 0) {
  const d = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const glowa = u8[i++], typ = glowa >> 5; let n = glowa & 31;
  if (n === 24) n = u8[i++];
  else if (n === 25) { n = d.getUint16(i); i += 2; }
  else if (n === 26) { n = d.getUint32(i); i += 4; }
  else if (n === 27) throw new Error('64-bitowe dlugosci: nie w kluczu COSE');
  if (typ === 0) return [n, i];
  if (typ === 1) return [-1 - n, i];
  if (typ === 2) return [u8.slice(i, i + n), i + n];
  if (typ === 3) return [new TextDecoder().decode(u8.slice(i, i + n)), i + n];
  if (typ === 4) { const t = []; for (let k = 0; k < n; k++) { const [w, j] = cbor(u8, i); t.push(w); i = j; } return [t, i]; }
  if (typ === 5) { const m = new Map(); for (let k = 0; k < n; k++) { const [kk, j] = cbor(u8, i); const [vv, j2] = cbor(u8, j); m.set(kk, vv); i = j2; } return [m, i]; }
  throw new Error('nieobslugiwany typ CBOR: ' + typ);
}

// --- 2. Klucz COSE EC2 (alg -7) -> CryptoKey, przez surowy punkt 0x04||x||y ---
async function kluczZCose(coseBajty) {
  const [m] = cbor(coseBajty);
  const kty = m.get(1), alg = m.get(3), crv = m.get(-1), x = m.get(-2), y = m.get(-3);
  if (kty !== 2 || alg !== -7 || crv !== 1) throw new Error(`nieobslugiwany klucz: kty=${kty} alg=${alg} crv=${crv}`);
  const surowy = new Uint8Array(65); surowy[0] = 4; surowy.set(x, 1); surowy.set(y, 33);
  return crypto.subtle.importKey('raw', surowy, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}

// --- 3. Podpis z authenticatora jest w DER (ASN.1 SEQUENCE{r,s}), a WebCrypto chce surowego r||s ---
function derNaSurowy(der) {
  if (der[0] !== 0x30) throw new Error('to nie jest SEQUENCE');
  let i = 2; if (der[1] & 0x80) i = 2 + (der[1] & 0x7f);
  const czytaj = () => { if (der[i++] !== 0x02) throw new Error('to nie jest INTEGER'); const n = der[i++]; const v = der.slice(i, i + n); i += n; return v; };
  const dopelnij = (v) => { const out = new Uint8Array(32); const z = v[0] === 0 ? v.slice(1) : v; out.set(z, 32 - z.length); return out; };
  const r = dopelnij(czytaj()), s = dopelnij(czytaj());
  const out = new Uint8Array(64); out.set(r, 0); out.set(s, 32); return out;
}
const surowyNaDer = (sur) => { // tylko do zbudowania probki, authenticator robi to sam
  const ci = (v) => { let i = 0; while (i < v.length - 1 && v[i] === 0) i++; const z = v.slice(i); return z[0] & 0x80 ? new Uint8Array([0, ...z]) : z; };
  const r = ci(sur.slice(0, 32)), s = ci(sur.slice(32));
  const t = new Uint8Array([0x02, r.length, ...r, 0x02, s.length, ...s]);
  return new Uint8Array([0x30, t.length, ...t]);
};

const main = async () => {
  console.log('Node', process.versions.node, '- crypto.subtle:', !!globalThis.crypto?.subtle, '\n');

  // klucz, ktory udaje passkey
  const para = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const sur = new Uint8Array(await crypto.subtle.exportKey('raw', para.publicKey));
  const x = sur.slice(1, 33), y = sur.slice(33, 65);
  // zbuduj klucz COSE tak, jak przysyla go authenticator
  const bs = (v) => new Uint8Array([0x58, v.length, ...v]);
  const cose = new Uint8Array([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, ...bs(x), 0x22, ...bs(y)]);

  let klucz = null;
  try { klucz = await kluczZCose(cose); ok('CBOR + import klucza COSE bez biblioteki', true, 'alg -7 (ES256), krzywa P-256, punkt surowy 0x04||x||y'); }
  catch (e) { ok('CBOR + import klucza COSE', false, String(e)); }

  // to, co podpisuje authenticator: authenticatorData || SHA-256(clientDataJSON)
  const clientData = new TextEncoder().encode(JSON.stringify({ type: 'webauthn.get', challenge: 'AAAA', origin: 'https://jaskinia.jozzpoly.workers.dev' }));
  const authData = new Uint8Array(37); authData[32] = 0x05; authData[36] = 1; // flagi UP|UV, licznik 1
  const skrotClient = new Uint8Array(await crypto.subtle.digest('SHA-256', clientData));
  const doPodpisu = new Uint8Array(authData.length + 32); doPodpisu.set(authData); doPodpisu.set(skrotClient, authData.length);

  const surPodpis = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, para.privateKey, doPodpisu));
  const der = surowyNaDer(surPodpis);

  // naiwna droga, ktora ludzie probuja pierwsza: podac DER prosto do WebCrypto
  const naiwnie = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, klucz, der, doPodpisu);
  ok('podpis DER podany wprost do WebCrypto jest ODRZUCANY (i dobrze, ze to wiemy teraz)', naiwnie === false,
     'WebCrypto chce surowego r||s; authenticator przysyla DER. To jest pulapka, nie bug.');

  const dobrze = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, klucz, derNaSurowy(der), doPodpisu);
  ok('po zamianie DER -> surowy r||s podpis przechodzi', dobrze === true, 'caly lancuch: CBOR -> import -> DER->raw -> verify, zero bibliotek');

  // kontrola przeciwna: zmieniony authenticatorData musi polec
  const zepsute = doPodpisu.slice(); zepsute[36] = 2;
  const zly = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, klucz, derNaSurowy(der), zepsute);
  ok('kontrola przeciwna: podmieniony licznik NIE przechodzi', zly === false, 'bez tego poprzednia linia nic nie znaczy');

  // ile kodu to jest naprawde
  const kod = (cbor.toString() + kluczZCose.toString() + derNaSurowy.toString()).split('\n').length;
  console.log(`\nCaly mechanizm sprawdzenia: ${kod} linii wlasnego kodu, zero zaleznosci.`);
};
main().catch((e) => { console.error('WYWROTKA:', e); process.exit(1); });
