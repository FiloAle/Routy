# Masterplan

Piano di implementazione delle prossime funzionalità di Routy.

| # | Funzionalità | Area | Stato |
|---|---|---|---|
| 1 | Dimenticare dispositivi disconnessi | Dispositivi | Fatto |
| 2 | SSID 2.4GHz / 5GHz separati | Impostazioni › Rete e consumi | Fatto, da provare sul router |
| 3 | Pannello "Modifica": icona e nome | Dispositivi | Fatto, da provare sul router |
| 4 | Bloccare i connessi ed etichetta "Tu" | Dispositivi | Fatto, da provare sul router |

---

## 1. Dimenticare dispositivi disconnessi

### Obiettivo

Nella schermata **Dispositivi**, uno swipe verso sinistra su un dispositivo della sezione **Disconnessi** mostra l'azione nativa "Dimentica". Toccandola, o con uno swipe completo, compare:

> **Vuoi dimenticare questo dispositivo?**
> `Annulla` · `Conferma`

Con **Conferma** il dispositivo sparisce dalla lista dei disconnessi finché resta offline, anche dopo riavvii dell'app o del router. Quando si riconnette torna noto e non è più dimenticato.

Accanto a "Dimentica" (arancione) c'è **Blocca** (rosso, `nosign`): aggiunge il MAC alla blacklist Wi-Fi del router (`setDeviceAccessControlList`). I bloccati hanno una sezione **Bloccati**, visibile solo se non vuota, con lo swipe verde **Riabilita**.

### Contesto

- I disconnessi sono le voci di `hostNameList` (memoria del router) senza IP. Li produce `RouterApi.fetchDevices()` in [router-api.ts](../src/services/router-api.ts), unendo `station_list` e `hostNameList` per MAC.
- [devices.tsx](../src/app/devices.tsx) è una `List` SwiftUI (`@expo/ui`) in stile `insetGrouped` con **una `Section` per dispositivo**, così ogni dispositivo è una card separata. La separazione connessi/disconnessi usa `isDisconnected(d)` (`!d.ip || d.ip === "-"`).
- La web UI del router non ha un comando per cancellare voci da `hostNameList`: `DEL_DEVICE` è `removeChildGroup` del parental control, non la memoria dei dispositivi. L'occultamento quindi è **locale**, persistito in AsyncStorage e indicizzato per **MAC**, l'identificativo stabile che l'app già usa come `key`.

### Implementazione

**1. Stato persistente, in [router-context.tsx](../src/context/router-context.tsx)**
- Nuova chiave: `const STORAGE_KEY_HIDDEN_DEVICES = '@routy/hidden_devices'`, un array JSON di MAC in maiuscolo.
- Stato `hiddenDeviceMacs: Set<string>`, caricato in `init()` insieme alle altre chiavi, con lo stesso `try/catch` sul `JSON.parse` usato per `knownIds`/`readIds`.
- Nuova azione `hideDevice(mac: string): Promise<void>`: normalizza con `mac.toUpperCase()`, aggiorna lo stato in modo immutabile (nuovo `Set`) e scrive su AsyncStorage.
- Esporre `hiddenDeviceMacs` e `hideDevice` in `RouterContextValue` e nel `value` del provider.

**2. Filtro e swipe action, in [devices.tsx](../src/app/devices.tsx)**
- Filtro del gruppo Disconnessi: `devices.filter(d => isDisconnected(d) && !hiddenDeviceMacs.has(d.mac.toUpperCase()))`.
- I Connessi **non** vengono filtrati: un dispositivo dimenticato che torna online compare sempre tra i Connessi.
- Ogni riga è avvolta in `SwipeActions` con i modifier della card. L'azione è sempre `trailing`, così lo swipe verso destra resta libero per il gesto indietro di iOS: "Dimentica" sui disconnessi, "Rinomina" (`EDIT_HOSTNAME`) sui connessi. Per i disconnessi:
  ```tsx
  <SwipeActions modifiers={cardModifiers}>
    <DeviceRow device={device} palette={palette} />
    <SwipeActions.Actions edge="trailing">
      <Button
        label={t("devices.forget")}
        systemImage="eye.slash"
        modifiers={[labelStyle("iconOnly"), tint(Colors.routyRed)]}
        onPress={() => confirmForget(device)}
      />
    </SwipeActions.Actions>
  </SwipeActions>
  ```
