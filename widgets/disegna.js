import React from 'react';
import { DebitoWidget } from './DebitoWidget';
import { RiepilogoWidget } from './RiepilogoWidget';
import { leggiDebito } from './debitoData';
import { leggiRiepilogo } from './riepilogoData';

export const NOME_WIDGET = 'Debito';
export const NOME_WIDGET_GRANDE = 'Riepilogo';
export const NOMI_WIDGET = [NOME_WIDGET, NOME_WIDGET_GRANDE];

// Unico punto in cui i widget vengono composti. Lo usano sia il task in
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

export function disegnaRiepilogo(debito, riepilogo) {
  return {
    light: <RiepilogoWidget debito={debito} riepilogo={riepilogo} tema="light" />,
    dark: <RiepilogoWidget debito={debito} riepilogo={riepilogo} tema="dark" />,
  };
}

// Legge quello che serve al widget richiesto e ne restituisce il disegno.
// Le due letture del widget grande partono insieme: sono endpoint diversi e
// in sequenza raddoppierebbero l'attesa.
export async function componiWidget(nome, widgetInfo) {
  if (nome === NOME_WIDGET_GRANDE) {
    const [debito, riepilogo] = await Promise.all([leggiDebito(), leggiRiepilogo()]);
    return disegnaRiepilogo(debito, riepilogo);
  }
  return disegnaDebito(await leggiDebito(), widgetInfo);
}
