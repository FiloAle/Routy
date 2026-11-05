import SwiftUI

private enum DeviceGroup: Hashable {
	case connected, disconnected, blocked

	var title: String {
		switch self {
		case .connected: L("devices.connected")
		case .disconnected: L("devices.disconnected")
		case .blocked: L("devices.blocked")
		}
	}
}

struct DevicesScreen: View {
	@Environment(RouterStore.self) private var store
	@State private var editing: Device?
	@State private var editSheetHeight: CGFloat = 0
	@State private var alert: AlertItem?
	@State private var isLoading = true

	/// Each device in one group only; "blocked" wins over the others. Empty groups are left out.
	private var groups: [(group: DeviceGroup, devices: [Device])] {
		let blockedMacs = Set(store.blockedDevices.map { $0.mac.uppercased() })
		let isBlocked = { (device: Device) in blockedMacs.contains(device.mac) }
		let blocked = store.blockedDevices.map { entry in
			// The router's current entry has renames; the blacklist may list devices it no longer knows.
			store.devices.first { $0.mac == entry.mac.uppercased() }
				?? Device(hostname: entry.hostname, ip: "-", mac: entry.mac.uppercased(), type: .wireless)
		}
		return [
			(DeviceGroup.connected, store.devices.filter { !$0.isDisconnected && !isBlocked($0) }),
			(.disconnected, store.devices.filter { $0.isDisconnected && !isBlocked($0) && !store.hiddenDevices.contains($0.mac) }),
			(.blocked, blocked),
		]
		.map { ($0, $1.sorted(by: order)) }
		.filter { !$1.isEmpty }
	}

	/// The phone running Routy first, then by name: case and accent insensitive, numbers in order
	/// ("iPhone 2" before "iPhone 10"); the MAC breaks ties.
	private func order(_ a: Device, _ b: Device) -> Bool {
		if store.isOwn(a) != store.isOwn(b) { return store.isOwn(a) }
		let byName = a.hostname.compare(b.hostname, options: [.caseInsensitive, .diacriticInsensitive, .numeric], locale: .current)
		if byName != .orderedSame { return byName == .orderedAscending }
		return a.mac < b.mac
	}

	var body: some View {
		List {
			ForEach(groups, id: \.group) { group, devices in
				// Each device is its own section, so the system draws it as a separate card.
				ForEach(Array(devices.enumerated()), id: \.element.id) { index, device in
					Section {
						DeviceRow(device: device, group: group, icon: store.icon(for: device), isOwn: store.isOwn(device))
							.rowActions { actions(for: device, in: group) }
							.cardRows()
					} header: {
						if index == 0 {
							Text(group.title)
								.font(Typography.sectionTitle)
								.foregroundStyle(Palette.textSecondary)
								.textCase(nil)
						}
					}
				}
			}
		}
		.listSectionSpacing(Spacing.sm)
		.cardList()
		.scrollIndicators(.hidden)
		.overlay {
			if !isLoading, store.devices.isEmpty {
				ContentUnavailableView(L("devices.empty"), systemImage: "wifi.slash")
			}
		}
		.refreshable { await store.loadDevices() }
		.task {
			// Polling keeps the devices fresh, but not the blacklist, which only this screen needs.
			await store.loadDevices()
			isLoading = false
		}
		.shows(.devices)
		.navigationTitle(L("devices.title"))
		.navigationBarTitleDisplayMode(.inline)
		.background { DeviceEditSheet.sizer(height: $editSheetHeight) }
		.sheet(item: $editing) { DeviceEditSheet(device: $0, icon: store.icon(for: $0), height: editSheetHeight) }
		.alert($alert)
	}

	// MARK: - Swipe actions

	/// The first action sits at the edge and runs on a full swipe. Trailing only: a swipe to the right
	/// stays the system back gesture. No destructive roles: SwiftUI would remove the row before the alert.
	@ViewBuilder private func actions(for device: Device, in group: DeviceGroup) -> some View {
		switch group {
		case .connected:
			// The Wi-Fi blacklist can't stop a cable, and blocking yourself cuts you off the router.
			if device.type != .cable, !store.isOwn(device) { blockButton(device, warnAboutSelf: store.ownMac == nil) }
			editButton(device)
		case .disconnected:
			blockButton(device, warnAboutSelf: false)
			forgetButton(device)
			editButton(device)
		case .blocked:
			unblockButton(device)
		}
	}

	private func editButton(_ device: Device) -> some View {
		Button(L("devices.edit"), systemImage: "pencil") { editing = device }
			.tint(Palette.accent)
	}

	private func blockButton(_ device: Device, warnAboutSelf: Bool) -> some View {
		Button(L("devices.block"), systemImage: "nosign") {
			guard store.blockedDevices.count < ZTE.maxBlockedDevices else {
				alert = .error(L("devices.block_limit", String(ZTE.maxBlockedDevices)))
				return
			}
			let message = L("devices.block_message")
			alert = AlertItem(
				title: L("devices.block_title", device.hostname),
				message: warnAboutSelf ? "\(message)\n\n\(L("devices.block_self_warning"))" : message,
				confirmation: .init(action: { try await store.blockDevice(device) }, failure: L("devices.block_failed"))
			)
		}
		.tint(Palette.red)
	}

	private func forgetButton(_ device: Device) -> some View {
		Button {
			alert = AlertItem(
				title: L("devices.forget_title", device.hostname),
				message: L("devices.forget_message"),
				confirmation: .init(action: { store.hideDevice(device) }, failure: L("common.error_generic"))
			)
		} label: {
			Label { Text(L("devices.forget")) } icon: { Image.outlined("eye.slash") }
		}
		.tint(Palette.orange)
	}

	private func unblockButton(_ device: Device) -> some View {
		Button(L("devices.unblock"), systemImage: "checkmark") {
			alert = AlertItem(
				title: L("devices.unblock_title", device.hostname),
				message: L("devices.unblock_message"),
				confirmation: .init(isDestructive: false, action: { try await store.unblockDevice(device) }, failure: L("devices.unblock_failed"))
			)
		}
		.tint(Palette.green)
	}
}

private struct DeviceRow: View {
	let device: Device
	let group: DeviceGroup
	let icon: DeviceIcon?
	let isOwn: Bool

	var body: some View {
		let color = group == .connected ? Palette.textPrimary : Palette.textSecondary
		HStack(spacing: Spacing.md) {
			DeviceIconWell(symbol: group == .blocked ? "nosign" : DeviceIcon.symbol(for: device, manual: icon), color: color)
			VStack(alignment: .leading, spacing: Spacing.xxs) {
				HStack(spacing: 6) {
					Text(device.hostname)
						.font(Typography.rowTitle)
						.foregroundStyle(color)
					if isOwn {
						// A text of its own: with a long name the name gets the ellipsis, not the label.
						Text(L("devices.this_device"))
							.foregroundStyle(Palette.accent)
							.layoutPriority(1)
					}
				}
				.lineLimit(1)
				Text(device.isDisconnected ? device.mac : "\(device.ip) • \(device.mac)")
					.font(Typography.metadata)
					.foregroundStyle(Palette.textSecondary)
			}
			Spacer(minLength: 0)
		}
		.padding(.vertical, Spacing.xs)
	}
}
