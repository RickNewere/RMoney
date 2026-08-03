import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { aggiornaWidget } from './aggiorna';

export const NOME_ATTIVITA = 'rmoney-aggiorna-widget';

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
    const stato = await BackgroundTask.getStatusAsync();
    if (stato === BackgroundTask.BackgroundTaskStatus.Restricted) {
      console.log('[RMoney] lavoro in background limitato dal sistema');
      return;
    }
    await BackgroundTask.registerTaskAsync(NOME_ATTIVITA, { minimumInterval: 15 });
    console.log('[RMoney] lavoro periodico registrato (15 min)');
  } catch (e) {
    console.log('[RMoney] registrazione lavoro periodico fallita: ' + e);
  }
}
