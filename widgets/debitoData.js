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
const TIMEOUT_MS = 12000;

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
  for (let i = 0; i < 3; i++) {
    try {
      return await unaVolta(url);
    } catch (e) {
      ultimo = e;
      if (i < 2) await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
  }
  throw ultimo;
}

// Un solo tentativo, con timeout corto: questa lettura ha gia' un ripiego
// buono (API_URL), quindi insistere qui aggiungerebbe solo attesa prima di
// arrivare ai dati veri.
export async function risolviApi() {
  try {
    const j = await unaVolta(API_CONFIG_URL + '?t=' + Date.now(), 5000);
    if (j && typeof j.exec === 'string' && j.exec.indexOf('/exec') > 0) return j.exec;
  } catch (e) {
    // offline, or the file is not published: the baked in URL still works as
    // long as that deployment has not been archived.
  }
  return API_URL;
}

async function leggiCoppia(api, c) {
  const j = await chiedi(
    api + '?action=debito&gid=' + c.gid + '&gidPartner=' + c.gidPartner
  );
  if (!j || !j.ok || !j.debito) throw new Error('Risposta inattesa dal backend.');

  const netto = Number(j.debito.netto) || 0;
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

// Sempre risolta: se la rete non risponde ripiega sull'ultimo valore salvato,
// perche' un widget che mostra un numero vecchio e' piu' utile di uno vuoto.
export async function leggiDebito() {
  try {
    const api = await risolviApi();
    // In parallelo: le due valute sono indipendenti e Promise.all conserva
    // l'ordine. In sequenza il widget ci metteva il doppio, e su un tocco
    // "aggiorna" l'attesa si vede.
    const voci = await Promise.all(COPPIE.map((c) => leggiCoppia(api, c)));
    const dati = { v: CACHE_V, voci: voci, aggiornato: Date.now(), vecchio: false };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(dati));
    return dati;
  } catch (e) {
    try {
      const cache = await AsyncStorage.getItem(CACHE_KEY);
      if (cache) {
        const dati = JSON.parse(cache);
        // Una cache di un formato precedente si scarta: meglio lo stato vuoto,
        // che invita a toccare, di una schermata disegnata a meta'.
        if (dati && dati.v === CACHE_V && dati.voci) {
          dati.vecchio = true;
          return dati;
        }
      }
    } catch (e2) {
      // cache illeggibile: si mostra lo stato vuoto
    }
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
