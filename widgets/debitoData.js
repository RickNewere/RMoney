// Data source for the home screen widget.
//
// The widget runs in a headless JS task, outside the WebView, so it cannot
// reuse anything from the web app: it talks to the Apps Script backend itself.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, TABS } from '../config';

// The Apps Script URL changes every time a "Nuova distribuzione" is made, and
// an URL baked into the APK would leave the widget dead until the next build.
// So it is resolved at runtime from a small file published next to the web app,
// and API_URL is only the fallback for when that file cannot be reached.
const API_CONFIG_URL = 'https://ricknewere.github.io/RMoney/api.json';

const CACHE_KEY = 'DebitoWidget:ultimo';

// Misurato sul backend vero: la lettura in euro impiega ~3 s, quella in franchi
// ~10 s. Con 12 s di tetto la seconda arrivava al limite e veniva abortita.
const TIMEOUT_MS = 25000;
const TENTATIVI = 2;

// Versione del formato salvato in cache. Va alzata ogni volta che cambiano i
// campi di una voce: senza, dopo un aggiornamento dell'app il widget ripescava
// una voce vecchia priva dei campi nuovi e finiva per disegnare caselle vuote.
const CACHE_V = 2;

// The debt is computed per currency: the two sheets of the same currency are
// compared against each other, euro and franchi never mix.
const COPPIE = [
  { valuta: 'Euro', simbolo: '€', gid: TABS.Riccardo.Euro, gidPartner: TABS.Roberta.Euro },
  { valuta: 'Franchi', simbolo: 'CHF', gid: TABS.Riccardo.Franchi, gidPartner: TABS.Roberta.Franchi },
];

// Both sheets are read from Riccardo's side, so a positive net means Roberta
// owes him and a negative one means the opposite.
const PERSONA = 'Riccardo';
const PARTNER = 'Roberta';

