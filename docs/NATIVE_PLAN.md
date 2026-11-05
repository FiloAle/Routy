# Routy nativa: piano di conversione

Riscrittura di Routy in SwiftUI, in `native/`, senza dipendenze esterne. Stesse funzioni dell'app Expo, codice più corto e diretto, bug noti corretti. L'app Expo resta nella repo finché non decidi di toglierla.

**Stella polare:** ogni pattern usato due volte diventa un componente, ogni valore visivo viene dai token, ogni comportamento viene dal controllo di sistema prima che dal codice custom. Struttura e regole sono quelle già collaudate in YouPlay (`youplay/native`).

---

## 1. Progetto

| Voce | Valore |
|---|---|
| Cartella | `native/` (`Routy.xcodeproj`, gruppi sincronizzati con il filesystem: niente modifiche manuali al `.pbxproj`) |
| Target | iOS 26.0, Swift 6, solo portrait, iPhone |
| Bundle ID | `com.filippoalessandrini.routy`, lo stesso di Expo: l'app si installa **come aggiornamento** e ne eredita i dati (§7) |
| Icona | `assets/routy.icon` copiata così com'è (formato Icon Composer) |
| Dipendenze | nessuna |

**Avvio:** stesso schema di YouPlay, già provato su iOS 27. `AppDelegate` crea la finestra su `UIScene.willConnectNotification`. Serve perché il telefono ha sessioni di scena salvate con `EXExpoAppSceneDelegate`, e con un normale `App` SwiftUI l'aggiornamento partirebbe su uno schermo nero. Dalla finestra UIKit arrivano anche:
- `window.tintColor = accent`, che colora gli alert e sostituisce `setAlertTintColor`;
- la registrazione del task in background;
- il delegate delle notifiche, impostato in `willFinishLaunching` così il tap funziona anche ad app chiusa.

**Info.plist:**
- `NSLocalNetworkUsageDescription` e `NSContactsUsageDescription`, tradotti in `InfoPlist.xcstrings` dai file `*-native.json`;
- `NSAllowsLocalNetworking`;
- `UIBackgroundModes: fetch` e `BGTaskSchedulerPermittedIdentifiers: com.filippoalessandrini.routy.refresh`;
- `UILaunchScreen` blu `#208AEF`.

**Spariscono del tutto:**
- il modulo `routy-ui-modifiers`;
- la patch a `react-native-screens`;
- i plugin `withSceneLifecycle`, `withPodsDeploymentTarget` e `withRemovePushEntitlement`;
- CocoaPods e gli stili RN (circa 640 righe);
- il ritardo artificiale di 800 ms sullo splash.

## 2. Struttura

```
native/Routy/
  App/            RoutyApp (AppDelegate, finestra), AppRouter (tab + path), RootView
  DesignSystem/   Tokens.swift, Components/
  Router/         RouterClient (protocollo), ZTEClient, DemoClient, ZTEParsing, FormEncoding, Models
  Store/          RouterStore (+SMS, +Devices, +Network), Preferences, Keychain, LegacyStorage
  Services/       Contacts, SMSNotifier, BackgroundRefresh
  Screens/        Home, Messages, Chat, Compose, Devices, DeviceEditSheet, Settings, DNS, Bands
  Resources/      Localizable.xcstrings, InfoPlist.xcstrings, AppIcon.icon
native/RoutyTests/  test di parità con l'app Expo (§9)
native/DESIGN.md    regole del design system, come in YouPlay
```

## 3. Livello router

**`protocol RouterClient: Sendable`** ha le stesse operazioni di oggi:
- login;
- `dataUsage`, `conversations`, `devices`, `blockedDevices`, `ownMac`, `softwareVersion`, `nightMode`;
- sendSms, markRead, deleteSms;
- connect, disconnect, reboot;
- setNightMode, setDns, setBands, rename, block, unblock.

Due implementazioni:

**`actor ZTEClient`**
- `URLSession` con cookie automatici al posto degli interceptor axios. Header `Referer` e `X-Requested-With`. Timeout 10 s, 4 s in background.
- **Una sola sessione:** `withSession { }` intercetta `SessionExpired`, riusa **un unico** `Task` di login condiviso da tutte le richieste concorrenti e ritenta una volta. Sostituisce `reloginRef`, `passwordRef` e le altre scorciatoie.
- **Token AD:** `MD5(MD5(wa_inner_version + cr_version) + RD)`. La prima metà non cambia per tutta la sessione, quindi va in cache: ogni scrittura passa da 2 GET a 1 (resta solo `RD`).
- **Hash del login:** `SHA256(SHA256(pw).HEX + LD).HEX`, con CryptoKit.
- **`FormEncoding`:** un unico encoder per query e body, che replica axios/jQuery: lo spazio diventa `+`, `,` e `:` restano in chiaro, tutto il resto è percent-encoded, **`+` incluso**. Questo è il punto critico: `URLComponents` lascia `+` in chiaro, e il router leggerebbe `+39…` come uno spazio, sbagliando il destinatario degli SMS.
- **Lettura del JSON:** `JSONSerialization` più un helper che legge i campi come stringhe anche quando arrivano come numeri. Niente `Codable` rigido su un'API non documentata.
- **Errori tipizzati:** `SessionExpired`, `SmsListUnavailable`, `wrongPassword`, `loginFailed(code)`, `commandFailed(code)` e `whitelistActive`. Il messaggio tradotto lo sceglie la UI. Un timeout arriva come `URLError.timedOut`: niente più ricerca della stringa `"10000ms"`.

**`ZTEParsing`** contiene funzioni pure, testate (§9):
- UCS2 hex in entrambe le direzioni, sulle unità UTF-16, come `charCodeAt`;
- date ZTE;
- raggruppamento in conversazioni;
- bande CA;
- tipo di rete;
- eNB, calcolato **una volta**. Oggi è duplicato in tre punti di `index.tsx` e `router-api.ts`;
- link lteitaly, con le eccezioni PLMN `22201`→`2221`, `22299`→`22288`, `22250`+6 cifre→`22288`;
- unione `station_list` + `hostNameList`;
- maschera delle bande in `UInt64`: il bit più alto è la banda 38, che sta comodamente nei 64 bit. Il valore auto `0x20080800C5` l'ho verificato bit per bit: B1, B3, B7, B8, B20, B28, B38;
- validazione degli hostname;
- SSID.

**`actor DemoClient`** produce i dati grezzi e li fa passare dagli **stessi parser** del client reale, come fa oggi `DemoRouterApi`. Ritardi e dati sono gli stessi di oggi.

## 4. Stato

**`@Observable @MainActor final class RouterStore`**: un file base più un'estensione per area. Sostituisce le 966 righe di `router-context.tsx`.

