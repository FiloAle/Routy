# Routy Native

SwiftUI version of Routy, with no third-party dependencies. Requires iOS 26.

Open `Routy.xcodeproj` in Xcode and run the `Routy` scheme. It has the Expo app's bundle ID (`com.filippoalessandrini.routy`), so it installs as an update of it. The demo mode works as before: address `demo`, password `demo`.

## Structure

| Folder | Contents |
|---|---|
| `Routy/App` | Entry point and window, tabs, navigation |
| `Routy/DesignSystem` | Tokens and reusable components. Rules are in [DESIGN.md](DESIGN.md) |
| `Routy/Router` | The `goform` client, the demo client, parsing, parameter encoding, models |
| `Routy/Logic` | Text shown on screen, device icons |
| `Routy/Store` | App state, preferences, Keychain, migration from the Expo app |
| `Routy/Services` | Contacts, SMS notifications, background refresh |
| `Routy/Screens` | Home, Messages, Chat, New message, Devices, Settings, DNS, LTE bands |
| `RoutyTests` | Parity with the Expo app and the bugs fixed since |

## Data from the Expo app

On first launch `LegacyStorage` reads what the Expo app kept in AsyncStorage (`Application Support/<bundle ID>/RCTAsyncLocalStorage_V1`): the password goes to the Keychain, everything else to `UserDefaults`, demo data is dropped. It then deletes those files, which held the password in plain text.

## Tests

`RoutyTests/golden.json` holds what the Expo app's own TypeScript returns for fixed inputs: hashes, UCS2, dates, conversations, router data, the fields of every write command, and how parameters are encoded. Regenerate it after changing the TypeScript, from the repository root:

```bash
node native/scripts/golden.mjs
```

Then run the tests:

```bash
xcodebuild -project native/Routy.xcodeproj -scheme Routy -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

## Translations

`Localizable.xcstrings` and `InfoPlist.xcstrings` are generated from the Expo app's `src/i18n/locales`, plus `scripts/strings-native.json` for strings only this app has. Edit those files, not the catalogs, then run:

```bash
node native/scripts/strings.mjs
```

## On the router

Things the simulator can't check, to try once with the real router:

- Sending an SMS to a `+39…` number, renaming a device with spaces in its name, blocking and unblocking, DNS, bands and night mode.
- Logging into the router's web dashboard while the app is open: the app should log in again on its own.
- The throughput unit: the app shows `realtime_*_thrpt / 1024` as "Kbps", as the Expo app did. Other ZTE clients read the value as bytes per second, in which case the speed is about 8 times higher. Compare once with a speed test; the conversion is in `Formatting.speed`.
- Background notifications: in Xcode, pause the app and run `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.filippoalessandrini.routy.refresh"]`, then resume.