- **Niente `role="destructive"`:** SwiftUI toglierebbe la riga prima della conferma, lo stesso motivo per cui la lista Messaggi usa `tint`. Lo swipe completo (`allowsFullSwipe`, attivo di default) lancia subito l'azione.
- `confirmForget` mostra l'alert e, con **Conferma**, chiama `hideDevice`:
  ```ts
  Alert.alert(t("devices.forget_title"), `${device.hostname}\n${device.mac}`, [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("common.confirm"), style: "destructive", onPress: () => hideDevice(device.mac) },
  ]);
  ```
- Il gruppo "Disconnessi" sparisce da solo quando è vuoto: il `.filter(g => g.data.length > 0)` c'è già.

**3. Testi, in [it.json](../src/i18n/locales/it.json) e [en.json](../src/i18n/locales/en.json)**
- `devices.forget_title`: "Vuoi dimenticare questo dispositivo?" / "Forget this device?"
- `devices.forget`: "Dimentica" / "Forget" (etichetta VoiceOver del pulsante con sola icona)
- `common.confirm`: "Conferma" / "Confirm"
- `common.cancel`: "Annulla" / "Cancel"
- **Bug preesistente:** `common.cancel`, `common.confirm_reboot`, `common.error_generic` e `common.success` sono già usate in `settings.tsx` ma mancano in entrambi i JSON, quindi gli alert mostrano `[missing "it.common.cancel" translation]`. Aggiungerle nello stesso intervento.

**4. Modalità demo, in [demo-router-api.ts](../src/services/demo-router-api.ts)**
- `fetchDevices()` restituisce già 3 dispositivi disconnessi (`ip: "-"`), quindi la funzione è testabile senza router.
- In `exitDemo()` rimuovere dal set nascosto i MAC dei dispositivi demo (`DEMO_DEVICE_MACS`), così una nuova sessione demo riparte pulita.

### Casi limite

| Caso | Comportamento |
|---|---|
| Dispositivo dimenticato torna online | Compare tra i Connessi e il flag viene tolto: se si disconnette di nuovo, torna tra i Disconnessi |
| MAC con case diverso tra `station_list` e `hostNameList` | Già normalizzato in `fetchDevices()`; `hideDevice` normalizza comunque |
| Tutti i disconnessi dimenticati | Sezione "Disconnessi" nascosta |
| Cambio router nelle impostazioni | Il set è globale; i MAC sono univoci, nessun conflitto |

### Decisioni aperte

- **Ripristino manuale:** è fuori scope. Se servirà, basterà una voce "Ripristina dispositivi dimenticati" nelle Impostazioni che svuota la chiave.

---

## 2. SSID 2.4GHz e 5GHz separati

### Obiettivo

In **Impostazioni › Rete e consumi**, mostrare due righe, **SSID 2.4GHz** e **SSID 5GHz**, solo quando il router restituisce due SSID **diversi e non vuoti**. In tutti gli altri casi resta la riga **SSID** attuale, senza indicare la banda.

### Contesto

- Oggi `fetchDataUsage()` chiede solo `wifi_chip1_ssid1_ssid` e lo mappa in `ssid: data.wifi_chip1_ssid1_ssid || "Unknown"`.
- Comandi goform:
  - `wifi_chip1_ssid1_ssid` = 2.4GHz
  - `wifi_chip2_ssid1_ssid` = 5GHz
- Con un SSID unico per tutte le bande, uno dei due valori arriva **vuoto**.

### Regole di visualizzazione

Valori considerati dopo `trim()`:

| 2.4GHz | 5GHz | Risultato |
|---|---|---|
| `A` | `B` (≠ A) | Due righe: `SSID 2.4GHz: A`, `SSID 5GHz: B` |
| `A` | `A` | Una riga: `SSID: A` |
| `A` | vuoto | Una riga: `SSID: A` |
| vuoto | `B` | Una riga: `SSID: B` |
| vuoto | vuoto | Nessuna riga |

### Implementazione

