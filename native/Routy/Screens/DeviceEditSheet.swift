import SwiftUI

/// Changes a device's icon and name. It edits a draft: nothing is saved until Confirm,
/// and Cancel or a swipe down discards the changes.
struct DeviceEditSheet: View {
	let device: Device
	@Environment(RouterStore.self) private var store
	@Environment(\.dismiss) private var dismiss
	@State private var name: String
	@State private var icon: DeviceIcon?
	@State private var isPickingIcon = false
	@State private var isSaving = false
	@State private var saveError: String?
	/// The sheet's height, measured before it opens (see `sizer`).
	private let height: CGFloat
	@FocusState private var isNameFocused: Bool

	/// "Automatic" first, then the catalog; `nil` stands for the automatic icon.
	private static let options: [DeviceIcon?] = [nil] + DeviceIcon.allCases

	init(device: Device, icon: DeviceIcon?, height: CGFloat) {
		self.device = device
		self.height = height
		_name = State(initialValue: device.hostname)
		_icon = State(initialValue: icon)
	}

	/// An invisible copy that measures the sheet's height before it opens: measured once the sheet is up,
	/// the height would change in the middle of the opening animation. It doesn't depend on the device
	/// or the width, only on the text size.
	static func sizer(height: Binding<CGFloat>) -> some View {
		DeviceEditSheet(device: Device(hostname: "Device", ip: "-", mac: "", type: .wireless), icon: nil, height: 0)
			.fixedSize(horizontal: false, vertical: true)
			.onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height.wrappedValue = $0 }
			.hidden()
			.allowsHitTesting(false)
	}

	private var originalIcon: DeviceIcon? { store.icon(for: device) }
	private var nameChanged: Bool { name != device.hostname }
	private var iconChanged: Bool { icon != originalIcon }
	/// Only a new name is checked: a name the router gave may break the rules and still be kept.
	private var nameError: String? { nameChanged ? Formatting.hostnameError(name) : nil }
	private var canSave: Bool { (nameChanged || iconChanged) && nameError == nil && !isSaving }

	var body: some View {
		VStack(spacing: Spacing.xl) {
			Button {
				isNameFocused = false
				isPickingIcon = true
			} label: {
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
			// Over the sheet rather than inside it: a sheet that changes height doesn't redraw its content
			// along the way, it shows the final layout centered and the controls jump.
			.popover(isPresented: $isPickingIcon, arrowEdge: .bottom) {
				LazyVGrid(columns: Array(repeating: GridItem(.fixed(52), spacing: Spacing.md), count: 4), spacing: Spacing.md) {
					ForEach(Self.options, id: \.self) { option in
						IconCell(option: option, isSelected: option == icon) {
							icon = option
							isPickingIcon = false
						}
					}
				}
				.padding(Spacing.lg)
				.presentationCompactAdaptation(.popover)
			}

			TextField(L("devices.name_placeholder"), text: $name)
				.focused($isNameFocused)
				.autocorrectionDisabled()
				.textInputAutocapitalization(.never)
				.submitLabel(.done)
				.padding(.horizontal, 14)
				.padding(.vertical, Spacing.md)
				.background(Palette.faintFill, in: .rect(cornerRadius: Radius.field))
				// In the space below the field, so an error doesn't change the sheet's height.
				.overlay(alignment: .bottomLeading) {
					if let error = nameError ?? saveError {
						Text(error)
							.font(Typography.metadata)
							.foregroundStyle(Palette.red)
							.lineLimit(1)
							.minimumScaleFactor(0.7)
							.padding(.leading, Spacing.xs)
							.alignmentGuide(.bottom) { $0[.top] - Spacing.xs }
					}
				}

			HStack(spacing: Spacing.md) {
				Button(L("common.cancel")) { dismiss() }
					.buttonStyle(.sheetSecondary)
					.disabled(isSaving)
				Button(action: save) {
					if isSaving { ProgressView() } else { Text(L("common.confirm")) }
				}
				.buttonStyle(.sheetPrimary)
				.disabled(!canSave)
			}
		}
		.padding(.top, 32)
		.padding(.horizontal, Spacing.xl)
		.padding(.bottom, Spacing.lg)
		.presentationDetents([.height(height)])
		.presentationDragIndicator(.visible)
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
