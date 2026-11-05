import SwiftUI

/// Changes a device's icon and name. It edits a draft: nothing is saved until Confirm,
/// and Cancel or a swipe down discards the changes.
struct DeviceEditSheet: View {
	let device: Device
	@Environment(RouterStore.self) private var store
	@Environment(\.dismiss) private var dismiss
	@State private var name: String
	@State private var icon: DeviceIcon?
	@State private var isGridOpen = false
	@State private var isSaving = false
	@State private var saveError: String?
	@State private var height: CGFloat = 400
	@FocusState private var isNameFocused: Bool

	/// "Automatic" first, then the catalog; `nil` stands for the automatic icon.
	private static let options: [DeviceIcon?] = [nil] + DeviceIcon.allCases

	init(device: Device, icon: DeviceIcon?) {
		self.device = device
		_name = State(initialValue: device.hostname)
		_icon = State(initialValue: icon)
	}

	private var originalIcon: DeviceIcon? { store.icon(for: device) }
	private var nameChanged: Bool { name != device.hostname }
	private var iconChanged: Bool { icon != originalIcon }
	/// Only a new name is checked: a name the router gave may break the rules and still be kept.
	private var nameError: String? { nameChanged ? Formatting.hostnameError(name) : nil }
	private var canSave: Bool { (nameChanged || iconChanged) && nameError == nil && !isSaving }

	var body: some View {
		VStack(spacing: Spacing.xl) {
			Button(action: toggleGrid) {
				Image(systemName: DeviceIcon.symbol(for: Device(hostname: name, ip: device.ip, mac: device.mac, type: device.type), manual: icon))
					.font(.system(size: 32))
					.symbolRenderingMode(.monochrome)
					.foregroundStyle(Palette.onAccent)
					.frame(width: 72, height: 72)
					.background(Palette.accent, in: .circle)
			}
			.buttonStyle(.plain)
			.accessibilityLabel(L("devices.change_icon"))
			.accessibilityValue(icon?.name ?? L("devices.automatic_icon"))

			if isGridOpen {
				LazyVGrid(columns: Array(repeating: GridItem(.fixed(52), spacing: Spacing.md), count: 4), spacing: Spacing.md) {
					ForEach(Self.options, id: \.self) { option in
						IconCell(option: option, isSelected: option == icon) { icon = option }
					}
				}
			}

			VStack(alignment: .leading, spacing: 6) {
				TextField(L("devices.name_placeholder"), text: $name)
					.focused($isNameFocused)
					.autocorrectionDisabled()
					.textInputAutocapitalization(.never)
					.submitLabel(.done)
					.padding(.horizontal, 14)
					.padding(.vertical, Spacing.md)
					.background(Palette.faintFill, in: .rect(cornerRadius: Radius.field))
				if let error = nameError ?? saveError {
					Text(error)
						.font(Typography.metadata)
						.foregroundStyle(Palette.red)
						.padding(.leading, Spacing.xs)
				}
			}

			HStack(spacing: Spacing.md) {
				Button { dismiss() } label: {
					Text(L("common.cancel")).frame(maxWidth: .infinity)
				}
				.buttonStyle(.bordered)
				.disabled(isSaving)
				Button(action: save) {
					Group {
						if isSaving { ProgressView() } else { Text(L("common.confirm")) }
					}
					.frame(maxWidth: .infinity)
				}
				.buttonStyle(.borderedProminent)
				.disabled(!canSave)
			}
			.controlSize(.large)
		}
		.padding(.top, 32)
		.padding(.horizontal, Spacing.xl)
		.padding(.bottom, Spacing.lg)
		.animation(Motion.standard, value: isGridOpen)
		// One at a time: the keyboard and the open grid don't both fit.
		.onChange(of: isNameFocused) { if isNameFocused { isGridOpen = false } }
		// As tall as its content, growing with the grid.
		.onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
		.presentationDetents([.height(height)])
		.presentationDragIndicator(.visible)
	}

	private func toggleGrid() {
		isNameFocused = false
		isGridOpen.toggle()
	}

	private func save() {
		isSaving = true
		saveError = nil
		Task {
			// The icon is saved on the phone first, so only the rename can fail.
			if iconChanged { store.setIcon(icon, for: device) }
			do {
				if nameChanged { try await store.renameDevice(mac: device.mac, hostname: name) }
				dismiss()
			} catch {
				saveError = L("devices.rename_failed")
				isSaving = false
			}
		}
	}
}

private struct IconCell: View {
	let option: DeviceIcon?
	let isSelected: Bool
	let select: () -> Void

	var body: some View {
		Button(action: select) {
			Image(systemName: option?.symbol ?? "sparkles")
				.font(.system(size: 20))
				.symbolRenderingMode(.monochrome)
				// "Automatic" stands apart in blue until it's the selected cell.
				.foregroundStyle(isSelected ? Palette.onAccent : option == nil ? Palette.accent : Palette.textPrimary)
				.frame(width: 44, height: 44)
				.background(isSelected ? Palette.accent : Palette.pickerFill, in: .circle)
				.frame(width: 52, height: 52)
				.overlay {
					if isSelected { Circle().strokeBorder(Palette.accent, lineWidth: 2) }
				}
		}
		.buttonStyle(.plain)
		.accessibilityLabel(option?.name ?? L("devices.automatic_icon"))
		.accessibilityAddTraits(isSelected ? .isSelected : [])
	}
}
