import SwiftUI

struct HomeScreen: View {
	@Environment(RouterStore.self) private var store
	@Environment(\.openURL) private var openURL
	@State private var speedUnit = Formatting.SpeedUnit.kbps

	private var usage: DataUsage? { store.dataUsage }

	var body: some View {
		ScrollView {
			VStack(spacing: Spacing.xxl) {
				section(L("dashboard.usage")) { usageCard }
				section(L("dashboard.network")) {
					CardRow {
						InfoCard(label: L("dashboard.operator"), value: usage?.networkProvider ?? "-")
						InfoCard(label: L("dashboard.network_tech"), value: usage?.networkLabel ?? "-")
					}
					CardRow {
						Button { speedUnit = speedUnit.toggled } label: { speedCard }
							.buttonStyle(.plain)
						NavigationLink(value: Route.devices) {
							InfoCard(label: L("dashboard.devices"), value: String(store.connectedDeviceCount), showsChevron: true)
						}
						.buttonStyle(.plain)
					}
				}
				section(L("dashboard.signal")) {
					CardRow {
						cellCard
						NavigationLink(value: Route.bands) {
							InfoCard(label: L("dashboard.bands"), value: usage?.bands ?? "-", showsChevron: true)
						}
						.buttonStyle(.plain)
					}
					CardRow {
						InfoCard(label: L("dashboard.rsrp"), value: usage.map { $0.rsrp == "-" ? "-" : "\($0.rsrp) dBm" } ?? "-")
						InfoCard(label: L("dashboard.sinr"), value: usage.map { $0.sinr == "-" ? "-" : "\($0.sinr) dB" } ?? "-")
					}
				}
			}
			.padding(.horizontal, Spacing.lg)
			.padding(.top, Spacing.sm)
			.padding(.bottom, Spacing.xl)
		}
		.scrollIndicators(.hidden)
		.background(Palette.background)
		.refreshable { await store.refreshDataUsage() }
		.navigationTitle(L("tabs.home"))
		.task(id: store.auth) {
			if store.auth == .loggedIn, store.dataUsage == nil || store.softwareInfo == nil { await store.refreshDataUsage() }
		}
	}

	private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
		VStack(spacing: Spacing.sm) {
			SectionTitle(title: title)
			content()
		}
	}

	// MARK: - Cards

	private var usageCard: some View {
		let limit = Double(store.dataLimitValue) ?? 0
		// No reference, or zero, reads as 1000 GB, as in the Expo app.
		let limitGB = limit == 0 ? 1000 : store.dataLimitUnit == .tb ? limit * 1024 : limit
		let consumed = usage.map { Formatting.gigabytes($0.monthlyTotalBytes) } ?? 0
		return HStack(spacing: Spacing.xl + Spacing.xs) {
			UsageRing(
				progress: min(consumed / limitGB, 1),
				value: String(Int(consumed.rounded())),
				caption: L("dashboard.usage_limit", "\(store.dataLimitValue)\(store.dataLimitUnit.rawValue)")
			)
			VStack(alignment: .leading, spacing: Spacing.lg) {
				statistic(L("dashboard.received"), bytes: usage?.monthlyRxBytes, color: Palette.rose)
				statistic(L("dashboard.sent"), bytes: usage?.monthlyTxBytes, color: Palette.lime)
			}
			.frame(maxWidth: .infinity, alignment: .leading)
		}
		.padding(Spacing.xl)
		.card()
	}

	private func statistic(_ label: String, bytes: Int64?, color: Color) -> some View {
		VStack(alignment: .leading, spacing: Spacing.xxs) {
			Text(label)
				.font(Typography.secondary)
				.foregroundStyle(Palette.textPrimary)
			HStack(alignment: .firstTextBaseline, spacing: Spacing.xxs) {
				Text(String(format: "%.1f", Formatting.gigabytes(bytes ?? 0)))
					.font(Typography.statValue)
				Text("GB")
					.font(Typography.statUnit)
			}
			.foregroundStyle(color)
		}
	}

	private var speedCard: some View {
		InfoCard(label: L("dashboard.speed", speedUnit.rawValue)) {
			HStack {
				throughput("arrow.down", Formatting.speed(usage?.realtimeRx ?? 0, unit: speedUnit), color: Palette.rose)
				Spacer(minLength: Spacing.xs)
				throughput("arrow.up", Formatting.speed(usage?.realtimeTx ?? 0, unit: speedUnit), color: Palette.lime)
					.padding(.trailing, Spacing.xs)
			}
		}
	}

	private func throughput(_ symbol: String, _ value: String, color: Color) -> some View {
		HStack(spacing: Spacing.xs) {
			Image(systemName: symbol)
				.fontWeight(.bold)
				.foregroundStyle(color)
			Text(value)
		}
	}

	/// Opens the cell on lteitaly.it; a long press can copy the link instead.
	@ViewBuilder private var cellCard: some View {
		let cellID = usage?.cellID ?? "-"
		let card = InfoCard(label: L("dashboard.cell"), value: ZTE.enbID(cellID: cellID) ?? cellID)
		if let usage, let url = ZTE.lteItalyURL(mcc: usage.mcc, mnc: usage.mnc, cellID: usage.cellID) {
			Button { openURL(url) } label: { card }
				.buttonStyle(.plain)
				.contextMenu {
					Button(L("dashboard.copy_link"), systemImage: "doc.on.doc") { UIPasteboard.general.url = url }
					Button(L("dashboard.open_map"), systemImage: "map") { openURL(url) }
				}
		} else {
			card
		}
	}
}
