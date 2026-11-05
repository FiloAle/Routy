import SwiftUI

struct DNSScreen: View {
	@Environment(RouterStore.self) private var store
	/// What the router has, loaded on appear.
	@State private var saved = (mode: SettingMode.auto, primary: "", secondary: "")
	@State private var mode = SettingMode.auto
	@State private var primary = ""
	@State private var secondary = ""
	@State private var alert: AlertItem?

	private var hasChanges: Bool {
		mode != saved.mode || (mode == .manual && (primary != saved.primary || secondary != saved.secondary))
	}

	var body: some View {
		AutoManualForm(
			title: L("settings.config_dns"),
			modeHeader: L("settings.dns_mode"),
			automaticLabel: L("settings.dns_automatic"),
			manualLabel: L("settings.dns_manual"),
			valuesHeader: L("settings.dns_server"),
			mode: $mode,
			hasChanges: hasChanges,
			save: save
		) {
			field(L("settings.dns_primary"), placeholder: "1.1.1.1", text: $primary)
			field(L("settings.dns_secondary"), placeholder: "1.0.0.1", text: $secondary)
		}
		.onAppear(perform: load)
		.alert($alert)
	}

	private func field(_ label: String, placeholder: String, text: Binding<String>) -> some View {
		LabeledContent(label) {
			TextField(placeholder, text: text)
				.multilineTextAlignment(.trailing)
				.keyboardType(.numbersAndPunctuation)
				.textInputAutocapitalization(.never)
				.autocorrectionDisabled()
				.foregroundStyle(mode == .manual ? Palette.textPrimary : Palette.textSecondary)
				// Some keyboards type a comma as the decimal separator.
				.onChange(of: text.wrappedValue) { text.wrappedValue = text.wrappedValue.replacingOccurrences(of: ",", with: ".") }
		}
	}

	private func load() {
		guard let usage = store.dataUsage else { return }
		saved = (usage.dnsMode, usage.preferDNS, usage.standbyDNS)
		(mode, primary, secondary) = saved
	}

	private func save() async {
		guard hasChanges else { return }
		if mode == .manual, primary.trimmingCharacters(in: .whitespaces).isEmpty {
			alert = AlertItem(title: L("settings.attention"), message: L("settings.dns_error_msg"))
			return
		}
		let values = mode == .manual
			? (mode, primary.trimmingCharacters(in: .whitespaces), secondary.trimmingCharacters(in: .whitespaces))
			: (mode, "", "")
		do {
			try await store.setDNS(mode: values.0, primary: values.1, secondary: values.2)
			saved = values
			alert = AlertItem(title: L("settings.saved_title"), message: L("settings.dns_success_msg"))
		} catch {
			alert = AlertItem(title: L("settings.attention"), message: L("settings.dns_error_msg"))
		}
	}
}
