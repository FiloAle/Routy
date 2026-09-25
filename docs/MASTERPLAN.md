# Masterplan

Piano di implementazione delle prossime funzionalità di Routy.

| # | Funzionalità | Area | Stato |
|---|---|---|---|
| 1 | Dimenticare dispositivi disconnessi | Dispositivi | Fatto |
| 2 | SSID 2.4 GHz / 5 GHz separati | Impostazioni › Rete e consumi | Da fare |
| 3 | Icona personalizzata dei dispositivi | Dispositivi | Da fare |

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

## 2. SSID 2.4 GHz e 5 GHz separati

### Obiettivo

In **Impostazioni › Rete e consumi**, mostrare due righe, **SSID 2.4 GHz** e **SSID 5 GHz**, solo quando il router restituisce due SSID **diversi e non vuoti**. In tutti gli altri casi resta la riga **SSID** attuale, senza indicare la banda.

### Contesto

- Oggi `fetchDataUsage()` chiede solo `wifi_chip1_ssid1_ssid` e lo mappa in `ssid: data.wifi_chip1_ssid1_ssid || "Unknown"`.
- Comandi goform:
  - `wifi_chip1_ssid1_ssid` = 2.4 GHz
  - `wifi_chip2_ssid1_ssid` = 5 GHz
- Con un SSID unico per tutte le bande, uno dei due valori arriva **vuoto**.

### Regole di visualizzazione

Valori considerati dopo `trim()`:

| 2.4 GHz | 5 GHz | Risultato |
|---|---|---|
| `A` | `B` (≠ A) | Due righe: `SSID 2.4 GHz: A`, `SSID 5 GHz: B` |
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
      { label: "SSID 2.4 GHz", value: a },
      { label: "SSID 5 GHz", value: b },
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

## 3. Icona personalizzata dei dispositivi

### Obiettivo

Nella schermata **Dispositivi**, un tap sull'icona di un dispositivo apre un **popover compatto** ancorato all'icona, con una piccola griglia di SF Symbols. Scegliendone uno, diventa l'icona di quel dispositivo, anche dopo riavvii dell'app o del router.

L'aspetto è quello del selettore di icone di Promemoria: cerchi pieni grigi con il simbolo al centro, e un anello attorno all'icona selezionata.

### Contesto

- **Nessun selettore nativo pubblico.** iOS non offre un selettore di SF Symbols: quello di Promemoria è interno all'app di Apple. Va quindi ricostruito con viste SwiftUI di `@expo/ui`.
- **Il popover resta un popover.** Il `Popover` di `@expo/ui` applica già `.presentationCompactAdaptation(.popover)` da iOS 16.4, il target minimo dell'app, quindi anche su iPhone resta un popover compatto con la freccia e non diventa un bottom sheet.
- **Righe SwiftUI.** La lista Dispositivi è già una `List` SwiftUI, quindi popover e griglia si innestano direttamente nella riga.

### Simboli, in questo ordine

