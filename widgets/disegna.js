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

// Compone il widget richiesto. Se `debitoPronto` e' fornito non tocca la rete:
// serve alla prima passata, quella che disegna subito con la cache perche' il
// widget non resti bianco mentre il backend fa aspettare anche mezzo minuto.
export async function componiWidget(nome, widgetInfo, debitoPronto) {
  const debito = debitoPronto || (await leggiDebito());
  if (nome === NOME_WIDGET_GRANDE) {
    return disegnaRiepilogo(debito, await leggiRiepilogo());
  }
  return disegnaDebito(debito, widgetInfo);
}
