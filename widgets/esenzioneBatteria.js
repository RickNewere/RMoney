import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, Platform } from 'react-native';

const CHIAVE = 'RMoney:esenzioneChiesta';
const PACCHETTO = 'com.rmoney.app';

// Chiede una volta sola di togliere RMoney dal risparmio energetico.
//
// Perche' serve: il lavoro periodico che aggiorna il widget e' pianificato
// correttamente (JobScheduler lo mostra scaduto e senza vincoli insoddisfatti)
// ma su Samsung non viene eseguito finche' l'app resta soggetta alle
// restrizioni di batteria. Verificato sul telefono: job scaduto da 16 minuti,
// mai partito, e l'app assente dalla whitelist di deviceidle.
//
// Non si puo' fare in automatico: concedere l'esenzione senza intervento
// dell'utente richiederebbe WRITE_SECURE_SETTINGS, che e' riservato al sistema.
// Il massimo consentito e' aprire il dialogo di sistema gia' puntato su questa
// app, che e' un tocco invece di sei passaggi nelle impostazioni.
export async function chiediEsenzioneBatteria() {
  if (Platform.OS !== 'android') return;

  try {
    // Una volta sola: se l'utente ha detto no, insistere a ogni avvio sarebbe
    // molesto. Per rifarla basta reinstallare o svuotare i dati.
    if (await AsyncStorage.getItem(CHIAVE)) return;
    await AsyncStorage.setItem(CHIAVE, '1');

    Alert.alert(
      'Aggiornamento del widget',
      'Per aggiornare il widget quando l\'app e\' chiusa, Android deve poter '
        + 'eseguire RMoney in background. Senza questo permesso il widget cambia '
        + 'solo aprendo l\'app.\n\nNella schermata che si apre scegli "Consenti".',
      [
        { text: 'Non ora', style: 'cancel' },
        {
          text: 'Apri',
          onPress: function () {
            IntentLauncher.startActivityAsync(
              'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
              { data: 'package:' + PACCHETTO }
            ).catch(function () {
              // Alcune ROM non espongono quell'azione: si ripiega sull'elenco
              // generale, dove l'app va cercata a mano.
              IntentLauncher.startActivityAsync(
                'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
              ).catch(function () {});
            });
          },
        },
      ]
    );
  } catch (e) {
    console.log('[RMoney] richiesta esenzione batteria fallita: ' + e);
  }
}