| # | ID opzione | SF Symbol | Disponibile da |
|---|---|---|---|
| 1 | `iphone` | `iphone` | iOS 14 |
| 2 | `ipad` | `ipad` | iOS 14 |
| 3 | `watch` | `applewatch` | iOS 14 |
| 4 | `computer` | `desktopcomputer` | iOS 13 |
| 5 | `macbook` | `macbook` (fallback `laptopcomputer`) | iOS 17 (fallback iOS 14) |
| 6 | `tv` | `tv` | iOS 13 |
| 7 | `speaker` | `homepod.and.homepod.mini` (fallback `homepod.2`) | iOS 18 (fallback iOS 14) |
| 8 | `console` | `gamecontroller` | iOS 13 |
| 9 | `printer` | `printer` | iOS 13 |
| 10 | `light` | `lightbulb` | iOS 13 |
| 11 | `doorbell` | `video.doorbell` | iOS 16 |
| 12 | `plug` | `poweroutlet.type.b` | iOS 16 |
| 13 | `wifi` | `wifi` | iOS 13 |

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
  { id: "speaker", symbol: "homepod.and.homepod.mini", legacySymbol: "homepod.2", minIOS: 18 },
  { id: "console", symbol: "gamecontroller" },
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
];
export function inferIconFromName(hostname: string): DeviceIconId | null;
```

**Icona automatica.** È l'icona che il dispositivo ha quando non ne è stata scelta una a mano. Si decide in quest'ordine:
1. dal **nome** con `inferIconFromName`: "iPhone di Filippo" → `iphone`, "iPad" → `ipad`, "MacBook-Pro" → `macbook`;
2. altrimenti dal **tipo di connessione**, come oggi: `wifi` per wireless, `desktopcomputer` per cavo.

Una scelta manuale ha sempre la precedenza sull'icona automatica. Le regole sul nome si possono estendere in futuro (per esempio "Watch" → `watch`, "iMac" → `computer`) aggiungendo righe a `NAME_RULES`.

**2. Stato persistente, in [router-context.tsx](../src/context/router-context.tsx)**
- Chiave `STORAGE_KEY_DEVICE_ICONS = '@routy/device_icons'`: oggetto JSON `{ [MAC maiuscolo]: DeviceIconId }`.
- Stato `deviceIcons`, caricato in `init()` con lo stesso `try/catch` delle altre chiavi. Gli ID sconosciuti, per esempio rimossi in futuro, vengono ignorati.
- Azione `setDeviceIcon(mac, id | null)`: con `null` rimuove la scelta e torna all'icona automatica. Aggiorna lo stato in modo immutabile e salva su AsyncStorage.
- Stesso schema di `hiddenDeviceMacs` della funzione 1: conviene implementarle insieme.

**3. Icona della riga e popover, in [devices.tsx](../src/app/devices.tsx)**
- Il riquadro dell'icona (40pt) diventa un `Button` con `buttonStyle("plain")`, così è tappabile solo l'icona e non tutta la riga (e non interferisce con la swipe action della funzione 1).
- È avvolto in `Popover` con `attachmentAnchor="bottom"`, `arrowEdge="top"` e `isPresented` controllato. Basta uno stato unico per schermata, `pickerFor: string | null` (il MAC della riga aperta).
- Icona mostrata, sempre in grigio per i disconnessi:
  1. scelta manuale → `symbolFor(id)`;
  2. altrimenti icona dal nome (`inferIconFromName`);
  3. altrimenti `wifi` per wireless e `desktopcomputer` per cavo. Per i disconnessi senza icona scelta né riconosciuta dal nome resta `wifi.slash`.
- Accessibilità: `accessibilityLabel` del pulsante "Cambia icona" e `accessibilityValue` con il nome dell'icona attuale.

**4. Griglia, nuovo componente `DeviceIconPicker`**
- `Grid` di `@expo/ui` con 13 icone su 4 colonne (`Grid.Row`: 4 + 4 + 4 + 1), `horizontalSpacing`/`verticalSpacing` di 12 e `padding` di 16. Circa 240×240pt: resta compatto nel popover.
- Ogni cella: `Button` (`buttonStyle("plain")`) con uno `ZStack` di 44pt.
  - `Circle` riempito con `palette.fill` e il simbolo a 20pt con `palette.text`.
  - Cella selezionata: anello esterno, un `Circle` con `strokeBorder` di 2pt in `palette.secondaryText` e diametro 52pt, come nello screenshot di Promemoria.
- Sotto la griglia, un pulsante testuale "Icona automatica" che cancella la scelta manuale (`setDeviceIcon(mac, null)`) e torna all'icona automatica, cioè quella dal nome o dal tipo di connessione. È visibile solo se c'è una scelta manuale.
- Nella griglia l'anello indica l'icona attualmente mostrata, anche se automatica.
- Il tap su un'icona salva subito e chiude il popover (`pickerFor = null`).
- Il componente riceve `palette`, quindi segue la light/dark mode come il resto della lista.

**5. Testi, in [it.json](../src/i18n/locales/it.json) e [en.json](../src/i18n/locales/en.json)**
- `devices.change_icon`: "Cambia icona" / "Change icon"
- `devices.automatic_icon`: "Icona automatica" / "Automatic icon"
- `devices.icons.<id>` per VoiceOver: iPhone, iPad, Apple Watch, Computer, MacBook, TV, Altoparlante / Speaker, Console, Stampante / Printer, Lampadina / Light bulb, Campanello / Doorbell, Presa / Smart plug, Wi-Fi.

**6. Modalità demo**
- Nessun dato nuovo: i dispositivi demo bastano per provare la funzione.
- In `exitDemo()` vanno rimosse dal salvataggio le icone dei MAC demo, come per i dispositivi nascosti della funzione 1.

### Casi limite

| Caso | Comportamento |
|---|---|
| iOS 16 e icona "MacBook" | `laptopcomputer` al posto di `macbook` |
| iOS 16–17 e icona "Altoparlante" | `homepod.2` al posto di `homepod.and.homepod.mini` |
| Nome con più corrispondenze (es. "iPhone-MacBook") | Vince la prima regola in `NAME_RULES` |
| Il router rinomina il dispositivo | L'icona automatica si aggiorna col nuovo nome; una scelta manuale resta |
| ID salvato non più presente nel catalogo | Ignorato: si torna all'icona automatica |
| Dispositivo dimenticato (funzione 1) | L'icona scelta resta salvata; se il dispositivo ricompare, la ritrova |
| Swipe sulla riga mentre il popover è aperto | Il popover è modale: il primo tap fuori lo chiude |

### Decisioni prese

- **Disconnessi:** il simbolo (scelto o automatico) si mostra in grigio, così il dispositivo resta riconoscibile e il grigio indica che è offline. `wifi.slash` resta solo quando non c'è né una scelta né un nome riconosciuto.
- **"Icona automatica":** resta sotto la griglia, perché con le regole sul nome l'icona automatica è utile e serve un modo per tornarci dopo una scelta manuale.

---

## Ordine di lavoro e verifica

1. **Funzione 2 per prima:** più piccola, tocca solo API e impostazioni. `tsc` guida il rename di `ssid`.
2. **Funzioni 1 e 3 insieme:** condividono lo schema di persistenza per MAC nel context e la riga di `devices.tsx`, cioè swipe action e popover sull'icona.
3. **Modalità demo** aggiornata per tutte.
4. **Controlli:** `npx tsc --noEmit`, `npx expo lint` (nessun nuovo errore nei file toccati), `npx expo export --platform ios`.
5. **Prova sul simulatore in modalità demo:**
   - [ ] Swipe su un disconnesso → "Dimentica" → alert → `Annulla`: nulla cambia
   - [ ] Swipe su un disconnesso → "Dimentica" → alert → `Conferma`: sparisce
   - [ ] Swipe completo su un disconnesso: compare direttamente l'alert
   - [ ] Riavvio app: il dispositivo resta nascosto
   - [ ] Swipe su un connesso: nessuna azione
   - [ ] Impostazioni in demo: due righe SSID
   - [ ] Icone automatiche in demo: "iPhone di Filippo" → iPhone, "iPad" → iPad, "MacBook-Pro" → MacBook
   - [ ] Tap sull'icona di un dispositivo: si apre il popover compatto (niente bottom sheet) con le 13 icone nell'ordine previsto
   - [ ] Tap su un'icona: salva, chiude il popover, l'icona della riga cambia
   - [ ] Riavvio app: l'icona scelta resta
   - [ ] "Icona automatica": torna all'icona dal nome o dal tipo di connessione
   - [ ] Tap sul resto della riga: nessun popover
   - [ ] Light e dark mode: griglia e anello di selezione leggibili
6. **Prova sul router reale:** SSID unico e SSID separati.
