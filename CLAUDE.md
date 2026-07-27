# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RMoney is a personal expense-entry app (two users: Riccardo and Roberta) that appends rows to a shared Google Spreadsheet (ID `10NT_nAkXRX12sEzFdpa6khSnONfjwm-NHGguoDm215U`). There are two sibling projects on the Desktop that share the same backend:

- `C:\Users\rober\Desktop\RMoney` (this folder) — Expo/React Native app, installed on Android as a locally-built APK. Also contains the backend source in `backend/Codice.gs`. **`App.js` is now a thin WebView shell** (`react-native-webview`) that loads the live web app (`SITE_URL = https://ricknewere.github.io/RMoney/`), so Android has full feature parity with the web (insert, debito, riepilogo, charts) and future web changes need no APK rebuild. The old native insert form was replaced; `App.js` no longer imports `config.js`, so its `TABS`/`API_URL` are unused by Android now (kept for reference).
- `C:\Users\rober\Desktop\RMoney-web` — static PWA (single `index.html`), deployed to GitHub Pages at https://ricknewere.github.io/RMoney/ (repo `RickNewere/RMoney`, public). This is the iPhone client (Add to Home Screen from Safari).

UI language is Italian; keep it that way. Both clients must stay visually and functionally identical (brand title "💸 RMoney", same fields and behavior).

## Architecture

Backend = a Google Apps Script Web App bound to the spreadsheet (`backend/Codice.gs`). Clients talk to it over HTTPS:

- `GET  {API_URL}?action=categorie&gid=...` → `{ok, version, categorie:[...]}` — distinct values actually used in the CATEGORIA column of that tab, sorted.
- `POST {API_URL}` body `{gid, data:"YYYY-MM-DD", spesa, categoria, nota, segno}` → appends a row.
- `GET  {API_URL}?action=riep&conto=Euro|Franchi&tipo=annuale|mensile&anno=YYYY[&mese=M]` → `{ok, version, riepilogo:{...}}`. Read-only. Recomputes the summary from the two LOG sheets of the currency for an arbitrary period (a month or a full year), so the web "Riepilogo" section can pick any month/year. Same shape as `riepilogo` (overview/entrate/risparmio/spese per person + andamento for annuale). Classification mirrors the SOMMARIO sheets: a row is a **spesa** iff its category is one of the 15 in `SPESE_CATS`; everything else (stipendi, tredicesime/quattordicesime, and **storni e rimborsi**) counts as **entrata**; `risparmio = entrate - spese`. Validated against SOMMARIO ANNUALE 2025 (entrate exact; spese within ~7€ due to minor LOG-vs-sheet category quirks). This is what the web app uses now; the older `?action=riepilogo&gid=` (reads a fixed SOMMARIO sheet) is kept but unused.
- `GET  {API_URL}?action=riepilogo&gid=<gid di un foglio SOMMARIO>` → `{ok, version, riepilogo:{...}}`. Read-only. Reads a SOMMARIO sheet (ANNUALE/MENSILE × euro/CHF) and returns `overview` (entrate/uscite/totale + `periodo`), `entrate` and `risparmio` per person (roberta/riccardo/totale), and `spese.roberta`/`spese.riccardo` as `[{categoria, importo}]`. For ANNUALE sheets it also returns `andamento` (monthly savings series roberta/riccardo/totale) read from the hidden pivot sheet. The 4 SOMMARIO gids: annuale euro `738641296`, annuale CHF `637629592`, mensile euro `282752746`, mensile CHF `387921258`. Values come from `getValues()` (the accounting "-" is numeric 0); anchors ("OVERVIEW", "ENTRATE", "RISPARMIO", "SPESE ROBERTA/RICCARDO") are matched by text so the extraction survives row shifts.
- `GET  {API_URL}?action=debito&gid=X&gidPartner=Y` → `{ok, version, debito:{mio:{totale,meta,conteggio}, partner:{...}, netto}}`. Read-only. Sums the amounts of rows marked with a dash `-` (shared expenses split 50/50); `meta`=totale/2. `netto = mio.meta - partner.meta` is the per-currency settlement between the two same-currency tabs (>0 ⇒ partner person owes the tab's person). `gidPartner` is optional. This never writes to the sheet.
- `GET  {API_URL}?action=condivise&gid=X` → `{ok, version, condivise:{tab, righe:[{riga, data, importo, categoria, nota, split}], totale, meta}}`. Read-only (v17). Itemises the rows the debt calculation sums, with their **sheet row number**, using exactly the same criteria as `_totaleCondivise`. This exists to reconcile the debt by hand: a mismatch is normally one forgotten row, and this turns "the total looks wrong" into "row 758, bennet, 12,51" in one call.
- `GET  {API_URL}?action=spese&conto=Euro|Franchi&tipo=annuale|mensile&anno=YYYY[&mese=M]&persona=Riccardo|Roberta|Insieme&categoria=<nome>` → `{ok, version, spese:{categoria, persona, valuta, periodo, righe:[{data, ts, importo, nota, persona, riga}], totale, conteggio}}`. Read-only (v18). The drill-down behind the web summary: `?action=riep` gives per-category totals, this gives the single expenses making up one of those totals, newest first. It filters the same LOG rows with the same period logic as `getRiepCalc`, so the sum of `righe` always matches the category total shown in the summary — if it ever doesn't, the two filters have drifted apart.
- Debug endpoints: `?action=debug&gid=` (tab name, row/col counts, first rows, last row) and `?action=catdebug&gid=`.

Tab routing: the four spreadsheet tabs are selected by Persona+Conto via gid — Riccardo Euro `113020932`, Roberta Euro `1888286288`, Riccardo Franchi `650699013`, Roberta Franchi `1063479927`. The map is duplicated in `config.js` (native) and in `RMoney-web/index.html` (web); change both.

Backend column handling (important — the sheets are not plain tables):

- Row 1 of each tab is a title; real headers are on row 2. `_findHeader()` scans the first 8 rows and scores keyword matches to find the header row. Never assume row 1.
- Columns are matched by substring on header names (`_colFor`): amount matches €/chf/importo/…, note matches dettagl/nota/…
- Date cell gets number format `d mmm yyyy` (renders "20 lug 2026" with the sheet's Italian locale) — no time.
- Shared expenses are marked in a dedicated **`split`** column (header `split`, real Sheets checkbox) placed immediately to the RIGHT of the note column. A row is shared if that cell is boolean `true` (or the legacy `-`, still recognized for backward compat). When `segno:true`, `aggiungiSpesa` inserts the row, then on the split cell calls `insertCheckboxes()` and `setValue(true)` — the checkbox must be applied AFTER `appendRow`, otherwise a bare `true` on a cell without checkbox validation renders as the literal text "true" (this was a real bug). If the `split` header is absent it falls back to writing `-` at note+1. `saldaFoglio` likewise re-applies `insertCheckboxes()` after clearing, so it never leaves the text "false" on cells lacking validation.
- **`appendRow` does not apply formatting** — it only inherits what already exists in the destination row. The tabs carry an accounting currency format (` € 9,50 `, ` CHF 22,70 `) applied to a *finite* range, so once the data outgrows that range new rows are born unformatted and an amount shows as `1` instead of ` € 1,00 `. This actually happened on LOG RICCARDO at row 770 and is why inserts "stopped working" after months of being fine. Since v15 `aggiungiSpesa` copies formats onto the new row with `copyTo(..., PASTE_FORMAT)` before re-applying the date format. The model row is the **first data row** (`h.row + 1`), deliberately not `r - 1`: when the last rows are already broken, copying from them propagates the defect. The same reasoning applies to the `split` checkbox: it is inserted on **every** row, shared or not, so a plain row is an unchecked box rather than an empty cell.
- `sistemaFormatoRighe(gid, daRiga, aRiga)` repairs rows written before that fix, by hand from the Apps Script editor. It writes **formatting and checkboxes only** and preserves existing ticks: dates, amounts, categories and notes are never touched. **The one real case (LOG RICCARDO, rows 770-774) is already sorted — the owner fixed it. Do not suggest running `sistemaRigheRotteRiccardoEuro()` again;** it is kept only as a template should the same breakage reappear elsewhere.
- One-time setup: `setupSplitColumn()` (run manually from the Apps Script editor) adds the `split` header + checkboxes to the 4 known tabs and converts existing `-` marks to checked. Touches only that single column.
- The spreadsheet has a **hidden sheet** "Tabelle brutte che nessuno vuole vedere" (gid `1943088578`, constant `GID_PIVOT`) holding the source pivots for the SOMMARIO charts, including the monthly "Andamento Risparmi" series (euro table first, CHF table second). `?action=riepilogo` reads the andamento from here.
- **Tail-only date sorting (v20).** `SORT_FROM` maps each LOG gid to the first row the app is allowed to reorder, frozen on 27/07/2026 at that sheet's then-last row + 1 (Riccardo € 775, Roberta € 565, Riccardo CHF 105, Roberta CHF 106). `_ordinaCoda()` sorts only from there down, after every insert and after any delete inside that zone. Everything above the threshold is never read or moved: the history keeps whatever order it already had, which is **not** chronological (a sample of 122 rows had 9 date inversions), so the sheet as a whole will never become fully sorted — that was the accepted trade-off for not disturbing existing rows. Do not recompute these thresholds: raising them abandons rows already being sorted, lowering them reshuffles the frozen history.
  - Blank cells sort to the bottom, so the hole left by a delete drifts to the end of the zone on its own and the space becomes reusable. `_primaRigaLibera()` additionally lets `aggiungiSpesa` fill a blank row in the zone instead of always appending.
  - Sorting moves values, so `_ordinaCoda` re-applies `insertCheckboxes()` over the split column afterwards and writes the boolean values back; without that a moved cell can end up showing the literal text "true".
  - Consequence for clients: a sort invalidates the row numbers held by an open `?action=spese` list. The `atteso` guard on delete is what keeps that safe — it refuses rather than deleting whatever now sits at that row number.
- `POST {op:'elimina', gid, riga, atteso:{importo, nota, categoria}}` → `svuotaRiga()` (v19). Clears date/amount/category/note on that ONE row and unchecks its split box, using `clearContent()` so formatting survives. It deliberately **does not delete the row**: removing it would shift everything below and invalidate every row number already handed to the client by `?action=spese`. `atteso` is a guard, not decoration — the row is only cleared if it still holds the amount, note and category the user was looking at, so a stale list cannot wipe the wrong expense. Reachable in the UI only from the category detail view.
- `POST {op:'salda', gid}` → `saldaFoglio(gid)` unchecks every `split` cell of that ONE tab (write limited strictly to the split column; expenses are left intact). Backs the in-app "Saldato · azzera split" button, which confirms before firing.

CORS: Apps Script `/exec` sends `Access-Control-Allow-Origin: *`. The web client POSTs with `Content-Type: text/plain;charset=utf-8` to avoid a preflight — don't change it to `application/json`.

## Backend deployment (manual, no CLI)

`backend/Codice.gs` is source only — it runs inside the sheet's Apps Script editor (Estensioni → Apps Script), where the user pastes it. To ship a change **without changing the URL**: Distribuisci → Gestisci distribuzioni → ✏️ → Nuova versione. A "Nuova distribuzione" creates a NEW `/exec` URL and breaks both clients (this happened repeatedly; the URL then has to be updated in `config.js` AND `RMoney-web/index.html`).

The `VERSION` constant in Codice.gs is a deliberate marker: bump it and check any endpoint's `version` field to verify what's actually live. Local Codice.gs is **v20** (tail-only date sorting + blank-row reuse; the live deployment answers v19, so sorting does not happen until this is redeployed), earlier **v19** (`{op:'elimina'}`), **v18** (`?action=spese`, the per-category drill-down), **v16** (v15/v16: new rows copy their formatting from the **first data row** and always get a split checkbox, plus `sistemaFormatoRighe(gid, da, a)` to repair rows written before the fix; the formatting bug is closed — the fix is live and the affected rows have been repaired), earlier **v12** (v10: split cell gets a real checkbox via `insertCheckboxes()`+`setValue(true)` after `appendRow` instead of a bare `true` that rendered as text; v12: adds `action=riepilogo`); a redeploy is required for it to take effect. v7's only addition (serving `backend/App.html` on plain GET) was superseded by the GitHub Pages client; `backend/App.html` is dead code kept for reference.

Current live URL (v19): `https://script.google.com/macros/s/AKfycbyVsbG2DAiH0yhR3BsbSxa0EokDo28HG--pc4Zfpd2D5YgF-eeluE2TuEEWHCnKK6JVkg/exec` — used by the web app. At least three older deployments are still live and answering (v17 `AKfycbzH9jpm…`, v18 `AKfycbyT4YZ…`); they should be archived. Every one of them was created by choosing "Nuova distribuzione" instead of "Nuova versione", and each time the symptom was the same: the code looked deployed but the clients kept talking to the old URL. (Each "Nuova distribuzione" the owner does mints a fresh URL; this has happened several times — update `index.html` + `config.js` when it changes.) Note: the installed Android APK still has the previous URL (`AKfycbxLYg…`, v6) baked in; that older deployment stays live and works for adding expenses, so Android keeps functioning until the APK is rebuilt from the updated `config.js`.

## Commands (native app)

```powershell
npm install
npx expo start            # dev server; Expo Go on the phone (same Wi-Fi)
```

No tests or linter are configured.

Android release APK — built fully locally, **zero accounts** (no EAS, no expo login). Toolchain lives in `C:\Users\rober\android-build\` (Temurin JDK 17 in `jdk-17.0.19+10\`, SDK in `sdk\`):

```powershell
npx expo prebuild -p android --clean  # regenerates android/ (needed after adding a native module)
# prebuild --clean deletes android/local.properties — recreate it:
#   sdk.dir=C:/Users/rober/android-build/sdk
$env:JAVA_HOME='C:\Users\rober\android-build\jdk-17.0.19+10'
cd android; .\gradlew assembleRelease
# output: android\app\build\outputs\apk\release\app-release.apk
# install on a USB-connected phone (adb in sdk\platform-tools):
#   adb install -r android\app\build\outputs\apk\release\app-release.apk
```

Icons are generated by `backend/make_icon.py` (Pillow) → writes `assets/icon.png`, `adaptive-icon.png`, `splash.png`, `favicon.png`. The icon is "RM" with a green (#22c55e) € badge; regenerate with the script rather than editing images.

Known pitfalls:
- `babel-preset-expo` must stay pinned `~54.0.10` to match Expo SDK 54 — a newer major breaks the build.
- `npx expo export` fails on Windows (hermesc.exe "private properties are not supported") — known Windows-only bug; it does NOT affect `expo start` or the Gradle build. Validate bundles via the dev server instead.
- After reinstalling the APK, Android launcher may cache the old icon (uninstall + reboot fixes it).

## Web client deploy

Any push to `main` of the `RMoney-web` repo triggers `.github/workflows/deploy.yml` → GitHub Pages. The repo must stay public (GitHub Free doesn't serve Pages from private repos). No build step: `index.html` is served as-is, so all JS/CSS is inline there.

## Constraints from the owner

- No accounts/services beyond what exists (no Expo/EAS account, no app stores, no paid Apple Developer).
- No PIN/auth on the web app — considered and explicitly rejected.
- Dates in the sheet must render as Italian "d mmm yyyy" with no time component.
