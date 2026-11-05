import SwiftUI

struct SettingsScreen: View {
	@Environment(RouterStore.self) private var store
	@State private var addressInput = ""
	@State private var passwordInput = ""
	@State private var isSaving = false
	@State private var alert: AlertItem?

	var body: some View {
		Form {
			routerSection
			// Its own section, so the card above keeps its rounded corners.
			Section {
				prominentButton(store.isDemo ? L("settings.exit_demo") : L("settings.save_and_connect"), color: Palette.accent, isLoading: isSaving) {
					if store.isDemo { store.exitDemo() } else { Task { await save() } }
				}
			}
			networkSection
			nightModeSection
			infoSection
			Section {
				prominentButton(L("settings.reboot"), color: Palette.rose) {
					alert = AlertItem(
						title: L("settings.reboot"),
						message: L("common.confirm_reboot"),
						confirmation: .init(
							label: L("settings.reboot"),
							action: { try await store.reboot() },
							failure: L("settings.reboot_error"),
							success: (L("common.success"), L("settings.reboot_success"))
						)
					)
				}
			}
		}
		.cardList()
		.scrollIndicators(.hidden)
		// Switches in the app blue, as in the Expo app.
		.tint(Palette.accent)
		.navigationTitle(L("settings.title"))
		.alert($alert)
		// The fields follow the saved values, e.g. when they load or after leaving demo mode.
		.onChange(of: store.address, initial: true) { addressInput = Address.host(of: store.address) }
		.onChange(of: store.password, initial: true) { passwordInput = store.password }
		.task(id: store.auth) {
			guard store.auth == .loggedIn else { return }
			await store.loadNightMode()
			await store.refreshDataUsage()
		}
	}

	// MARK: - Sections

	private var routerSection: some View {
		Section {
			LabeledContent(L("settings.address")) {
				TextField("192.168.0.1", text: $addressInput)
					.keyboardType(.URL)
					.onChange(of: addressInput) { addressInput = Address.host(of: addressInput) }
			}
			LabeledContent(L("settings.password")) {
				SecureField("••••••••", text: $passwordInput)
			}
		} header: {
			header(L("settings.router"))
		}
		.cardRows()
		// The button below belongs to this card.
		.listSectionSpacing(Spacing.md)
		.multilineTextAlignment(.trailing)
		.textInputAutocapitalization(.never)
		.autocorrectionDisabled()
	}

	private var networkSection: some View {
		Section {
			if let usage = store.dataUsage {
				ForEach(Formatting.ssidEntries(ssid24: usage.ssid24, ssid5: usage.ssid5), id: \.label) { entry in
					LabeledContent(entry.label, value: entry.value)
				}
			}
			Toggle(L("settings.data_network"), isOn: Binding(get: { store.isDataConnected }, set: setDataConnection))
				.disabled(store.pendingDataConnection != nil)
			if let ip = store.dataUsage?.wanIP, !ip.isEmpty {
				LabeledContent(L("settings.public_ip"), value: ip)
			}
			NavigationLink(value: Route.dns) {
				LabeledContent(L("settings.dns"), value: store.dataUsage?.dnsMode == .manual ? L("settings.dns_manual") : L("settings.dns_automatic"))
			}
			LabeledContent(L("settings.data_limit")) {
				HStack(spacing: Spacing.md) {
					TextField("0", text: Binding(get: { store.dataLimitValue }) { value in
						store.setDataLimit(value: value.filter { $0.isASCII && $0.isNumber }, unit: store.dataLimitUnit)
					})
					.keyboardType(.numberPad)
					.multilineTextAlignment(.trailing)
					Picker(L("settings.data_limit"), selection: Binding(get: { store.dataLimitUnit }) { unit in
						store.setDataLimit(value: store.dataLimitValue, unit: unit)
					}) {
						ForEach(DataLimitUnit.allCases, id: \.self) { Text($0.label).tag($0) }
					}
					.pickerStyle(.segmented)
					.fixedSize()
				}
			}
		} header: {
			header(L("settings.network"))
		}
		.cardRows()
	}

