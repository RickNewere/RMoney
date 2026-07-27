import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import { widgetTaskHandler } from './widgetTaskHandler';

// The default Expo entry point only registers the app. The widget needs its own
// handler registered next to it, which is why package.json points here instead
// of at expo/AppEntry.js.
registerRootComponent(App);
registerWidgetTaskHandler(widgetTaskHandler);
