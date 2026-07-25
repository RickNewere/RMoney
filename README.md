# 💸 RMoney

App per iPhone e Android per aggiungere spese in *append* sul foglio Google (io e la mia compagna).
Scegli **Persona** (Riccardo/Roberta) e **Conto** (Euro/Franchi): la spesa finisce nel tab giusto.
Campi: **Data, Importo, Categoria, Nota**. Le categorie vengono lette automaticamente dal foglio.

```
RMoney/
├─ App.js            → schermata dell'app (interfaccia nativa)
├─ config.js         → QUI incolli l'URL del backend
├─ package.json      → dipendenze
├─ app.json          → configurazione Expo
└─ backend/
   └─ Codice.gs      → codice da incollare in Apps Script (dentro il foglio)
```

---

## PARTE 1 — Backend (una volta sola, ~10 min)

Serve un piccolo "ponte" tra l'app e il foglio. Non è una web app da usare: è solo l'indirizzo che l'app chiama.

1. Apri il foglio Google → menu **Estensioni → Apps Script**.
2. Cancella tutto il codice presente e incolla il contenuto di **`backend/Codice.gs`**. Salva (💾).
3. In alto a destra: **Distribuisci → Nuova distribuzione**.
4. Icona ⚙️ → **Applicazione web**. Imposta:
   - *Esegui come*: **Me**
   - *Chi ha accesso*: **Chiunque** (l'app deve poterlo chiamare senza login)
5. **Distribuisci** → autorizza i permessi (è codice tuo, è normale).
6. Copia l'**URL dell'app web** (finisce con `/exec`).
7. Apri **`config.js`** e incolla quell'URL al posto di `INCOLLA_QUI_URL_...`.

> Se in futuro modifichi `Codice.gs`, rifai **Distribuisci → Gestisci distribuzioni → Modifica → Nuova versione** (l'URL resta lo stesso).

---

## PARTE 2 — Far girare l'app sul telefono (test immediato, gratis)

Il modo più rapido per avere RMoney sul telefono senza App Store:

1. Sul **PC**: installa [Node.js LTS](https://nodejs.org).
2. Sul **telefono**: installa l'app **Expo Go** (App Store / Play Store).
3. Sul PC, apri il terminale nella cartella `RMoney` ed esegui:
   ```
   npm install
   npx expo install @react-native-picker/picker @react-native-community/datetimepicker
   npx expo start
   ```
4. Appare un **QR code**. Inquadralo:
   - **iPhone**: con la fotocamera → si apre in Expo Go.
   - **Android**: dall'app Expo Go → "Scan QR code".
5. RMoney si apre sul telefono. Aggiungi una spesa → controlla che compaia nel foglio.

Telefono e PC devono essere sulla **stessa rete Wi-Fi**. Stesso procedimento per il telefono della tua compagna (basta il QR / lo stesso progetto).

---

## PARTE 3 — App "vera" installabile (opzionale)

Expo Go è comodo ma richiede il PC acceso. Per un'app installata in modo permanente:

- **Android** (gratis): crea un account su [expo.dev](https://expo.dev), poi:
  ```
  npm install -g eas-cli
  eas login
  eas build -p android --profile preview
  ```
  Ottieni un file **.apk** da installare direttamente sul telefono Android.

- **iPhone**: per installare un'app fuori da Expo Go serve un **account Apple Developer** (99 $/anno) e `eas build -p ios`. Senza quello, su iPhone si usa Expo Go (Parte 2), che per l'uso quotidiano va benissimo.

---

## Note tecniche

- **Colonne**: il backend legge la riga 1 di ogni tab e riconosce da solo le colonne "data", "spesa/importo/euro/franchi", "categoria", "nota". Funziona qualunque sia l'ordine. Se una colonna ha un nome molto diverso, dimmelo e lo aggiungo.
- **Categorie**: prese dal menu a tendina della colonna Categoria del tab selezionato, oppure dai valori già presenti. Aggiungine una nel foglio e comparirà nell'app.
- **Privacy**: l'URL `/exec` scrive solo tramite le funzioni definite; non espone l'intero foglio.
```