export async function unaVolta(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Apps Script ogni tanto risponde con una pagina HTML al posto del JSON, e il
// tentativo successivo va a buon fine. Senza ritenti quell'unico inciampo
// lascerebbe il widget fermo sul dato vecchio per mezz'ora.
export async function chiedi(url) {
  let ultimo;
  for (let i = 0; i < TENTATIVI; i++) {
    try {
      console.log('[RMoney] rete: tentativo ' + (i + 1) + ' ' + url.slice(-42));
      const r = await unaVolta(url);
      console.log('[RMoney] rete: ok');
      return r;
    } catch (e) {
      console.log('[RMoney] rete: fallito (' + e.message + ')');
      ultimo = e;
      // Pausa lunga prima di riprovare: quando Apps Script risponde con una
      // pagina invece dei dati e' perche' e' congestionato, e ributtarsi subito
      // peggiora la coda. Dopo due minuti di respiro tornava a rispondere in
      // 6,9 s contro i 33 s sotto pressione.
      if (i < TENTATIVI - 1) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw ultimo;
}

// Un solo tentativo, con timeout corto: questa lettura ha gia' un ripiego
// buono (API_URL), quindi insistere qui aggiungerebbe solo attesa prima di
// arrivare ai dati veri.
let apiInMemoria = null;

export async function risolviApi() {
  // Una volta sola per processo: l'URL cambia quando si fa una nuova
  // distribuzione, non fra un aggiornamento e l'altro.
  if (apiInMemoria) return apiInMemoria;
  try {
    const j = await unaVolta(API_CONFIG_URL + '?t=' + Date.now(), 5000);
    if (j && typeof j.exec === 'string' && j.exec.indexOf('/exec') > 0) {
      apiInMemoria = j.exec;
      return apiInMemoria;
    }
  } catch (e) {
    // offline, or the file is not published: the baked in URL still works as
    // long as that deployment has not been archived.
  }
  return API_URL;
}

// Compone una valuta partendo dai totali dei quattro fogli.
function componiVoce(fogli, c) {
  const mio = fogli[String(c.gid)];
  const suo = fogli[String(c.gidPartner)];
  if (!mio || !suo) throw new Error('Totali mancanti per ' + c.valuta + '.');

  const netto = (Number(mio.meta) || 0) - (Number(suo.meta) || 0);
  // Chi deve dare i soldi all'altro. Sotto il centesimo si considera pari.
  const pari = Math.abs(netto) < 0.005;
  const debitore = pari ? null : (netto > 0 ? PARTNER : PERSONA);
  const creditore = debitore === PERSONA ? PARTNER : PERSONA;

  return {
    valuta: c.valuta,
    simbolo: c.simbolo,
    importo: Math.abs(netto),
    debitore: debitore,
    // Due versioni: quale usare lo decide il widget in base alla larghezza
    // effettiva, perche' in un 2x2 la frase intera non ci sta.
    frase: pari ? 'siete in pari' : debitore + ' deve a ' + creditore,
    fraseCorta: pari ? 'in pari' : debitore + ' deve',
  };
}

// Ultimo valore salvato, o null. Anche la lettura ha un tetto: un modulo nativo
// che non risponde bloccherebbe il disegno invece di far ripiegare sul vuoto.
export async function leggiCacheDebito() {
  return leggiCache();
}

async function leggiCache() {
  try {
    const grezzo = await Promise.race([
      AsyncStorage.getItem(CACHE_KEY),
      new Promise((_, no) => setTimeout(() => no(new Error('cache lenta')), 3000)),
    ]);
    if (!grezzo) return null;
    const dati = JSON.parse(grezzo);
    // Una cache di un formato precedente si scarta: meglio lo stato vuoto, che
    // invita a toccare, di una schermata disegnata a meta'.
    return (dati && dati.v === CACHE_V && dati.voci) ? dati : null;
  } catch (e) {
    return null;
  }
}

// Una sola lettura per volta, condivisa da tutti quelli che la chiedono.
//
// Le sorgenti che aggiornano il widget sono piu' di una (avvio dell'app, uscita
// dall'app, lavoro periodico, tocco, e il widget grande che vuole gli stessi
// dati) e capitano insieme. Senza questo si aprivano piu' letture in parallelo
// che, sommate alla serializzazione di Apps Script, si abortivano a vicenda:
// nei log si vedevano due serie identiche di tentativi finite tutte in
// "Aborted". Chi arriva mentre una lettura e' in corso aspetta quella.
let inCorso = null;

export function leggiDebito() {
  if (!inCorso) {
    inCorso = leggiDebitoOra();
    inCorso.then(
      function () { inCorso = null; },
      function () { inCorso = null; }
    );
  }
  return inCorso;
}

// Sempre risolta: se la rete non risponde ripiega sull'ultimo valore salvato,
// perche' un widget che mostra un numero vecchio e' piu' utile di uno vuoto.
async function leggiDebitoOra() {
  try {
    console.log('[RMoney] leggo: risolvo api');
    const api = await risolviApi();
    console.log('[RMoney] leggo: api risolta');

    // UNA RICHIESTA SOLA per tutte e due le valute (?action=debiti).
    //
    // Prima era una per valuta, in sequenza. Sequenza e non parallelo era gia'
    // corretto (Apps Script serializza le richieste dello stesso utente, e
    // lanciarle insieme le fa scadere a vicenda), ma restavano due giri, e
    // all'avvio dell'app si sommavano a quelli della pagina: nel log del
    // telefono la lettura dell'euro e' fallita due volte con "Aborted" mentre
    // quella dei franchi passava. Con una richiesta sola il problema non si
    // pone, e il backend apre il foglio una volta invece di due.
    const j = await chiedi(api + '?action=debiti');
    if (!j || !j.ok || !j.fogli) throw new Error('Risposta inattesa dal backend.');

    const voci = [];
    for (const c of COPPIE) {
      voci.push(componiVoce(j.fogli, c));
    }
    console.log('[RMoney] leggo: debiti letti (' + voci.length + ')');
    const dati = { v: CACHE_V, voci: voci, aggiornato: Date.now(), vecchio: false };
    // La scrittura in cache non deve poter bloccare il disegno: se il modulo
    // nativo non risponde, il widget resterebbe appeso per sempre invece di
    // mostrare i dati che ha gia' in mano.
    try {
      await Promise.race([
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(dati)),
        new Promise((_, no) => setTimeout(() => no(new Error('cache lenta')), 3000)),
      ]);
      console.log('[RMoney] leggo: cache scritta');
    } catch (e) {
      console.log('[RMoney] leggo: cache non scritta (' + e.message + ')');
    }
    return dati;
  } catch (e) {
    console.log('[RMoney] leggo: fallito (' + e.message + '), uso la cache');
    const dati = await leggiCache();
    if (dati) { dati.vecchio = true; return dati; }
    return { voci: null, aggiornato: null, vecchio: true };
  }
}

// Stesso formato della web app, cifra per cifra. In italiano il punto delle
// migliaia compare solo da 10.000 in su (CLDR usa minimumGroupingDigits=2), ed
// e' quello che fa toLocaleString('it-IT') nell'app: 1165.86 -> "1165,86",
// 12345.67 -> "12.345,67". La regola e' scritta a mano invece di usare
// toLocaleString perche' qui gira in un task headless, dove non si puo' dare
// per scontato il supporto Intl completo.
export function formattaImporto(n) {
  const parti = Number(n).toFixed(2).split('.');
  const intera = parti[0].length >= 5
    ? parti[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    : parti[0];
  return intera + ',' + parti[1];
}

export function formattaOra(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const due = (x) => (x < 10 ? '0' + x : '' + x);
  return due(d.getHours()) + ':' + due(d.getMinutes());
}
