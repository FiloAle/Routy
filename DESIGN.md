# Routy design system

Goal: the Expo app's look, with system controls wherever iOS has one.

## Rules

1. **Colors come only from `Palette`.** System colors where the Expo palette matched them, its own light and dark values where it was tuned (secondary text, lime, rose, icon wells, received bubble, avatar gradient).
2. **Text comes only from `Typography`,** built on Dynamic Type styles. Numbers use the rounded design.
3. **Spacing, corners and motion come only from `Spacing`, `Radius`, `Metrics` and `Motion`.**
4. **Use the system control first:** `NavigationStack` titles, `List` swipe actions, `Form`, `Toggle`, `DatePicker`, segmented `Picker`, `ContentUnavailableView`, alerts, sheets and Liquid Glass.
5. **A UI pattern used twice becomes a component** in `DesignSystem/Components`.
6. **Every string comes from `L(_:)`,** never a literal, so the String Catalog stays the only source.

## Components

| Component | Purpose |
|---|---|
| `AlertItem`, `.alert(_:)` | Every alert: a message, or a confirmation that runs an action and reports how it went |
| `InfoCard`, `CardRow`, `SectionTitle`, `.card()` | Dashboard cards and their grouping |
| `.cardList()`, `.cardRows()` | Lists and forms in the dashboard's colors (screen background, card rows) instead of the system's grouped gray, so every screen matches in light mode |
| `UsageRing` | Monthly usage against the user's reference |
| `MessageComposer` | Text field and send button, in a chat and in a new message |
| `Avatar` | Initials or a person on a gray gradient |
| `DeviceIconWell` | A device's symbol in a rounded well |
| `Image.outlined(_:)` | A symbol that keeps its outline in swipe actions |
| `AutoManualForm`, `CheckmarkRow`, `header(_:)` | Automatic or manual router settings (DNS, LTE bands) |
| `.tabRoot(path:)` | The tab bar shows only on the root screen of a tab, and fades as screens are pushed and popped |
| `.rowActions { }` | A row's trailing swipe actions, also on right click on the Mac |
| `SheetButtonStyle` (`.sheetPrimary`, `.sheetSecondary`) | Confirm and Cancel at the bottom of a sheet |

## Interaction rules

- Destructive actions ask for confirmation in an alert. Swipe actions use a tint, not the destructive role, which would remove the row before the alert.
- Swipe actions are trailing only, so swiping right stays the system back gesture, and show icons only; their label is the VoiceOver name.
- Changes made on the phone show at once and are taken back, with an error, if the router refuses them.

## Mac

The Mac app is the same code built with Mac Catalyst, in the iPad idiom scaled to the Mac: same controls, same look. Differences stay in `#if targetEnvironment(macCatalyst)`, as few as possible:

- A phone-shaped window, with no title or toolbar of its own.
- Row actions also on right click (`.rowActions`), and ⌘R in the View menu for what pulling down refreshes.
- Sheets fit their content (`.presentationSizing(.fitted)`), since the Mac ignores detents.
- The password is a file in the sandbox container: the app is signed only for this Mac, and the Keychain refuses it.
- Polling goes on in the background, every 30 seconds, to notify SMS: the Mac has no background refresh.
