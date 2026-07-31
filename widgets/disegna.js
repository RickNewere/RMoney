import React from 'react';
import { DebitoWidget } from './DebitoWidget';

export const NOME_WIDGET = 'Debito';

// Unico punto in cui il widget viene composto. Lo usano sia il task in
// background (aggiornamento periodico e tocco) sia l'app quando forza un
// ridisegno: se ognuno costruisse il proprio, i due percorsi finirebbero per
// disegnare cose diverse.
export function disegnaDebito(dati, widgetInfo) {
  const larghezza = (widgetInfo && widgetInfo.width) || 0;
  return {
    light: <DebitoWidget dati={dati} tema="light" larghezza={larghezza} />,
    dark: <DebitoWidget dati={dati} tema="dark" larghezza={larghezza} />,
  };
}
