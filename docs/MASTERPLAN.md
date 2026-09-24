# Masterplan

Piano di implementazione delle prossime funzionalità di Routy.

| # | Funzionalità | Area | Stato |
|---|---|---|---|
| 1 | Dimenticare dispositivi disconnessi | Dispositivi | Da fare |
| 2 | SSID 2.4 GHz / 5 GHz separati | Impostazioni › Rete e consumi | Da fare |

---

## 1. Dimenticare dispositivi disconnessi

### Obiettivo

Nella schermata **Dispositivi**, un tap su un dispositivo della sezione **Disconnessi** chiede:

> **Vuoi dimenticare questo dispositivo?**
> `Annulla` · `Conferma`

Con **Conferma** il dispositivo sparisce dalla lista dei disconnessi e non ricompare più, anche dopo riavvii dell'app o del router.

### Contesto

- I disconnessi sono le voci di `hostNameList` (memoria del router) senza IP. Li produce `RouterApi.fetchDevices()` in [router-api.ts](../src/services/router-api.ts), unendo `station_list` e `hostNameList` per MAC.
- La separazione connessi/disconnessi avviene in [devices.tsx](../src/app/devices.tsx) con `!d.ip || d.ip === "-"`.
- Non conosciamo un comando goform affidabile per cancellare voci da `hostNameList` sull'MF289F. L'occultamento quindi è **locale**, persistito in AsyncStorage e indicizzato per **MAC**, l'identificativo stabile che l'app già usa come `key`.

### Implementazione

**1. Stato persistente, in [router-context.tsx](../src/context/router-context.tsx)**
- Nuova chiave: `const STORAGE_KEY_HIDDEN_DEVICES = '@routy/hidden_devices'`, un array JSON di MAC in maiuscolo.
- Stato `hiddenDeviceMacs: Set<string>`, caricato in `init()` insieme alle altre chiavi, con lo stesso `try/catch` sul `JSON.parse` usato per `knownIds`/`readIds`.
- Nuova azione `hideDevice(mac: string): Promise<void>`: normalizza con `mac.toUpperCase()`, aggiorna lo stato in modo immutabile (nuovo `Set`) e scrive su AsyncStorage.
- Esporre `hiddenDeviceMacs` e `hideDevice` in `RouterContextValue` e nel `value` del provider.

**2. Filtro e interazione, in [devices.tsx](../src/app/devices.tsx)**
- Filtro: `knownDevices = devices.filter(d => isDisconnected(d) && !hiddenDeviceMacs.has(d.mac.toUpperCase()))`.
- `connectedDevices` **non** viene filtrato: un dispositivo dimenticato che torna online compare sempre tra i Connessi.
- Estrarre `isDisconnected(d)` in una funzione, oggi duplicata in due punti.
- Solo le righe disconnesse vanno avvolte in un `Pressable` (con feedback `opacity` al press). Il `onPress` chiama:
  ```ts
  Alert.alert(t("devices.forget_title"), `${device.hostname}\n${device.mac}`, [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("common.confirm"), style: "destructive", onPress: () => hideDevice(device.mac) },
  ]);
  ```
- Le righe connesse restano non interattive, come oggi.
- La sezione "Disconnessi" sparisce da sola quando è vuota: il `.filter(s => s.data.length > 0)` c'è già.

**3. Testi, in [it.json](../src/i18n/locales/it.json) e [en.json](../src/i18n/locales/en.json)**
- `devices.forget_title`: "Vuoi dimenticare questo dispositivo?" / "Forget this device?"
- `common.confirm`: "Conferma" / "Confirm"
- `common.cancel`: "Annulla" / "Cancel"
- **Bug preesistente:** `common.cancel`, `common.confirm_reboot`, `common.error_generic` e `common.success` sono già usate in `settings.tsx` ma mancano in entrambi i JSON, quindi gli alert mostrano `[missing "it.common.cancel" translation]`. Aggiungerle nello stesso intervento.

**4. Modalità demo, in [demo-router-api.ts](../src/services/demo-router-api.ts)**
- Aggiungere a `fetchDevices()` 2–3 dispositivi con `ip: "-"`, così la funzione è testabile senza router.
- In `exitDemo()` rimuovere dal set nascosto i MAC dei dispositivi demo, così una nuova sessione demo riparte pulita.

### Casi limite

| Caso | Comportamento |
|---|---|
| Dispositivo dimenticato torna online | Compare tra i Connessi; il flag resta, quindi quando si disconnette sparisce di nuovo |
| MAC con case diverso tra `station_list` e `hostNameList` | Già normalizzato in `fetchDevices()`; `hideDevice` normalizza comunque |
| Tutti i disconnessi dimenticati | Sezione "Disconnessi" nascosta |
| Cambio router nelle impostazioni | Il set è globale; i MAC sono univoci, nessun conflitto |

### Decisioni aperte

- **Ripristino:** è fuori scope. Se servirà, basterà una voce "Ripristina dispositivi dimenticati" nelle Impostazioni che svuota la chiave.
- **Auto-ripristino al ritorno online:** di default no, perché la richiesta è "permanentemente". In alternativa si può togliere il flag quando il MAC compare tra i connessi.

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

## Ordine di lavoro e verifica

1. **Funzione 2 per prima:** più piccola, tocca solo API e impostazioni. `tsc` guida il rename di `ssid`.
2. **Funzione 1:** context, schermata, i18n.
3. **Modalità demo** aggiornata per entrambe.
4. **Controlli:** `npx tsc --noEmit`, `npx expo lint` (nessun nuovo errore nei file toccati), `npx expo export --platform ios`.
5. **Prova sul simulatore in modalità demo:**
   - [ ] Tap su un disconnesso → alert → `Annulla`: nulla cambia
   - [ ] Tap su un disconnesso → alert → `Conferma`: sparisce
   - [ ] Riavvio app: il dispositivo resta nascosto
   - [ ] Tap su un connesso: nessuna azione
   - [ ] Impostazioni in demo: due righe SSID
6. **Prova sul router reale:** SSID unico e SSID separati.
