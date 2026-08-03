import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import { widgetTaskHandler } from './widgetTaskHandler';
// L'import definisce il task periodico: deve avvenire al caricamento del
// bundle, perche' quando il sistema riavvia l'app solo per eseguirlo non passa
// da nessun componente React.
import './widgets/attivitaPeriodica';

// The default Expo entry point only registers the app. The widget needs its own
// handler registered next to it, which is why package.json points here instead
// of at expo/AppEntry.js.
registerRootComponent(App);
registerWidgetTaskHandler(widgetTaskHandler);
