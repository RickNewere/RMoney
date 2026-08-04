import { requestWidgetUpdate } from 'react-native-android-widget';
import { componiWidget, NOMI_WIDGET } from './disegna';
import { leggiCacheDebito, leggiDebito } from './debitoData';

// Aggiorna tutti i widget piazzati sulla home.
//
// requestWidgetUpdate() risolve appena ha LANCIATO i disegni, non quando sono
// finiti: dentro la libreria c'e' un forEach con callback async, quindi un
// errore nel disegno diventa una promise rifiutata che nessuno raccoglie e
// sparisce. E' per questo che l'app registrava "widget aggiornato" mentre sulla
// home il widget restava fermo da ore. Qui si tracciano le fasi una per una,
// cosi' un fallimento e' visibile invece che silenzioso.
// Un aggiornamento per volta. Avvio dell'app, uscita, lavoro periodico e tocco
// possono capitare a distanza di un istante: senza questa guardia partivano
// letture sovrapposte che si ostacolavano a vicenda.
let inCorso = null;
let inizioCorso = 0;
let ultimo = 0;

// Oltre questo tempo un aggiornamento "in corso" si considera piantato.
//
// Senza questo limite la guardia anti-sovrapposizione si trasformava nel guasto
// peggiore possibile: bastava che una lettura non si concludesse mai perche'
// inCorso restasse pieno per sempre, e da quel momento OGNI aggiornamento
// successivo veniva scartato. Nel log si leggeva "aggiornamento gia' in corso,
// salto: lavoro periodico" mentre il widget restava fermo per ore.
//
// Il tetto e' generoso rispetto ai tempi veri (euro ~3 s, franchi ~10 s, piu'
// i ritentativi): serve solo a impedire il blocco permanente.
const SCADENZA_CORSO_MS = 120000;

// Distanza minima fra due aggiornamenti spontanei. Apre e chiudi l'app e sono
// gia' due letture a pochi secondi l'una dall'altra; sommate al lavoro
// periodico bastavano a congestionare Apps Script, che sotto carico smette di
// rispondere con JSON e restituisce pagine di errore (misurato: 2,7 s la prima
// lettura, 19 s e poi 33 s le successive, entrambe pagine HTML).
const DISTANZA_MIN_MS = 10 * 60 * 1000;

// Motivi che saltano la distanza minima: sono richieste esplicite o segnalano
// che il foglio e' appena cambiato, quindi il dato vecchio e' sicuramente
// sbagliato e vale la richiesta in piu'.
// "avvio" e' incluso apposta: aprire l'app e' un gesto voluto, tipicamente
// perche' si vuole vedere il dato aggiornato (per esempio dopo aver inserito
// una spesa dall'iPhone). Con la distanza minima applicata anche li', il widget
// poteva restare indietro proprio nel momento in cui lo si stava guardando.
const SEMPRE = ['scrittura sul foglio', 'tocco', 'avvio'];

export function aggiornaWidget(motivo) {
  if (inCorso) {
    const da = Date.now() - inizioCorso;
    if (da < SCADENZA_CORSO_MS) {
      console.log('[RMoney] aggiornamento in corso da ' + Math.round(da / 1000)
        + 's, salto: ' + motivo);
      return inCorso;
    }
    // Piantato: lo si abbandona invece di restare bloccati per sempre.
    console.log('[RMoney] aggiornamento piantato da ' + Math.round(da / 1000)
      + 's, lo abbandono e riparto: ' + motivo);
    inCorso = null;
  }

  const eta = Date.now() - ultimo;
  if (ultimo && eta < DISTANZA_MIN_MS && SEMPRE.indexOf(motivo) < 0) {
    console.log('[RMoney] aggiornato da ' + Math.round(eta / 1000) + 's, salto: ' + motivo);
    return Promise.resolve();
  }

  ultimo = Date.now();
  inizioCorso = Date.now();
  const mio = aggiornaOra(motivo);
  inCorso = mio;
  // Solo chi e' ancora il corrente si azzera: un aggiornamento abbandonato che
  // finisce tardi non deve cancellare quello che nel frattempo l'ha sostituito.
  const libera = function () { if (inCorso === mio) inCorso = null; };
  mio.then(libera, libera);
  return mio;
}

// Due passate.
//
// La prima disegna con quello che c'e' gia' in cache, senza toccare la rete, e
// serve a non lasciare mai il widget bianco: dopo ogni reinstallazione Android
// azzera il disegno, e se la lettura dal backend non fa in tempo a finire prima
// che l'app vada in background il widget resta vuoto. Con il backend che
// impiega dai 10 ai 30 secondi succedeva quasi sempre.
//
// La seconda passata rifa' il disegno con i dati freschi appena arrivano.
async function aggiornaOra(motivo) {
  console.log('[RMoney] aggiorno widget: ' + motivo);
  try {
    const cache = await leggiCacheDebito();
    if (cache) {
      await disegnaTutti(motivo + '/cache', cache);
    }

    const fresco = await leggiDebito();
    await disegnaTutti(motivo + '/rete', fresco);
  } catch (e) {
    // Deve concludersi comunque: un'eccezione che sfugge lascerebbe la promise
    // rifiutata e, prima della scadenza, bloccherebbe gli aggiornamenti dopo.
    console.log('[RMoney] aggiornamento fallito (' + motivo + '): ' + e);
  }
}

function disegnaTutti(fase, debito) {
  return Promise.all(NOMI_WIDGET.map(function (nome) {
    return requestWidgetUpdate({
      widgetName: nome,
      renderWidget: async (info) => {
        console.log('[RMoney] disegno ' + nome + ' (' + fase + ') id=' + info.widgetId
          + ' ' + info.width + 'x' + info.height);
        try {
          const albero = await componiWidget(nome, info, debito);
          console.log('[RMoney] disegno pronto ' + nome + ' (' + fase + ')');
          return albero;
        } catch (e) {
          console.log('[RMoney] disegno FALLITO ' + nome + ' (' + fase + '): ' + e);
          throw e;
        }
      },
      widgetNotFound: () => console.log('[RMoney] ' + nome + ' non sulla home'),
    }).catch(function (e) { console.log('[RMoney] ' + nome + ' fallito: ' + e); });
  }));
}