**1. API, in [router-api.ts](../src/services/router-api.ts)**
- Aggiungere `wifi_chip2_ssid1_ssid` alla stringa `cmd` di `fetchDataUsage()`.
- In `DataUsage`, sostituire `ssid: string` con:
  ```ts
  ssid24: string; // wifi_chip1_ssid1_ssid, "" se assente
  ssid5: string;  // wifi_chip2_ssid1_ssid, "" se assente
  ```
- Mappare con `(data.wifi_chip1_ssid1_ssid ?? "").trim()` e l'equivalente per il chip 2. Togliere il fallback `"Unknown"`: il caso "nessun SSID" ora lo gestisce la UI.

**2. Logica pura, nuovo file `src/utils/wifi.ts`**
```ts
export interface SsidEntry { label: string; value: string }

export function getSsidEntries(ssid24: string, ssid5: string): SsidEntry[] {
  const a = ssid24.trim();
  const b = ssid5.trim();
  if (a && b && a !== b) {
    return [
      { label: "SSID 2.4GHz", value: a },
      { label: "SSID 5GHz", value: b },
    ];
  }
  const single = a || b;
  return single ? [{ label: "SSID", value: single }] : [];
}
```
Tenendola separata dalla UI, la regola si verifica a colpo d'occhio e si può testare in isolamento. Le etichette restano letterali come l'attuale "SSID": sono sigle universali, non serve i18n.

**3. UI, in [settings.tsx](../src/app/(tabs)/settings.tsx), sezione "Rete e consumi"**
- Sostituire il blocco `dataUsage?.ssid && (...)` con un `map` su `getSsidEntries(dataUsage.ssid24, dataUsage.ssid5)`. Ogni voce rende la stessa `infoRow` + `divider` di oggi, con `key={entry.label}`.
- Il resto della card (Rete dati, IP pubblico, DNS, bande) non cambia.

**4. Modalità demo, in [demo-router-api.ts](../src/services/demo-router-api.ts)**
- `fetchDataUsage()` restituisce `ssid24: "Routy-Demo"` e `ssid5: "Routy-Demo-5G"`, così in demo si vede il caso a due righe.

**5. Altri consumatori**
- `dataUsage.ssid` oggi è usato solo in `settings.tsx`. Dopo la modifica, `tsc` segnala eventuali usi residui: il rename è voluto proprio per farli emergere.

### Verifica sul router reale

- Nel log `[RouterApi] Raw statistics response` controllare che `wifi_chip2_ssid1_ssid` sia presente.
- Provare entrambe le configurazioni del router: SSID unico e SSID separati per banda.

---

## 3. Pannello "Modifica" del dispositivo: icona e nome

### Obiettivo

Lo swipe **Modifica** (matita blu, oggi "Rinomina" e solo sui connessi) su un dispositivo **connesso o disconnesso** apre un **pannello dal basso** che raccoglie in un solo posto icona e nome:

```
┌──────────────────────────────┐
│             ───              │  indicatore di trascinamento
│           ( 💻 )             │  icona attuale, 72pt: il tap apre/chiude la griglia
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐         │
│  └──┘ └──┘ └──┘ └──┘  …      │  griglia dei simboli (solo se aperta)
│  ┌────────────────────────┐  │
│  │ MacBook-Pro            │  │  campo del nome, già compilato
│  └────────────────────────┘  │
│  Messaggio di errore         │  solo se il nome non è valido
│  [ Annulla ]  [ Conferma ]   │
└──────────────────────────────┘
```

- **Icona in alto al centro.** Il tap espande sotto di sé la griglia dei simboli, un secondo tap la richiude. Scegliere un simbolo aggiorna subito l'anteprima in alto; la griglia resta aperta, così si possono confrontare più icone, e si chiude solo col focus sul campo del nome.
- **Campo del nome.** Contiene il nome attuale e, al tap, apre la tastiera per modificarlo.
- **Annulla / Conferma.** Nulla viene salvato finché non si conferma: Annulla, o il pannello chiuso col trascinamento, scarta le modifiche.

Sostituisce sia il popover sull'icona della riga (il piano precedente) sia l'`Alert.prompt` della rinomina di oggi.

**Swipe action risultanti**, da sinistra a destra. L'ultima sta sul bordo e parte con lo swipe completo, sempre dopo l'alert di conferma:

| Sezione | Azioni |
|---|---|
| Connessi | Modifica (blu) · Blocca (rosso), vedi funzione 4 |
| Disconnessi | Modifica (blu) · Dimentica (arancione) · Blocca (rosso) |
| Bloccati | Riabilita (verde) |

### Fattibilità

Tutti i pezzi esistono in `@expo/ui` (SDK 57), senza codice nativo nuovo:

| Pezzo | Componente |
|---|---|
| Pannello dal basso | `BottomSheet` con `fitToContents`, che adatta l'altezza al contenuto, e `presentationDragIndicator("visible")` |
| Espansione animata della griglia | Modifier `animation(Animation.easeInOut(...), gridOpen)` sul contenuto del pannello |
| Griglia dei simboli | `Grid` con `Grid.Row` |
| Campo del nome | `TextField` con `useNativeState(nomeAttuale)` per il testo iniziale e `onTextChange` |
| Pulsanti | `Button` con `buttonStyle("bordered")` e `buttonStyle("borderedProminent")` |

**Punti da verificare nel prototipo:**
- **Altezza con `fitToContents`.** Il pannello deve crescere in modo fluido quando la griglia si apre. In caso contrario, si usano i detent `medium` e `large` con `presentationDetents`.
- **Tastiera.** Il pannello SwiftUI sale da solo sopra la tastiera, ma con la griglia aperta rischia di non starci. Per questo il focus sul campo richiude la griglia, e il tap sull'icona chiude la tastiera. Una sola delle due è aperta alla volta.
- **Posizione del `BottomSheet`.** Va nello stesso `Host` della `List`: è la presentazione `.sheet` di SwiftUI, agganciata a una vista.

### Contesto

- **Nessun selettore nativo pubblico.** iOS non offre un selettore di SF Symbols: quello di Promemoria è interno all'app di Apple. La griglia va quindi ricostruita con viste SwiftUI.
- **Rinomina sul router.** Il nome si salva con `EDIT_HOSTNAME` (`RouterApi.renameDevice`), con le regole di validazione della dashboard già in `hostnameError`.
- **Icona in locale.** Il router non memorizza icone, quindi l'icona scelta resta sul telefono, in AsyncStorage per MAC, come i dispositivi dimenticati.

### Simboli, in questo ordine

| # | ID opzione | SF Symbol | Disponibile da |
|---|---|---|---|
| 1 | `iphone` | `iphone` | iOS 14 |
| 2 | `ipad` | `ipad` | iOS 14 |
| 3 | `watch` | `applewatch` | iOS 14 |
| 4 | `computer` | `desktopcomputer` | iOS 13 |
| 5 | `macbook` | `macbook` (fallback `laptopcomputer`) | iOS 17 (fallback iOS 14) |
| 6 | `tv` | `tv` | iOS 13 |
| 7 | `mediastick` | `mediastick` | iOS 15 |
| 8 | `speaker` | `homepod.and.homepod.mini` (fallback `homepod.2`) | iOS 18 (fallback iOS 14) |
| 9 | `console` | `gamecontroller` | iOS 13 |
| 10 | `drive` | `externaldrive` | iOS 14 |
| 11 | `printer` | `printer` | iOS 13 |
| 12 | `light` | `lightbulb` | iOS 13 |
| 13 | `doorbell` | `video.doorbell` | iOS 16 |
| 14 | `plug` | `poweroutlet.type.b` | iOS 16 |
| 15 | `wifi` | `wifi` | iOS 13 |

Disponibilità verificata nel catalogo `CoreGlyphs` di iOS 27. L'app supporta da iOS 16.4, quindi due simboli hanno un fallback: `macbook` richiede iOS 17 (sotto si usa `laptopcomputer`) e `homepod.and.homepod.mini` richiede iOS 18 (sotto si usa `homepod.2`). `Image(systemName:)` con un nome inesistente non mostra nulla, quindi la scelta va fatta in JS con `Platform.Version`.

Si salva l'**ID dell'opzione**, non il nome del simbolo: fallback e cambi di nome restano gestiti in un solo punto, la mappa ID → simbolo.

### Implementazione

