import SwiftUI

struct BandsScreen: View {
	@Environment(RouterStore.self) private var store
	@State private var saved = ZTE.decodeBandLock("")
	@State private var mode = SettingMode.auto
	@State private var bands = Set(ZTE.selectableBands)
	@State private var alert: AlertItem?

	private var hasChanges: Bool {
		mode != saved.mode || (mode == .manual && bands != saved.bands)
	}

	var body: some View {
		AutoManualForm(
			title: L("settings.config_bands"),
			modeHeader: L("settings.bands_mode"),
			automaticLabel: L("settings.bands_automatic"),
			manualLabel: L("settings.bands_manual"),
			valuesHeader: L("settings.bands_list"),
			mode: $mode,
			hasChanges: hasChanges,
			save: save
		) {
			ForEach(ZTE.selectableBands, id: \.self) { band in
				CheckmarkRow(label: band, isChecked: bands.contains(band)) {
					if bands.contains(band) { bands.remove(band) } else { bands.insert(band) }
				}
			}
		}
		.onAppear(perform: load)
		.alert($alert)
	}

	private func load() {
		saved = ZTE.decodeBandLock(store.dataUsage?.lteBandLock ?? "")
		(mode, bands) = saved
	}

	private func save() async {
		guard hasChanges else { return }
		if mode == .manual, bands.isEmpty {
			alert = AlertItem(title: L("settings.attention"), message: L("settings.bands_empty_error_msg"))
			return
		}
		let selected = mode == .manual ? bands : Set(ZTE.selectableBands)
		do {
			try await store.setBands(mode: mode, bands: ZTE.selectableBands.filter(selected.contains))
			saved = (mode, selected)
			alert = AlertItem(title: L("settings.saved_title"), message: L("settings.bands_success_msg"))
		} catch {
			alert = AlertItem(title: L("settings.attention"), message: L("settings.bands_error_msg"))
		}
	}
}
