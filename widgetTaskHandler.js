import { disegnaDebito, NOME_WIDGET } from './widgets/disegna';
import { leggiDebito } from './widgets/debitoData';

// Android calls this outside the app, in a headless JS task. Every branch has
// to end in a renderWidget() or the widget keeps whatever it was showing.
export async function widgetTaskHandler(props) {
  const { widgetInfo, widgetAction, renderWidget } = props;

  if (widgetInfo.widgetName !== NOME_WIDGET) return;
  if (widgetAction === 'WIDGET_DELETED') return;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
    case 'WIDGET_CLICK':
      // leggiDebito() non lancia mai: se la rete manca ritorna l'ultimo valore
      // salvato, marcato come vecchio.
      renderWidget(disegnaDebito(await leggiDebito(), widgetInfo));
      break;
    default:
      break;
  }
}