**1. Catalogo, nuovo file `src/constants/deviceIcons.ts`**
```ts
export const DEVICE_ICONS = [
  { id: "iphone", symbol: "iphone" },
  { id: "ipad", symbol: "ipad" },
  { id: "watch", symbol: "applewatch" },
  { id: "computer", symbol: "desktopcomputer" },
  { id: "macbook", symbol: "macbook", legacySymbol: "laptopcomputer", minIOS: 17 },
  { id: "tv", symbol: "tv" },
  { id: "mediastick", symbol: "mediastick" },
  { id: "speaker", symbol: "homepod.and.homepod.mini", legacySymbol: "homepod.2", minIOS: 18 },
  { id: "console", symbol: "gamecontroller" },
  { id: "drive", symbol: "externaldrive" },
  { id: "printer", symbol: "printer" },
  { id: "light", symbol: "lightbulb" },
  { id: "doorbell", symbol: "video.doorbell" },
  { id: "plug", symbol: "poweroutlet.type.b" },
  { id: "wifi", symbol: "wifi" },
] as const;

export type DeviceIconId = (typeof DEVICE_ICONS)[number]["id"];
export function symbolFor(id: DeviceIconId): string; // applica il fallback con Platform.Version

// Icona automatica dal nome del dispositivo, senza distinzione di maiuscole: prima regola che corrisponde.
const NAME_RULES: { match: RegExp; id: DeviceIconId }[] = [
  { match: /iphone/i, id: "iphone" },
  { match: /ipad/i, id: "ipad" },
  { match: /macbook/i, id: "macbook" },
  { match: /stick/i, id: "mediastick" }, // prima di "tv": "FireTV-Stick" è una chiavetta
  { match: /tv/i, id: "tv" },
  { match: /nas|drive/i, id: "drive" },
];
export function inferIconFromName(hostname: string): DeviceIconId | null;
```

**Icona automatica.** È l'icona che il dispositivo ha quando non ne è stata scelta una a mano. Si decide in quest'ordine:
1. dal **nome** con `inferIconFromName`: "iPhone di Filippo" → `iphone`, "iPad" → `ipad`, "MacBook-Pro" → `macbook`, "Amazon-FireTV-Stick" → `mediastick`, "Smart-TV" → `tv`, "NAS" e "My-Drive" → `drive`. Se il nome contiene sia "stick" sia "tv" vince `mediastick`;
2. altrimenti dal **tipo di connessione**, come oggi: `wifi` per wireless, `desktopcomputer` per cavo.

Una scelta manuale ha sempre la precedenza sull'icona automatica. Le regole sul nome si possono estendere in futuro (per esempio "Watch" → `watch`, "iMac" → `computer`) aggiungendo righe a `NAME_RULES`.

**2. Stato persistente, in [router-context.tsx](../src/context/router-context.tsx)**
- Chiave `STORAGE_KEY_DEVICE_ICONS = '@routy/device_icons'`: oggetto JSON `{ [MAC maiuscolo]: DeviceIconId }`.
- Stato `deviceIcons`, caricato in `init()` con lo stesso `try/catch` delle altre chiavi. Gli ID sconosciuti, per esempio rimossi in futuro, vengono ignorati.
- Azione `setDeviceIcon(mac, id | null)`: con `null` rimuove la scelta e torna all'icona automatica. Stesso schema di `hideDevice` (ref + stato + AsyncStorage).
- In `exitDemo()` si tolgono le icone dei MAC demo (`DEMO_DEVICE_MACS`), come per i dispositivi dimenticati.

**3. Icona della riga, in [devices.tsx](../src/app/devices.tsx)**
- La riga non diventa tappabile: si modifica solo dallo swipe.
- Icona mostrata, in ordine di priorità:
  1. **bloccati:** sempre `nosign`;
  2. **scelta manuale:** `symbolFor(id)`;
  3. **icona dal nome:** `inferIconFromName`;
  4. **tipo di connessione:** `wifi` per wireless, `desktopcomputer` per cavo. Per i disconnessi senza scelta né nome riconosciuto resta `wifi.slash`.
- I disconnessi mostrano il simbolo in grigio, come oggi.

