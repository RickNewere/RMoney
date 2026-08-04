import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { aggiornaWidget } from './aggiorna';

export const NOME_ATTIVITA = 'rmoney-aggiorna-widget';

// Minuti fra un aggiornamento e l'altro. 15 e' il minimo che WorkManager
// accetta. Cambiare questo numero forza UNA ri-registrazione al primo avvio
// successivo (vedi sotto), che e' anche il modo per riparare una pianificazione
// finita male.
const INTERVALLO_MIN = 15;

// Ricorda con quale intervallo il lavoro e' stato registrato l'ultima volta.
const CHIAVE_INTERVALLO = 'RMoney:intervalloPeriodico';

// Aggiornamento periodico VERO, che non dipende dai widget di Android.
//
// updatePeriodMillis e' dichiaratamente best effort: il sistema non sveglia il
// dispositivo per aggiornare un widget e i produttori lo ritardano ancora. Sul
// telefono si e' visto l'allarme di sistema scattare regolarmente mentre il
// widget restava fermo per ore. Qui si usa invece WorkManager, che e' lo stesso
// meccanismo con cui Android pianifica il lavoro in background delle app.
//
// La definizione sta a livello di modulo e viene importata da index.js: quando
// il sistema riavvia l'app solo per eseguire il lavoro, il task deve gia'
// esistere al momento del caricamento, altrimenti non viene trovato.
TaskManager.defineTask(NOME_ATTIVITA, async () => {
  try {
    await aggiornaWidget('lavoro periodico');
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    console.log('[RMoney] lavoro periodico fallito: ' + e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// 15 minuti e' il minimo che WorkManager accetta; sotto, il sistema lo alza da
// solo. Registrare due volte lo stesso nome non crea doppioni: sostituisce.
export async function registraAttivitaPeriodica() {
  try {
    const voluto = String(INTERVALLO_MIN);
    const registrato = await TaskManager.isTaskRegisteredAsync(NOME_ATTIVITA);
    const usato = await AsyncStorage.getItem(CHIAVE_INTERVALLO);

    // Registrare di nuovo un lavoro periodico gia' attivo lo SOSTITUISCE e ne
    // azzera il conto alla rovescia. Siccome questa funzione gira a ogni avvio,
    // e l'app la si apre proprio per controllare se il widget si e' aggiornato,
    // farlo ogni volta significava rimandare lo scatto all'infinito.
    //
    // Ma non si puo' nemmeno lasciar stare sempre: una pianificazione finita
    // male resterebbe tale per sempre. Sul telefono se n'e' vista una col primo
    // avvio previsto fra 3649 GIORNI, e il controllo "e' gia' attivo, non lo
    // tocco" la rendeva impossibile da correggere. Quindi si ri-registra solo
    // quando l'intervallo voluto e' diverso da quello effettivamente usato:
    // cambiare INTERVALLO_MIN e' il modo per forzare una riparazione.
    if (registrato && usato === voluto) {
      console.log('[RMoney] lavoro periodico gia\' attivo a ' + voluto + ' min');
      return;
    }

    const stato = await BackgroundTask.getStatusAsync();
    if (stato === BackgroundTask.BackgroundTaskStatus.Restricted) {
      console.log('[RMoney] lavoro in background limitato dal sistema');
      return;
    }

    if (registrato) {
      await BackgroundTask.unregisterTaskAsync(NOME_ATTIVITA);
      console.log('[RMoney] vecchia pianificazione rimossa');
    }
    await BackgroundTask.registerTaskAsync(NOME_ATTIVITA, { minimumInterval: INTERVALLO_MIN });
    await AsyncStorage.setItem(CHIAVE_INTERVALLO, voluto);
    console.log('[RMoney] lavoro periodico registrato (' + voluto + ' min)');
  } catch (e) {
    console.log('[RMoney] registrazione lavoro periodico fallita: ' + e);
  }
}