- **`auth: AuthState`** vale `.idle`, `.loading`, `.loggedIn` oppure `.failed(RouterError)`. Il login automatico parte all'avvio e quando l'app torna attiva dopo un errore.
- **Polling:** un solo `Task` attivo solo con `scenePhase == .active` e login fatto. Ogni giro esegue `async let` su SMS, consumi e dispositivi, aggiorna ciascuna parte solo se la sua lettura riesce, poi `Task.sleep(3 s)`. I giri non si sovrappongono per costruzione, quindi spariscono `pollInFlightRef` e `mountedRef`. In background il polling si ferma (oggi continua finché iOS non sospende l'app).
- **Snapshot del router + intenzioni locali al posto del contatore di generazione.** `conversations` è calcolato da:
  `snapshot del router` − `deletedIDs` (in memoria) + `outbox` (messaggi inviati non ancora restituiti dal router), con i `readIDs` applicati.
  Un poll "vecchio" non può più cancellare una modifica locale, perché le intenzioni vengono riapplicate a ogni snapshot. Un messaggio esce dall'outbox quando il router restituisce un SMS inviato con lo stesso numero e lo stesso testo. Se l'invio fallisce esce subito, con un alert (oggi spariva in silenzio). Se un'eliminazione fallisce, gli ID tornano visibili e compare un alert. Si eliminano così `beginSmsMutation`, `endSmsMutation`, `generation`, `pending` e `isStale`.
- **`networkStatus`** è derivato da `dataUsage.pppStatus`, più un flag di transizione per connessione e disconnessione in corso. Oggi lo aggiorna solo `loadDataUsage` e non il polling.
- **Niente flag `isLoading*`:** `.refreshable` attende direttamente la funzione `async`, e il primo caricamento si riconosce da `dataUsage == nil`.
- **Persistenza:**

  | Dato | Dove |
  |---|---|
  | Password | Keychain (oggi è in chiaro) |
  | URL, limite dati, ID letti e noti, dispositivi nascosti, icone | `UserDefaults` tramite `Preferences` |

- **Modalità demo:** le sue preferenze (letti, nascosti, icone) vivono **solo in memoria**, quindi non serve il codice di pulizia di `exitDemo()`. Le credenziali `demo`/`demo` si salvano come oggi, così l'app si riapre in demo.

## 5. Notifiche e background

**`actor SMSNotifier`** è condiviso da polling e background, quindi le due strade non si pestano i piedi sugli ID noti.
- Notifica gli SMS ricevuti con ID non noti. Titolo = nome del contatto, `userInfo` = numero.
- **Baseline:** se per quel router non c'è ancora un elenco di ID noti, adotta la lista attuale **senza notificare**. Oggi un primo login fatto dalle Impostazioni notifica tutti gli SMS vecchi.
- **Potatura:** dopo ogni lista completa, gli ID noti e letti vengono ridotti a quelli ancora presenti sul router. Senza questo crescono all'infinito, e se il router riusa un ID dopo un'eliminazione l'SMS nuovo verrebbe considerato già noto o già letto.

**`BackgroundRefresh`:** `BGAppRefreshTask` al posto di `BGProcessingTask`. Il processing gira di rado, di solito in carica. Il refresh è pensato proprio per controlli brevi e frequenti, e il budget (circa 30 s) basta per login + 1 GET. Si riprogramma a ogni esecuzione e quando l'app va in background; prima richiesta tra 15 minuti. In demo salta.

**Tap sulla notifica:** passa ad `AppRouter`, che apre la tab Messaggi con la chat in cima. Funziona anche ad app chiusa.

**Notifiche in primo piano:** banner, elenco e suono, come oggi.

## 6. Design system e componenti

**`Tokens.swift`**:
- `Palette` usa colori di sistema semantici: `secondarySystemBackground`, `label`, `secondaryLabel`, `opaqueSeparator`, `systemGray5` per la bolla ricevuta, e così via. I valori custom (`#1C1C1E`, `#F2F2F7`, `#8E8E93`…) oggi li approssimano già.
- Restano custom solo `accent #208AEF`, la coppia adattiva `lime`/`rose` e il gradiente degli avatar.
- `Typography` usa Dynamic Type, con stile `rounded` per i valori numerici.
- `Spacing`, `Radius` (card a 24) e `Motion`.

**Componenti** (ognuno usato almeno due volte):

| Componente | Sostituisce | Usato in |
|---|---|---|
| `InfoCard` | `DashboardCard` | 8 card della Home |
| `UsageRing` | SVG animato | Home |
| `MessageComposer` | `MessageInputBar` + `SendButton` + `NativeGlassView` | Chat, Nuovo messaggio |
| `Avatar` | `ConversationAvatar` | Lista messaggi, suggerimenti dei contatti |
| `DeviceIcon` | il pozzetto con il simbolo, in 3 punti | Riga del dispositivo, sheet, griglia |
| `AutoManualForm` | due schermate quasi identiche | DNS, Bande |
| `SaveToolbarButton` | due `headerRight` copiati | DNS, Bande |
| `confirmAction(...)` | `confirmAction` di `devices.tsx` e gli alert sparsi | Dispositivi, Messaggi, Riavvio |
| `swipeIcon(_:)` | `SymbolImage` nativo | Swipe action |
| `fittedSheet()` | `BottomSheet` dentro un `Host` di dimensione zero | Modifica dispositivo |

**Scelte visive:**
- I titoli grandi sono nativi (`navigationTitle`), al posto degli header finti con dissolvenza Reanimated e `LinearGradient`.
- La sfocatura sotto la barra è nativa e scorre insieme alla schermata durante il push, quindi `ScrollEdgeContainer` non serve più.
- Impostazioni, DNS, Bande e Dispositivi usano `Form`/`List` `insetGrouped` con i colori di sistema. In modalità chiara le card diventano bianche su fondo grigio, cioè lo stile di Impostazioni di iOS. Oggi è il contrario, grigio su bianco.
- **Icona Home:** `house.fill`. `home.fill` è un simbolo **privato**: l'ho verificato, non esiste nell'API pubblica.
- **Pallino dei non letti sulla tab:** `message.badge.filled.fill` con palette blu, renderizzato una volta in `UIImage(.alwaysOriginal)` con API pubblica, in circa 10 righe al posto della patch Objective-C. Se la tab bar di SwiftUI non rispetta l'immagine originale, si usa `.badge` con il conteggio (da verificare nel prototipo).
- Con iOS 26 come minimo spariscono i fallback `legacySymbol` e `minIOS` del catalogo delle icone.
- Gli stati vuoti, di caricamento e di errore usano `ContentUnavailableView` e `ProgressView`.

## 7. Dati dall'app Expo

**`LegacyStorage`** fa la migrazione una sola volta al primo avvio, poi segna la chiave `migrated` e non tocca più i file.
- Legge `Application Support/com.filippoalessandrini.routy/RCTAsyncLocalStorage_V1/manifest.json`.
- I valori lunghi più di 1024 caratteri non sono nel manifest (valore `null`) ma in un file accanto, chiamato con l'MD5 della chiave in esadecimale minuscolo. L'ho verificato nel sorgente di AsyncStorage 2.2.0.
- Chiavi migrate:

  | Chiave | Destinazione |
  |---|---|
  | `@routy/password` | Keychain |
  | `router_url`, `data_limit_value`, `data_limit_unit`, `known_sms_ids`, `read_ids`, `hidden_devices`, `device_icons` | `Preferences` |

  Gli ID con prefisso `demo-` e le icone dei MAC demo vengono scartati.
- Risultato: nessun nuovo login, nessuna raffica di notifiche, e dispositivi nascosti e icone conservati.

## 8. Schermate

| Schermata | SwiftUI | Cosa sparisce |
|---|---|---|
| Tab | `TabView` con `Tab` per Home, Messaggi e Impostazioni, `NavigationStack` per tab, `enum Route { chat(number), devices, bands, dns }` | `NativeTabs` e la patch |
| **Home** | `ScrollView` con `UsageRing`, griglia di `InfoCard` e `.refreshable`. Il tap sulla velocità alterna le unità. La card Cella apre lteitaly al tap; la pressione prolungata apre `.contextMenu` con "Copia link" (copiare era l'azione di oggi). Le card Dispositivi e Bande sono `NavigationLink` | `Animated` + SVG, header finto, `RefreshControl` con offset fisso |
| **Messaggi** | `List(.plain)` con `.swipeActions` (tinta rossa, alert prima di eliminare) e `.refreshable`. Pulsante "Scrivi" nella toolbar (glass di sistema). Stati di caricamento ed errore con "Riprova" | `Host`, `scrollTopInset`, `useScrollGeometryChange`, Reanimated |
| **Chat** | `ScrollView` + `LazyVStack` con `.defaultScrollAnchor(.bottom)`, sia per la posizione iniziale sia per i cambi di dimensione: **si apre sull'ultimo messaggio** e ci resta quando arriva la tastiera o un messaggio nuovo. Composer in `.safeAreaBar(edge: .bottom)`, `.scrollDismissesKeyboard(.interactively)`. Separatori di giorno e spazio tra mittenti diversi come oggi. `markRead` all'apertura | `isReady` + opacità 0, `initialNumToRender`, listener della tastiera, `scrollToOffset`, `KeyboardAvoidingView`, `ScrollEdgeContainer` |
| **Nuovo messaggio** | `.sheet` con `NavigationStack`, pulsante di chiusura di sistema, campo "A:", suggerimenti (5, per nome o numero), chip del contatto scelto (Backspace lo toglie), `MessageComposer`. Il numero viene normalizzato come oggi: si tolgono spazi, `()-.`, `00`→`+`, e 10 cifre che iniziano per 3 diventano `+39` | `Modal`, `KeyboardAvoidingView`, `GlassView` |
| **Dispositivi** | `List(.insetGrouped)`, una `Section` per dispositivo (le card di oggi), intestazioni con `.textCase(nil)`. Gruppi Connessi, Disconnessi e Bloccati con tutte le regole di oggi: "Tu" in blu, telefono in cima, ordinamento `compare(_:options: [.caseInsensitive, .diacriticInsensitive, .numeric])`, equivalente al `localeCompare` di oggi, MAC come spareggio. Swipe solo a destra, nello stesso ordine | `Host`, `symbolMonochrome`, `textCaseNone`, `SymbolImage` |
| **Modifica dispositivo** | `.sheet(item:)` + `fittedSheet()`. Anteprima dell'icona che segue il nome mentre lo scrivi, griglia 4×4, focus e griglia mutuamente esclusivi con `@FocusState`, validazione del nome, Annulla/Conferma | `useNativeState`, `FILL_WIDTH = 10000`, `Host` di dimensione zero |
| **Impostazioni** | `Form`: router (`TextField` e `SecureField`, Salva e connetti / Esci dalla demo), rete (SSID, `Toggle` dati, IP pubblico, DNS, limite con `TextField(.numberPad)` + `Picker(.segmented)` GB/TB), modalità notte (`Toggle` e due `DatePicker(.hourAndMinute)`), info (modello, stato con pallino, versione), pulsante Riavvia distruttivo | gestione manuale della selezione, selettore animato a mano, `DateTimePicker` |
| **DNS / Bande** | `AutoManualForm`: modalità con spunte, contenuto disattivato in automatico, Salva attivo solo con modifiche, validazione, alert di esito. Nei campi DNS la virgola diventa punto | due copie dello stesso codice |

## 9. Verifica: niente errori

1. **Test di parità.** Uno script Node (`native/scripts/golden.mjs`) esegue le funzioni pure **dell'app Expo attuale** su un insieme di input e scrive le uscite in `RoutyTests/Fixtures/golden.json`. I test Swift devono dare esattamente gli stessi risultati. Le funzioni coperte:
   - hash del login e token AD;
   - encode e decode UCS2, emoji comprese;
   - date ZTE;
   - `groupByConversation`;
   - maschere delle bande;
   - bande CA;
   - eNB e link lteitaly;
   - SSID;
   - hostname;
   - serializzazione axios dei parametri.

   Dove l'app Expo ha un bug (§10), il test fissa il comportamento corretto e lo dichiara nel nome.
2. **Simulatore iOS 26.5, modalità demo:** ogni schermata e ogni azione della tabella del §8.
3. **iPhone (iOS 27):**
   - installazione sopra l'app Expo: avvio senza schermo nero, dati migrati, nessuna notifica duplicata. Gli eventuali crash si leggono con `devicectl`;
   - task in background forzato da LLDB con `_simulateLaunchForTaskWithIdentifier`.
4. **Router reale.** Va fatto da te, perché il router è sulla tua rete:
   - invio a un numero `+39…`;
   - rinomina con spazi;
   - blocco e sblocco;
   - DNS e bande;
   - modalità notte;
   - scadenza della sessione (login dalla dashboard web mentre l'app è aperta);
   - i due punti aperti del §10.

## 10. Bug dell'app Expo corretti nella nativa

1. **Fuso orario degli SMS inviati:** `sms_time` lo fissa a `+2`, sbagliato con l'ora solare. Si calcola dal fuso del telefono, come fa la dashboard ZTE.
2. **Date nella lista messaggi:** sempre in italiano (`it-IT`, `"ieri"`), anche con l'app in inglese. Diventano localizzate.
3. **Riavvio:** l'alert di successo compare due volte (`router-context.tsx:663` e `settings.tsx:177`).
4. **Nome dell'operatore:** `hexToUtf16` lancia un errore su `spn_name_data` vuoto e fa fallire tutto `fetchDataUsage`. Inoltre i fallback sono inventati: `"VERY"` per l'operatore e `"4G"` per il tipo di rete. Diventano `network_provider` e `"-"`.
5. **Stato della rete dati:** l'interruttore non segue il polling (vedi §4).
6. **Primo login dalle Impostazioni:** notifica tutti gli SMS vecchi (vedi §5).
7. **ID noti e letti:** crescono senza limite e sono a rischio quando il router riusa un ID (vedi §5).
8. **Errori silenziosi:** un invio fallito in chat sparisce senza dire nulla, e un'eliminazione fallita non mostra errori.
9. **Testi in italiano fissi nel codice:** `"Impossibile ottenere il salt LD…"`, `"Invio fallito"`, `"Impossibile aprire l'URL."`. Diventano testi tradotti.
10. **Password in chiaro** in AsyncStorage: va nel Keychain.
11. **Contatti:** non si aggiornano se cambia la rubrica; serve `CNContactStoreDidChange`. Inoltre `0039…` non viene normalizzato come `+39…`.
12. **Numeri non codificati:** `decodeZTE` applicato a un numero in chiaro (es. `+393331234567`) restituisce caratteri senza senso, e il `|| raw.number` non scatta perché la stringa non è vuota. Si decodifica solo se la stringa è esadecimale e lunga un multiplo di 4. Gli screenshot reali mostrano nomi risolti correttamente, quindi il tuo router manda i numeri codificati e per te non cambia nulla: è robustezza in più.
13. **Background:** `BGProcessingTask` gira di rado; passa a `BGAppRefreshTask`.
14. **API private e polling:** l'icona `home.fill` usa un'API privata, e il polling resta attivo in background.
15. **Pulizia:** 5 chiavi di traduzione non usate (`messages.send`, `settings.status_disconnecting`, `settings.status_disconnected`, `common.info`, `common.save`). Dalla richiesta dei consumi si tolgono i campi mai usati: `wan_apn` e `wifi_access_sta_num`, perché il conteggio della Home viene dalla lista dei dispositivi.

**Da verificare sul router (punti aperti):**
- **Unità della velocità.** L'app divide `realtime_*_thrpt` per 1024 e lo chiama "Kbps". Altri client ZTE trattano il valore come **byte/s** (vedi `zte-mf286-api`, `realtime()`). In quel caso la Home mostra KiB/s etichettati come kbit/s, sottostimando la velocità di circa 8 volte. Va confrontato una volta con uno speed test: se confermato, si mostra in Mbps (`× 8 / 1_000_000`).
- **B32 nella modalità automatica.** È tra le bande selezionabili ma non nella maschera auto, per cui in automatico la UI la mostra spuntata anche se il router non la usa. Comportamento conservato, solo segnalato.

## 11. Ordine di lavoro

1. **Base:** progetto, `Tokens`, `AppDelegate` con finestra, tab e navigazione, String Catalog generati da `it.json`/`en.json`, con i placeholder `%{x}` convertiti in `%@`.
2. **Router:** livello router, `FormEncoding`, `DemoClient`, test di parità (tutti verdi prima di andare avanti).
3. **Stato:** `RouterStore`, `Preferences`, Keychain, `LegacyStorage`, `SMSNotifier`, `BackgroundRefresh`, contatti.
4. **Schermate:** Messaggi, Chat, Nuovo messaggio, Home, Dispositivi con il suo sheet, Impostazioni, DNS e Bande.
5. **Verifica:** §9 punti 2 e 3, poi la checklist del punto 4 sul router consegnata a te.
6. **Chiusura:** `native/README.md` e `native/DESIGN.md`, commit per fase su un branch.

Stima: circa 2.500–3.000 righe Swift, contro le circa 6.000 righe TS più patch e plugin di oggi.