**4. Pannello, nuovo componente `DeviceEditSheet`**
- Stato della schermata: `editing: Device | null`. Lo swipe "Modifica" lo imposta, la chiusura del pannello lo azzera.
- Stato interno del pannello: `draftIcon: DeviceIconId | null` (con `null` = automatica), `nameState = useNativeState(device.hostname)` e `gridOpen: boolean`.
- **Icona in alto:** `Button` con `buttonStyle("plain")`. Dentro c'è uno `ZStack` con `Circle` di 72pt in `Colors.routyBlue` e il simbolo bianco a 32pt, come la cella selezionata della griglia. Il tap esegue `withAnimation` su `gridOpen` e chiude la tastiera.
- **Griglia**, visibile solo con `gridOpen`:
  - 16 celle su 4 colonne: **Automatica** per prima (`sparkles`), poi i 15 simboli nell'ordine della tabella.
  - Celle da 44pt, spaziature di 12pt.
  - La cella selezionata ha l'anello di 2pt e il cerchio pieno in `Colors.routyBlue`, lo stesso blu del pulsante Conferma, con il simbolo in bianco.
  - Il tap su una cella imposta `draftIcon`; la griglia resta aperta.
- **Campo del nome:** `TextField` in `textFieldStyle("roundedBorder")`. `onFocusChange(true)` richiude la griglia.
- **Errore del nome:** sotto il campo, in `Colors.routyRed`, mostra il testo di `hostnameError` mentre si scrive. Sostituisce l'alert d'errore che riapre il prompt.
- **Pulsanti:** Annulla (`bordered`) e Conferma (`borderedProminent` con `tint(Colors.routyBlue)`, pulsante primario).
  - Conferma è disabilitato se il nome non è valido o se non è cambiato nulla.
  - Mentre salva mostra un `ProgressView` e resta disabilitato.
- **Conferma** salva solo ciò che è cambiato:
  1. l'icona con `setDeviceIcon`, locale e immediata;
  2. il nome con `renameDevice`, sul router.
  - Se la rinomina fallisce, il pannello resta aperto con l'errore `devices.rename_failed` sotto il campo. L'icona resta salvata, perché è indipendente dal nome.

