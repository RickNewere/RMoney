import React from 'react';
import { DebitoWidget } from './widgets/DebitoWidget';
import { leggiDebito } from './widgets/debitoData';

// Android calls this outside the app, in a headless JS task. Every branch has
// to end in a renderWidget() or the widget keeps whatever it was showing.
export async function widgetTaskHandler(props) {
  const { widgetInfo, widgetAction, renderWidget } = props;

  if (widgetInfo.widgetName !== 'Debito') return;

  if (widgetAction === 'WIDGET_DELETED') return;

  // La larghezza serve al widget per scegliere fra la frase intera e quella
  // corta: a 2x2 "Riccardo deve a Roberta" non ci sta.
  const larghezza = widgetInfo.width || 0;

  const disegna = (dati) =>
    renderWidget({
      light: <DebitoWidget dati={dati} tema="light" larghezza={larghezza} />,
      dark: <DebitoWidget dati={dati} tema="dark" larghezza={larghezza} />,
    });

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
    case 'WIDGET_CLICK':
      // leggiDebito() non lancia mai: se la rete manca ritorna l'ultimo valore
      // salvato, marcato come vecchio.
      disegna(await leggiDebito());
      break;
    default:
      break;
  }
}
