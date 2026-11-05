import SwiftUI

/// A router setting that is either automatic or manual, with the manual values below and a Save
/// button that only works once something changed. Used by the DNS and LTE band screens.
struct AutoManualForm<Values: View>: View {
	let title: String
	let modeHeader: String
	let automaticLabel: String
	let manualLabel: String
	let valuesHeader: String
	@Binding var mode: SettingMode
	let hasChanges: Bool
	let save: () async -> Void
	@ViewBuilder let values: Values

	@State private var isSaving = false

	var body: some View {
		Form {
			Section {
				modeRow(.auto, automaticLabel)
				modeRow(.manual, manualLabel)
			} header: {
				header(modeHeader)
			}
			.cardRows()
			Section {
				values
					.disabled(mode == .auto)
					.opacity(mode == .auto ? Metrics.disabledOpacity : 1)
			} header: {
				header(valuesHeader)
			}
			.cardRows()
		}
		.cardList()
		.navigationTitle(title)
		.navigationBarTitleDisplayMode(.inline)
		.detailScreen()
		.toolbar {
			ToolbarItem(placement: .confirmationAction) {
				if isSaving {
					ProgressView()
				} else {
					Button(L("settings.save")) {
						Task {
							isSaving = true
							await save()
							isSaving = false
						}
					}
					.disabled(!hasChanges)
				}
			}
		}
	}

	private func modeRow(_ value: SettingMode, _ label: String) -> some View {
		CheckmarkRow(label: label, isChecked: mode == value) { mode = value }
	}
}

/// A row that toggles or picks something, with a checkmark when it's on.
struct CheckmarkRow: View {
	let label: String
	let isChecked: Bool
	let action: () -> Void

	var body: some View {
		Button(action: action) {
			HStack {
				Text(label).foregroundStyle(Palette.textPrimary)
				Spacer()
				if isChecked {
					Image(systemName: "checkmark")
						.fontWeight(.semibold)
						.foregroundStyle(Palette.accent)
				}
			}
			.contentShape(.rect)
		}
	}
}

/// A Form section header written as is, not upper-cased.
func header(_ title: String) -> some View {
	Text(title)
		.font(Typography.sectionTitle)
		.foregroundStyle(Palette.textSecondary)
		.textCase(nil)
}