**5. Testi, in [it.json](../src/i18n/locales/it.json) e [en.json](../src/i18n/locales/en.json)**
- `devices.edit`: "Modifica" / "Edit" (etichetta VoiceOver della swipe action; sostituisce `devices.rename`)
- `devices.change_icon`: "Cambia icona" / "Change icon" (VoiceOver dell'icona in alto)
- `devices.automatic_icon`: "Icona automatica" / "Automatic icon"
- `devices.name_placeholder`: "Nome del dispositivo" / "Device name"
- `devices.icons.<id>` per VoiceOver: iPhone, iPad, Apple Watch, Computer, MacBook, TV, Chiavetta multimediale / Media stick, Altoparlante / Speaker, Console, Disco esterno / External drive, Stampante / Printer, Lampadina / Light bulb, Campanello / Doorbell, Presa / Smart plug, Wi-Fi.
- Da rimuovere: `devices.rename_title` (il pannello non ha titolo).

**6. Modalità demo**
- Nessun dato nuovo: `DemoRouterApi.renameDevice` esiste già e aggiorna la lista in memoria.

### Casi limite

| Caso | Comportamento |
|---|---|
| iOS 16 e icona "MacBook" | `laptopcomputer` al posto di `macbook` |
| iOS 16–17 e icona "Altoparlante" | `homepod.2` al posto di `homepod.and.homepod.mini` |
| Nome con più corrispondenze (es. "iPhone-MacBook", "FireTV-Stick") | Vince la prima regola in `NAME_RULES`: per "stick" e "tv" vince `mediastick` |
| Rinomina dal pannello, icona automatica | L'anteprima in alto segue il nome mentre si scrive: "iPad" → `ipad` |
| Il router rinomina il dispositivo | L'icona automatica si aggiorna col nuovo nome; una scelta manuale resta |
| ID salvato non più presente nel catalogo | Ignorato: si torna all'icona automatica |
| Dispositivo dimenticato o bloccato | L'icona scelta resta salvata; se il dispositivo torna tra i connessi, la ritrova |
| Il dispositivo si disconnette a pannello aperto | Il pannello resta aperto; nome e icona si possono salvare comunque (`EDIT_HOSTNAME` vale anche per i disconnessi) |
| Rinomina di un disconnesso | Il nuovo nome compare subito nella lista, perché `hostNameList` lo restituisce già aggiornato |
| Rinomina fallita | Pannello aperto con l'errore, icona già salvata |

### Decisioni prese

- **Modifica anche sui disconnessi:** `EDIT_HOSTNAME` vale anche per le voci di `hostNameList` offline. Nel codice di `actionsFor("disconnected")` il pulsante Modifica va **per ultimo**: in SwiftUI il primo pulsante sta sul bordo. L'ordine nel codice è quindi Blocca, Dimentica, Modifica.
- **Bloccati:** solo Riabilita. Per rinominarli si riabilitano prima.

---

## 4. Bloccare anche i dispositivi connessi ed etichetta "Tu"

### Obiettivo

Anche i dispositivi **connessi via Wi-Fi** hanno lo swipe **Blocca** (rosso, `nosign`), accanto a Modifica, con lo stesso alert dei disconnessi. Dopo la conferma il router lo disconnette dal Wi-Fi e la riga passa tra i **Bloccati**.

Il dispositivo su cui gira Routy si riconosce dal MAC e mostra, subito dopo il nome e sulla stessa riga, l'etichetta **Tu**, in regular e in grigio:

> **iPhone di Filippo** Tu
> 192.168.0.101 • A4:83:E7:12:34:56

### Contesto

- **Stesso comando.** È la blacklist Wi-Fi della funzione 1: `RouterApi.blockDevice`, con gli stessi controlli sul limite di 32 voci e sulla whitelist. Non serve codice API nuovo per il blocco.
- **Non bloccare sé stessi.** La dashboard del router impedisce di bloccare il dispositivo da cui la si usa (`black_yourself_tip` in `wifi/station_info.js`). Il client si riconosce con `cmd=get_user_mac_addr`, che restituisce il MAC di chi fa la richiesta, cioè il telefono con Routy.
- **Solo Wi-Fi.** Il filtro agisce solo sul Wi-Fi: un dispositivo via cavo resterebbe connesso, quindi per i `type: "cable"` il pulsante non compare.

### Implementazione

**1. API, in [router-api.ts](../src/services/router-api.ts)**
- `fetchOwnMac(): Promise<string | null>` con `cmd=get_user_mac_addr`, in maiuscolo. Restituisce `null` se il router non risponde.
- In [demo-router-api.ts](../src/services/demo-router-api.ts), `fetchOwnMac` restituisce il MAC di "iPhone di Filippo", così in demo si prova anche il caso "sé stessi".

**2. Stato, in [router-context.tsx](../src/context/router-context.tsx)**
- `ownMac: string | null`, letto in `loadDevices` insieme alla blacklist. Un errore non blocca la lista, come per la blacklist.

**3. Swipe action, in [devices.tsx](../src/app/devices.tsx)**
- `actionsFor("connected")`: Blocca sul bordo e Modifica accanto, quindi nel codice Blocca va per primo.
- Blocca **non compare** per i dispositivi via cavo.
- Per il **proprio dispositivo** (MAC uguale a `ownMac`) Blocca non compare. Se `ownMac` è sconosciuto, il pulsante compare e la conferma mostra un avviso in più: è il comportamento prudente, perché bloccarsi da soli si recupera solo da un altro dispositivo o via cavo.
- Stesso alert della funzione 1: "Vuoi bloccare a <nome> l'accesso alla rete?".

**4. Etichetta "Tu", in `DeviceRow`**
- **Quando:** solo per il dispositivo con MAC uguale a `ownMac`. Con `ownMac` sconosciuto non compare.
- **Nessuna riga in più:** la riga del nome diventa un `HStack` (spacing 6):
  - il nome resta `font({ size: 17, weight: "semibold" })` con `lineLimit(1)`;
  - l'etichetta è un secondo `Text` con `font({ size: 17 })` (regular), `foregroundStyle(palette.secondaryText)`, `lineLimit(1)` e `layoutPriority(1)`.
- **Nomi lunghi:** con `layoutPriority(1)` è il nome ad accorciarsi con i puntini, mentre l'etichetta resta intera. Due `Text` annidati si fonderebbero in un'unica stringa, e il troncamento taglierebbe proprio l'etichetta: per questo servono due viste affiancate.
- **Dove compare:** dove sta il dispositivo, di norma tra i Connessi. Nell'app il proprio dispositivo è per forza connesso, perché la risposta del router arriva proprio da lì.
- **Demo:** con `fetchOwnMac` della demo, l'etichetta compare su "iPhone di Filippo".

**5. Testi**
- Nessun testo nuovo per il blocco.
- `devices.this_device`: "Tu" / "You". Breve apposta: "Questo dispositivo" toglierebbe troppo spazio al nome.
- `devices.block_self_warning`: "Se è il dispositivo che stai usando, perderai la connessione al router." / "If this is the device you're using, you'll lose your connection to the router." (solo con `ownMac` sconosciuto).

### Casi limite

| Caso | Comportamento |
|---|---|
| Dispositivo connesso via cavo | Nessun pulsante Blocca |
| Telefono con indirizzo Wi-Fi privato di iOS | Il router vede quel MAC sia in `station_list` sia in `get_user_mac_addr`, quindi il confronto regge |
| Il dispositivo bloccato era connesso | Il router lo disconnette; al refresh successivo compare solo tra i Bloccati |
| Riabilitazione | Torna tra i Disconnessi finché non si ricollega, poi tra i Connessi |
| Nome lungo sul proprio dispositivo | Il nome si accorcia con i puntini, "Tu" resta intero |

---

## Ordine di lavoro e verifica

1. **Funzione 2 per prima:** più piccola, tocca solo API e impostazioni. `tsc` guida il rename di `ssid`.
2. **Funzioni 3 e 4 insieme:** toccano le stesse swipe action. La 3 riusa lo schema di persistenza per MAC della funzione 1 e trasforma "Rinomina" in "Modifica"; la 4 aggiunge Blocca ai connessi.
3. **Modalità demo** aggiornata per tutte.
4. **Controlli:** `npx tsc --noEmit`, `npx expo lint` (nessun nuovo errore nei file toccati), `npx expo export --platform ios`.
5. **Prova sul simulatore in modalità demo:**
   - [ ] Impostazioni in demo: due righe SSID
   - [ ] Icone automatiche in demo: "iPhone di Filippo" → iPhone, "iPad" → iPad, "MacBook-Pro" → MacBook, "Smart-TV" → TV, "NAS" → disco esterno
   - [ ] Swipe su un connesso via Wi-Fi: Modifica e Blocca; via cavo e sul proprio dispositivo ("iPhone di Filippo" in demo) solo Modifica
   - [ ] Blocca su un connesso: alert, poi la riga passa tra i Bloccati
   - [ ] "iPhone di Filippo" in demo: "Tu" in grigio dopo il nome, sulla stessa riga; con un nome lungo si accorcia solo il nome
   - [ ] Swipe su un disconnesso: da sinistra Modifica, Dimentica, Blocca
   - [ ] Swipe "Modifica" su un connesso e su un disconnesso: si apre il pannello con icona e nome attuali, griglia chiusa
   - [ ] Tap sull'icona: la griglia si apre con Automatica + 15 simboli nell'ordine previsto; secondo tap la chiude
   - [ ] Scelta di un simbolo: anteprima aggiornata, anello blu sulla cella, griglia ancora aperta, niente salvato
   - [ ] Tap sul campo: tastiera aperta e griglia chiusa; il pannello resta visibile sopra la tastiera
   - [ ] Nome non valido: errore sotto il campo, Conferma disabilitato
   - [ ] Annulla, o pannello trascinato giù: nessuna modifica
   - [ ] Conferma: riga aggiornata con nuovo nome e nuova icona; riavvio app: l'icona resta
   - [ ] "Automatica": torna all'icona dal nome o dal tipo di connessione
   - [ ] Light e dark mode: pannello, griglia e anello di selezione leggibili
6. **Prova sul router reale:** SSID unico e SSID separati; rinomina dal pannello; `get_user_mac_addr` restituisce il MAC del telefono e "Tu" compare sulla sua riga; blocco e riabilitazione di un dispositivo Wi-Fi connesso che si può scollegare.
