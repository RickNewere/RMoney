import { requestWidgetUpdate } from 'react-native-android-widget';
import { componiWidget, NOMI_WIDGET } from './disegna';

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

export function aggiornaWidget(motivo) {
  if (inCorso) {
    console.log('[RMoney] aggiornamento gia\' in corso, salto: ' + motivo);
    return inCorso;
  }
  inCorso = aggiornaOra(motivo);
  inCorso.then(
    function () { inCorso = null; },
    function () { inCorso = null; }
  );
  return inCorso;
}

function aggiornaOra(motivo) {
  console.log('[RMoney] aggiorno widget: ' + motivo);

  return Promise.all(NOMI_WIDGET.map(function (nome) {
    return requestWidgetUpdate({
      widgetName: nome,
      renderWidget: async (info) => {
        console.log('[RMoney] disegno ' + nome + ' id=' + info.widgetId
          + ' ' + info.width + 'x' + info.height);
        try {
          const albero = await componiWidget(nome, info);
          console.log('[RMoney] disegno pronto ' + nome);
          return albero;
        } catch (e) {
          console.log('[RMoney] disegno FALLITO ' + nome + ': ' + e);
          throw e;
        }
      },
      widgetNotFound: () => console.log('[RMoney] ' + nome + ' non sulla home'),
    })
      .then(function () { console.log('[RMoney] ' + nome + ' inviato (' + motivo + ')'); })
      .catch(function (e) { console.log('[RMoney] ' + nome + ' fallito: ' + e); });
  }));
}
