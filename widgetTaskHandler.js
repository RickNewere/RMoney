import { componiWidget, NOMI_WIDGET } from './widgets/disegna';

// Android calls this outside the app, in a headless JS task. Every branch has
// to end in a renderWidget() or the widget keeps whatever it was showing.
export async function widgetTaskHandler(props) {
  const { widgetInfo, widgetAction, renderWidget } = props;

  if (NOMI_WIDGET.indexOf(widgetInfo.widgetName) < 0) return;
  if (widgetAction === 'WIDGET_DELETED') return;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
    case 'WIDGET_CLICK':
      // Le letture non lanciano mai: se la rete manca tornano l'ultimo valore
      // salvato, marcato come vecchio.
      renderWidget(await componiWidget(widgetInfo.widgetName, widgetInfo));
      break;
    default:
      break;
  }
}
