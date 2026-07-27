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

async function chiedi(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function risolviApi() {
  try {
    const j = await chiedi(API_CONFIG_URL + '?t=' + Date.now());
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
    // Frase intera: "Riccardo deve" da solo non dice a chi, e nel widget lo
    // spazio in orizzontale c'e'.
    frase: pari ? 'siete in pari' : debitore + ' deve a ' + creditore,
  };
}

// Sempre risolta: se la rete non risponde ripiega sull'ultimo valore salvato,
// perche' un widget che mostra un numero vecchio e' piu' utile di uno vuoto.
export async function leggiDebito() {
  try {
    const api = await risolviApi();
    const voci = [];
    for (const c of COPPIE) voci.push(await leggiCoppia(api, c));
    const dati = { voci: voci, aggiornato: Date.now(), vecchio: false };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(dati));
    return dati;
  } catch (e) {
    try {
      const cache = await AsyncStorage.getItem(CACHE_KEY);
      if (cache) {
        const dati = JSON.parse(cache);
        dati.vecchio = true;
        return dati;
      }
    } catch (e2) {
      // cache illeggibile: si mostra lo stato vuoto
    }
    return { voci: null, aggiornato: null, vecchio: true };
  }
}

// Formato italiano, con il punto per le migliaia: 1165.86 -> "1.165,86".
// Senza separatore un importo a quattro cifre nel widget si legge male.
export function formattaImporto(n) {
  const parti = Number(n).toFixed(2).split('.');
  const intera = parti[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return intera + ',' + parti[1];
}

export function formattaOra(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const due = (x) => (x < 10 ? '0' + x : '' + x);
  return due(d.getHours()) + ':' + due(d.getMinutes());
}
