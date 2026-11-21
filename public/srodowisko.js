// Gospodarz środowiska: strona, która pokazuje, co jest w Miejscu, i otwiera gości w oknach (17 XI 2026). Próba.
// To jedyny kod działający pod adresem Miejsca. Wszystko, co pokazuje, czyta z tych samych drzwi co agenci
// (/api/srodowisko/…), a z gośćmi rozmawia umową okna (opis: /umowa-okna). Dane trafiają na stronę wyłącznie jako
// tekst (textContent), nigdy jako HTML.
(() => {
  'use strict';
  const PAMIEC = 'jaskinia:srodowisko:widziany-akt';
  const $ = (id) => document.getElementById(id);
  const el = (znacznik, cechy = {}, ...dzieci) => {
    const e = document.createElement(znacznik);
    for (const [k, w] of Object.entries(cechy)) {
      if (w === null || w === undefined || w === false) continue;
      if (k === 'tekst') e.textContent = w; else if (k === 'klik') e.addEventListener('click', w); else if (k === 'klasa') e.className = w; else e.setAttribute(k, w === true ? '' : w);
    }
    for (const d of dzieci.flat()) if (d !== null && d !== undefined && d !== false) e.append(d);
    return e;
  };
  // Klucz uczestnika zostaje w pamięci tej przeglądarki, pod adresem Miejsca. Goście w ramkach go nie widzą:
  // kod z Miejsca nie ma własnego adresu, a obce strony mają inny.
  const KLUCZ = 'jaskinia:srodowisko:klucz';
  let klucz = localStorage.getItem(KLUCZ) || '';
  const naglowki = (dod = {}) => ({ accept: 'application/json', ...(klucz ? { authorization: 'Bearer ' + klucz } : {}), ...dod });
  const czytaj = async (sciezka) => {
    let o = await fetch(sciezka, { headers: naglowki(), cache: 'no-store' });
    // Klucz, którego Miejsce już nie zna, nie może zamknąć strony: zapominamy go i czytamy jak zwiedzający.
    if (o.status === 401 && klucz) { klucz = ''; localStorage.removeItem(KLUCZ); komunikat('Ten klucz nie jest już znany w tym Miejscu. Wejdź jeszcze raz.', true); o = await fetch(sciezka, { headers: naglowki(), cache: 'no-store' }); }
    const d = await o.json().catch(() => null);
    if (!o.ok || !d || d.ok === false) throw new Error((d && (d.blad || d.error)) || 'odpowiedź ' + o.status);
    return d;
  };
  // Czytanie w imieniu narzędzia w oknie: te same drzwi, ale z nagłówkiem X-Gosc, czyli słabszymi z dwóch par oczu
  // (narzędzia i tego, kto okno otworzył). Okno bez rzeczy gościa (sam adres, np. wejście projektu) czyta bez klucza,
  // jak zwiedzający: narzędzie w oknie nie dostaje oczu właściciela tylko dlatego, że to on je otworzył.
  const czytajOknem = async (o, sciezka) => {
    const odp = await fetch(sciezka, { headers: o.gosc ? naglowki({ 'x-gosc': o.gosc.id }) : { accept: 'application/json' }, cache: 'no-store' });
    const d = await odp.json().catch(() => null);
    if (!odp.ok || !d || d.ok === false) throw new Error((d && (d.blad || d.error)) || 'odpowiedź ' + odp.status);
    return d;
  };
  // Zdanie o tym, co się właśnie stało (albo dlaczego się nie stało): nakładka nad dokiem, więc nie przesuwa
  // układu strony i palec nie trafia w pustkę. Dotknięcie ją zamyka; sama znika po kilku sekundach.
  function komunikat(tekst, zly = false) {
    const k = $('komunikat');
    if (!k) return;
    k.textContent = tekst || '';
    k.className = zly ? 'komunikat zly' : 'komunikat';
    k.hidden = !tekst;
    clearTimeout(komunikat.zegar);
    if (tekst) komunikat.zegar = setTimeout(() => { k.hidden = true; }, zly ? 12000 : 5000);
  }
  $('komunikat').addEventListener('click', () => { clearTimeout(komunikat.zegar); $('komunikat').hidden = true; });
  let licznikOp = 0;
  const nowyOp = () => 'reka-' + Date.now().toString(36) + '-' + (++licznikOp).toString(36) + Math.random().toString(36).slice(2, 8);
  // Jeden ruch ręki przez te same drzwi, którymi chodzą agenci. Odpowiedź drzwi mówi po polsku, co się stało.
  // opcje.zrodlo: guzik, który wysłał ruch; on i jego sąsiedzi w grupie są nieczynni do końca ruchu (bez drugiego
  // wysłania i bez dotknięcia starego stanu). opcje.sukces: co zrobić po przyjęciu ruchu, ZANIM strona się odświeży
  // (np. wyczyścić szkic pola, żeby przerysowanie nie pokazało starego tekstu).
  async function ruch(cialo, dobrze, opcje = {}) {
    if (!klucz) { komunikat('Żeby coś zmienić, najpierw wejdź: guzik "Wejdź" na górze strony.', true); return null; }
    const grupa = opcje.zrodlo && opcje.zrodlo.parentElement ? [...opcje.zrodlo.parentElement.querySelectorAll('button, textarea')] : [];
    const bylo = grupa.map((x) => x.disabled);
    grupa.forEach((x) => { x.disabled = true; });
    try {
      const o = await fetch('/api/srodowisko/ruch', { method: 'POST', headers: naglowki({ 'content-type': 'application/json', 'x-cialo': 'strona gospodarza' }), body: JSON.stringify({ op: nowyOp(), ...cialo }) });
      const d = await o.json().catch(() => null);
      if (!o.ok || !d || d.ok === false) { if (opcje.naOdmowe) opcje.naOdmowe(d); komunikat((d && d.blad) || 'Drzwi odpowiedziały: ' + o.status, true); return null; }
      if (opcje.sukces) opcje.sukces();
      let zdanie = d.skutek === 'propozycja' ? 'Poszło jako propozycja (' + (d.powod || 'czeka na rozstrzygnięcie') + ').' : (dobrze || 'Zrobione.');
      // Najpierw ekran, potem zdanie o skutku: inaczej przez chwilę strona mówi dwie różne rzeczy.
      try { await dogon(); if (kr.id) await odswiezKarte(); } catch (blad) { zdanie += ' (Strony nie udało się odświeżyć: ' + blad.message + ')'; }
      komunikat(zdanie);
      return d;
    } catch (blad) { komunikat('Nie udało się połączyć: ' + blad.message, true); return null; }
    finally { grupa.forEach((x, i) => { x.disabled = bylo[i]; }); }
  }
  const kiedy = (iso) => {
    const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (!Number.isFinite(min)) return '';
    if (min < 1) return 'przed chwilą';
    if (min < 60) return min + ' min temu';
    if (min < 60 * 36) return Math.round(min / 60) + ' godz. temu';
    const dni = Math.round(min / 1440);
    return dni < 60 ? dni + ' dni temu' : Math.round(dni / 30) + ' mies. temu';
  };
  // Im żywszy projekt, tym bardziej zielony: kolor paska bierze się z wieku ostatniej zmiany u źródła.
  const kolorZycia = (iso) => {
    const dni = (Date.now() - Date.parse(iso)) / 86400000;
    if (!Number.isFinite(dni)) return null;
    const t = Math.max(0, Math.min(1, 1 - Math.log10(1 + dni) / Math.log10(181)));
    return `color-mix(in srgb, var(--zywe) ${Math.round(t * 100)}%, var(--stare))`;
  };

  let opis = null, rzeczy = [], akt = 0;
  let widziany = Number(localStorage.getItem(PAMIEC) || 0) || 0;
  const okna = new Map(); // id okna -> { ramka, sekcja, guzik, gosc, chce, nazwa }
  let nrOkna = 0;

  // --- okna gości ----------------------------------------------------------------------------------------------
  // Trzy poziomy zaufania do tego, co otwieramy w ramce:
  //   'kod'   : kod gościa zapisany w Miejscu (piaskownica bez własnego adresu, pamięci i sieci);
  //   'obcy'  : adres podany przez kogoś innego niż właściciel (skrypty tak, własna pamięć i wyskakujące okna nie);
  //   'swoj'  : adres w rzeczy, którą dołożył i ostatnio zmienił właściciel (gra ma własną pamięć pod swoim adresem).
  const PIASKOWNICE = { kod: 'allow-scripts allow-pointer-lock', obcy: 'allow-scripts allow-pointer-lock', swoj: 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups' };
  // Okno jest rzeczą (okno/1): które narzędzie i czy jest otwarte. Wraca po przeładowaniu strony i na drugim urządzeniu,
  // a jako rzecz jest zasięgiem wartości pokręteł (wygląd tylko dla tego okna). Zapis jest cichy: bez komunikatu.
  const mojeImie = () => (opis && klucz && opis.czytasz_jako ? opis.czytasz_jako.imie : null);
  const rzeczOkna = (goscId) => { const ja = mojeImie(); return ja ? rzeczy.find((x) => x.rodzaj === 'okno/1' && x.cechy.czyje === ja && x.cechy.gosc === goscId) || null : null; };
  async function zapamietajOkno(r, otwarte) {
    const ja = mojeImie();
    if (!ja) return;
    const jest = rzeczOkna(r.id);
    // Okno pamięta wersję narzędzia z chwili otwarcia: po przeładowaniu strona wraca do niego sama tylko wtedy, gdy
    // narzędzie od tego czasu się nie zmieniło. Zamknięcie zostawia wersję, którą okno już pamięta.
    const wersjaGoscia = otwarte && Number.isInteger(r.wersja) ? r.wersja : (jest && Number.isInteger(jest.cechy.wersja_goscia) ? jest.cechy.wersja_goscia : null);
    if (jest && jest.cechy.otwarte === otwarte && (Number.isInteger(jest.cechy.wersja_goscia) ? jest.cechy.wersja_goscia : null) === wersjaGoscia) return;
    try {
      await fetch('/api/srodowisko/ruch', { method: 'POST', headers: naglowki({ 'content-type': 'application/json', 'x-cialo': 'strona gospodarza' }), body: JSON.stringify({ op: nowyOp(), co: 'poloz', rodzaj: 'okno/1', wersja: 'dowolna', cechy: { nazwa: r.tytul || 'okno', czyje: ja, gosc: r.id, otwarte, ...(wersjaGoscia !== null ? { wersja_goscia: wersjaGoscia } : {}) } }) });
    } catch { /* okno i tak jest otwarte na tej stronie; nie wróci tylko po przeładowaniu */ }
  }
  // Otwarcie narzędzia z jego rzeczy (gosc/1): z guzika "Otwórz" i przy powrocie okien po przeładowaniu strony.
  function otworzGoscia(r, { cicho = false } = {}) {
    const c = r.cechy;
    const kod = typeof c.kod === 'string' && /^[0-9a-f]{64}$/.test(c.kod) ? '/gosc/' + c.kod : null;
    const adres = !kod && typeof c.adres === 'string' && /^https:\/\//.test(c.adres) ? c.adres : null;
    if (!kod && !adres) return;
    otworz({ klucz: 'g:' + r.id + ':' + (kod || adres), tytul: r.tytul, adres: kod || adres, piaskownica: kod ? 'kod' : (odWlasciciela(r) ? 'swoj' : 'obcy'), gosc: { id: r.id, nazwa: r.tytul, umowa: typeof c.umowa === 'string' ? c.umowa : null } });
    if (!cicho) zapamietajOkno(r, true);
  }
  // Powrót okien po przeładowaniu: regułę trzyma public/okna.mjs (tylko okno, które sam zapisałem, i tylko do narzędzia
  // w wersji, którą otworzyła moja ręka). Dopóki moduł nie przyszedł, nic nie otwiera się samo.
  let modulOkien = null;
  const powiedzianeOkna = new Set();
  function wrocOkna() {
    const ja = mojeImie();
    if (!ja || !modulOkien) return;
    for (const o of rzeczy) {
      if (o.rodzaj !== 'okno/1') continue;
      const g = rzeczy.find((x) => x.id === o.cechy.gosc) || null;
      const w = modulOkien.oknoWracaSamo(o, g, ja);
      if (w.wraca) otworzGoscia(g, { cicho: true });
      // Okno, które nie wróciło, bo narzędzie się zmieniło: mówimy to raz i zapisujemy je jako zamknięte (jest moje,
      // więc wolno mi), żeby strona nie powtarzała tego zdania przy każdym wejściu. Otworzy je dopiero ręka.
      else if (w.powiedz && !powiedzianeOkna.has(o.id + ':' + o.wersja)) { powiedzianeOkna.add(o.id + ':' + o.wersja); komunikat(w.powiedz); if (g) zapamietajOkno({ id: g.id, tytul: g.tytul }, false); }
    }
  }
  function otworz({ klucz, tytul, adres, piaskownica, gosc = null, nakladka = null, rola = null }) {
    for (const [id, o] of okna) if (o.klucz === klucz) return pokaz(id, true);
    const id = 'okno-' + ++nrOkna;
    const ramka = el('iframe', { src: adres, title: tytul, referrerpolicy: 'no-referrer', allow: 'fullscreen; gamepad', sandbox: PIASKOWNICE[piaskownica] || PIASKOWNICE.obcy });
    const mowi = el('span', { klasa: 'mowi' });
    // ślad pisania: ile razy narzędzie w tym oknie coś zapisało albo zaproponowało (ruch z okna, umowa okno/3)
    const sladOkna = el('span', { klasa: 'slad-okna' });
    const tyt = el('span', { klasa: 'tytul', tekst: tytul });
    // Suwaki świata obok okna (krok 3 serca domu, Opus czatu, 21 XI 2026): pokrętła, które ten świat sam czyta
    // z Jaskini, w zasięgu, z którym je czyta. Guzik pojawia się dopiero, gdy świat o coś zapyta.
    const suwaki = el('aside', { klasa: 'suwaki', hidden: true, 'aria-label': 'Suwaki świata' });
    const guzikSuwakow = el('button', { tekst: 'suwaki', hidden: true, 'aria-pressed': 'false', title: 'Pokrętła, które ten świat czyta z Jaskini: strojenie tylko dla niego', klik: () => przelaczSuwaki(id) });
    // Dwa okna jednego świata (jego słowa z 21 XI 04:43: ten sam input na dwa okna, inne ustawienia). Guzik pojawia się,
    // gdy świat w hello mówi, że umie odtwarzać programy wejścia (umie: play); okno B go nie ma.
    const guzikAB = el('button', { tekst: 'A/B', hidden: true, title: 'Drugie okno tego świata obok, z własnymi ustawieniami (profil B), i ten sam przejazd w obu', klik: () => otworzAB(id) });
    suwaki.addEventListener('pointerdown', () => { const o = okna.get(id); if (o) o.trzymaSuwak = true; });
    // wyjście z pola: to, co przyszło w trakcie pisania, rysuje się teraz
    suwaki.addEventListener('focusout', () => setTimeout(() => { const o = okna.get(id); if (o && o.suwakiZalegle && !o.trzymaSuwak && !pisze(o)) { o.suwakiZalegle = false; rysujSuwaki(o); } }, 0));
    const sekcja = el('section', { klasa: 'okno', 'aria-label': tytul },
      el('div', { klasa: 'pasek' }, rola ? el('span', { klasa: 'rola', tekst: rola, title: rola === 'B' ? 'Okno B: ustawienia z profilu B nad ustawieniami świata' : 'Okno A: ustawienia świata' }) : null, tyt, mowi, sladOkna,
        guzikSuwakow, guzikAB,
        el('a', { klasa: 'guzik', href: adres, target: '_blank', rel: 'noopener', tekst: 'nowa karta' }),
        el('button', { tekst: 'zwiń', title: 'Zwiń do guzika na dole; okno zostaje załadowane', klik: () => pokaz(id, false) }),
        el('button', { tekst: '×', title: 'Zamknij okno', klik: () => zamknij(id) })),
      el('div', { klasa: 'tresc' }, ramka, suwaki));
    // Mowa świata pod oknem (krok 2 serca domu, Opus czatu, 21 XI 2026): sygnały z małym wykresem i ostatnie
    // zdarzenie. Pas jest pusty i schowany, dopóki świat nic nie powie, więc nic tu nie udaje życia.
    const mowa = el('div', { klasa: 'mowa', hidden: true, 'aria-live': 'off' });
    sekcja.append(mowa);
    const guzik = el('button', { tekst: tytul, klik: () => pokaz(id, sekcja.hidden) });
    okna.set(id, { klucz, ramka, sekcja, guzik, tyt, mowi, gosc, chce: [], nazwa: tytul, slad: sladOkna, zapisy: 0, propozycje: 0, mowa, sygnaly: new Map(), zdarzenia: [], rysujMowe: 0, suwaki, guzikSuwakow, czyta: new Set(), dla: null, suwakiNr: 0, trzymaSuwak: false, suwakiZalegle: false, zwiniete: new Set(),
      adres, piaskownica, nakladka, rola, para: null, umie: [], oczekuje: new Map(), dotkniete: 0, guzikAB });
    ramka.addEventListener('load', () => { if (!ramka.contentWindow) return; ramka.contentWindow.postMessage({ jaskinia: 1, type: 'hi', v: 2, umowy: ['okno/2', 'okno/3'], umie: ['look'] }, '*'); powiedzWyglad(okna.get(id)); });
    $('okna').append(sekcja);
    $('dok').append(guzik);
    pokaz(id, true);
  }
  function pokaz(id, widac) {
    // Para A/B pokazuje się i chowa razem: dwa okna obok siebie albo żadne.
    const ten = okna.get(id);
    const para = ten && ten.para && okna.has(ten.para) ? ten.para : null;
    for (const [inne, o] of okna) {
      const ma = inne === id || inne === para ? widac : (widac ? false : !o.sekcja.hidden);
      if (o.sekcja.hidden === !ma) continue;
      o.sekcja.hidden = !ma;
      o.guzik.classList.toggle('widoczne', ma);
      o.ramka.contentWindow && o.ramka.contentWindow.postMessage({ jaskinia: 1, type: 'visible', visible: ma }, '*');
    }
    const o = okna.get(id);
    if (o) o.guzik.classList.toggle('widoczne', !o.sekcja.hidden);
    ulozAB();
    powiedzPrzy();
  }
  function zamknij(id) {
    const o = okna.get(id);
    if (!o) return;
    // Okno B nie jest pamiętane (nie wraca po przeładowaniu); zamknięcie A zamyka też jego B.
    if (o.para && okna.has(o.para)) {
      const p = okna.get(o.para);
      p.para = null;
      if (o.rola === 'A') { zamknij(o.para); } else { p.rola = null; p.sekcja.querySelector('.pasek .rola')?.remove(); p.guzikAB.hidden = !(p.umie.includes('play') && p.gosc); p.guzik.textContent = p.nazwa; }
    }
    if (o.gosc && o.rola !== 'B') zapamietajOkno({ id: o.gosc.id, tytul: o.gosc.nazwa }, false);
    for (const w of o.oczekuje.values()) w({ ok: false, error: 'okno zamknięte' });
    o.sekcja.remove(); o.guzik.remove(); okna.delete(id);
    ulozAB();
    powiedzPrzy();
  }
  // --- dwa okna jednego świata (A/B) -----------------------------------------------------------------------------
  // Jego słowa z 21 XI 04:43: ten sam input na dwa okna, inne ustawienia. Okno B to ten sam świat z profilem
  // „B: <świat>” jako nakładką: czyta to, co A, a nad tym swoje wartości (A/B na profilach, uzgodnione z Opusem Code).
  // Porównanie idzie programem wejścia (umowa JV z 21 XI: play/played, record/recorded, format wejscie/1 i przebieg/1):
  // oba auta wracają na start i jadą krok w krok to samo, więc różnica bierze się tylko z ustawień. Zdanie liczy się
  // jak w przyrządzie Opusa Code (sprawdz-swiat.mjs, dwaOkna): prędkość po 3 s, odległość na końcu, najwyższa
  // prędkość i przechył, bo szybsze nie znaczy lepsze (pierwszy zrzut A/B pokazał szybsze auto na boku).
  const PROGRAM_AB = { schemat: 'wejscie/1', nazwa: 'Osiadanie, ruszanie, łuk, hamowanie do zatrzymania', odcinki: [{ s: 1 }, { s: 2, gaz: 1 }, { s: 1, gaz: 1, skret: 0.5 }, { s: 3, hamulec: 1 }] };
  const CHWILA_AB = 3, PRZEWROTKA_ST = 60;
  const ab = { sekcja: null, para: null, trwa: false };
  const sekundyProgramu = (p) => Math.round((p.odcinki || []).reduce((s, x) => s + (Number.isFinite(x.s) ? x.s : (Number(x.kroki) || 0) / 60), 0) * 10) / 10;
  let nrZadaniaAB = 0;
  // Wiadomość do świata w oknie i czekanie na odpowiedź z tym samym id, nie dłużej niż `ms`.
  function zapytajSwiat(o, wiadomosc, ms) {
    const id = 'ab-' + Date.now().toString(36) + '-' + ++nrZadaniaAB;
    return new Promise((res) => {
      const t = setTimeout(() => { o.oczekuje.delete(id); res({ ok: false, error: 'świat nie odpowiedział w ' + Math.round(ms / 1000) + ' s' }); }, ms);
      o.oczekuje.set(id, (m) => { clearTimeout(t); res(m); });
      if (o.ramka.contentWindow) o.ramka.contentWindow.postMessage({ jaskinia: 1, ...wiadomosc, id }, '*');
    });
  }
  async function otworzAB(idA) {
    const A = okna.get(idA);
    if (!A || !A.gosc) return;
    if (A.para && okna.has(A.para)) { pokaz(idA, true); return; }
    if (!klucz) { komunikat('Okno B ma własne ustawienia, więc najpierw wejdź (guzik „Wejdź” na górze strony).', true); return; }
    const ja = mojeImie();
    const nazwaB = 'B: ' + A.gosc.nazwa;
    // profil B jest jeden na świat i osobę: wraca przy następnym A/B razem ze swoimi wartościami
    let profil = rzeczy.find((r) => r.rodzaj === 'profil/1' && r.cechy && r.cechy.nazwa === nazwaB && (!ja || r.utworzyl === ja)) || null;
    if (!profil) {
      const r = await ruch({ co: 'poloz', rodzaj: 'profil/1', cechy: { nazwa: nazwaB, opis: 'Okno B świata „' + A.gosc.nazwa + '”: wartości, którymi B różni się od A.' } }, 'Profil „' + nazwaB + '” gotowy: suwaki okna B piszą w niego.');
      if (!r || !r.rzecz) return;
      profil = { id: r.rzecz };
    }
    otworz({ klucz: A.klucz + '#B', tytul: A.nazwa, adres: A.adres, piaskownica: A.piaskownica, gosc: A.gosc, nakladka: profil.id, rola: 'B' });
    const wpis = [...okna].find(([, o]) => o.klucz === A.klucz + '#B');
    if (!wpis) return;
    const [idB, B] = wpis;
    A.rola = 'A'; A.para = idB; B.para = idA;
    if (!A.sekcja.querySelector('.pasek .rola')) A.sekcja.querySelector('.pasek').prepend(el('span', { klasa: 'rola', tekst: 'A', title: 'Okno A: ustawienia świata' }));
    A.guzikAB.hidden = true;
    A.guzik.textContent = A.nazwa + ' · A'; B.guzik.textContent = B.nazwa + ' · B';
    pokaz(idA, true);
  }
  function zbudujAB() {
    if (ab.sekcja) return;
    ab.stan = el('span', { klasa: 'ab-stan', 'aria-live': 'polite' });
    ab.zdanie = el('p', { klasa: 'ab-zdanie', 'aria-live': 'polite' });
    ab.wykres = el('div', { klasa: 'ab-wykres' });
    ab.jedz = el('button', { klasa: 'glowny', tekst: 'Jedź tak samo w obu', title: 'Oba auta wracają na start i jadą ten sam program: ' + PROGRAM_AB.nazwa.toLowerCase() + ' (' + liczbaPL(sekundyProgramu(PROGRAM_AB)) + ' s)', klik: () => jedzWObu(PROGRAM_AB) });
    ab.powtorz = el('button', { tekst: 'Powtórz mój przejazd w obu', title: 'Twoja jazda od ostatniego startu w oknie, w którym jechałeś, odtworzona od startu w obu oknach', klik: () => powtorzWObu() });
    ab.sekcja = el('section', { klasa: 'ab', hidden: true, 'aria-label': 'Porównanie okien A i B' },
      el('div', { klasa: 'ab-guziki' }, ab.jedz, ab.powtorz, ab.stan), ab.zdanie, ab.wykres);
    $('okna').append(ab.sekcja);
  }
  // Para A/B widoczna razem: okna stają obok siebie (na telefonie jedno pod drugim), a pod nimi pas porównania.
  function ulozAB() {
    const A = [...okna.values()].find((o) => o.rola === 'A' && o.para && okna.has(o.para)) || null;
    const B = A ? okna.get(A.para) : null;
    const obaWidac = !!A && !A.sekcja.hidden && !B.sekcja.hidden;
    for (const o of okna.values()) { o.sekcja.classList.toggle('ab-a', obaWidac && o === A); o.sekcja.classList.toggle('ab-b', obaWidac && o === B); }
    if (obaWidac) zbudujAB();
    if (!ab.sekcja) return;
    ab.sekcja.hidden = !obaWidac;
    ab.para = obaWidac ? A : null;
    if (obaWidac && !ab.trwa) { ab.jedz.disabled = !(A.umie.includes('play') && B.umie.includes('play')); ab.powtorz.disabled = !(A.umie.includes('record') && B.umie.includes('record')); }
  }
  async function jedzWObu(program, skad = '') {
    const A = ab.para, B = A && okna.get(A.para);
    if (!A || !B || ab.trwa) return;
    ab.trwa = true; ab.jedz.disabled = true; ab.powtorz.disabled = true;
    const s = sekundyProgramu(program);
    ab.stan.textContent = 'Oba auta jadą od startu: ' + (program.nazwa || 'program') + ' (' + liczbaPL(s) + ' s)…';
    // schowane okno może jechać wolniej, nigdy inaczej: limit to trzy długości programu i start
    const ms = Math.ceil(s * 3000 + 15000);
    const [pa, pb] = await Promise.all([zapytajSwiat(A, { type: 'play', program }, ms), zapytajSwiat(B, { type: 'play', program }, ms)]);
    ab.trwa = false;
    ulozAB();
    if (!pa.ok || !pb.ok || !pa.przebieg || !pb.przebieg) {
      ab.stan.textContent = '';
      ab.zdanie.textContent = 'Nie wyszło. ' + [!pa.ok || !pa.przebieg ? 'A: ' + String(pa.error || 'brak przebiegu').slice(0, 160) : null, !pb.ok || !pb.przebieg ? 'B: ' + String(pb.error || 'brak przebiegu').slice(0, 160) : null].filter(Boolean).join('; ') + '.';
      ab.wykres.replaceChildren();
      return;
    }
    ab.stan.textContent = (skad ? skad + ': ' : 'Przejazd: ') + (program.nazwa || 'program') + ', ' + liczbaPL(s) + ' s.';
    ab.zdanie.textContent = zdanieAB(pa.przebieg, pb.przebieg, program);
    ab.wykres.replaceChildren(wykresAB(pa.przebieg, pb.przebieg));
  }
  // „Powtórz mój przejazd”: nagranie z okna, w którym ręka jechała ostatnio (domyślnie A), potem ten program w obu.
  async function powtorzWObu() {
    const A = ab.para, B = A && okna.get(A.para);
    if (!A || !B || ab.trwa) return;
    const zrodlo = B.dotkniete > A.dotkniete ? B : A;
    ab.stan.textContent = 'Biorę Twój przejazd z okna ' + zrodlo.rola + '…';
    const r = await zapytajSwiat(zrodlo, { type: 'record' }, 10000);
    if (!r.ok || !r.program || !Array.isArray(r.program.odcinki) || !r.program.odcinki.length) { ab.stan.textContent = ''; ab.zdanie.textContent = 'Nie ma czego powtórzyć: ' + String(r.error || 'w oknie ' + zrodlo.rola + ' nikt jeszcze nie jechał od startu') + '.'; return; }
    const program = { ...r.program, nazwa: r.program.nazwa || 'Twój przejazd z okna ' + zrodlo.rola };
    await jedzWObu(program, 'Twój przejazd z okna ' + zrodlo.rola + (r.obciete ? ' (ucięty do limitu programu)' : ''));
  }
  // Która kolumna próbki jest czasem, a która prędkością: z pola kolumny (przebieg/1), inaczej t i v_kmh na początku.
  const kolumnyAB = (p) => { const k = Array.isArray(p.kolumny) ? p.kolumny : []; const t = k.indexOf('t'), v = k.indexOf('v_kmh'); return { t: t >= 0 ? t : 0, v: v >= 0 ? v : 1 }; };
  const ileAB = (x, m = 1) => (typeof x === 'number' && Number.isFinite(x) ? x.toLocaleString('pl-PL', { maximumFractionDigits: m }) : '?');
  function zdanieAB(a, b, program) {
    if (!Array.isArray(a.probki) || !Array.isArray(b.probki) || !a.probki.length || !b.probki.length) return 'Świat oddał przebieg bez próbek, więc nie ma czego porównać.';
    if (a.skrot && a.skrot === b.skrot) return 'Ustawienia B nie zmieniły tej jazdy: oba okna przejechały „' + (program.nazwa || 'program') + '” bit w bit tak samo.';
    const ka = kolumnyAB(a), kb = kolumnyAB(b);
    const wChwili = (p, k) => p.probki.reduce((naj, r) => (Math.abs(r[k.t] - CHWILA_AB) < Math.abs(naj[k.t] - CHWILA_AB) ? r : naj));
    const ra = wChwili(a, ka), rb = wChwili(b, kb);
    const va = Math.abs(ra[ka.v]), vb = Math.abs(rb[kb.v]);
    const procent = va > 0.05 ? (vb / va - 1) * 100 : null;
    let z = procent === null
      ? 'Po ' + ileAB(ra[ka.t], 2) + ' s programu B jedzie ' + ileAB(vb) + ' km/h, A stoi.'
      : 'B ' + (procent >= 0 ? 'szybsze' : 'wolniejsze') + ' o ' + ileAB(Math.abs(procent), 0) + '% po ' + ileAB(ra[ka.t], 2) + ' s programu (' + ileAB(vb) + ' wobec ' + ileAB(va) + ' km/h).';
    const ea = a.koniec || {}, eb = b.koniec || {};
    if (Number.isFinite(ea.odleglosc_m) && Number.isFinite(eb.odleglosc_m)) z += ' Na końcu B ' + ileAB(eb.odleglosc_m) + ' m od startu, A ' + ileAB(ea.odleglosc_m) + ' m';
    if (Number.isFinite(a.vmax_kmh) && Number.isFinite(b.vmax_kmh)) z += (z.endsWith(' m') ? '; najwyżej' : ' Najwyżej') + ' B ' + ileAB(Math.abs(b.vmax_kmh)) + ', A ' + ileAB(Math.abs(a.vmax_kmh)) + ' km/h';
    if (!z.endsWith('.')) z += '.';
    const pa = a.przechyl_max_st, pb = b.przechyl_max_st;
    if (!Number.isFinite(pa) || !Number.isFinite(pb)) return z + ' (Świat nie podaje przechyłu.)';
    const lezy = [['B', pb, b.t_przechyl_max], ['A', pa, a.t_przechyl_max]].filter((x) => x[1] >= PRZEWROTKA_ST);
    const opisL = (x) => x[0] + ' ' + ileAB(x[1], 0) + '° po ' + ileAB(x[2], 1) + ' s';
    if (lezy.length === 2) return z + ' Oba się przewróciły: ' + lezy.map(opisL).join(', ') + '.';
    if (lezy.length === 1) return z + ' ' + lezy[0][0] + ' się przewróciło (' + opisL(lezy[0]) + '), ' + (lezy[0][0] === 'B' ? 'A' : 'B') + ' nie (najwyżej ' + ileAB(lezy[0][0] === 'B' ? pa : pb, 0) + '°).';
    return z + ' Przechył najwyżej B ' + ileAB(pb, 0) + '°, A ' + ileAB(pa, 0) + '°.';
  }
  // Dwie krzywe prędkości v(t) na jednej skali: A i B podpisane przy końcach linii, więc nie trzeba legendy z kolorów.
  function wykresAB(a, b) {
    const NS = 'http://www.w3.org/2000/svg', W = 320, H = 90, L = 28, D = 14;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('role', 'img');
    const ka = kolumnyAB(a), kb = kolumnyAB(b);
    const pkt = (p, k) => p.probki.map((r) => [Number(r[k.t]), Math.abs(Number(r[k.v]))]).filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v));
    const ta = pkt(a, ka), tb = pkt(b, kb);
    const tMax = Math.max(1, ...ta.map((x) => x[0]), ...tb.map((x) => x[0]));
    const vMax = Math.max(1, ...ta.map((x) => x[1]), ...tb.map((x) => x[1]));
    svg.setAttribute('aria-label', 'Prędkość A i B w czasie programu, najwyżej ' + ileAB(vMax) + ' km/h po ' + ileAB(tMax) + ' s');
    const x = (t) => L + (t / tMax) * (W - L - 16), y = (v) => H - D - (v / vMax) * (H - D - 6);
    const linia = (x1, y1, x2, y2, klasa) => { const l = document.createElementNS(NS, 'line'); l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); l.setAttribute('class', klasa); svg.append(l); };
    const napis = (tekst, tx, ty, klasa, kotwica = 'start') => { const t = document.createElementNS(NS, 'text'); t.setAttribute('x', tx); t.setAttribute('y', ty); t.setAttribute('class', klasa); t.setAttribute('text-anchor', kotwica); t.textContent = tekst; svg.append(t); };
    linia(L, H - D, W - 16, H - D, 'os'); linia(L, 6, L, H - D, 'os');
    // podpis skali wewnątrz wykresu: przy lewej krawędzi „122 km/h” wychodził poza rysunek i zostawało „2 km/h”
    napis(ileAB(vMax, 0) + ' km/h', L + 3, 12, 'skala'); napis('0', L - 3, H - D, 'skala', 'end');
    napis(ileAB(tMax, 1) + ' s', W - 16, H - 2, 'skala', 'end'); napis('0 s', L, H - 2, 'skala');
    for (const [p, k, klasa] of [[ta, 'A', 'krzywa-a'], [tb, 'B', 'krzywa-b']]) {
      if (p.length < 2) continue;
      const l = document.createElementNS(NS, 'polyline');
      l.setAttribute('points', p.map(([t, v]) => x(t).toFixed(1) + ',' + y(v).toFixed(1)).join(' '));
      l.setAttribute('class', klasa);
      svg.append(l);
      const [tk, vk] = p.reduce((naj, r) => (r[1] > naj[1] ? r : naj));
      napis(k, Math.min(W - 10, x(tk) + 4), Math.max(10, y(vk) - 3), 'podpis ' + klasa);
    }
    return svg;
  }
  // Gdzie ręka jechała ostatnio: ramka dostaje fokus przy kliknięciu, a strona traci go w tej samej chwili.
  addEventListener('blur', () => setTimeout(() => { const a = document.activeElement; for (const o of okna.values()) if (o.ramka === a) o.dotkniete = Date.now(); }, 0));
  // Rozmowa z gośćmi. Przyjmujemy wiadomości tylko od ramek, które sami otworzyliśmy.
  addEventListener('message', async (e) => {
    const m = e.data;
    if (!m || typeof m !== 'object' || m.jaskinia !== 1 || typeof m.type !== 'string') return;
    const o = [...okna.values()].find((x) => x.ramka.contentWindow === e.source);
    if (!o) return;
    const odp = (w) => e.source.postMessage({ jaskinia: 1, ...w }, '*');
    if (m.type === 'hello') {
      // w doku para musi się różnić: „Świat · A” i „Świat · B”, inaczej dwa takie same guziki
      if (typeof m.name === 'string' && m.name.trim()) { o.nazwa = m.name.trim().slice(0, 60); o.tyt.textContent = o.nazwa; o.guzik.textContent = o.nazwa + (o.rola ? ' · ' + o.rola : ''); }
      o.chce = Array.isArray(m.wants) ? m.wants.filter((x) => typeof x === 'string').slice(0, 8) : [];
      // co świat umie poza umową (JV od 21 XI: play i record, programy wejścia); nieznane pola pomijamy
      o.umie = Array.isArray(m.umie) ? m.umie.filter((x) => typeof x === 'string').slice(0, 16) : [];
      o.guzikAB.hidden = !(o.umie.includes('play') && o.gosc && o.rola !== 'B');
      // okno B przedstawia się później niż powstaje para: dopiero wtedy wiadomo, czy oba umieją jechać programem
      if (o.para) ulozAB();
    } else if (m.type === 'played' || m.type === 'recorded') {
      // odpowiedź na play albo record od gospodarza: czeka na nią porównanie A/B
      const w = o.oczekuje.get(m.id);
      if (w) { o.oczekuje.delete(m.id); w(m); }
    } else if (m.type === 'state') {
      o.mowi.textContent = typeof m.text === 'string' ? m.text.slice(0, 240) : '';
    } else if (m.type === 'read') {
      try {
        let dane;
        if (m.what === 'spis') {
          const p = new URLSearchParams();
          if (typeof m.rodzaj === 'string') p.set('rodzaj', m.rodzaj);
          if (typeof m.obszar === 'string' || m.obszar === null) p.set('obszar', m.obszar || '');
          if (Number.isInteger(m.pomin) && m.pomin > 0) p.set('pomin', String(m.pomin));
          // po: tylko to, co zmieniło się po akcie o tym numerze; gość, który dostał "changed", nie musi czytać wszystkiego
          if (Number.isInteger(m.po) && m.po >= 0) p.set('po', String(m.po));
          if (m.odlozone === 'razem' || m.odlozone === 'tak') p.set('odlozone', m.odlozone);
          const d = await czytajOknem(o, '/api/srodowisko/spis?' + p);
          dane = { rzeczy: d.rzeczy, razem: d.razem, pokazane: d.pokazane, pominiete: d.pominiete, wszystko: d.wszystko, akt: d.akt };
        } else if (m.what === 'rzecz') {
          const d = await czytajOknem(o, '/api/srodowisko/rzecz?id=' + encodeURIComponent(String(m.rzecz || '')));
          dane = { rzecz: d.rzecz, historia: d.historia, wskazuja: d.wskazuja };
        } else if (m.what === 'ksztalty') {
          dane = { ksztalty: (await czytajOknem(o, '/api/srodowisko/ksztalty')).ksztalty };
        } else if (m.what === 'ja') {
          dane = { uczestnik: opis ? opis.czytasz_jako : null, gosc: o.gosc ? { rzecz: o.gosc.id, nazwa: o.gosc.nazwa, umowa: o.gosc.umowa || null, imie: 'gosc-' + o.gosc.id } : null, pisze: !!(klucz && o.gosc && o.gosc.umowa === 'okno/3') };
        } else if (m.what === 'ustawienia') {
          // Narzędzie czyta pokrętła po nazwie, także własne: liczy gospodarz, tymi samymi drzwiami co twarz.
          const nazwy = Array.isArray(m.nazwy) ? m.nazwy.filter((n) => typeof n === 'string' && /^[a-z0-9_.]{3,250}$/.test(n)).slice(0, 200) : [];
          // okno B czyta przez profil B jako nakładkę: najpierw jego wartości, potem to, co czyta A
          const d = await czytajOknem(o, '/api/srodowisko/ustawienia?nazwy=' + nazwy.join(',') + (typeof m.dla === 'string' && /^[0-9a-z]{26}$/.test(m.dla) ? '&dla=' + m.dla : '') + (o.nakladka ? '&nakladki=' + o.nakladka : ''));
          dane = { wartosci: d.wartosci, akt: d.akt, format: d.format };
          for (const n of nazwy) if (o.czyta.size < 64) o.czyta.add(n);
          if (typeof m.dla === 'string' && /^[0-9a-z]{26}$/.test(m.dla)) o.dla = m.dla;
          if (o.czyta.size) o.guzikSuwakow.hidden = false;
        } else throw new Error('nie znam takiego czytania: ' + String(m.what) + '; znane: spis, rzecz, ksztalty, ja, ustawienia');
        odp({ type: 'result', id: m.id, ok: true, data: dane });
      } catch (blad) { odp({ type: 'result', id: m.id, ok: false, error: String(blad && blad.message || blad).slice(0, 300) }); }
    }
    else if (m.type === 'move') {
      // Ruch z okna (umowa okna, pokolenie 3): narzędzie pisze pod własnym imieniem, nie imieniem tego, kto je otworzył.
      // Strona dokłada tylko to, czego gość sam wiedzieć nie może: klucz otwierającego i identyfikator gościa.
      const zle = (tekst) => odp({ type: 'result', id: m.id, ok: false, error: tekst });
      const r = m.move;
      if (!o.gosc || o.gosc.umowa !== 'okno/3') return zle('to okno mówi umową, która nie zna ruchów; gość pisze, gdy jest zgłoszony z "umowa":"okno/3"');
      if (!klucz) return zle('okno pisze dopiero wtedy, gdy ten, kto je otworzył, wszedł (guzik "Wejdź" na górze strony)');
      if (!r || typeof r !== 'object' || !['poloz', 'odloz', 'przywroc', 'cofnij'].includes(r.co)) return zle('move: {co: "poloz"|"odloz"|"przywroc"|"cofnij", …}; propozycji nie rozstrzyga się z okna');
      const cialo = { op: typeof m.op === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(m.op) ? m.op : nowyOp(), co: r.co };
      for (const pole of ['rodzaj', 'cechy', 'rzecz', 'wersja', 'obszar', 'powod', 'do']) if (pole in r) cialo[pole] = r[pole];
      try {
        const odpowiedz = await fetch('/api/srodowisko/ruch', { method: 'POST', headers: naglowki({ 'content-type': 'application/json', 'x-cialo': 'okno goscia', 'x-gosc': o.gosc.id }), body: JSON.stringify(cialo) });
        const d = await odpowiedz.json().catch(() => null);
        if (!odpowiedz.ok || !d || d.ok === false) return zle((d && d.blad) || 'drzwi odpowiedziały: ' + odpowiedz.status);
        if (d.skutek === 'propozycja') o.propozycje++; else o.zapisy++;
        o.slad.textContent = [o.zapisy ? 'zapisało: ' + o.zapisy : null, o.propozycje ? 'zaproponowało: ' + o.propozycje : null].filter(Boolean).join(' · ');
        o.slad.title = 'Tyle razy to narzędzie pisało w tym oknie. Każdy jego ruch stoi w historii pod jego imieniem.';
        odp({ type: 'result', id: m.id, ok: true, data: { skutek: d.skutek, rzecz: d.rzecz || null, propozycja: d.propozycja || null, wersja: d.wersja ?? null, numer: d.numer ?? null, powod: d.powod || null, powtorzone: !!d.powtorzone } });
        if (d.skutek === 'propozycja') komunikat(`Narzędzie "${o.nazwa}" zaproponowało zmianę (${d.powod || 'czeka na rozstrzygnięcie'}). Znajdziesz ją w "Czeka na właściciela".`);
        dogon().catch(() => {});
      } catch (err) { zle('nie udało się połączyć: ' + String(err && err.message || err).slice(0, 200)); }
    }
    else if (m.type === 'signals') przyjmijSygnaly(o, m.values);
    else if (m.type === 'event') przyjmijZdarzenie(o, m.text, m.level);
    else if (m.type === 'flag') przyjmijZdarzenie(o, m.text || m.label || 'znacznik', 'flag');
    // wszystko nieznane: pomijamy bez błędu (umowa okna, pokolenia 2 i 3)
  });
  // Mowa świata. Wszystko, co przychodzi z ramki, jest cudzym tekstem: tylko textContent, twarde granice liczby
  // i długości, a rysowanie najwyżej cztery razy na sekundę, żeby szybki świat nie zjadał ręki.
  const NAJWIECEJ_SYGNALOW = 8, PROBEK = 90, ZDARZEN = 8;
  function przyjmijSygnaly(o, wartosci) {
    if (!wartosci || typeof wartosci !== 'object' || Array.isArray(wartosci)) return;
    for (const [k0, w] of Object.entries(wartosci)) {
      const k = String(k0).slice(0, 40);
      if (!o.sygnaly.has(k) && o.sygnaly.size >= NAJWIECEJ_SYGNALOW) continue;
      const s = o.sygnaly.get(k) || { probki: [], tekst: null };
      if (typeof w === 'number' && Number.isFinite(w)) { s.probki.push(w); if (s.probki.length > PROBEK) s.probki.shift(); s.tekst = null; }
      else if (typeof w === 'string' || typeof w === 'boolean') s.tekst = String(w).slice(0, 40);
      else continue;
      o.sygnaly.set(k, s);
    }
    zaplanujMowe(o);
  }
  function przyjmijZdarzenie(o, tekst, poziom) {
    if (typeof tekst !== 'string' || !tekst.trim()) return;
    // Umowa okna mówi info, uwaga, blad (tak mówi JV); przyrząd starej Jaskini mówił warn i error. Oba znaczą to samo.
    const p = { info: 'info', uwaga: 'warn', warn: 'warn', blad: 'error', error: 'error', flag: 'flag' }[poziom] || 'info';
    o.zdarzenia.unshift({ tekst: tekst.trim().slice(0, 160), poziom: p, kiedy: new Date() });
    o.zdarzenia.length = Math.min(o.zdarzenia.length, ZDARZEN);
    zaplanujMowe(o);
  }
  function zaplanujMowe(o) {
    if (o.rysujMowe) return;
    o.rysujMowe = setTimeout(() => { o.rysujMowe = 0; rysujMowe(o); }, 250);
  }
  const liczbaPL = (x) => x.toLocaleString('pl-PL', { maximumFractionDigits: Math.abs(x) >= 100 ? 0 : 2 });
  function wykres(probki) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 64 16'); svg.setAttribute('aria-hidden', 'true');
    if (probki.length < 2) return svg;
    const mn = Math.min(...probki), mx = Math.max(...probki), r = mx - mn;
    const pkt = probki.map((v, i) => `${(i / (probki.length - 1) * 64).toFixed(1)},${(r ? 15 - (v - mn) / r * 14 : 8).toFixed(1)}`).join(' ');
    const l = document.createElementNS(NS, 'polyline'); l.setAttribute('points', pkt);
    svg.append(l);
    return svg;
  }
  function rysujMowe(o) {
    if (!o.mowa.isConnected) return;
    const syg = [...o.sygnaly].map(([k, s]) => el('span', { klasa: 'syg', title: s.probki.length ? `${k}: ostatnie ${s.probki.length} próbek` : k },
      el('span', { klasa: 'syg-nazwa', tekst: k }),
      el('span', { klasa: 'syg-wartosc', tekst: s.tekst !== null ? s.tekst : (s.probki.length ? liczbaPL(s.probki[s.probki.length - 1]) : '–') }),
      s.tekst === null && s.probki.length > 1 ? wykres(s.probki) : null));
    const z = o.zdarzenia[0];
    const zd = z ? el('span', { klasa: 'zdarzenie ' + z.poziom, title: o.zdarzenia.map((x) => `${x.kiedy.toLocaleTimeString('pl-PL')} ${x.tekst}`).join('\n'),
      tekst: (z.poziom === 'flag' ? '⚑ ' : '') + z.tekst }) : null;
    o.mowa.replaceChildren(...syg, zd || '');
    o.mowa.hidden = !syg.length && !zd;
  }
  // Suwaki świata: pokrętła, które świat sam czyta (read ustawienia), w zasięgu, z którym je czyta (dla: zwykle jego
  // własna rzecz gościa), więc strojenie dotyczy tylko tego świata. Pole to samo co w panelu ustawień (suwak i liczba:
  // zakres suwaka nie jest granicą, reguła właściciela z JV, 9 VII), zapis przy puszczeniu. Świat słyszy "changed"
  // (dogon po zapisie mówi to gościom, którzy chcą rzeczy) i sam czyta nowe wartości.
  function przelaczSuwaki(id) {
    const o = okna.get(id);
    if (!o) return;
    o.suwaki.hidden = !o.suwaki.hidden;
    o.guzikSuwakow.classList.toggle('widoczne', !o.suwaki.hidden);
    o.guzikSuwakow.setAttribute('aria-pressed', String(!o.suwaki.hidden));
    if (!o.suwaki.hidden) rysujSuwaki(o);
  }
  // Ustawienia w Miejscu zmieniły się gdzie indziej (inna karta, agent, zestaw): otwarte suwaki czytają od nowa.
  const odswiezSuwaki = () => { for (const o of okna.values()) if (!o.suwaki.hidden) rysujSuwaki(o, { tlo: true }); };
  // Ręka pisze w polu panelu (liczba, nazwa presetu, wybór): odświeżenie z tła czeka, aż wyjdzie z pola, żeby nie
  // zgubić tego, co wpisuje (ślepa ręka i próby 21 XI: panel przerysowany w trakcie pisania gubił wpisane znaki).
  const pisze = (o) => { const a = document.activeElement; return !!a && o.suwaki.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.type !== 'range'; };
  // Puszczenie suwaka gdziekolwiek (także poza ramką panelu): to, co przyszło w trakcie, rysuje się teraz.
  const puscSuwaki = () => { for (const o of okna.values()) if (o.trzymaSuwak) { o.trzymaSuwak = false; if (o.suwakiZalegle) { o.suwakiZalegle = false; rysujSuwaki(o); } } };
  addEventListener('pointerup', puscSuwaki);
  addEventListener('pointercancel', puscSuwaki);
  async function rysujSuwaki(o, { tlo = false } = {}) {
    const nazwy = [...o.czyta];
    if (!nazwy.length || o.suwaki.hidden) return;
    // ręka trzyma suwak: nie podmieniamy go pod palcem, tylko rysujemy po puszczeniu
    if (o.trzymaSuwak || (tlo && pisze(o))) { o.suwakiZalegle = true; return; }
    const nr = ++o.suwakiNr;
    let u;
    // razem z pokrętłami świata: lista zestawów włączonych w jego zasięgu (który preset jest jego)
    try { u = await czytaj('/api/srodowisko/ustawienia?deklaracje=tak&nazwy=' + [...nazwy, ZESTAWY].join(',') + (o.dla ? '&dla=' + o.dla : '') + (o.nakladka ? '&nakladki=' + o.nakladka : '')); }
    catch (blad) { if (nr === o.suwakiNr) o.suwaki.replaceChildren(el('p', { klasa: 'bok', tekst: 'Nie udało się przeczytać pokręteł: ' + blad.message })); return; }
    if (nr !== o.suwakiNr || o.suwaki.hidden) return;
    if (o.trzymaSuwak || (tlo && pisze(o))) { o.suwakiZalegle = true; return; }
    // okno B stroi swój profil (nakładkę), okno A i każde inne: rzecz, dla której świat czyta
    const zasieg = o.nakladka || o.dla;
    // Skąd jest wartość, słowami ręki: pierwsze ogniwo łańcucha to zasięg, w którym świat czyta (rzecz gościa albo,
    // gdy świat zacznie czytać dla okna, okno), ostatnie to obszar główny, czyli całe Miejsce.
    const ogniwa = u.lancuch || [];
    const ogniwo = new Map(ogniwa.map((z, i) => [z.id, { ...z, ostatnie: i === ogniwa.length - 1 }]));
    const dlaCzego = (z) => (z && z.rodzaj === 'okno/1' ? 'tego okna' : z && z.rodzaj === 'gosc/1' ? 'tego świata' : z && z.rodzaj === 'profil/1' && o.rola === 'B' ? 'okna B' : '„' + ((z && z.nazwa) || 'tej rzeczy') + '”');
    const tu = dlaCzego(ogniwo.get(zasieg));
    // w oknie B wartość ustawiona dla świata to po prostu to, co ma okno A
    const skadWyzej = (id) => { const z = ogniwo.get(id); return !z ? 'odziedziczone' : o.rola === 'B' && z.rodzaj === 'gosc/1' ? 'jak w oknie A' : z.ostatnie ? 'wspólne dla całego Miejsca' : z.rodzaj === 'obszar/1' ? 'z obszaru „' + z.nazwa + '”' : 'z „' + z.nazwa + '”'; };
    // Pokrętło nie ma w kształcie osobnej etykiety: deklarujący pisze ludzką nazwę na początku opisu przed dwukropkiem
    // (tak deklaruje JV: „Moment napędu: …”); bez niej ręka widzi ostatni człon nazwy.
    const etykieta = (d) => { const m = /^([^:.]{2,40}):\s+(.+)$/s.exec(d.opis || ''); return m ? { nazwa: m[1], opis: m[2] } : { nazwa: d.nazwa.split('.').pop().replace(/_/g, ' '), opis: d.opis || '' }; };
    // kolejność świata: tak, jak sam pyta o swoje pokrętła (grupy w kolejności pierwszego pokrętła), nie alfabet
    const kolejnosc = new Map(nazwy.map((x, i) => [x, i]));
    const grupy = new Map();
    for (const d of [...(u.deklaracje || [])].filter((d) => o.czyta.has(d.nazwa)).sort((a, b) => (kolejnosc.get(a.nazwa) ?? 1e9) - (kolejnosc.get(b.nazwa) ?? 1e9))) { const g = d.grupa || 'Inne'; if (!grupy.has(g)) grupy.set(g, []); grupy.get(g).push(d); }
    // Preset świata (jego droga z 18 XI: bierze domyślny, kopiuje, nazywa, psuje, zapisuje punkt, wraca): zestaw włączony
    // wprost w zasięgu świata; ostatni na liście wygrywa. Gdy jest, suwaki piszą w niego, a nie w wartość świata.
    const zs = (u.wartosci || {})[ZESTAWY];
    const wlasnaLista = zs && zs.skad === 'wartosc' && zs.zasieg === zasieg && Array.isArray(zs.wartosc) ? zs.wartosc : [];
    const aktywnyId = wlasnaLista.length ? wlasnaLista[wlasnaLista.length - 1] : null;
    const aktywny = aktywnyId ? rzeczy.find((r) => r.id === aktywnyId && r.rodzaj === 'zestaw/1') || null : null;
    // Cudzy preset (utworzył go ktoś inny niż czytający, np. „JV Web: domyślny” prowadzony przez agentów) nie zmienia się
    // z panelu. Jego droga z 18 XI: „wziąść default przygotowany i zarzadzany przez was, skopiować, nazwać swoim”; druga
    // linia Opusa Code na 85. Pierwsza zmiana robi więc kopię czytającego, włącza ją i zmienia kopię, jednym gestem, który
    // „cofnij” cofa w całości. Działa w obie strony: agent w panelu nie zmieni presetu właściciela.
    const ja = mojeImie();
    const cudzy = !!aktywny && !!ja && typeof aktywny.utworzyl === 'string' && aktywny.utworzyl !== ja;
    // Zmiana włączonego presetu: we własnym zapis w miejscu (z `dalej`: jednym gestem), w cudzym kopia z punktem
    // „początek” (stan sprzed zmiany) i ta sama zmiana w kopii.
    const zmienPreset = async (zmiana, { zdanie, co }, dalej = []) => {
      const p = rzeczy.find((r) => r.id === aktywny.id) || aktywny;
      if (!cudzy) {
        const zapis = { co: 'poloz', rzecz: p.id, wersja: p.wersja, rodzaj: 'zestaw/1', cechy: zmiana(p.cechy) };
        return dalej.length ? ruchyGestem([zapis, ...dalej], zdanie(p.cechy.nazwa), o, co) : ruch(zapis, zdanie(p.cechy.nazwa));
      }
      const pole = o.suwaki.querySelector('input[aria-label="Nazwa presetu"]');
      const wpisana = pole ? pole.value.trim() : '';
      const n = wpisana || p.cechy.nazwa + ' (moja, ' + godzinaTeraz() + ')';
      const r = await ruchyGestem([
        { co: 'kopiuj', rzecz: p.id, nazwa: n },
        (w) => wlaczZestaw(zasieg, w[0].rzecz),
        poczatekPresetu(n),
        async (w) => { const k = (await czytaj('/api/srodowisko/rzecz?id=' + w[0].rzecz)).rzecz; return { co: 'poloz', rzecz: k.id, wersja: k.wersja, rodzaj: 'zestaw/1', cechy: zmiana(k.cechy) }; },
        ...dalej,
      ], 'Preset „' + p.cechy.nazwa + '” prowadzi ' + p.utworzyl + ', więc się nie zmienia. Zmiana (' + co + ') poszła do Twojej kopii „' + n + '”, włączonej dla „' + o.nazwa + '”.' + (wpisana ? '' : ' Nazwij ją po swojemu: wpisz nazwę obok i „zmień nazwę”.'), o, 'kopia „' + n + '” (' + co + ')');
      if (r && wpisana && pole) pole.value = '';
      return r;
    };
    const wiersz = (d) => {
      const x = (u.wartosci || {})[d.nazwa] || { wartosc: d.domyslna, skad: 'domyslna' };
      const swoja = !!zasieg && x.skad === 'wartosc' && x.zasieg === zasieg;
      const wPresecie = !!aktywny && !!aktywny.cechy.wartosci && Object.hasOwn(aktywny.cechy.wartosci, d.nazwa);
      const skad = (swoja ? 'ustawione dla ' + tu + (wPresecie ? ' (ważniejsze niż preset)' : '')
        : x.skad === 'wartosc' ? skadWyzej(x.zasieg)
          : x.skad === 'zestaw' ? 'z presetu „' + x.zestaw + '”' : x.skad === 'brak' ? 'brak wartości' : 'domyślne')
        // ile wynosi domyślna, żeby „wróć do domyślnego” nie było skokiem w nieznane (ślepa ręka, 21 XI: C6)
        + (x.skad === 'domyslna' ? '' : ' · domyślnie ' + pokazWartosc(d.domyslna, d.jednostka));
      const e = etykieta(d);
      // Z aktywnym presetem suwak pisze w preset (nowa wersja zestawu z tą jedną zmianą), chyba że świat ma tu własną
      // wartość: ta jest ważniejsza niż preset, więc pisanie w preset nic by nie zmieniło.
      const doPresetu = aktywny && !swoja ? (w) => zmienPreset((c) => ({ ...c, wartosci: { ...c.wartosci, [d.nazwa]: w } }), { zdanie: (n) => 'Zmienione w presecie „' + n + '”: ' + d.nazwa + '.', co: d.nazwa }) : null;
      // ten sam zapis co suwak (w preset albo w wartość świata), dla powrotu do wartości z historii
      const ustawTo = async (w) => { const r = doPresetu ? await doPresetu(w) : await ruch({ co: 'poloz', rodzaj: 'wartosc/1', wersja: 'dowolna', cechy: { pokretlo: d.nazwa, zasieg, wartosc: w } }, 'Ustawione dla „' + o.nazwa + '”: ' + d.nazwa + '.'); if (r) rysujSuwaki(o); return r; };
      const pole = PROSTE.includes(d.typ) && zasieg
        ? poleUstawienia(d, x, { zasieg, zapis: doPresetu, potem: () => rysujSuwaki(o), zdanie: 'Ustawione dla „' + o.nazwa + '”: ' + d.nazwa + '.' })
        : el('span', { klasa: 'bok', tekst: zasieg ? 'typ ' + d.typ + ': zmiana ruchem, opis pod /ustawienia' : String(x.wartosc) });
      const wyjmij = wPresecie && klucz && !swoja ? el('button', { tekst: 'wyjmij z presetu', title: cudzy ? 'Ten preset prowadzi ' + aktywny.utworzyl + ': powstanie Twoja kopia bez tego pokrętła' : 'Preset przestaje ustawiać to pokrętło: wraca wartość spoza presetu', klik: async () => {
        const bezTego = (c) => {
          const reszta = { ...c.wartosci };
          delete reszta[d.nazwa];
          return { ...c, wartosci: reszta };
        };
        const r = await zmienPreset(bezTego, { zdanie: (n) => 'Wyjęte z presetu „' + n + '”: ' + d.nazwa + '.', co: 'bez ' + d.nazwa });
        if (r) rysujSuwaki(o);
      } }) : null;
      return el('li', { klasa: 'suwak', title: d.nazwa + (d.opis ? '\n' + d.opis : '') },
        el('span', { klasa: 'nazwa', tekst: e.nazwa }),
        e.opis ? el('span', { klasa: 'opis', tekst: e.opis, tabindex: '0', title: 'Dotknij, żeby zobaczyć cały opis', klik: (ev) => ev.currentTarget.classList.toggle('caly') }) : null,
        el('span', { klasa: 'skad' + (swoja ? ' swoja' : ''), tekst: skad + (x.z ? ', idzie za ' + x.z : '') }),
        pole,
        el('span', { klasa: 'czynnosci' },
          swoja && klucz ? el('button', { tekst: o.rola === 'B' ? 'wróć do A' : 'wróć do domyślnego', title: o.rola === 'B' ? 'Odłóż wartość okna B: wraca ta, którą ma okno A' : 'Odłóż wartość ustawioną dla ' + tu + ': wraca wspólna albo domyślna', klik: async () => {
            const r = await ruch({ co: 'odloz', rzecz: x.rzecz, wersja: 'dowolna', powod: 'powrót do wartości odziedziczonej' }, 'Wróciło dla „' + o.nazwa + '”: ' + d.nazwa + '.');
            if (r) rysujSuwaki(o);
          } }) : null,
          wyjmij,
          x.rzecz ? el('button', { klasa: 'historia', tekst: 'historia', 'aria-expanded': 'false', title: 'Ostatnie wartości: ile, kto i kiedy; do każdej da się wrócić', klik: (ev) => przelaczHistorie(ev.currentTarget, x.rzecz, d, zasieg && klucz && PROSTE.includes(d.typ) ? ustawTo : null) }) : null),
        el('div', { klasa: 'historia-lista', hidden: true }));
    };
    const presety = zasieg ? sekcjaPresetu(o, { zasieg, tu, zs, wlasnaLista, aktywny, cudzy, zmienPreset, wartosci: u.wartosci || {}, deklaracje: (u.deklaracje || []).filter((d) => o.czyta.has(d.nazwa)) }) : null;
    const fokus = o.suwaki.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
    // replaceChildren zamienia null na napis "null": puste miejsca odsiewamy jak el()
    o.suwaki.replaceChildren(...[
      el('p', { klasa: 'bok', tekst: !zasieg ? 'Ten świat czyta pokrętła dla całego Miejsca: stroisz je w panelu ustawień, tu tylko je widać.' : !klucz ? 'Żeby stroić, wejdź (guzik „Wejdź” na górze).' : 'Strojenie tylko dla ' + tu + '. Zapis przy puszczeniu suwaka albo po wpisaniu liczby; liczba może wyjść poza suwak.' }),
      presety,
      ...[...grupy].map(([g, lista]) => {
        const det = el('details', { klasa: 'grupa', open: o.zwiniete.has(g) ? null : true },
          el('summary', {}, el('span', { klasa: 'g', tekst: g }), ' ', el('span', { klasa: 'ile', tekst: String(lista.length) })),
          el('ul', {}, lista.map(wiersz)));
        det.addEventListener('toggle', () => { if (det.open) o.zwiniete.delete(g); else o.zwiniete.add(g); });
        return det;
      }),
      (u.deklaracje || []).length ? null : el('p', { klasa: 'bok', tekst: 'Świat czyta pokrętła, których Miejsce nie zna: ' + nazwy.join(', ') + '.' })].filter(Boolean));
    if (fokus) { const e = [...o.suwaki.querySelectorAll('[aria-label]')].find((x) => x.getAttribute('aria-label') === fokus); if (e) e.focus(); }
  }
  // Sekcja presetu w panelu świata. Wszystko na ruchach, które grunt już ma: zestaw/1 (preset), srodowisko.zestawy
  // w zasięgu świata (który jest włączony), kopiuj (z pochodzeniem), punkt/1 i wroc-do-punktu, domyslny (wróć do źródła).
  // Czynność z kilku ruchów idzie jednym gestem, a guzik „cofnij” w sekcji presetu cofa ją całą (co: cofnij-gest).
  const ZESTAWY = 'srodowisko.zestawy';
  const POCZATEK = 'początek presetu';
  // włączenie presetu w zasięgu świata, punkt „początek” nowego presetu i godzina do nazw: wspólne dla sekcji presetu
  // i dla kopii cudzego presetu przy pierwszej zmianie
  const wlaczZestaw = (zasieg, id) => ({ co: 'poloz', rodzaj: 'wartosc/1', wersja: 'dowolna', cechy: { pokretlo: ZESTAWY, zasieg, wartosc: [id] } });
  const wersjaRzeczy = async (id) => (await czytaj('/api/srodowisko/rzecz?id=' + id)).rzecz.wersja;
  const poczatekPresetu = (n) => async (w) => ({ co: 'poloz', rodzaj: 'punkt/1', cechy: { nazwa: n + ': początek', opis: POCZATEK, czego: w[0].rzecz, wersja: w[0].wersja ?? await wersjaRzeczy(w[0].rzecz) } });
  const godzinaTeraz = () => new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const pokazWartosc = (w, jednostka) => (typeof w === 'number' ? liczbaPL(w) : String(w)) + (jednostka ? ' ' + jednostka : '');
  // Kilka ruchów jako jeden gest ręki (cofają się razem: co: cofnij-gest). Idą po kolei tymi samymi drzwiami; element
  // listy może być funkcją wyników poprzednich (np. identyfikator nowego presetu). Pierwsza odmowa zatrzymuje resztę.
  async function ruchyGestem(lista, dobrze, o = null, opisCzynnosci = '') {
    if (!klucz) { komunikat('Żeby coś zmienić, najpierw wejdź: guzik "Wejdź" na górze strony.', true); return null; }
    const gest = 'reka-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const wyniki = [];
    for (const krok of lista) {
      const cialo = typeof krok === 'function' ? await krok(wyniki) : krok;
      if (!cialo) continue;
      let d = null;
      try {
        const o = await fetch('/api/srodowisko/ruch', { method: 'POST', headers: naglowki({ 'content-type': 'application/json', 'x-cialo': 'strona gospodarza' }), body: JSON.stringify({ op: nowyOp(), gest, ...cialo }) });
        d = await o.json().catch(() => null);
        if (!o.ok || !d || d.ok === false) { komunikat(((d && d.blad) || 'Drzwi odpowiedziały: ' + o.status) + (wyniki.length ? ' (to, co zdążyło się zapisać, cofa guzik „cofnij” w sekcji presetu)' : ''), true); d = null; }
      } catch (blad) { komunikat('Nie udało się połączyć: ' + blad.message, true); }
      if (!d) { if (o && wyniki.length) o.ostatniGest = { gest, opis: (opisCzynnosci || dobrze) + ' (przerwane)' }; try { await dogon(); } catch { /* strona dogoni przy następnej zmianie */ } return null; }
      wyniki.push(d);
    }
    // ostatnia czynność z wielu ruchów w tym oknie da się cofnąć w całości guzikiem w sekcji presetu
    if (o) o.ostatniGest = { gest, opis: opisCzynnosci || dobrze };
    try { await dogon(); if (kr.id) await odswiezKarte(); } catch { /* jak wyżej */ }
    komunikat(dobrze);
    return wyniki;
  }
  // Historia jednej wartości w miejscu: ostatnie pięć wersji, ile, kto i kiedy (zamiast gołej strony rzeczy).
  // godzina zamiast „przed chwilą”: przy kilku wpisach z jednej minuty względny czas nic nie mówi (ślepa ręka 2, C6)
  const zegar = (iso) => { const t = new Date(iso); if (!Number.isFinite(t.getTime())) return ''; const dzis = new Date().toDateString() === t.toDateString(); return (dzis ? '' : t.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) + ' ') + t.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
  async function przelaczHistorie(guzik, rzeczId, d, ustawTo = null) {
    const lista = guzik.closest('li.suwak').querySelector('.historia-lista');
    if (!lista.hidden) { lista.hidden = true; guzik.setAttribute('aria-expanded', 'false'); return; }
    lista.hidden = false; guzik.setAttribute('aria-expanded', 'true');
    lista.replaceChildren(el('p', { klasa: 'bok', tekst: 'czytam…' }));
    try {
      const r = await czytaj('/api/srodowisko/rzecz?id=' + rzeczId);
      // Wersja presetu zmienia się też wtedy, gdy rusza się inne pokrętło albo nazwa: pokazujemy tylko te wersje, w których
      // zmieniło się TO pokrętło (przeglądamy najwyżej 12 ostatnich wersji, żeby jedno dotknięcie nie było drogie).
      const ost = (r.historia || []).slice(-12);
      const wart = await Promise.all(ost.map(async (h) => {
        try { const v = await czytaj('/api/srodowisko/wersja?id=' + rzeczId + '&akt=' + h.akt); const c = v.wersja && v.wersja.cechy; return c ? (c.wartosci && typeof c.wartosci === 'object' ? c.wartosci[d.nazwa] : c.wartosc) : undefined; } catch { return undefined; }
      }));
      const zmiany = [];
      for (let i = ost.length - 1; i >= 0 && zmiany.length < 5; i--) if (i === 0 || JSON.stringify(wart[i]) !== JSON.stringify(wart[i - 1])) zmiany.push({ h: ost[i], w: wart[i] });
      const wiersze = zmiany.map(({ h, w }, i) => el('li', {},
        el('span', { klasa: 'w', tekst: w === undefined ? (r.rzecz.rodzaj === 'zestaw/1' ? 'bez tego pokrętła' : '—') : pokazWartosc(w, d.jednostka) }),
        el('span', { klasa: 'kto', tekst: h.kto + ' · ' + zegar(h.kiedy) }),
        // do każdej wcześniejszej wartości wraca się jednym dotknięciem (tym samym zapisem co suwak)
        i > 0 && ustawTo && w !== undefined ? el('button', { klasa: 'ustaw', tekst: 'wróć do tej', title: 'Ustaw znowu ' + pokazWartosc(w, d.jednostka), klik: () => ustawTo(w) }) : null));
      lista.replaceChildren(el('ul', {}, wiersze), el('a', { href: '/rzecz/' + rzeczId, target: '_blank', rel: 'noopener', tekst: 'cała historia (strona dla agentów)' }));
    } catch (blad) { lista.replaceChildren(el('p', { klasa: 'bok', tekst: 'Nie udało się przeczytać historii: ' + blad.message })); }
  }
  function sekcjaPresetu(o, { zasieg, tu, zs, wlasnaLista, aktywny, cudzy, zmienPreset, wartosci, deklaracje }) {
    const odswiez = (r) => { if (r) rysujSuwaki(o); return r; };
    const wlacz = (id) => wlaczZestaw(zasieg, id);
    const poczatek = poczatekPresetu;
    // wartości ustawione wprost dla świata: ważniejsze niż preset, więc przy presecie suwak zmieniałby je, a nie preset
    const wlasne = [...o.czyta].filter((k) => { const x = wartosci[k]; return x && x.skad === 'wartosc' && x.zasieg === zasieg && x.rzecz; });
    const odlozWlasne = (powod) => wlasne.map((k) => ({ co: 'odloz', rzecz: wartosci[k].rzecz, wersja: 'dowolna', powod }));
    // zdanie po zmianie presetu mówi, gdy świat i tak tego nie zobaczy (wartość świata ważniejsza), zamiast cicho kłamać
    // zielonym komunikatem (ślepa ręka 2, pkt 2: „wróć do początku” bez zmiany w świecie)
    const ostrzezenie = (klucze) => { const n = wlasne.filter((k) => klucze.includes(k)).length; return n ? ' Uwaga: ' + lp(n, 'pokrętło ma', 'pokrętła mają', 'pokręteł ma') + ' wartość ustawioną dla ' + tu + ', ważniejszą niż preset (ramka pod wyborem).' : ''; };
    const kluczePresetu = (p) => (p && p.cechy && p.cechy.wartosci && typeof p.cechy.wartosci === 'object' ? Object.keys(p.cechy.wartosci) : []);
    // presety tego świata: zestawy, które ustawiają choć jedno z jego pokręteł
    const swoje = rzeczy.filter((r) => r.rodzaj === 'zestaw/1' && r.cechy && r.cechy.wartosci && typeof r.cechy.wartosci === 'object' && Object.keys(r.cechy.wartosci).some((n) => o.czyta.has(n)))
      .sort((a, b) => String(a.cechy.nazwa).localeCompare(String(b.cechy.nazwa), 'pl'));
    const wybor = el('select', { 'aria-label': 'Preset dla ' + tu, disabled: klucz ? null : true },
      // domyślne pokrętła to też układ, który się bierze i kopiuje (jego słowa z 18 XI), więc ma tu swoje imię
      el('option', { value: '', tekst: 'domyślne (bez presetu)' }),
      swoje.map((r) => el('option', { value: r.id, tekst: r.cechy.nazwa, selected: aktywny && r.id === aktywny.id ? true : null })));
    wybor.addEventListener('change', async () => {
      const id = wybor.value;
      if (!id) { if (zs && zs.rzecz && wlasnaLista.length) odswiez(await ruch({ co: 'odloz', rzecz: zs.rzecz, wersja: 'dowolna', powod: 'bez presetu' }, 'Bez presetu dla „' + o.nazwa + '”.')); return; }
      const wybrany = swoje.find((r) => r.id === id) || { cechy: { nazwa: id } };
      odswiez(await ruch(wlacz(id), 'Preset „' + wybrany.cechy.nazwa + '” dla „' + o.nazwa + '”.' + ostrzezenie(kluczePresetu(wybrany))));
    });
    const nazwa = el('input', { type: 'text', maxlength: '60', placeholder: aktywny ? 'nazwa: kopii, punktu albo nowa' : 'nazwa nowego presetu', 'aria-label': 'Nazwa presetu', disabled: klucz ? null : true });
    const wezNazwe = () => { const n = nazwa.value.trim(); if (!n) { komunikat('Najpierw nazwa presetu.', true); nazwa.focus(); } return n; };
    // Nowy preset z tego, co świat ma teraz, razem z wartościami ustawionymi wprost dla świata: te wchodzą do presetu
    // i są odkładane, bo inaczej byłyby ważniejsze niż preset i suwak zmieniałby je zamiast presetu (ślepa ręka, 21 XI).
    const nowy = el('button', { tekst: 'nowy z obecnych', title: 'Nowy preset z wartości, które świat ma teraz; od razu włączony, z punktem „początek”', klik: async () => {
      const n = wezNazwe(); if (!n) return;
      const teraz = {};
      for (const k of o.czyta) { const x = wartosci[k]; if (x && x.wartosc !== undefined && x.wartosc !== null && x.skad !== 'brak') teraz[k] = x.wartosc; }
      odswiez(await ruchyGestem([
        { co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa: n, po_co: 'preset', opis: 'Preset świata „' + o.nazwa + '”.', wartosci: teraz } },
        (w) => wlacz(w[0].rzecz), poczatek(n), ...odlozWlasne('wartość weszła do presetu „' + n + '”'),
      ], 'Nowy preset „' + n + '”, włączony dla „' + o.nazwa + '”.', o, 'nowy preset „' + n + '”'));
    } });
    // „weź default, skopiuj, nazwij swoim” (18 XI): preset z wartości domyślnych pokręteł świata, bez tego, co ktoś zmienił
    const kopiujDomyslne = !aktywny ? el('button', { tekst: 'kopiuj domyślne', title: 'Nowy preset z wartości domyślnych pokręteł tego świata; od razu włączony, z punktem „początek”', klik: async () => {
      const n = wezNazwe(); if (!n) return;
      const dom = Object.fromEntries((deklaracje || []).filter((d) => d.domyslna !== undefined && d.domyslna !== null).map((d) => [d.nazwa, d.domyslna]));
      odswiez(await ruchyGestem([
        { co: 'poloz', rodzaj: 'zestaw/1', cechy: { nazwa: n, po_co: 'preset', opis: 'Preset świata „' + o.nazwa + '” z wartości domyślnych.', wartosci: dom } },
        (w) => wlacz(w[0].rzecz), poczatek(n),
      ], 'Nowy preset „' + n + '” z wartości domyślnych, włączony dla „' + o.nazwa + '”.' + ostrzezenie(Object.keys(dom)), o, 'kopia domyślnych jako „' + n + '”'));
    } }) : null;
    const kopiuj = aktywny ? el('button', { tekst: 'kopiuj', title: 'Kopia włączonego presetu pod nową nazwą; pamięta źródło, a „początek” to jej stan z chwili kopiowania', klik: async () => {
      const n = wezNazwe(); if (!n) return;
      odswiez(await ruchyGestem([{ co: 'kopiuj', rzecz: aktywny.id, nazwa: n }, (w) => wlacz(w[0].rzecz), poczatek(n)], 'Skopiowane jako „' + n + '”, włączone dla „' + o.nazwa + '”.', o, 'kopia „' + n + '”'));
    } }) : null;
    const zmienNazwe = aktywny ? el('button', { tekst: 'zmień nazwę', title: 'Nadaj włączonemu presetowi nazwę wpisaną obok', klik: async () => {
      const n = wezNazwe(); if (!n) return;
      const p = rzeczy.find((r) => r.id === aktywny.id) || aktywny;
      odswiez(await ruch({ co: 'poloz', rzecz: p.id, wersja: p.wersja, rodzaj: 'zestaw/1', cechy: { ...p.cechy, nazwa: n } }, 'Preset „' + p.cechy.nazwa + '” nazywa się teraz „' + n + '”.'));
    } }) : null;
    const wszystkiePunkty = aktywny ? rzeczy.filter((r) => r.rodzaj === 'punkt/1' && r.cechy && r.cechy.czego === aktywny.id) : [];
    const start = wszystkiePunkty.filter((r) => r.cechy.opis === POCZATEK).sort((a, b) => String(a.utworzono || '').localeCompare(String(b.utworzono || '')))[0] || null;
    const punkty = wszystkiePunkty.filter((r) => r !== start).sort((a, b) => String(b.utworzono || '').localeCompare(String(a.utworzono || ''))).slice(0, 5);
    const pochodzenie = aktywny ? rzeczy.find((r) => r.rodzaj === 'pochodzenie/1' && r.cechy && r.cechy.kopia === aktywny.id) : null;
    const zrodlo = pochodzenie ? rzeczy.find((r) => r.id === pochodzenie.cechy.z) : null;
    const godzina = godzinaTeraz;
    // „wróć” do punktu, w którym preset już jest, drzwi odrzucają („nie ma czego cofać”): guzik mówi to zawczasu
    const juzTu = (pk) => !!aktywny && aktywny.wersja === pk.cechy.wersja;
    const wrocDo = (pk, tekst) => el('button', { tekst, disabled: juzTu(pk) ? true : null, title: juzTu(pk) ? 'Preset jest teraz dokładnie w tym punkcie' : 'Preset wraca do tego punktu', klik: async () => odswiez(await ruch({ co: 'wroc-do-punktu', punkt: pk.id }, 'Preset wrócił do „' + pk.cechy.nazwa + '”.' + ostrzezenie(kluczePresetu(aktywny)))) });
    // usunięcie: dwa dotknięcia (bez okna dialogowego, tym samym guzikiem co reszta strony); preset włączony gdzie
    // indziej zostaje, a strona mówi, ile takich miejsc jest
    const usun = aktywny && klucz ? dwaDotkniecia('usuń preset', 'Na pewno usunąć?', '„' + aktywny.cechy.nazwa + '”', async () => {
      const gdzieIndziej = rzeczy.filter((r) => r.rodzaj === 'wartosc/1' && r.cechy && r.cechy.pokretlo === ZESTAWY && Array.isArray(r.cechy.wartosc) && r.cechy.wartosc.includes(aktywny.id) && r.cechy.zasieg !== zasieg);
      if (gdzieIndziej.length) { komunikat('Preset „' + aktywny.cechy.nazwa + '” jest włączony jeszcze w ' + gdzieIndziej.length + ' innych miejscach; najpierw wyłącz go tam.', true); return; }
      odswiez(await ruchyGestem([
        zs && zs.rzecz && wlasnaLista.includes(aktywny.id) ? { co: 'odloz', rzecz: zs.rzecz, wersja: 'dowolna', powod: 'preset usunięty' } : null,
        { co: 'odloz', rzecz: aktywny.id, wersja: 'dowolna', powod: 'usunięty z okna świata „' + o.nazwa + '”' },
      ], 'Preset „' + aktywny.cechy.nazwa + '” usunięty; guzik „cofnij” w tej sekcji przywróci go.', o, 'usunięcie presetu „' + aktywny.cechy.nazwa + '”'));
    }) : null;
    return el('section', { klasa: 'presety' },
      el('h3', { tekst: 'Preset dla ' + tu }),
      wybor,
      // ostrzeżenie zaraz pod wyborem, w ramce: na komputerze przeoczone pod niżej (ślepa ręka 2, pkt 6)
      aktywny && wlasne.length && klucz ? el('div', { klasa: 'nad-presetem', role: 'status' },
        el('span', { tekst: (wlasne.length === 1 ? 'Jedno pokrętło ma' : lp(wlasne.length, 'pokrętło ma', 'pokrętła mają', 'pokręteł ma')) + ' wartość ustawioną dla ' + tu + '; suwak zmienia wtedy ją, a nie preset.' }),
        el('button', { tekst: 'przenieś do presetu', title: cudzy ? 'Ten preset prowadzi ' + aktywny.utworzyl + ': wartości wejdą do Twojej kopii, a ustawione dla świata zostaną odłożone' : 'Te wartości wchodzą do presetu, a ustawione dla świata są odkładane', klik: async () => {
          const dodaj = Object.fromEntries(wlasne.map((k) => [k, wartosci[k].wartosc]));
          odswiez(await zmienPreset((c) => ({ ...c, wartosci: { ...c.wartosci, ...dodaj } }), { zdanie: (n) => 'Przeniesione do presetu „' + n + '”.', co: 'przeniesienie do presetu' }, odlozWlasne('wartość weszła do presetu „' + aktywny.cechy.nazwa + '”')));
        } }),
        el('button', { tekst: 'odłóż je', title: 'Wartości ustawione dla świata znikają; działa preset', klik: async () => odswiez(await ruchyGestem(odlozWlasne('niech działa preset'), 'Odłożone; działa preset „' + aktywny.cechy.nazwa + '”.', o, 'odłożenie wartości świata')) })) : null,
      // cudzy preset: zamiast nazwy, punktów, powrotów i usuwania jedno zdanie, co się stanie przy pierwszej zmianie
      cudzy && klucz ? el('p', { klasa: 'bok cudzy', tekst: 'Ten preset prowadzi ' + aktywny.utworzyl + ', więc się nie zmienia. Pierwsza zmiana suwaka zrobi Twoją kopię i ją włączy; nazwa z pola obok albo „' + aktywny.cechy.nazwa + ' (moja, godzina)”.' }) : null,
      el('div', { klasa: 'nowy' }, nazwa, aktywny ? kopiuj : kopiujDomyslne, aktywny ? (cudzy ? null : zmienNazwe) : nowy),
      aktywny && klucz && !cudzy ? el('div', { klasa: 'czynnosci' },
        el('button', { tekst: 'zapisz punkt', title: 'Zapamiętaj ten układ presetu; potem wrócisz do niego jednym ruchem', klik: async () => {
          const p = rzeczy.find((r) => r.id === aktywny.id) || aktywny;
          // nazwa punktu z pola obok, gdy coś w nim jest; inaczej nazwa presetu z godziną (ślepa ręka 2, pkt 3)
          const wlasnaNazwa = nazwa.value.trim();
          const np = wlasnaNazwa || p.cechy.nazwa + ', ' + godzina();
          const r = await ruch({ co: 'poloz', rodzaj: 'punkt/1', cechy: { nazwa: np, czego: p.id, wersja: p.wersja } }, 'Punkt zapisany: „' + np + '”.');
          if (r && wlasnaNazwa) nazwa.value = '';
          odswiez(r);
        } }),
        start ? wrocDo(start, 'wróć do początku') : null,
        pochodzenie ? el('button', { tekst: 'wróć do źródła' + (zrodlo ? ' „' + zrodlo.cechy.nazwa + '”' : ''), title: 'Preset wraca do dzisiejszej treści źródła, z którego go skopiowano; nazwa zostaje, a Twoje wersje zostają w historii', klik: async () => odswiez(await ruch({ co: 'domyslny', rzecz: aktywny.id }, 'Preset „' + aktywny.cechy.nazwa + '” wrócił do źródła.' + ostrzezenie(kluczePresetu(aktywny)))) }) : null,
        usun) : null,
      o.ostatniGest && klucz ? el('div', { klasa: 'cofnij' }, el('button', { tekst: 'cofnij: ' + o.ostatniGest.opis, title: 'Cofa całą ostatnią czynność z tego okna (wszystkie jej ruchy razem)', klik: async () => {
        const g = o.ostatniGest;
        const r = await ruch({ co: 'cofnij-gest', cofany: g.gest }, 'Cofnięte: ' + g.opis + '.');
        if (r) { o.ostatniGest = null; rysujSuwaki(o); }
      } })) : null,
      punkty.length && !cudzy ? el('ul', { klasa: 'punkty' }, punkty.map((pk) => el('li', {},
        el('span', { tekst: pk.cechy.nazwa }),
        klucz ? wrocDo(pk, 'wróć') : null))) : null);
  }

  // --- strona --------------------------------------------------------------------------------------------------
  const lp = (n, a, b, c) => `${n} ${n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c)}`;
  // Most do starej Jaskini (Opus Code, 17 XI 2026). Ta strona jest gospodarzem dla swoich gosci, ale sama
  // bywa gosciem: stara Jaskinia umie otworzyc dowolny adres w oknie i rozmawia ta sama umowa (hello, state,
  // signals, event, flag). Bez tych kilku linii nowe srodowisko otwarte w jej oknie dzialaloby "po cichu":
  // bez nazwy, bez stanu i bez liczb. Dzieki nim jedno miejsce jest prawda od pierwszego dnia, a stara
  // Jaskinia nie wymaga ani jednej zmiany.
  // Znani rodzice. Uwaga Fable, 17 XI: strona w ramce ma mowic stan tylko temu, kogo zna. Pierwsza wersja
  // tego mostu wysylala stan przez postMessage z celem '*', czyli komukolwiek, kto nas osadzi. Dopoki wszystko
  // tu jest publiczne, nic to nie kosztuje; w dniu, w ktorym wejdzie pierwsza prywatna rzecz, byloby to okno
  // na cudza strone. Dlatego: nigdy '*', nigdy pierwsi do nieznajomego, a stan tylko do adresu z tej listy.
  const ZNANI_RODZICE = [
    'https://jozzpoly.github.io',   // stara Jaskinia i laby wlasciciela
    location.origin,                // to samo Miejsce osadzone w sobie (podglad, proby)
  ];
  const znanyRodzic = (adres) => typeof adres === 'string' && ZNANI_RODZICE.includes(adres);
  const gospodarzOnad = window.parent && window.parent !== window ? window.parent : null;
  // Adres rodzica poznajemy dopiero z wiadomosci od niego (origin ramki jest nieczytelny z drugiej strony).
  // Przed pierwsza wiadomoscia mozemy go zgadnac z referrera - i tylko wtedy, gdy jest na liscie, odzywamy sie pierwsi.
  let adresRodzica = null;
  let ostatniStan = null;
  const doGospodarza = (w) => {
    if (!gospodarzOnad || !znanyRodzic(adresRodzica)) return;
    try { gospodarzOnad.postMessage({ jaskinia: 1, ...w }, adresRodzica); } catch { /* okno moglo zniknac */ }
  };
  function przedstawSie() {
    doGospodarza({ type: 'hello', name: 'Jaskinia: srodowisko', version: '1', wants: [] });
    if (ostatniStan) powiedzStan();
  }
  function powiedzStan() {
    if (!ostatniStan) return;
    doGospodarza({ type: 'state', text: ostatniStan.tekst });
    doGospodarza({ type: 'signals', values: { rzeczy: ostatniStan.rzeczy, czeka: ostatniStan.czeka, akt: ostatniStan.akt } });
  }
  if (gospodarzOnad) {
    addEventListener('message', (e) => {
      const m = e.data;
      if (e.source !== gospodarzOnad || !m || m.jaskinia !== 1) return;
      if (!znanyRodzic(e.origin)) return;   // nieznajomy nie uslyszy od nas nic, nawet ze tu jestesmy
      adresRodzica = e.origin;
      if (m.type === 'hi') przedstawSie();
      else if (m.type === 'state?') powiedzStan();
      else if (m.type === 'remark' && typeof m.text === 'string') doGospodarza({ type: 'event', text: 'uwaga wlasciciela trafila do srodowiska: ' + m.text.slice(0, 120), level: 'info' });
    });
    // Odzywamy sie pierwsi tylko do znanego adresu z referrera: umowa nie rozstrzyga, kto zaczyna,
    // a stara Jaskinia potrafi wyslac 'hi', zanim ten skrypt zdazy sie zaladowac.
    try {
      const r = document.referrer ? new URL(document.referrer).origin : null;
      if (znanyRodzic(r)) { adresRodzica = r; przedstawSie(); }
    } catch { /* bez referrera czekamy na jego pierwsze slowo */ }
  }

  // --- wejście: kim jestem na tej stronie -----------------------------------------------------------------------
  function wejdz(nowy) {
    klucz = String(nowy || '').trim();
    if (klucz) localStorage.setItem(KLUCZ, klucz); else localStorage.removeItem(KLUCZ);
    $('wejscie-panel').hidden = true;
    zlyKlucz = null;
    przedstawSieKanalowi();
    return odswiez().then(async () => {
      komunikat(klucz ? 'Jesteś jako ' + (opis.czytasz_jako.imie || '?') + ' (' + opis.czytasz_jako.rola + ').' : 'Wyszedłeś. Czytasz jako zwiedzający.');
      // Właściciel, który właśnie wszedł, a nie ma jeszcze żadnego urządzenia w drzwiach: zostawiamy panel
      // OTWARTY z guzikiem „Dodaj to urządzenie". Inaczej panel znika i trzeba go otworzyć drugi raz, żeby
      // znaleźć krok, o którym nikt jeszcze nie wie, że istnieje - a to jest ten moment, w którym człowiek odpada.
      if (!klucz || !opis || opis.czytasz_jako.rola !== 'wlasciciel' || !window.Drzwi || !window.Drzwi.umieDotkniecie()) return;
      await dajStanDrzwi();
      if (stanDrzwi && stanDrzwi.sekret_sesji_ustawiony && stanDrzwi.poswiadczen === 0) { rysujWejscie(); $('wejscie-panel').hidden = false; }
    }, (blad) => komunikat('Nie udało się wejść: ' + blad.message, true));
  }
  // Stan drzwi (czy w ogóle jest czym wejść) pytamy RAZ, przy pierwszym otwarciu panelu. Guzik, który po
  // naciśnięciu mówi „tu jeszcze nic nie ma", jest gorszy niż brak guzika: to jest narzędzie do zmniejszania
  // tarcia, więc samo nie może go dokładać.
  let stanDrzwi = null;
  async function dajStanDrzwi() {
    if (stanDrzwi || !window.Drzwi) return stanDrzwi;
    try { stanDrzwi = await window.Drzwi.stanDrzwi(); } catch { stanDrzwi = { poswiadczen: 0, nieudane: true }; }
    return stanDrzwi;
  }
  // Od 19 XI obcy nie dostaje liczby urządzeń właściciela (niezależny atak, znalezisko 4), tylko to, czy drzwi są
  // gotowe. Cena jest świadoma: guzik "Wejdź dotknięciem" stoi także tam, gdzie nikt jeszcze nie dodał urządzenia,
  // i wtedy przeglądarka sama powie, że nie ma czym wejść. Właściciel z kluczem dalej dostaje liczbę.
  const mozaDotknac = () => Boolean(window.Drzwi && window.Drzwi.umieDotkniecie() && stanDrzwi && (stanDrzwi.wejscie_dotknieciem === true || stanDrzwi.poswiadczen > 0));

  async function dotknij(co, nazwa) {
    if (!window.Drzwi) return komunikat('Drzwi właściciela nie wczytały się na tej stronie.', true);
    try {
      komunikat(co === 'wejdz' ? 'Poproś urządzenie o potwierdzenie…' : 'Potwierdź na urządzeniu, że to Ty…');
      if (co === 'wejdz') await window.Drzwi.wejdzDotknieciem();
      else await window.Drzwi.dodajUrzadzenie(nazwa, klucz ? { authorization: 'Bearer ' + klucz } : {});
      stanDrzwi = null; // po dodaniu urządzenia stan jest inny; pytamy od nowa przy następnym otwarciu
      $('wejscie-panel').hidden = true;
      await odswiez();
      komunikat(co === 'wejdz' ? 'Jesteś w środku. Wejście zostaje w tej przeglądarce na miesiąc.' : 'To urządzenie otwiera teraz drzwi.');
    } catch (b) {
      // Dosłownie to, co powiedziała przeglądarka albo drzwi: zgadywanie, co się nie udało, byłoby tu najgorszą przysługą.
      komunikat((co === 'wejdz' ? 'Nie udało się wejść dotknięciem: ' : 'Nie udało się dodać urządzenia: ') + (b && b.message ? b.message : String(b)), true);
    }
  }

  const guzikDotkniecia = () => (mozaDotknac() ? el('button', { klasa: 'glowny', tekst: 'Wejdź dotknięciem', title: 'Passkey: urządzenie potwierdza, że to Ty, bez wklejania klucza', klik: () => dotknij('wejdz') }) : null);

  // Dokładanie dzieci, które mogą nie istnieć. Zwykły append(null) wpisuje na stronę słowo "null".
  const dolacz = (gdzie, dzieci) => gdzie.append(...dzieci.filter(Boolean));

  function rysujWejscie() {
    const d = opis, p = $('wejscie-panel'), g = $('wejscie');
    const imie = d.czytasz_jako.imie;
    const w_srodku = Boolean(imie) && (Boolean(klucz) || wpuszczony());
    g.textContent = w_srodku ? imie + ' · wyjdź' : 'Wejdź';
    rysujWidac(w_srodku);
    p.textContent = '';
    if (w_srodku) {
      g.onclick = async () => {
        // Wyjście musi zabrać OBA wejścia: klucz z tej przeglądarki i sesję z drzwi. Zostawienie jednego
        // znaczyłoby, że guzik „wyjdź" kłamie.
        if (window.Drzwi) await window.Drzwi.wyjdzDrzwiami().catch(() => null);
        return wejdz('');
      };
      // Właściciel, który jest w środku, może dołożyć urządzenie: to jedyny moment, w którym wolno to zrobić.
      if (d.czytasz_jako.rola === 'wlasciciel' && window.Drzwi && window.Drzwi.umieDotkniecie()) {
        const pole = el('input', { type: 'text', id: 'pole-urzadzenia', placeholder: 'np. telefon', 'aria-label': 'Nazwa urządzenia' });
        dolacz(p, [el('p', { tekst: 'Dodaj urządzenie, żeby następnym razem wejść jednym dotknięciem. Klucz prywatny zostaje na urządzeniu.' }),
          el('div', { klasa: 'rzad' }, pole, el('button', { tekst: 'Dodaj to urządzenie', klik: () => dotknij('zaloz', pole.value) }))]);
      }
      return;
    }
    g.onclick = async () => {
      const otwieram = p.hidden;
      p.hidden = !p.hidden;
      // Przy pierwszym otwarciu dopytujemy drzwi i rysujemy panel jeszcze raz, już z guzikiem albo bez niego.
      if (otwieram && !stanDrzwi && window.Drzwi) { await dajStanDrzwi(); rysujWejscie(); p.hidden = false; }
    };
    const pole = el('input', { type: 'password', id: 'pole-klucza', placeholder: 'Twój klucz', autocomplete: 'current-password', 'aria-label': 'Klucz uczestnika' });
    // Zdanie nad guzikami mówi to, co widzi czytający, a nie to, co wie autor. Właściciel stanął 17 XI przed tym
    // panelem i zapytał „jaki klucz, jak mam go zdobyć" - bo panel prosił o klucz, a guzik obok wpuszczał bez
    // niego. Ślepa uliczka w narzędziu, które ma zdejmować tarcie, jest gorsza niż brak narzędzia.
    const naPodgladzie = Boolean(d.klucz_probny_wlasciciela);
    const drzwiCzekaja = Boolean(stanDrzwi && stanDrzwi.sekret_sesji_ustawiony && stanDrzwi.poswiadczen === 0);
    const zdanie = naPodgladzie
      ? (drzwiCzekaja
        ? 'Tu nie potrzebujesz żadnego klucza: guzik „Wejdź jako właściciel próbny" wpuszcza jednym naciśnięciem. Drzwi jednym dotknięciem czekają na pierwsze urządzenie — po wejściu ten panel zostanie otwarty na kroku „Dodaj to urządzenie".'
        : 'Tu nie potrzebujesz żadnego klucza: guzik „Wejdź jako właściciel próbny" wpuszcza jednym naciśnięciem. Pole na klucz jest dla agentów bez przeglądarki.')
      : 'Wejście jest potrzebne tylko do zmian. Klucz zostaje w tej przeglądarce.';
    // UWAGA: append(null) wpisuje na stronę gołe słowo "null". Guzik, którego nie ma, musi zniknąć, a nie
    // zostawić po sobie napis - zobaczone okiem na podglądzie 17 XI, dokładnie tam, gdzie właściciel szukał wejścia.
    dolacz(p, [
      el('p', { tekst: zdanie }),
      guzikDotkniecia(),
      d.klucz_probny_wlasciciela ? el('button', { klasa: 'glowny', tekst: 'Wejdź jako właściciel próbny', title: 'Na podglądzie klucze próbne są jawne; nic tu nie jest prywatne', klik: () => wejdz(d.klucz_probny_wlasciciela) }) : null,
      d.klucz_probny ? el('button', { tekst: 'Wejdź jako agent próbny', klik: () => wejdz(d.klucz_probny) }) : null,
      el('div', { klasa: 'rzad' }, pole, el('button', { tekst: 'Wejdź kluczem', klik: () => wejdz(pole.value) })),
    ]);
  }
  // Wpuszczony znaczy: Miejsce zna moje imię z dowodu. Dowodem jest klucz w nagłówku ALBO sesja z drzwi
  // właściciela (ciastko), której ta strona w ogóle nie widzi - dlatego pytamy opisu, a nie schowka.
  const wpuszczony = () => Boolean(opis && opis.czytasz_jako.imie && opis.czytasz_jako.pewnosc === 'klucz');
  const jestemWlascicielem = () => Boolean(opis && opis.czytasz_jako.rola === 'wlasciciel' && (klucz || wpuszczony()));
  const rzeczO = (id) => rzeczy.find((r) => r.id === id) || null;

  // --- to, co ręka właśnie robi, przeżywa przerysowanie ------------------------------------------------------------
  // Strona przerysowuje całą treść przy każdej zmianie w Miejscu (niedługo często). Wpisany tekst, otwarte pola,
  // rozwinięte <details>, fokus i przewinięcie nie mogą przez to znikać. Szkice trzymamy poza elementami.
  const szkice = new Map();          // klucz pola -> { tekst, otwarte }
  const rozwiniete = new Set();      // rodzaje rozwiniętych <details>
  let pokazWszystkieNowe = false;
  function zachowaj(przewijany, buduj) {
    const a = document.activeElement;
    const fk = a && a.dataset ? a.dataset.pole : null;
    const zaznaczenie = fk && 'selectionStart' in a ? [a.selectionStart, a.selectionEnd] : null;
    const y = window.scrollY, gora = przewijany ? przewijany.scrollTop : 0;
    buduj();
    if (przewijany) przewijany.scrollTop = gora;
    if (window.scrollY !== y) window.scrollTo(0, y);
    if (fk) {
      const n = document.querySelector('[data-pole="' + CSS.escape(fk) + '"]');
      if (n && n.offsetParent !== null) { n.focus({ preventScroll: true }); if (zaznaczenie) { try { n.setSelectionRange(zaznaczenie[0], zaznaczenie[1]); } catch { /* pole bez zaznaczenia */ } } }
    }
  }
  // Małe pole z jednym guzikiem: rozwija się pod wierszem albo kartą, wysyła i zwija się samo. Szkic (tekst i to, czy
  // pole jest otwarte) żyje pod kluczem, więc nowy egzemplarz pola po przerysowaniu wraca do tego, co ręka zostawiła.
  // wyslij(tekst, opcje) ma oddać ruch(…, opcje): wtedy guzik jest nieczynny w trakcie, a po sukcesie szkic znika.
  function pole(klucz, napis, podpowiedz, wyslij) {
    const sz = szkice.get(klucz) || { tekst: '', otwarte: false };
    const tekst = el('textarea', { rows: '2', placeholder: podpowiedz, 'aria-label': podpowiedz, 'data-pole': klucz });
    tekst.value = sz.tekst;
    const zapisz = () => { if (tekst.value || !pudlo.hidden) szkice.set(klucz, { tekst: tekst.value, otwarte: !pudlo.hidden }); else szkice.delete(klucz); };
    tekst.addEventListener('input', zapisz);
    const pudlo = el('div', { klasa: 'pole', hidden: !sz.otwarte }, tekst, el('button', { klasa: 'glowny', tekst: napis, klik: async (e) => {
      const w = tekst.value.trim(); if (!w) return;
      if (await wyslij(w, { zrodlo: e.currentTarget, sukces: () => szkice.delete(klucz) })) { tekst.value = ''; pudlo.hidden = true; szkice.delete(klucz); }
    } }));
    return { pudlo, pokaz: () => { pudlo.hidden = !pudlo.hidden; zapisz(); if (!pudlo.hidden) tekst.focus(); } };
  }
  // Ruch, którego nie cofa się jednym dotknięciem bez namysłu: pierwsze dotknięcie zmienia napis na pytanie na kilka
  // sekund, drugie wykonuje. Zamiast okna confirm(), które na telefonie łatwo zatwierdzić odruchem.
  function dwaDotkniecia(napis, pytanie, etykieta, akcja) {
    let zegar = null;
    const g = el('button', { tekst: napis, 'aria-label': napis + ' ' + etykieta, klik: (e) => {
      if (zegar) { clearTimeout(zegar); zegar = null; g.textContent = napis; g.classList.remove('pytanie'); g.setAttribute('aria-label', napis + ' ' + etykieta); akcja(e.currentTarget); return; }
      g.textContent = pytanie; g.classList.add('pytanie'); g.setAttribute('aria-label', pytanie + ' ' + napis + ' ' + etykieta);
      zegar = setTimeout(() => { zegar = null; g.textContent = napis; g.classList.remove('pytanie'); g.setAttribute('aria-label', napis + ' ' + etykieta); }, 5000);
    } });
    return g;
  }
  const slowaPrzy = (id) => rzeczy.filter((r) => r.rodzaj.startsWith('slowo/') && Array.isArray(r.cechy.dotyczy) && r.cechy.dotyczy.includes(id)).sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
  // Słowo przy rzeczy: uwaga albo pomysł zostawiony dokładnie tam, gdzie dotyczy, a nie w rozmowie.
  // Stan oka do słowa: co było widać, gdy je pisano (public/oko.mjs). Bez modułu albo przy błędzie słowo idzie bez niego.
  async function okoGospodarza() {
    if (!modulOka) return {};
    try { return { oko: await modulOka.stanOka({ twarz: 'gospodarz', pliki: ['/srodowisko.js', '/pokretla.mjs', '/kroje.mjs'], akt, ciemny: P ? P.ciemna(matchMedia('(prefers-color-scheme: dark)').matches) : null, bezpiecznie: new URLSearchParams(location.search).has('bezpiecznie'), stan: { okna: okna.size } }) }; } catch { return {}; }
  }
  function slowoPrzy(r) {
    const sa = slowaPrzy(r.id);
    const p = pole('slowo:' + r.id, 'Zostaw słowo', 'Twoje słowo przy tej rzeczy', async (w, o) => ruch({ co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: w, dotyczy: [r.id], ...(await okoGospodarza()) } }, 'Słowo zostawione przy: ' + r.tytul, o));
    return [el('div', { klasa: 'ruchy' }, el('button', { tekst: sa.length ? 'słowo (' + sa.length + ')' : 'słowo', title: 'Zostaw słowo przy tej rzeczy', klik: p.pokaz })),
      p.pudlo,
      sa.length ? el('ul', { klasa: 'slowa' }, sa.slice(0, 3).map((s) => el('li', {}, el('span', { tekst: s.cechy.tresc }), el('span', { klasa: 'bok', tekst: s.utworzyl + ' · ' + kiedy(s.utworzono) })))) : null];
  }
  const STOPNIE = [['nic', 'nic'], ['proponowac', 'proponować'], ['porzadkowac', 'porządkować'], ['prowadzic', 'prowadzić']];
  const CO_ZNACZY = { nic: 'ruchy agentów są odrzucane', proponowac: 'każdy ruch agenta czeka na Ciebie jako propozycja', porzadkowac: 'agenci układają sami, a zmianę treści proponują', prowadzic: 'agenci dokładają i zmieniają sami' };
  // Ile wolno agentom w obszarze: cztery guziki, bieżący jest zaznaczony. Zmiana jest zwykłym ruchem na rzeczy obszaru.
  function wierszObszaru(x) {
    const teraz = x.ustawienia.ile_wolno.wartosc;
    const rz = x.id ? rzeczO(x.id) : null;
    return el('li', { klasa: 'obszar' },
      el('div', {}, el('b', { tekst: x.nazwa }), el('span', { klasa: 'bok', tekst: ' · ' + lp(x.ile, 'rzecz', 'rzeczy', 'rzeczy') + ' · agentom wolno: ' + teraz + ' (' + CO_ZNACZY[teraz] + ')' })),
      rz ? el('div', { klasa: 'wybor', role: 'group', 'aria-label': 'Ile wolno agentom w obszarze ' + x.nazwa }, STOPNIE.map(([w, napis]) => el('button', { klasa: w === teraz ? 'wybrany' : null, 'aria-pressed': w === teraz ? 'true' : 'false', tekst: napis, title: CO_ZNACZY[w],
        klik: (e) => { if (w !== teraz) ruch({ co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: rz.rodzaj, cechy: { ...rz.cechy, ile_wolno: w } }, 'W obszarze ' + x.nazwa + ' agentom wolno teraz: ' + napis + '.', { zrodlo: e.currentTarget }); } }))) : null);
  }
  // Co propozycja chce zrobić, jednym zdaniem: nazwa rzeczy, której dotyczy, a przy nowej jej przyszła nazwa.
  // p: {id, rzecz, co, rodzaj}; pr: rzecz-propozycja (na karcie bierzemy ją z drzwi, nie ze spisu).
  function coProponuje(p, pr = rzeczO(p.id)) {
    const stara = p.rzecz ? rzeczO(p.rzecz) : null;
    const tresc = pr && pr.cechy.tresc && pr.cechy.tresc.cechy ? pr.cechy.tresc.cechy : {};
    const nazwa = tresc.nazwa || tresc.imie || tresc.tresc || tresc.dla || '';
    const czyn = { odloz: 'odłożyć', przywroc: 'przywrócić', cofnij: 'cofnąć do wcześniejszej wersji' }[p.co];
    if (stara) return (czyn ? czyn + ': ' : 'zmienić: ') + stara.tytul + (!czyn && nazwa && nazwa !== stara.tytul ? ' → ' + String(nazwa).slice(0, 80) : '');
    return 'dołożyć (' + p.rodzaj + ')' + (nazwa ? ': ' + String(nazwa).slice(0, 80) : '');
  }
  // Ruchy właściciela na czekającej propozycji; te same w liście i na karcie. Guzik mówi, co przyjmuje (aria-label).
  function ruchyPropozycji(id, co, kluczPola) {
    const odm = pole(kluczPola, 'Odrzuć z powodem', 'Dlaczego nie (zostanie przy propozycji)', (w, o) => ruch({ co: 'odrzuc', propozycja: id, powod: w }, 'Propozycja odrzucona.', o));
    const ruchy = el('div', { klasa: 'ruchy' },
      // Propozycja, która włącza zestawy, pamięta ich wersje: gdy któryś zmienił się od jej złożenia, drzwi odmawiają
      // i mówią który. Drugie kliknięcie przyjmuje świadomie to, co jest dziś.
      el('button', { klasa: 'glowny', tekst: 'Przyjmij', 'aria-label': 'Przyjmij: ' + co, klik: (e) => { const g = e.currentTarget; return ruch({ co: 'przyjmij', propozycja: id, ...(g.dataset.mimo ? { mimo_zmian: true } : {}) }, 'Propozycja przyjęta.', { zrodlo: g, naOdmowe: (odp) => { if (odp && Array.isArray(odp.zmienione)) { g.dataset.mimo = '1'; g.textContent = 'Przyjmij w dzisiejszej wersji'; } } }); } }),
      el('button', { tekst: 'Odrzuć', 'aria-label': 'Odrzuć: ' + co, klik: (e) => ruch({ co: 'odrzuc', propozycja: id }, 'Propozycja odrzucona.', { zrodlo: e.currentTarget }) }),
      el('button', { tekst: 'z powodem', 'aria-label': 'Odrzuć z powodem: ' + co, klik: odm.pokaz }));
    return { ruchy, pudlo: odm.pudlo };
  }

  function rysuj() {
    const t = $('tresc');
    const d = opis;
    rysujWejscie();
    rysujStan();
    const czekaIle = d.czeka.propozycje.length + d.czeka.prosby.length;
    const ileRzeczy = Number(d.razem) || 0;
    ostatniStan = { rzeczy: ileRzeczy, czeka: czekaIle, akt: (d.miejsce && d.miejsce.akt) || 0,
      tekst: ileRzeczy + ' rzeczy' + (czekaIle ? ', ' + czekaIle + ' czeka na Ciebie' : '') };
    powiedzStan();
    zachowaj(null, () => { t.textContent = ''; rysujTresc(t, d, czekaIle); });
    // Otwarta karta czyta swoją rzecz od nowa tylko wtedy, gdy Miejsce poszło dalej: inaczej niczego jej nie ruszamy.
    if (kr.id && kr.akt !== akt) odswiezKarte();
    odswiezUstawienia();
  }
  function rysujTresc(t, d, czekaIle) {
    if (d.miejsce.podglad) t.append(el('p', { klasa: 'uwaga', tekst: 'Podgląd: wszystko tutaj jest publiczne do czytania i niczego prywatnego tu nie ma. To jest środowisko, w którym Jaskinia ma rosnąć; Start stoi obok jako szkielet (guzik Start u góry).' }));
    const ja = jestemWlascicielem();
    // 1. Czeka na właściciela: to, na co ręka ma odpowiedzieć, jest pierwsze.
    if (czekaIle) t.append(el('section', {}, el('h2', {}, 'Czeka na właściciela ', el('span', { klasa: 'ile', tekst: String(czekaIle) })),
      el('ul', { klasa: 'lista czeka' },
        d.czeka.prosby.map((p) => {
          const rz = rzeczO(p.id);
          const odp = pole('odp:' + p.id, 'Odpowiedz', 'Twoja odpowiedź', (w, o) => rz && ruch({ co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: rz.rodzaj, cechy: { ...rz.cechy, odpowiedz: w, stan: 'zalatwiona' } }, 'Odpowiedź zapisana przy prośbie.', o));
          return el('li', {}, el('div', {}, el('a', { href: '/rzecz/' + p.id, tekst: p.tresc }), el('span', { klasa: 'bok', tekst: ` prośba od ${p.od} · ${kiedy(p.kiedy)}` }), odp.pudlo),
            ja && rz ? el('div', { klasa: 'ruchy' }, el('button', { klasa: 'glowny', tekst: 'Odpowiedz', 'aria-label': 'Odpowiedz na prośbę: ' + String(p.tresc).slice(0, 80), klik: odp.pokaz })) : null);
        }),
        d.czeka.propozycje.map((p) => {
          const co = coProponuje(p);
          const r = ja ? ruchyPropozycji(p.id, co, 'odm:' + p.id) : null;
          return el('li', {}, el('div', {}, el('a', { href: '/rzecz/' + p.id, tekst: co }),
            // propozycja, która zmienia prawa albo uczestników, ma inną wagę niż zmiana nazwy: mówi to od razu
            p.wymaga === 'wlasciciel' ? el('span', { klasa: 'nowe', tekst: ' zmienia prawa albo uczestników' }) : null,
            el('span', { klasa: 'bok', tekst: ` propozycja od ${p.od} · ${kiedy(p.kiedy)}` }), r ? r.pudlo : null),
            r ? r.ruchy : null);
        })),
      ja ? null : el('p', { klasa: 'ciche', tekst: 'Rozstrzyga właściciel. Jeśli to Ty: wejdź guzikiem na górze strony.' })));

    // 2. Nowe od ostatniej wizyty: najnowsze pierwsze, pięć na start.
    // To, co przyniósł automat (obserwator faktów), to setki drobnych rzeczy naraz: w "Nowe" stają jednym zdaniem,
    // żeby nie zasłoniły tego, co zrobił człowiek albo agent.
    const automaty = new Set(['srodowisko', ...d.uczestnicy.filter((u) => u.rola === 'automat').map((u) => u.imie)]);
    const wszystkieSwieze = rzeczy.filter((r) => r.wersja > widziany && widziany > 0).sort((a, b) => b.wersja - a.wersja);
    const odAutomatow = wszystkieSwieze.filter((r) => automaty.has(r.zmienil));
    const swieze = wszystkieSwieze.filter((r) => !automaty.has(r.zmienil));
    const zdanieOAutomatach = () => {
      const wg = new Map();
      for (const r of odAutomatow) { const m = wg.get(r.zmienil) || new Map(); const n = r.rodzaj.split('/')[0]; m.set(n, (m.get(n) || 0) + 1); wg.set(r.zmienil, m); }
      return 'Automaty przyniosły albo zmieniły ' + lp(odAutomatow.length, 'rzecz', 'rzeczy', 'rzeczy') + ': ' + [...wg].map(([kto, m]) => kto + ' (' + [...m].map(([n, ile]) => ile + ' ' + n).join(', ') + ')').join('; ') + '.';
    };
    if (wszystkieSwieze.length) {
      const widac = pokazWszystkieNowe ? swieze : swieze.slice(0, 5);
      t.append(el('section', {}, el('h2', {}, 'Nowe od Twojej ostatniej wizyty ', el('span', { klasa: 'ile', tekst: String(swieze.length) }),
        el('button', { tekst: 'widziałem', klik: () => { widziany = akt; localStorage.setItem(PAMIEC, String(akt)); rysuj(); } })),
        el('ul', { klasa: 'lista' }, widac.map((r) => el('li', {}, el('a', { href: '/rzecz/' + r.id, tekst: r.tytul }), el('span', { klasa: 'bok', tekst: `${r.rodzaj} · ${r.zmienil} · ${kiedy(r.zmieniono)}` })))),
        odAutomatow.length ? el('p', { klasa: 'ciche', tekst: zdanieOAutomatach() }) : null,
        swieze.length > 5 ? el('div', { klasa: 'ruchy' }, el('button', { tekst: pokazWszystkieNowe ? 'pokaż mniej' : 'pokaż pozostałe (' + (swieze.length - 5) + ')', 'aria-expanded': pokazWszystkieNowe ? 'true' : 'false', klik: () => { pokazWszystkieNowe = !pokazWszystkieNowe; rysuj(); } })) : null));
    }

    // 3. Projekty, 4. Organy i narzędzia
    // Projekty to dzieła (rodzaj projekt) i fakty o repozytoriach, które przyniósł obserwator (rodzaj repo).
    // Karta czyta jedne i drugie tak samo: nazwa, opis, gdzie zagrać, gdzie źródło, kiedy ostatnio żyło.
    // Tytułem jest ladna_nazwa (z pliku starej Jaskini), gdy jest; opisem tożsamość (jedno zdanie, czym to jest), gdy jest.
    const jakoProjekt = (r) => (r.rodzaj.startsWith('repo/') ? { ...r, tytul: (typeof r.cechy.ladna_nazwa === 'string' && r.cechy.ladna_nazwa) || r.tytul, cechy: { ...r.cechy, opis: (typeof r.cechy.tozsamosc === 'string' && r.cechy.tozsamosc) || r.cechy.opis, zagraj: r.cechy.strona, karta: r.cechy.karta, wejscie: r.cechy.wejscie, zrodlo: r.cechy.adres, zycie: r.cechy.ostatni_push } } : r);
    const projekty = rzeczy.filter((r) => r.rodzaj.startsWith('projekt/') || r.rodzaj.startsWith('repo/')).map(jakoProjekt).sort((a, b) => String(b.cechy.zycie || '').localeCompare(String(a.cechy.zycie || '')));
    const pr = d.przeniesienie;
    t.append(el('section', {}, el('h2', {}, 'Projekty ', el('span', { klasa: 'ile', tekst: (() => { const fakty = projekty.filter((r) => r.rodzaj.startsWith('repo/')).length, dziela = projekty.length - fakty; return [dziela ? `dzieła: ${dziela}` : null, fakty ? `repozytoria z faktów: ${fakty}` : null].filter(Boolean).join(' · ') || '0'; })() })),
      projekty.length ? el('div', { klasa: 'siatka' }, projekty.map(kartaProjektu)) : el('p', { klasa: 'ciche', tekst: 'Jeszcze żadnego. Projekt dokłada się jednym ruchem: /co-tu-jest, punkt 5.' })));

    const goscie = rzeczy.filter((r) => r.rodzaj.startsWith('gosc/'));
    t.append(el('section', {}, el('h2', {}, 'Organy i narzędzia ', el('span', { klasa: 'ile', tekst: String(goscie.length) })),
      goscie.length ? el('div', { klasa: 'siatka' }, goscie.map(kartaGoscia)) : el('p', { klasa: 'ciche', tekst: 'Jeszcze żadnego.' })));

    // 5. Obszary: ile wolno agentom
    t.append(el('section', {}, el('h2', {}, 'Obszary: ile wolno agentom'),
      el('ul', { klasa: 'lista obszary' }, d.obszary.map(wierszObszaru)),
      ja ? null : el('p', { klasa: 'ciche', tekst: 'Ustawienie zmienia właściciel; ruch kogoś innego staje się propozycją do niego.' })));

    // 6. Pozostałe rzeczy: rozwinięte <details> zostają rozwinięte po przerysowaniu
    const reszta = new Map();
    for (const r of rzeczy) { if (r.rodzaj.startsWith('projekt/') || r.rodzaj.startsWith('repo/') || r.rodzaj.startsWith('gosc/') || r.rodzaj.startsWith('zdolnosc/')) continue; if (!reszta.has(r.rodzaj)) reszta.set(r.rodzaj, []); reszta.get(r.rodzaj).push(r); }
    t.append(el('section', {}, el('h2', {}, 'Pozostałe rzeczy'),
      [...reszta].sort((a, b) => a[0].localeCompare(b[0])).map(([rodzaj, lista]) => {
        // Lista rodzaju powstaje dopiero po rozwinięciu i ma najwyżej 300 pozycji: przy setkach faktów budowanie jej
        // przy każdym przerysowaniu (a przerysowanie idzie po każdej zmianie w Miejscu) było większością pracy strony.
        const srodek = el('div', {});
        const wypelnij = () => {
          if (srodek.childNodes.length) return;
          srodek.append(el('ul', { klasa: 'lista' }, lista.slice(0, 300).map((r) => el('li', {}, el('a', { href: '/rzecz/' + r.id, tekst: r.tytul }), el('span', { klasa: 'bok', tekst: `${r.zmienil} · ${kiedy(r.zmieniono)}` })))));
          if (lista.length > 300) srodek.append(el('p', { klasa: 'ciche' }, 'Pokazane pierwsze 300 z ' + lista.length + '. Wszystkie tekstem: ', el('a', { href: '/rzeczy?rodzaj=' + encodeURIComponent(rodzaj), target: '_blank', rel: 'noopener', tekst: '/rzeczy?rodzaj=' + rodzaj })));
        };
        const det = el('details', { open: rozwiniete.has(rodzaj) }, el('summary', {}, rodzaj + ' ', el('span', { klasa: 'ile', tekst: String(lista.length) })), srodek);
        if (rozwiniete.has(rodzaj)) wypelnij();
        det.addEventListener('toggle', () => { if (det.open) { rozwiniete.add(rodzaj); wypelnij(); } else rozwiniete.delete(rodzaj); });
        return det;
      })));

    // 7. Stan budowy
    const stany = [['stoi', 'Stoi'], ['cienko', 'Cienko'], ['brak', 'Jeszcze nie ma']];
    // Etapami: grunt ma być solidny, zanim staną ściany; wykończenie jest na końcu. Każdy etap mówi, co stoi i czego brak.
    const etapy = Array.isArray(d.etapy) && d.etapy.length ? d.etapy : [{ id: 'grunt', nazwa: 'Stan budowy', opis: '' }];
    t.append(el('section', {}, el('h2', {}, 'Stan budowy środowiska'),
      el('p', { klasa: 'ciche', tekst: 'Budowa idzie etapami: grunt ma być solidny, zanim staną na nim ściany i kable; wykończenie jest na końcu; tworzenie jest celem.' }),
      etapy.map((e) => {
        const z = d.zdolnosci.filter((x) => (x.etap || 'grunt') === e.id);
        if (!z.length) return null;
        const ileW = (s) => z.filter((x) => x.stan === s).length;
        return el('details', { open: e.id === 'grunt' ? '' : null }, el('summary', {}, el('b', { tekst: e.nazwa }), el('span', { klasa: 'ile', tekst: ` stoi ${ileW('stoi')} · cienko ${ileW('cienko')} · brak ${ileW('brak')}` })),
          e.opis ? el('p', { klasa: 'ciche', tekst: e.opis }) : null,
          el('div', { klasa: 'trzy' }, stany.map(([s, napis]) => el('div', { klasa: 'kolumna ' + s }, el('h3', { tekst: napis.toUpperCase() }),
            z.filter((x) => x.stan === s).sort((a, b) => a.nazwa.localeCompare(b.nazwa)).map((x) => el('p', {}, el('b', { tekst: x.nazwa + '. ' }), el('span', { tekst: x.opis + (x.jak ? ' ' + x.jak : '') })))))));
      })));
  }
  function kartaProjektu(r) {
    const c = r.cechy;
    const k = el('article', { klasa: 'karta' });
    const kolor = c.zycie ? kolorZycia(c.zycie) : null;
    if (kolor) k.style.borderLeftColor = kolor;
    k.append(el('div', { klasa: 'nazwa', tekst: r.tytul }));
    if (typeof c.opis === 'string' && c.opis) k.append(el('div', { klasa: 'opis', tekst: c.opis }));
    // wejscie to jedno zdanie o wejściu do gry (np. czemu nie ma guzika); tekst idzie przez textContent, nigdy jako HTML
    if (typeof c.wejscie === 'string' && c.wejscie) k.append(el('div', { klasa: 'opis ciche', tekst: c.wejscie }));
    const ruchy = el('div', { klasa: 'ruchy' });
    const swoja = odWlasciciela(r);
    // gra z karta: true ma się otwierać w osobnej karcie: ramka dzieli pamięć gry i miejsce przy stole przepada
    const wKarcie = c.karta === true && typeof c.zagraj === 'string' && /^https:///.test(c.zagraj);
    if (wKarcie) ruchy.append(el('a', { klasa: 'guzik glowny', href: c.zagraj, target: '_blank', rel: 'noopener', title: typeof c.wejscie === 'string' && c.wejscie ? c.wejscie : null, tekst: 'Zagraj w karcie' }));
    else if (typeof c.zagraj === 'string' && /^https:\/\//.test(c.zagraj)) ruchy.append(el('button', { klasa: 'glowny', tekst: 'Zagraj', title: swoja ? c.zagraj : 'Adres podał ' + r.zmienil + ', nie właściciel: otworzy się bez własnej pamięci. ' + c.zagraj, klik: () => otworz({ klucz: 'p:' + r.id, tytul: r.tytul, adres: c.zagraj, piaskownica: swoja ? 'swoj' : 'obcy' }) }));
    if (typeof c.zrodlo === 'string' && /^https:\/\//.test(c.zrodlo)) ruchy.append(el('a', { klasa: 'guzik', href: c.zrodlo, target: '_blank', rel: 'noopener', tekst: 'źródło' }));
    if (ruchy.childNodes.length) k.append(ruchy);
    k.append(el('div', { klasa: 'meta' }, r.wersja > widziany && widziany > 0 ? el('span', { klasa: 'nowe', tekst: 'nowe' }) : null,
      c.zycie ? el('span', { tekst: 'żyje: ' + kiedy(c.zycie) }) : el('span', { tekst: 'brak daty życia' }),
      // skąd rzecz pochodzi: kto ją dołożył i kto ostatnio zmienił; rzecz nie od właściciela jest oznaczona
      el('span', { klasa: swoja ? null : 'nowe', tekst: swoja ? (r.utworzyl === 'obserwator' ? (typeof c.zrodlo_faktow === 'string' && c.zrodlo_faktow.startsWith('plik') ? 'fakt: plik starej Jaskini' : 'fakt: GitHub') + (c.stan_na ? ', ' + kiedy(c.stan_na) : '') + (Number.isFinite(c.galezie) ? ', gałęzi: ' + c.galezie : '') : 'od właściciela') : 'dołożył ' + r.utworzyl + (r.zmienil !== r.utworzyl ? ', zmienił ' + r.zmienil : '') }),
      el('a', { href: '/rzecz/' + r.id, tekst: 'szczegóły' })));
    k.append(...slowoPrzy(r).filter(Boolean));
    return k;
  }
  // Rzecz "od właściciela": on ją dołożył i on ostatnio zmienił. Każdą inną mógł dołożyć albo zmienić agent.
  // Tak samo ufamy obserwatorowi faktów: przynosi tylko to, co GitHub mówi o publicznych repozytoriach właściciela,
  // a żaden klucz nie może nosić jego imienia.
  const ZAUFANI = ['obserwator'];
  const odWlasciciela = (r) => Boolean(opis && opis.wlasciciel && [opis.wlasciciel, ...ZAUFANI].includes(r.utworzyl) && [opis.wlasciciel, ...ZAUFANI].includes(r.zmienil));
  function kartaGoscia(r) {
    const c = r.cechy;
    const kod = typeof c.kod === 'string' && /^[0-9a-f]{64}$/.test(c.kod) ? '/gosc/' + c.kod : null;
    const adres = !kod && typeof c.adres === 'string' && /^https:\/\//.test(c.adres) ? c.adres : null;
    const k = el('article', { klasa: 'karta' }, el('div', { klasa: 'nazwa', tekst: r.tytul }), el('div', { klasa: 'opis', tekst: typeof c.opis === 'string' ? c.opis : '' }));
    k.style.borderLeftColor = 'var(--akcent)';
    k.append(el('div', { klasa: 'ruchy' }, kod || adres ? el('button', { klasa: 'glowny', tekst: 'Otwórz', klik: () => otworzGoscia(r) }) : el('span', { klasa: 'ciche', tekst: 'bez kodu i adresu' })),
      el('div', { klasa: 'meta' }, r.wersja > widziany && widziany > 0 ? el('span', { klasa: 'nowe', tekst: 'nowe' }) : null, el('span', { tekst: `dołożył ${r.utworzyl} · ${kiedy(r.utworzono)}` }), el('a', { href: '/rzecz/' + r.id, tekst: 'szczegóły' })));
    k.append(...slowoPrzy(r).filter(Boolean));
    return k;
  }

  // --- karta rzeczy: odnośnik do rzeczy otwiera ją tu, na stronie, a nie jako goły tekst dla agentów ---------------
  // href zostaje (agent i "otwórz w nowej karcie" działają jak dotąd); dla ręki łapiemy zwykłe dotknięcie jedną
  // wspólną obsługą. Karta żyje poza #tresc, więc przerysowanie strony jej nie rusza; sama czyta rzecz od nowa tylko
  // wtedy, gdy rzecz (albo to, co ją otacza) naprawdę się zmieniła.
  const ID_RZECZY = /^[0-9a-z]{26}$/;
  const kr = { id: null, pierwszy: null, pierwszyId: null, nr: 0, podpis: '', akt: -1, sekcja: null, tresc: null, tyt: null, rodz: null };
  function szkieletKarty() {
    if (kr.sekcja) return;
    kr.tyt = el('span', { klasa: 'tytul' });
    kr.rodz = el('span', { klasa: 'mowi' });
    kr.tresc = el('div', { klasa: 'kr-tresc', tabindex: '-1' });
    kr.sekcja = el('section', { klasa: 'okno karta-rzeczy', role: 'dialog', 'aria-label': 'Karta rzeczy', hidden: true },
      el('div', { klasa: 'pasek' }, kr.tyt, kr.rodz, el('button', { tekst: '×', title: 'Zamknij kartę', 'aria-label': 'Zamknij kartę', klik: zamknijKarte })),
      kr.tresc);
    $('okna').append(kr.sekcja);
  }
  function otworzKarte(id, opener) {
    szkieletKarty();
    // fokus wróci do odnośnika, z którego karta została otwarta po raz pierwszy, nawet gdy potem chodzimy po odnośnikach w karcie
    if (!kr.id) { kr.pierwszy = opener || null; kr.pierwszyId = id; }
    kr.id = id; kr.podpis = ''; kr.akt = -1;
    powiedzPrzy();
    kr.sekcja.hidden = false;
    kr.tyt.textContent = 'Czytam…'; kr.rodz.textContent = '';
    kr.tresc.replaceChildren(el('p', { klasa: 'ciche', tekst: 'Czytam rzecz…' }));
    kr.tresc.scrollTop = 0;
    return odswiezKarte().then(() => { const h = kr.tresc.querySelector('.kr-tytul'); if (h && kr.id === id) h.focus({ preventScroll: true }); });
  }
  function zamknijKarte() {
    if (!kr.id) return;
    const wracam = kr.pierwszy, idPierwszej = kr.pierwszyId;
    kr.id = null; kr.nr++; kr.podpis = ''; kr.pierwszy = null;
    powiedzPrzy();
    kr.sekcja.hidden = true;
    // odnośnik, z którego otwarto, mógł zniknąć przy przerysowaniu: szukamy go po adresie
    const cel = wracam && wracam.isConnected ? wracam : [...document.querySelectorAll('#tresc a[href^="/rzecz/"]')].find((a) => a.getAttribute('href') === '/rzecz/' + idPierwszej);
    if (cel) cel.focus({ preventScroll: true });
  }
  // Czyta rzecz z drzwi i przerysowuje kartę. Kolejne wywołania wyprzedzają poprzednie (numer nr), a niezmieniony
  // odczyt nie rusza niczego: ani wpisanego tekstu, ani zapytania "Na pewno?" w połowie.
  async function odswiezKarte() {
    const id = kr.id;
    if (!id) return;
    const nr = ++kr.nr;
    try {
      const d = await czytaj('/api/srodowisko/rzecz?id=' + encodeURIComponent(id));
      if (kr.nr !== nr || kr.id !== id) return;
      kr.akt = akt;
      const wokol = [slowaPrzy(id).map((s) => [s.id, s.wersja]), (d.wskazuja || []).map((w) => [w.od, rzeczO(w.od) && rzeczO(w.od).tytul]),
        Object.values(d.rzecz.cechy).filter((w) => typeof w === 'string' && ID_RZECZY.test(w)).map((w) => rzeczO(w) && rzeczO(w).tytul),
        jestemWlascicielem(), opis.obszary.map((o) => [o.id, o.nazwa])];
      const podpis = JSON.stringify([d, wokol]);
      if (podpis === kr.podpis) return;
      kr.podpis = podpis;
      zachowaj(kr.tresc, () => rysujKarte(d));
    } catch (blad) {
      if (kr.nr !== nr || kr.id !== id) return;
      // gdy karta już coś pokazuje, błąd odczytu w tle jej nie psuje; pusta dostaje zdanie, dlaczego
      if (!kr.podpis) { kr.tyt.textContent = 'Nie ma tej rzeczy'; kr.tresc.replaceChildren(el('p', { klasa: 'uwaga', tekst: 'Nie udało się przeczytać tej rzeczy: ' + blad.message }), el('p', {}, el('a', { href: '/rzecz/' + id, target: '_blank', rel: 'noopener', tekst: 'tekstem' }))); }
    }
  }
  // Czytelny tekst z wartości cechy: lista w jednej linii, obiekt jako "nazwa: wartość" z wcięciami.
  function tekstWartosci(w, wc = '') {
    if (w === null || w === undefined) return '—';
    if (typeof w === 'boolean') return w ? 'tak' : 'nie';
    if (typeof w !== 'object') return String(w);
    if (Array.isArray(w) && w.every((x) => x === null || typeof x !== 'object')) return w.length ? w.map((x) => tekstWartosci(x)).join(', ') : '(pusta lista)';
    const pozycje = Array.isArray(w) ? w.map((x) => [null, x]) : Object.entries(w);
    if (!pozycje.length) return '(pusty)';
    return pozycje.map(([k, v]) => {
      const zlozona = v !== null && typeof v === 'object' && (Array.isArray(v) ? v.length > 0 && v.some((x) => x !== null && typeof x === 'object') : Object.keys(v).length > 0);
      return wc + (k === null ? '- ' : k + ': ') + (zlozona ? '\n' : '') + tekstWartosci(v, wc + '  ');
    }).join('\n');
  }
  // Tytułem propozycji jest jej rodzaj, co nic nie mówi: w odnośniku nazywamy ją tym, co proponuje.
  const nazwaRzeczy = (r) => r.rodzaj === 'propozycja/1' ? 'Propozycja: ' + coProponuje({ id: r.id, rzecz: r.cechy.rzecz || null, co: r.cechy.co || 'poloz', rodzaj: r.cechy.rodzaj }, r) : r.tytul;
  const odnosnikRzeczy = (id) => el('a', { href: '/rzecz/' + id, tekst: rzeczO(id) ? nazwaRzeczy(rzeczO(id)) : id });
  // Wartość cechy jako węzły: identyfikator innej rzeczy (obecnej w spisie) jest odnośnikiem z jej tytułem.
  function wartoscWezel(w) {
    const jestId = (x) => typeof x === 'string' && ID_RZECZY.test(x) && rzeczO(x);
    if (jestId(w)) return odnosnikRzeczy(w);
    if (Array.isArray(w) && w.length && w.some(jestId) && w.every((x) => x === null || typeof x !== 'object')) {
      const wynik = [];
      w.forEach((x, i) => { if (i) wynik.push(', '); wynik.push(jestId(x) ? odnosnikRzeczy(x) : String(x)); });
      return el('span', { klasa: 'kr-tekst' }, wynik);
    }
    return el('span', { klasa: 'kr-tekst', tekst: tekstWartosci(w) });
  }
  const listaCech = (cechy, pomin = []) => {
    const wpisy = Object.entries(cechy || {}).filter(([k]) => !pomin.includes(k));
    return wpisy.length ? el('dl', { klasa: 'kr-cechy' }, wpisy.flatMap(([k, w]) => [el('dt', { tekst: k }), el('dd', {}, wartoscWezel(w))])) : el('p', { klasa: 'ciche', tekst: 'Bez cech.' });
  };
  function rysujKarte(d) {
    const r = d.rzecz, ja = jestemWlascicielem(), c = r.cechy || {};
    const ob = opis.obszary.find((o) => (r.obszar ? o.id === r.obszar : o.glowny));
    // propozycja nie ma własnej nazwy (jej tytułem jest rodzaj), więc karta nazywa ją tym, co proponuje
    const prop = r.rodzaj === 'propozycja/1' ? { id: r.id, rzecz: c.rzecz || null, co: c.co || 'poloz', rodzaj: c.rodzaj } : null;
    const co = prop ? coProponuje(prop, r) : '';
    const tytulKarty = prop ? 'Propozycja: ' + co : r.tytul;
    kr.tyt.textContent = tytulKarty; kr.rodz.textContent = r.rodzaj;
    kr.sekcja.setAttribute('aria-label', 'Karta rzeczy: ' + tytulKarty);
    const k = [];
    k.push(el('h3', { klasa: 'kr-tytul', tabindex: '-1', tekst: tytulKarty }));
    k.push(el('p', { klasa: 'kr-meta' }, el('b', { tekst: r.rodzaj }), ' · obszar: ' + (ob ? ob.nazwa : (r.obszar || 'główny'))));
    if (r.odlozone) k.push(el('p', { klasa: 'kr-odlozona' }, el('b', { tekst: 'ODŁOŻONA' }), r.powod ? ' z powodu: ' + r.powod : ' (bez podanego powodu)', el('span', { klasa: 'bok', tekst: ' Zniknęła z list, ale zostaje tu i w historii.' })));
    k.push(el('p', { klasa: 'kr-meta' }, 'Dołożył ' + r.utworzyl + ' ', el('span', { title: r.utworzono, tekst: kiedy(r.utworzono) }),
      '. Ostatnio zmienił ' + r.zmienil + ' ', el('span', { title: r.zmieniono, tekst: kiedy(r.zmieniono) }), '. Wersja ' + r.numer + '.'));

    if (prop) {
      const p = prop;
      k.push(el('p', { klasa: 'kr-zdanie' }, el('b', { tekst: 'Proponuje: ' }), co));
      const nowe = c.tresc && c.tresc.cechy ? c.tresc.cechy : null;
      if (nowe) {
        const stara = p.rzecz ? rzeczO(p.rzecz) : null;
        k.push(el('h4', { tekst: 'Co dokładnie się zmieni' }));
        k.push(el('dl', { klasa: 'kr-cechy' }, Object.entries(nowe).flatMap(([n, w]) => {
          const bylo = stara && Object.prototype.hasOwnProperty.call(stara.cechy, n) ? stara.cechy[n] : undefined;
          const zmiana = stara && JSON.stringify(bylo) !== JSON.stringify(w);
          return [el('dt', { tekst: n }), el('dd', {}, wartoscWezel(w), zmiana ? el('span', { klasa: 'ciche kr-bylo', tekst: bylo === undefined ? 'nowa cecha' : 'teraz: ' + tekstWartosci(bylo).slice(0, 200) }) : null)];
        })));
      }
      if (c.stan === 'czeka') {
        if (ja) { const rp = ruchyPropozycji(r.id, co, 'k:odm:' + r.id); k.push(rp.ruchy, rp.pudlo); }
        else k.push(el('p', { klasa: 'ciche', tekst: 'Czeka na właściciela. Jeśli to Ty: wejdź guzikiem na górze strony.' }));
      } else k.push(el('p', { klasa: 'kr-meta' }, el('b', { tekst: 'Stan: ' + (c.stan || '?') }), c.rozstrzygnal ? ' · rozstrzygnął ' + c.rozstrzygnal : ''));
    }
    if (r.rodzaj === 'prosba/1' && c.stan === 'czeka') {
      if (ja) {
        const odp = pole('k:odp:' + r.id, 'Odpowiedz', 'Twoja odpowiedź', (w, o) => ruch({ co: 'poloz', rzecz: r.id, wersja: r.wersja, rodzaj: r.rodzaj, cechy: { ...c, odpowiedz: w, stan: 'zalatwiona' } }, 'Odpowiedź zapisana przy prośbie.', o));
        k.push(el('div', { klasa: 'ruchy' }, el('button', { klasa: 'glowny', tekst: 'Odpowiedz', 'aria-label': 'Odpowiedz na prośbę: ' + String(c.tresc || r.tytul).slice(0, 80), klik: odp.pokaz })), odp.pudlo);
      } else k.push(el('p', { klasa: 'ciche', tekst: 'Czeka na odpowiedź właściciela.' }));
    }

    k.push(el('h4', { tekst: 'Cechy' }), listaCech(c, r.rodzaj === 'propozycja/1' ? ['tresc'] : []));

    // ruchy na samej rzeczy; odłożenie jest dwudotykowe, przywrócenie nie (nic nie niszczy)
    if (ja && r.rodzaj !== 'propozycja/1') {
      k.push(el('div', { klasa: 'ruchy' }, r.odlozone
        ? el('button', { tekst: 'Przywróć', 'aria-label': 'Przywróć rzecz: ' + r.tytul, klik: (e) => ruch({ co: 'przywroc', rzecz: r.id, wersja: r.wersja }, 'Przywrócone: ' + r.tytul + '.', { zrodlo: e.currentTarget }) })
        : dwaDotkniecia('Odłóż', 'Na pewno odłożyć?', 'rzecz: ' + r.tytul, (g) => ruch({ co: 'odloz', rzecz: r.id, wersja: r.wersja }, 'Odłożone: ' + r.tytul + '. Da się je przywrócić z tej karty.', { zrodlo: g }))));
    }

    const sa = slowaPrzy(r.id);
    const sl = pole('k:slowo:' + r.id, 'Zostaw słowo', 'Twoje słowo przy tej rzeczy', async (w, o) => ruch({ co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: w, dotyczy: [r.id], ...(await okoGospodarza()) } }, 'Słowo zostawione przy: ' + r.tytul, o));
    k.push(el('h4', { tekst: sa.length ? 'Słowa przy tej rzeczy (' + sa.length + ')' : 'Słowa przy tej rzeczy' }),
      sa.length ? el('ul', { klasa: 'slowa kr-slowa' }, sa.map((s) => el('li', {}, el('span', { klasa: 'kr-tekst', tekst: s.cechy.tresc }), el('span', { klasa: 'bok', tekst: s.utworzyl + ' · ' + kiedy(s.utworzono) })))) : el('p', { klasa: 'ciche', tekst: 'Jeszcze żadnych.' }),
      el('div', { klasa: 'ruchy' }, el('button', { tekst: 'Zostaw słowo', klik: sl.pokaz })), sl.pudlo);

    if ((d.wskazuja || []).length) k.push(el('h4', { tekst: 'Wskazują na tę rzecz' }),
      el('ul', { klasa: 'lista kr-wskazuja' }, d.wskazuja.map((w) => el('li', {}, odnosnikRzeczy(w.od), el('span', { klasa: 'bok', tekst: 'przez cechę: ' + w.cecha })))));

    // historia: ostatnie pięć wersji od najnowszej; powrót do starszej tylko dla właściciela i dwudotykowo
    k.push(el('h4', { tekst: 'Historia' }),
      el('ul', { klasa: 'lista kr-historia' }, d.historia.slice(-5).reverse().map((h) => el('li', {},
        el('span', {}, 'wersja ' + h.numer + ' · ' + h.kto + ' · ', el('span', { title: h.kiedy, tekst: kiedy(h.kiedy) }), h.numer === r.numer ? el('b', { tekst: ' (teraz)' }) : null),
        ja && h.numer !== r.numer && !prop ? dwaDotkniecia('wróć do tej wersji', 'Na pewno wrócić?', 'do wersji ' + h.numer, (g) => ruch({ co: 'cofnij', rzecz: r.id, wersja: r.wersja, do: h.akt }, 'Wróciło do wersji ' + h.numer + ' (jako nowa wersja).', { zrodlo: g })) : null))));

    k.push(el('p', { klasa: 'kr-stopka' }, el('a', { href: '/rzecz/' + r.id, target: '_blank', rel: 'noopener', tekst: 'tekstem', title: 'Ta sama rzecz jako goły tekst, w nowej karcie przeglądarki' })));
    kr.tresc.replaceChildren(...k.flat());
  }
  // Jedna obsługa dla każdego odnośnika do rzeczy na stronie i w karcie. Klawisze modyfikujące, środkowy przycisk
  // i target=_blank zostają przeglądarce.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target instanceof Element ? e.target.closest('a[href^="/rzecz/"]') : null;
    if (!a || (a.target && a.target !== '_self')) return;
    const id = a.getAttribute('href').slice('/rzecz/'.length);
    if (!/^[0-9a-z]+$/.test(id)) return;
    e.preventDefault();
    otworzKarte(id, kr.id ? null : a);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && kr.id && !e.defaultPrevented) zamknijKarte(); });

  // --- pokrętła: wygląd i odczucie są danymi w Miejscu (public/pokretla.mjs, drzwi /api/srodowisko/ustawienia) -------
  // Ta strona bierze z nich palety i kroje, mówi je narzędziom w oknach (wiadomość look: przy otwarciu i po każdej
  // zmianie, w biegu) i daje ręce panel: każde zadeklarowane pokrętło z polem według typu. W trakcie kręcenia zmiana
  // jest podglądem (bez zapisu; widzą ją też inne karty tego adresu), zapis idzie przy puszczeniu. Adres z ?bezpiecznie
  // zostawia wygląd domyślny.
  let P = null, modulPokretel = null, modulKrojow = null, modulOka = null, podglad = null, ust = null, odciskUstawien = null, pytamOUstawienia = false;
  const bajtyPliku = async (plik) => { const o = await fetch('/api/srodowisko/bajty?rzecz=' + plik.rzecz + '&odcisk=' + plik.odcisk, { headers: naglowki({ accept: '*/*' }) }); if (!o.ok) throw new Error('nie ma pliku ' + plik.rzecz); return o.arrayBuffer(); };
  let pelneKiedy = 0, pelneZegar = null, pelneOdRazu = false, twarzSprawdzona = false;
  const PANEL_NAJCZESCIEJ_MS = 15000;
  const bezpiecznie = new URLSearchParams(location.search).has('bezpiecznie');
  const systemCiemny = () => matchMedia('(prefers-color-scheme: dark)').matches;
  const krojRoli = (rola, p = P) => { const k = p.kroj(rola); return { rodzina: k.rodzina, ...(k.grubosc !== undefined ? { grubosc: k.grubosc } : {}), ...(k.osie ? { osie: k.osie } : {}) }; };
  // Wygląd dla okna narzędzia: wszystkie role palety, które zna ta strona (z tablicy i z deklaracji w Miejscu), kroje
  // obu ról jako wartości typu kroj i natężenie ruchu.
  function wygladDlaOkna(p = P) {
    const kolory = {};
    for (const rola of p.role()) { const k = p.kolor(rola, systemCiemny()); if (typeof k === 'string') kolory[rola] = k; }
    return { jaskinia: 1, type: 'look', v: 2, ciemny: p.ciemna(systemCiemny()), kolory, kroj: { tekst: krojRoli('tekst', p), imiona: krojRoli('imiona', p) }, ruch: Number(p.w('odczucie.ruch.natezenie')) };
  }
  // Wygląd liczony dla okna: gdy jakaś wartość ma zasięg tego okna, strona pyta drzwi o ustawienia dla niego
  // (dla=<okno>); inaczej okno dostaje wygląd Miejsca, bez dodatkowego pytania.
  const wygladyOkien = new Map(); // id rzeczy okna -> { odcisk, wiadomosc }
  async function wygladOkna(o) {
    const rz = o.gosc ? rzeczOkna(o.gosc.id) : null;
    if (!rz || !rzeczy.some((x) => x.rodzaj === 'wartosc/1' && !x.odlozone && x.cechy.zasieg === rz.id)) return wygladDlaOkna();
    const odcisk = odciskUst();
    const pam = wygladyOkien.get(rz.id);
    if (pam && pam.odcisk === odcisk) return pam.wiadomosc;
    const u = await czytaj('/api/srodowisko/ustawienia?nazwy=' + P.nazwy() + '&dla=' + rz.id);
    const wlasne = new modulPokretel.Pokretla({ bezpiecznie });
    for (const d of P.typy.values()) wlasne.znaj(d);
    wlasne.przyjmij(u);
    const wiadomosc = wygladDlaOkna(wlasne);
    wygladyOkien.set(rz.id, { odcisk, wiadomosc });
    return wiadomosc;
  }
  function powiedzWyglad(o) {
    if (!P || !o || !o.ramka.contentWindow) return;
    wygladOkna(o).catch(() => wygladDlaOkna()).then((w) => { if (o.ramka.contentWindow) o.ramka.contentWindow.postMessage(w, '*'); });
  }
  function zastosujWyglad() {
    if (!P) return;
    const st = document.documentElement.style;
    for (const rola of P.role()) { const k = P.kolor(rola, systemCiemny()); if (typeof k === 'string') st.setProperty('--' + rola, k); }
    st.setProperty('color-scheme', P.ciemna(systemCiemny()) ? 'dark' : 'light');
    const css = modulPokretel.krojNaCss(P.kroj('tekst'));
    // krój z pliku w Miejscu ładuje się z bajtów (public/kroje.mjs); do tego czasu zostaje rodzina zapasowa
    document.body.style.fontFamily = modulKrojow ? modulKrojow.rodzinaKroju(P.kroj('tekst'), { czytajBajty: bajtyPliku, naGotowe: zastosujWyglad }) : css.rodzina;
    document.body.style.fontWeight = css.grubosc;
    document.body.style.fontVariationSettings = css.osie;
    for (const o of okna.values()) powiedzWyglad(o);
  }
  const odciskUst = () => { let ile = 0, ostatnia = 0; for (const r of rzeczy) if (modulPokretel.RODZAJE_USTAWIEN.includes(r.rodzaj)) { ile++; if (r.wersja > ostatnia) ostatnia = r.wersja; } return ile + ':' + ostatnia + ':' + (klucz ? 1 : 0); };
  // Wygląd od razu i tanio: po zmianie strona pyta tylko o pokrętła, które zna (tablica i role nauczone z deklaracji).
  // Pełna lista wszystkich deklaracji, z której rysuje się panel, przychodzi przy wejściu, po własnym zapisie z panelu
  // i poza tym najwyżej raz na kilkanaście sekund: jej koszt rośnie z tym, co ktokolwiek zadeklarował w Miejscu.
  async function odswiezUstawienia() {
    if (!P || !opis || pytamOUstawienia) return;
    pytamOUstawienia = true;
    try {
      for (let obieg = 0; obieg < 3; obieg++) {
        const odcisk = odciskUst();
        if (odcisk === odciskUstawien) break;
        if (!pelneKiedy) { odciskUstawien = odcisk; pelneOdRazu = true; zaplanujPelne(); break; }
        const u = await czytaj('/api/srodowisko/ustawienia?nazwy=' + P.nazwy());
        odciskUstawien = odcisk;
        odswiezSuwaki();
        if (!bezpiecznie) P.przyjmij(u);
        zaplanujPelne();
      }
    } catch { /* bez ustawień z Miejsca strona zostaje przy wyglądzie, który ma */ } finally { pytamOUstawienia = false; }
  }
  function zaplanujPelne() {
    if (pelneZegar) { if (!pelneOdRazu) return; clearTimeout(pelneZegar); pelneZegar = null; }
    const zaIle = pelneOdRazu ? 0 : Math.max(0, pelneKiedy + PANEL_NAJCZESCIEJ_MS - Date.now());
    pelneOdRazu = false;
    pelneZegar = setTimeout(async () => {
      pelneZegar = null;
      pelneKiedy = Date.now();
      try {
        ust = await czytaj('/api/srodowisko/ustawienia?deklaracje=tak');
        // Twarz domyślna jest ustawieniem: gdy mówi "start", główny adres otwiera Start. Tylko przy wejściu, nigdy w trybie
        // bezpiecznym ani pod adresem z ?zostan (tak tu wraca Start), więc do strony gospodarza zawsze da się dojść.
        const pierwsze = !twarzSprawdzona;
        twarzSprawdzona = true;
        const domyslna = ust.wartosci && ust.wartosci['srodowisko.twarz_domyslna'];
        if (pierwsze && domyslna && domyslna.wartosc === 'start' && !bezpiecznie && location.pathname === '/' && !new URLSearchParams(location.search).has('zostan')) { location.replace('/start/'); return; }
        // Role palety zadeklarowane w Miejscu: strona uczy się ich, odtąd pyta o nie po nazwie i mówi je oknom narzędzi.
        let nowe = false;
        for (const d of ust.deklaracje || []) if (d.typ === 'kolor' && typeof d.nazwa === 'string' && (d.nazwa.startsWith(modulPokretel.PALETA.jasna) || d.nazwa.startsWith(modulPokretel.PALETA.ciemna)) && P.znaj(d)) nowe = true;
        const zmiana = bezpiecznie ? false : P.przyjmij(ust);
        if (nowe && !zmiana) zastosujWyglad();
        rysujUstawienia();
      } catch { /* panel zostaje przy tym, co ma */ }
    }, zaIle);
  }
  // Panel dla ręki: jedno miejsce, które stroi wszystko, co ktokolwiek zadeklarował. Kręcenie jest podglądem, zapis
  // idzie przy puszczeniu suwaka albo zatwierdzeniu pola (jedna zmiana to jeden zapis), a "wróć" odkłada wartość,
  // czyli oddaje odziedziczoną.
  const PROSTE = ['kolor', 'liczba', 'czas', 'wybor', 'tak-nie', 'tekst', 'cien', 'kroj', 'sprezyna'];
  // opcje.zasieg: wartość tylko dla jednej rzeczy (suwaki świata obok jego okna); wtedy bez podglądu wyglądu strony,
  // bo pokrętło świata nie jest wyglądem gospodarza, a po zapisie woła opcje.potem.
  function poleUstawienia(d, x, opcje = {}) {
    const nieczynne = klucz ? null : true;
    const podejrzyj = opcje.zasieg ? () => {} : (w) => { if (bezpiecznie) return; P.podejrzyj(d.nazwa, w); if (podglad) podglad.nadaj(d.nazwa, w); };
    const ustaw = async (w) => {
      if (opcje.zapis) { const o = await opcje.zapis(w); if (opcje.potem) opcje.potem(o); return; }
      if (opcje.zasieg) {
        const o = await ruch({ co: 'poloz', rodzaj: 'wartosc/1', wersja: 'dowolna', cechy: { pokretlo: d.nazwa, zasieg: opcje.zasieg, wartosc: w } }, opcje.zdanie || 'Ustawione: ' + d.nazwa + '.');
        if (opcje.potem) opcje.potem(o);
        return;
      }
      pelneOdRazu = true;
      const o = await ruch({ co: 'poloz', rodzaj: 'wartosc/1', wersja: 'dowolna', cechy: { pokretlo: d.nazwa, wartosc: w } }, 'Ustawione: ' + d.nazwa + '.');
      // Zapis ze skutkiem: podgląd gaśnie sam, gdy ta sama wartość przyjdzie z Miejsca. Propozycja albo odmowa: gaśnie od razu.
      if (!o || o.skutek === 'propozycja') { P.koniecPodgladu(d.nazwa); if (podglad) podglad.koniec(d.nazwa); }
    };
    const cechy = { 'aria-label': d.nazwa, disabled: nieczynne };
    const w0 = x.wartosc;
    const obiekt = w0 && typeof w0 === 'object' && !Array.isArray(w0) ? w0 : {};
    const pod = (nazwa, tekst) => el('span', { klasa: 'bok', tekst });
    let pole;
    if (d.typ === 'kolor') { pole = el('input', { type: 'color', value: String(w0).slice(0, 7), ...cechy }); pole.addEventListener('input', () => podejrzyj(pole.value)); pole.addEventListener('change', () => ustaw(pole.value)); }
    else if (d.typ === 'liczba' || d.typ === 'czas') {
      const z = d.zakres || {};
      // pole liczbowe ma własną nazwę: niżej `pole` staje się parą suwak i liczba, a słuchacze mają czytać liczbę
      const liczbowe = el('input', { type: 'number', value: String(w0), step: z.krok ? String(z.krok) : 'any', ...cechy });
      liczbowe.addEventListener('change', () => { const w = Number(liczbowe.value); if (liczbowe.value !== '' && Number.isFinite(w)) ustaw(w); });
      pole = liczbowe;
      if (Number.isFinite(z.od) && Number.isFinite(z.do)) {
        const suwak = el('input', { type: 'range', min: String(z.od), max: String(z.do), step: z.krok ? String(z.krok) : 'any', value: String(w0), 'aria-label': d.nazwa + ' (suwak)', disabled: nieczynne });
        suwak.addEventListener('input', () => { liczbowe.value = suwak.value; podejrzyj(Number(suwak.value)); });
        suwak.addEventListener('change', () => ustaw(Number(suwak.value)));
        pole = el('span', { klasa: 'ust-para' }, suwak, liczbowe, d.jednostka ? pod(d.nazwa, d.jednostka) : (d.typ === 'czas' ? pod(d.nazwa, 'ms') : null));
      }
    } else if (d.typ === 'wybor') { pole = el('select', cechy, (d.wartosci || []).map((w) => el('option', { value: w, selected: w === w0 ? true : null, tekst: w }))); pole.addEventListener('change', () => ustaw(pole.value)); }
    else if (d.typ === 'tak-nie') { pole = el('input', { type: 'checkbox', checked: w0 === true ? true : null, ...cechy }); pole.addEventListener('change', () => ustaw(pole.checked)); }
    else if (d.typ === 'cien') {
      // cień to jedna wartość: barwa z kryciem (kanał alfa) i trzy liczby; każda zmiana składa całość
      const kolor = typeof obiekt.kolor === 'string' ? obiekt.kolor : '#00000000';
      const barwa = el('input', { type: 'color', value: kolor.slice(0, 7), 'aria-label': d.nazwa + ' (barwa)', disabled: nieczynne });
      const krycie = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: String(kolor.length === 9 ? parseInt(kolor.slice(7), 16) / 255 : 1), 'aria-label': d.nazwa + ' (krycie)', disabled: nieczynne });
      const liczby = ['x', 'y', 'rozmycie'].map((n) => el('input', { type: 'number', step: '1', value: String(Number(obiekt[n]) || 0), 'aria-label': d.nazwa + ' (' + n + ')', disabled: nieczynne }));
      const zloz = () => ({ x: Number(liczby[0].value) || 0, y: Number(liczby[1].value) || 0, rozmycie: Math.max(0, Number(liczby[2].value) || 0), kolor: barwa.value + Math.round(Math.max(0, Math.min(1, Number(krycie.value) || 0)) * 255).toString(16).padStart(2, '0') });
      for (const p of [barwa, krycie, ...liczby]) { p.addEventListener('input', () => podejrzyj(zloz())); p.addEventListener('change', () => ustaw(zloz())); }
      pole = el('span', { klasa: 'ust-para' }, barwa, pod(d.nazwa, 'krycie'), krycie, pod(d.nazwa, 'x'), liczby[0], pod(d.nazwa, 'y'), liczby[1], pod(d.nazwa, 'rozmycie'), liczby[2]);
    } else if (d.typ === 'kroj') {
      // krój: rodzina jak w CSS i grubość; osie kroju zmiennego zostają, jakie były (zmiana osi ruchem, opis pod /ustawienia)
      const rodzina = el('input', { type: 'text', value: typeof obiekt.rodzina === 'string' ? obiekt.rodzina : '', 'aria-label': d.nazwa + ' (rodzina)', disabled: nieczynne });
      const grubosc = el('input', { type: 'number', min: '1', max: '1000', step: '10', value: obiekt.grubosc === undefined ? '' : String(obiekt.grubosc), placeholder: 'grubość', 'aria-label': d.nazwa + ' (grubość)', disabled: nieczynne });
      const zloz = () => ({ rodzina: rodzina.value, ...(grubosc.value !== '' && Number.isFinite(Number(grubosc.value)) ? { grubosc: Number(grubosc.value) } : {}), ...(obiekt.osie ? { osie: obiekt.osie } : {}), ...(obiekt.plik ? { plik: obiekt.plik } : {}) });
      for (const p of [rodzina, grubosc]) p.addEventListener('change', () => { if (rodzina.value.trim()) ustaw(zloz()); });
      // Krój z pliku: bajty wchodzą do Miejsca jako plik (rzecz plik/1), a wartość kroju przypina jego wersję odciskiem.
      const wgraj = el('input', { type: 'file', accept: '.woff2,.woff,.ttf,.otf', 'aria-label': d.nazwa + ' (plik kroju)', disabled: nieczynne });
      wgraj.addEventListener('change', async () => {
        const f = wgraj.files && wgraj.files[0];
        const typ = f && modulKrojow ? modulKrojow.typKroju(f.name) : null;
        if (!f || !typ) { komunikat('Plik kroju ma mieć rozszerzenie woff2, woff, ttf albo otf.', true); return; }
        try {
          const o = await fetch('/api/srodowisko/bajty?op=' + nowyOp(), { method: 'POST', headers: naglowki({ 'content-type': typ, 'x-cialo': 'strona gospodarza' }), body: await f.arrayBuffer() });
          const z = await o.json().catch(() => null);
          if (!o.ok || !z || z.ok === false) { komunikat((z && z.blad) || 'Drzwi odpowiedziały: ' + o.status, true); return; }
          const nazwa = f.name.replace(/\.[^.]+$/, '');
          const rz = await ruch({ co: 'poloz', rodzaj: 'plik/1', cechy: { nazwa, typ, rozmiar: z.rozmiar, tresc: z.zapis } }, 'Plik kroju zapisany: ' + nazwa + '.');
          if (!rz || rz.skutek === 'propozycja' || !rz.rzecz) return;
          const stara = zloz();
          await ustaw({ ...stara, rodzina: '"' + nazwa.replace(/["\\]/g, '') + '", ' + (stara.rodzina || 'sans-serif'), plik: { rzecz: rz.rzecz, odcisk: z.zapis } });
        } catch (blad) { komunikat('Nie udało się wgrać pliku: ' + blad.message, true); }
      });
      const bezPliku = obiekt.plik && klucz ? el('button', { tekst: 'bez pliku', title: 'Zostaw rodzinę i grubość, przestań brać krój z pliku', klik: () => { const w = zloz(); return ustaw({ rodzina: w.rodzina, ...(w.grubosc !== undefined ? { grubosc: w.grubosc } : {}), ...(w.osie ? { osie: w.osie } : {}) }); } }) : null;
      pole = el('span', { klasa: 'ust-para' }, rodzina, grubosc, obiekt.plik ? pod(d.nazwa, 'z pliku ' + String(obiekt.plik.odcisk).slice(0, 8)) : pod(d.nazwa, 'plik:'), wgraj, bezPliku);
    } else if (d.typ === 'sprezyna') {
      const czas = el('input', { type: 'range', min: '0', max: '2000', step: '10', value: String(Number(obiekt.czas) || 0), 'aria-label': d.nazwa + ' (czas)', disabled: nieczynne });
      const odbicie = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: String(Number(obiekt.odbicie) || 0), 'aria-label': d.nazwa + ' (odbicie)', disabled: nieczynne });
      const zloz = () => ({ czas: Number(czas.value) || 0, odbicie: Math.max(0, Math.min(1, Number(odbicie.value) || 0)) });
      for (const p of [czas, odbicie]) { p.addEventListener('input', () => podejrzyj(zloz())); p.addEventListener('change', () => ustaw(zloz())); }
      pole = el('span', { klasa: 'ust-para' }, pod(d.nazwa, 'jak szybko'), czas, pod(d.nazwa, 'jak odbija'), odbicie);
    } else { pole = el('input', { type: 'text', value: String(w0), ...cechy }); pole.addEventListener('change', () => ustaw(pole.value)); }
    return pole;
  }
  function rysujUstawienia() {
    const pudlo = $('ustawienia');
    if (!pudlo || !ust || !Array.isArray(ust.deklaracje)) return;
    const otwarte = new Set([...pudlo.querySelectorAll('details[open]')].map((x) => x.dataset.grupa));
    const grupy = new Map();
    for (const d of ust.deklaracje) { const g = d.grupa || 'Inne'; if (!grupy.has(g)) grupy.set(g, []); grupy.get(g).push(d); }
    const wiersz = (d) => {
      const x = ust.wartosci[d.nazwa] || { wartosc: d.domyslna, skad: 'domyslna' };
      const skad = (x.skad === 'wartosc' ? 'ustawione' : x.skad === 'zestaw' ? 'z zestawu ' + x.zestaw : x.skad === 'brak' ? 'brak wartości' : 'domyślne') + (x.z ? ', idzie za ' + x.z : '');
      return el('li', { klasa: 'ust-wiersz' },
        el('div', { klasa: 'ust-opis' }, el('code', { tekst: d.nazwa }), el('span', { klasa: 'bok', tekst: ' ' + skad }), el('p', { tekst: d.opis })),
        el('div', { klasa: 'ust-pole' }, PROSTE.includes(d.typ) ? poleUstawienia(d, x) : el('a', { href: '/ustawienia', tekst: 'typ ' + d.typ + ': zmiana ruchem, opis pod /ustawienia' }),
          x.skad === 'wartosc' && klucz ? el('button', { tekst: 'wróć', title: 'Odłóż tę wartość: wraca odziedziczona albo domyślna', klik: () => { pelneOdRazu = true; return ruch({ co: 'odloz', rzecz: x.rzecz, wersja: 'dowolna', powod: 'powrót do wartości odziedziczonej' }, 'Wróciła wartość odziedziczona: ' + d.nazwa + '.'); } }) : null));
    };
    pudlo.textContent = '';
    pudlo.append(el('h2', {}, 'Ustawienia: wygląd i odczucie ', el('span', { klasa: 'ile', tekst: String(ust.deklaracje.length) })),
      el('p', { klasa: 'bok', tekst: (klucz ? 'Zmiana to zapis w Miejscu z Twoim imieniem; widać ją od razu tu, na Starcie i w oknach narzędzi. W trakcie kręcenia widzisz podgląd, zapis idzie przy puszczeniu.' : 'Żeby stroić, wejdź (guzik "Wejdź" na górze).') + (bezpiecznie ? ' Tryb bezpieczny: ta strona pokazuje wygląd domyślny.' : '') }),
      el('p', { klasa: 'bok' }, bezpiecznie ? el('a', { href: location.pathname, tekst: 'Wróć do wyglądu z Miejsca' }) : el('a', { href: '?bezpiecznie', tekst: 'Wygląd domyślny' }), ' (wyjście z każdego nieczytelnego wyglądu; ten sam guzik stoi u góry strony).'),
      ...(Array.isArray(ust.uwagi) ? ust.uwagi.map((u) => el('p', { klasa: 'bok', tekst: u })) : []),
      ...[...grupy].map(([g, lista]) => { const det = el('details', { open: otwarte.has(g) ? true : null }, el('summary', {}, g + ' ', el('span', { klasa: 'ile', tekst: String(lista.length) })), el('ul', { klasa: 'lista ust' }, lista.map(wiersz))); det.dataset.grupa = g; return det; }));
    pudlo.hidden = false;
  }
  import('/oko.mjs').then((m) => { modulOka = m; }).catch(() => { /* bez tego modułu słowo idzie bez stanu oka */ });
  import('/okna.mjs').then((m) => { modulOkien = m; wrocOkna(); }).catch(() => { /* bez tego modułu żadne okno nie wraca samo */ });
  import('/kroje.mjs').then((m) => { modulKrojow = m; zastosujWyglad(); }).catch(() => { /* bez tego modułu kroje zostają przy rodzinach, które urządzenie już ma */ });
  import('/pokretla.mjs').then((m) => {
    modulPokretel = m;
    P = new m.Pokretla({ bezpiecznie, naZmiane: zastosujWyglad });
    podglad = m.polaczPodglad(P);
    zastosujWyglad();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', zastosujWyglad);
    // Widoczne wyjście do wyglądu domyślnego i z powrotem: stałe barwy (srodowisko.css), nie barwy motywu.
    const gora = document.querySelector('header.gora');
    if (gora) gora.append(el('a', { klasa: 'wyjscie', href: bezpiecznie ? location.pathname : '?bezpiecznie', tekst: bezpiecznie ? '◑' : '◐', title: bezpiecznie ? 'Wróć do wyglądu z Miejsca' : 'Wygląd domyślny: wyjście z każdego nieczytelnego wyglądu', 'aria-label': bezpiecznie ? 'Wróć do wyglądu z Miejsca' : 'Wygląd domyślny' }));
    odswiezUstawienia();
  }).catch(() => { /* bez tablicy pokręteł strona zostaje przy stylu z pliku */ });

  // --- czytanie: całość raz, potem tylko zmiany -------------------------------------------------------------------
  const powiedzGosciom = () => { for (const o of okna.values()) if (o.chce.includes('rzeczy') && o.ramka.contentWindow) o.ramka.contentWindow.postMessage({ jaskinia: 1, type: 'changed', akt }, '*'); };
  const OPIS_NAJCZESCIEJ_MS = 15000;
  const RODZAJE_OPISU = ['propozycja/1', 'prosba/1', 'obszar/1', 'ksztalt/1', 'uczestnik/1', 'gosc/1', 'zdolnosc/1'];
  let opisCzytany = 0, opisZalegly = null;
  async function odswiez() {
    const [o, s] = await Promise.all([czytaj('/api/srodowisko/opis'), czytaj('/api/srodowisko/spis')]);
    opisCzytany = Date.now();
    // spis przychodzi kawałkami po 1000; czytamy do końca, żeby strona nie udawała, że pierwszy kawałek to wszystko
    const wszystkie = s.rzeczy;
    for (let kawalek = s; !kawalek.wszystko && wszystkie.length < 20000;) { kawalek = await czytaj('/api/srodowisko/spis?pomin=' + wszystkie.length); wszystkie.push(...kawalek.rzeczy); if (!kawalek.rzeczy.length) break; }
    const byl = akt;
    // Akt strony to starszy z dwóch odczytów: jeśli między nimi coś się zmieniło, następne doganianie to doczyta.
    opis = o; rzeczy = wszystkie; akt = Math.min(o.miejsce.akt, Number.isInteger(s.akt) ? s.akt : o.miejsce.akt);
    if (!widziany) { widziany = akt; localStorage.setItem(PAMIEC, String(akt)); }
    rysuj();
    wrocOkna();
    if (byl && byl !== akt) powiedzGosciom();
  }
  // Doganianie: strona czyta opis i tylko te rzeczy, które zmieniły się po jej akcie (razem z odłożonymi, żeby je
  // zdjąć). Zmierzone 17 XI: czytanie całego spisu po każdej zmianie kosztowało przy 636 rzeczach tysiące wierszy bazy.
  async function dogon() {
    if (!opis) return odswiez();
    const od = akt;
    const s = await czytaj('/api/srodowisko/spis?odlozone=razem&po=' + od);
    // Miejsce cofnęło się (wwóz całości) albo zmian jest więcej niż jeden kawałek: wtedy uczciwiej przeczytać wszystko.
    if (!s.wszystko || !Number.isInteger(s.akt) || s.akt < od) return odswiez();
    if (s.rzeczy.length) {
      const zmienione = new Set(s.rzeczy.map((r) => r.id));
      rzeczy = [...s.rzeczy.filter((r) => !r.odlozone), ...rzeczy.filter((r) => !zmienione.has(r.id))];
    }
    // Opis Miejsca jest najdroższym czytaniem, a po każdej zmianie czytała go każda otwarta strona (dowody środowiska,
    // fala 9, punkt D). Od razu czytamy go tylko wtedy, gdy zmieniło się to, na co ręka ma odpowiedzieć, albo to,
    // z czego opis jest zbudowany (obszary, kształty, uczestnicy, goście, stan budowy). Przy każdej innej zmianie
    // strona pokazuje rzeczy z różnicy od razu, a opis doczytuje najwyżej raz na kilkanaście sekund.
    const pilne = s.rzeczy.some((r) => RODZAJE_OPISU.includes(r.rodzaj));
    if (pilne || Date.now() - opisCzytany >= OPIS_NAJCZESCIEJ_MS) {
      clearTimeout(opisZalegly); opisZalegly = null;
      const o = await czytaj('/api/srodowisko/opis');
      opisCzytany = Date.now();
      if (o.miejsce.akt < od) return odswiez();
      opis = o; akt = Math.min(o.miejsce.akt, s.akt);
    } else {
      akt = s.akt;
      if (!opisZalegly) opisZalegly = setTimeout(() => {
        opisZalegly = null;
        czytaj('/api/srodowisko/opis').then((o) => { opisCzytany = Date.now(); if (o.miejsce.akt >= akt) { opis = o; rysuj(); } }).catch(() => { /* następna zmiana spróbuje znowu */ });
      }, Math.max(500, OPIS_NAJCZESCIEJ_MS - (Date.now() - opisCzytany)));
    }
    rysuj();
    if (akt !== od) powiedzGosciom();
  }
  // Sygnały o zmianie przychodzą seriami (agent robi dziesiątki ruchów): jedno doganianie naraz, a to, co przyszło
  // w trakcie, załatwia jedno następne. Niewidoczna karta nie czyta wcale; dogoni, gdy wróci na wierzch.
  let goni = false, znowu = false, zalegle = false, zegarGonienia = null;
  function zaplanujDogonienie(ms = 250) {
    if (document.visibilityState !== 'visible') { zalegle = true; return; }
    if (goni) { znowu = true; return; }
    clearTimeout(zegarGonienia);
    zegarGonienia = setTimeout(async () => {
      goni = true;
      try { await dogon(); } catch { /* następny sygnał albo puls spróbuje jeszcze raz */ }
      goni = false;
      if (znowu) { znowu = false; zaplanujDogonienie(400); }
    }, ms);
  }

  // --- kanał na żywo: Miejsce samo mówi, że coś się zmieniło i kto tu jest ----------------------------------------
  // Połączenie niesie sam numer ostatniego aktu i obecność; treść strona doczytuje zwykłymi drzwiami. Gdy połączenie
  // nie stoi, strona wraca do pytania o puls co kilka sekund i próbuje połączyć się ponownie, coraz rzadziej.
  const CICHO = 'jaskinia:srodowisko:cicho';
  let cicho = localStorage.getItem(CICHO) === 'tak';
  let gniazdo = null, zywe = false, proba = 0, zegarPolaczenia = null, zegarPing = null, czekaNaPong = null, zlyKlucz = null;
  const stanObecnych = { lista: [], ilu: null };
  const doKanalu = (w) => {
    if (!gniazdo || gniazdo.readyState !== 1) return false;
    try { gniazdo.send(typeof w === 'string' ? w : JSON.stringify(w)); return true; } catch { return false; }
  };
  function rysujStan() {
    if (!opis) return;
    const d = opis, ja = d.czytasz_jako.imie;
    const inni = stanObecnych.lista.filter((x) => x && x.kto !== ja);
    let tu = '';
    if (inni.length) tu = ' · są też: ' + inni.map((x) => x.kto + (x.przy && rzeczO(x.przy) ? ' (przy: ' + rzeczO(x.przy).tytul.slice(0, 30) + ')' : '')).join(', ');
    else if (stanObecnych.ilu) tu = ' · z kluczem jest tu: ' + stanObecnych.ilu;
    const s = $('stan');
    s.textContent = `${lp(d.razem, 'rzecz', 'rzeczy', 'rzeczy')} · akt ${d.miejsce.akt} · ${ja || 'zwiedzający'} · ${zywe ? 'na żywo' : 'bez połączenia na żywo'}${tu}`;
    s.title = zywe ? 'Połączenie stoi: zmiany przychodzą same, strona o nic nie pyta.' : 'Połączenie na żywo nie stoi: strona pyta o zmiany co kilka sekund i próbuje połączyć się ponownie.';
  }
  // Przy której rzeczy jestem: otwarta karta rzeczy albo widoczne okno projektu czy gościa. Idzie do kanału tylko
  // wtedy, gdy się zmienia i gdy mnie widać.
  let ostatniePrzy;
  const ID_Z_KLUCZA = /^[pg]:([0-9a-z]{26})/;
  function terazPrzy() {
    if (kr.id) return kr.id;
    for (const o of okna.values()) { if (o.sekcja.hidden) continue; const m = ID_Z_KLUCZA.exec(o.klucz || ''); if (m) return m[1]; }
    return null;
  }
  function powiedzPrzy() {
    if (cicho || !klucz) return;
    const p = terazPrzy();
    if (p === ostatniePrzy) return;
    if (doKanalu({ t: 'przy', rzecz: p })) ostatniePrzy = p;
  }
  // Przeglądarka nie umie dołączyć klucza do otwarcia połączenia, więc przedstawia się pierwszą wiadomością.
  function przedstawSieKanalowi() {
    ostatniePrzy = undefined;
    if (!klucz) { doKanalu({ t: 'wychodze' }); return; }
    if (klucz !== zlyKlucz) doKanalu({ t: 'jestem', klucz, cicho });
  }
  // Wyłącznik obecności: uczestnik dalej słyszy zmiany, ale inni nie widzą, że tu jest ani przy czym.
  function rysujWidac(wSrodku) {
    let g = $('widac');
    if (!g) {
      g = el('button', { id: 'widac', type: 'button', klik: () => {
        cicho = !cicho;
        localStorage.setItem(CICHO, cicho ? 'tak' : 'nie');
        doKanalu({ t: 'cicho', cicho });
        ostatniePrzy = undefined;
        powiedzPrzy();
        rysujWidac(true);
      } });
      $('wejscie').after(g);
    }
    g.hidden = !wSrodku;
    g.textContent = cicho ? 'nie widać mnie' : 'widać mnie';
    g.setAttribute('aria-pressed', cicho ? 'false' : 'true');
    g.title = cicho ? 'Inni uczestnicy nie widzą, że tu jesteś. Dotknij, żeby było Cię widać.' : 'Inni uczestnicy (z kluczem) widzą, że tu jesteś i przy której rzeczy. Dotknij, żeby się schować.';
  }
  function ustawZywe(tak) { zywe = tak; if (!tak) { stanObecnych.lista = []; stanObecnych.ilu = null; } rysujStan(); }
  function zaplanujPolaczenie(najmniej = 0) {
    clearTimeout(zegarPolaczenia);
    const ms = Math.max(najmniej, Math.min(60000, 1000 * 2 ** Math.min(proba, 6)) * (0.7 + Math.random() * 0.6));
    proba++;
    zegarPolaczenia = setTimeout(polacz, ms);
  }
  function pingKanalu() {
    if (document.visibilityState !== 'visible' || czekaNaPong) return;
    if (!doKanalu('ping')) return;
    czekaNaPong = setTimeout(() => { czekaNaPong = null; try { if (gniazdo) gniazdo.close(); } catch { /* i tak zamknięte */ } }, 10000);
  }
  function polacz() {
    clearTimeout(zegarPolaczenia);
    if (gniazdo || !('WebSocket' in window)) return;
    if (document.visibilityState !== 'visible') return; // niewidoczna karta połączy się, gdy wróci na wierzch
    let g;
    try { g = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/srodowisko/zywe'); } catch { zaplanujPolaczenie(); return; }
    gniazdo = g;
    g.addEventListener('open', () => {
      if (gniazdo !== g) return;
      proba = 0;
      ustawZywe(true);
      przedstawSieKanalowi();
      clearInterval(zegarPing);
      zegarPing = setInterval(pingKanalu, 45000);
    });
    g.addEventListener('message', (e) => {
      if (gniazdo !== g) return;
      if (e.data === 'pong') { clearTimeout(czekaNaPong); czekaNaPong = null; return; }
      let m = null;
      try { m = JSON.parse(e.data); } catch { return; }
      if (!m || typeof m !== 'object') return;
      if (m.t === 'witaj') powiedzPrzy();
      if (m.t === 'akt' || m.t === 'witaj') {
        if (m.calosc) odswiez().catch(() => {});
        else if (Number.isInteger(m.akt) && m.akt !== akt) zaplanujDogonienie();
      } else if (m.t === 'obecni') {
        stanObecnych.lista = Array.isArray(m.lista) ? m.lista.filter((x) => x && typeof x.kto === 'string') : [];
        stanObecnych.ilu = Number.isInteger(m.ilu) ? m.ilu : null;
        rysujStan();
      }
    });
    g.addEventListener('close', (e) => {
      if (gniazdo !== g) return;
      gniazdo = null;
      clearInterval(zegarPing);
      clearTimeout(czekaNaPong); czekaNaPong = null;
      ustawZywe(false);
      // 4401: Miejsce nie zna tego klucza (nie wysyłamy go drugi raz); 4429 i 4503: za dużo wiadomości albo połączeń
      if (e.code === 4401) zlyKlucz = klucz;
      zaplanujPolaczenie(e.code === 4429 || e.code === 4503 ? 60000 : 0);
    });
    g.addEventListener('error', () => { try { g.close(); } catch { /* i tak zamknięte */ } });
  }

  // Bez połączenia na żywo: gdy karta jest widoczna, co kilka sekund pytamy o numer ostatniego aktu.
  let czeka = 5000;
  async function puls() {
    if (!zywe && document.visibilityState === 'visible') {
      try {
        const p = await czytaj('/api/srodowisko/puls');
        if (p.akt !== akt) { await dogon(); czeka = 5000; } else czeka = Math.min(30000, czeka + 1000);
      } catch { czeka = 30000; }
    }
    setTimeout(puls, zywe ? 5000 : czeka);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    czeka = 5000;
    if (!gniazdo) { proba = 0; polacz(); }
    if (zalegle) { zalegle = false; zaplanujDogonienie(0); }
  });
  // Adres z #rzecz=<id> otwiera od razu kartę tej rzeczy: tak Start odsyła do pełnej karty (cechy, historia).
  const kartaZAdresu = () => { const m = /^#rzecz=([0-9a-z]{26})$/.exec(location.hash); if (m && opis) otworzKarte(m[1], null); };
  addEventListener('hashchange', kartaZAdresu);
  odswiez().then(() => { polacz(); setTimeout(puls, czeka); kartaZAdresu(); }, (blad) => { $('tresc').textContent = ''; $('tresc').append(el('p', { klasa: 'uwaga', tekst: 'Nie udało się przeczytać Miejsca: ' + blad.message })); $('stan').textContent = 'brak połączenia'; });
})();