	private var nightModeSection: some View {
		Section {
			Toggle(L("settings.night_mode"), isOn: nightModeBinding(\.enabled))
			DatePicker(L("settings.night_mode_start"), selection: timeBinding(\.start), displayedComponents: .hourAndMinute)
			DatePicker(L("settings.night_mode_end"), selection: timeBinding(\.end), displayedComponents: .hourAndMinute)
		} header: {
			header(L("settings.night_mode"))
		}
		.cardRows()
		.disabled(store.nightMode == nil)
	}

	private var infoSection: some View {
		Section {
			LabeledContent(L("settings.model"), value: store.softwareInfo?.model ?? "...")
			LabeledContent(L("settings.info_connection")) {
				HStack(spacing: Spacing.sm) {
					Circle()
						.fill(statusColor)
						.frame(width: Metrics.statusDot, height: Metrics.statusDot)
					Text(statusText)
					if store.auth == .loading { ProgressView() }
				}
			}
			LabeledContent(L("settings.software_version"), value: store.softwareInfo?.version ?? "...")
		} header: {
			header(L("settings.info"))
		}
		.cardRows()
	}

	private var statusColor: Color {
		switch store.auth {
		case .idle: Palette.textSecondary
		case .loading: Palette.accent
		case .loggedIn: Palette.lime
		case .failed: Palette.red
		}
	}

	private var statusText: String {
		switch store.auth {
		case .idle: L("settings.status_idle")
		case .loading: L("settings.status_connecting")
		case .loggedIn: L("settings.status_connected")
		case .failed: L("settings.status_error")
		}
	}

	/// A full-width colored button between the sections.
	private func prominentButton(_ title: String, color: Color, isLoading: Bool = false, action: @escaping () -> Void) -> some View {
		Button(action: action) {
			Group {
				if isLoading { ProgressView().tint(Palette.onAccent) } else { Text(title).fontWeight(.semibold) }
			}
			.frame(maxWidth: .infinity)
		}
		.buttonStyle(.borderedProminent)
		.buttonBorderShape(.capsule)
		.controlSize(.large)
		.tint(color)
		.disabled(isLoading)
		.listRowInsets(EdgeInsets())
		.listRowBackground(Color.clear)
	}

	// MARK: - Actions

	private func save() async {
		let address = Address.normalized(addressInput)
		let password = passwordInput.trimmingCharacters(in: .whitespacesAndNewlines)
		guard !password.isEmpty else {
			alert = AlertItem(title: L("settings.attention"), message: L("settings.enter_pw_alert"))
			return
		}
		isSaving = true
		store.saveSettings(address: address, password: password)
		let success = await store.login()
		isSaving = false
		if success, store.isDemo {
			alert = AlertItem(title: L("settings.demo_enabled"))
		} else if success {
			alert = AlertItem(title: L("settings.login_success_title"), message: L("settings.login_success_msg"))
		} else {
			alert = AlertItem(title: L("settings.saved_title"), message: L("settings.saved_msg"))
		}
	}

	private func setDataConnection(_ connected: Bool) {
		Task {
			do { try await store.setDataConnection(connected) } catch { alert = .error(L("settings.error_conn")) }
		}
	}

	private func nightModeBinding(_ keyPath: WritableKeyPath<NightMode, Bool>) -> Binding<Bool> {
		Binding(get: { store.nightMode?[keyPath: keyPath] ?? false }) { value in
			update { $0[keyPath: keyPath] = value }
		}
	}

	/// "HH:mm" on the router, a date for the picker.
	private func timeBinding(_ keyPath: WritableKeyPath<NightMode, String>) -> Binding<Date> {
		Binding {
			let parts = (store.nightMode?[keyPath: keyPath] ?? "00:00").split(separator: ":").compactMap { Int($0) }
			return Calendar.current.date(bySettingHour: parts.first ?? 0, minute: parts.dropFirst().first ?? 0, second: 0, of: .now) ?? .now
		} set: { date in
			let time = Calendar.current.dateComponents([.hour, .minute], from: date)
			update { $0[keyPath: keyPath] = String(format: "%02d:%02d", time.hour ?? 0, time.minute ?? 0) }
		}
	}

	private func update(_ change: (inout NightMode) -> Void) {
		guard var nightMode = store.nightMode else { return }
		change(&nightMode)
		let updated = nightMode
		Task {
			do { try await store.setNightMode(updated) } catch { alert = .error(L("common.error_generic")) }
		}
	}
}
