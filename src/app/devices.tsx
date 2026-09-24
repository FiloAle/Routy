import { Stack } from "expo-router";
import React from "react";
import { View } from "react-native";
import {
	HStack,
	Host,
	Image,
	List,
	RoundedRectangle,
	Section,
	Spacer,
	Text as SwiftText,
	VStack,
	ZStack,
} from "@expo/ui/swift-ui";
import {
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listRowBackground,
	listRowInsets,
	listSectionSpacing,
	listStyle,
	offset,
	padding,
	refreshable,
	scrollContentBackground,
} from "@expo/ui/swift-ui/modifiers";
import { useRouter } from "@/context/router-context";
import { t } from "@/i18n";
import { useThemePalette } from "@/constants/Colors";
import { globalStyles } from "@/styles/globalStyles";
import { Device } from "@/services/router-api";
import { textCaseNone } from "../../modules/routy-ui-modifiers";

type Palette = ReturnType<typeof useThemePalette>;

const isDisconnected = (device: Device) => !device.ip || device.ip === "-";

function DeviceRow({
	device,
	palette,
	modifiers,
}: {
	device: Device;
	palette: Palette;
	modifiers: React.ComponentProps<typeof HStack>["modifiers"];
}) {
	const disconnected = isDisconnected(device);
	const color = disconnected ? palette.secondaryText : palette.text;
	const symbol = disconnected
		? "wifi.slash"
		: device.type === "cable"
			? "desktopcomputer"
			: "wifi";

	return (
		<HStack spacing={12} modifiers={modifiers}>
			<ZStack modifiers={[frame({ width: 40, height: 40 })]}>
				<RoundedRectangle
					cornerRadius={10}
					modifiers={[foregroundStyle(palette.fill)]}
				/>
				<Image systemName={symbol} color={color} modifiers={[font({ size: 18 })]} />
			</ZStack>
			<VStack alignment="leading" spacing={2}>
				<SwiftText
					modifiers={[
						font({ size: 17, weight: "semibold" }),
						foregroundStyle(color),
						lineLimit(1),
					]}
				>
					{device.hostname}
				</SwiftText>
				<SwiftText
					modifiers={[font({ size: 13 }), foregroundStyle(palette.secondaryText)]}
				>
					{disconnected ? device.mac : `${device.ip} • ${device.mac}`}
				</SwiftText>
			</VStack>
			<Spacer />
		</HStack>
	);
}

export default function DevicesScreen() {
	const palette = useThemePalette();
	const { devices, isLoadingDevices, loadDevices } = useRouter();

	const groups = [
		{ title: t("devices.connected"), data: devices.filter((d) => !isDisconnected(d)) },
		{ title: t("devices.disconnected"), data: devices.filter(isDisconnected) },
	].filter((g) => g.data.length > 0);

	// Each device is its own inset-grouped section, so the system draws it as a separate card.
	const cardModifiers = [
		listRowInsets({ top: 16, bottom: 16, leading: 16, trailing: 16 }),
		listRowBackground(palette.card),
	];

	return (
		<View style={globalStyles.container}>
			<Stack.Screen
				options={{
					title: t("devices.title"),
					headerLargeTitle: false,
					headerTransparent: true,
					headerShadowVisible: false,
					headerBackButtonDisplayMode: "minimal",
					headerTitleStyle: { color: palette.text },
				}}
			/>

			{/* Sits under the transparent native header: the List's safe area already clears it. */}
			<Host style={{ flex: 1 }}>
				<List
					modifiers={[
						listStyle("insetGrouped"),
						scrollContentBackground("hidden"),
						listSectionSpacing(8),
						refreshable(loadDevices),
					]}
				>
					{groups.map((group) =>
						group.data.map((device, index) => (
							<Section
								key={device.mac}
								header={
									index === 0 ? (
										<SwiftText
											modifiers={[
												font({ size: 16, weight: "semibold" }),
												foregroundStyle(palette.secondaryText),
												textCaseNone(),
												// iOS aligns headers with the row content; keep them near the card edge as before.
												offset({ x: -12 }),
											]}
										>
											{group.title}
										</SwiftText>
									) : undefined
								}
							>
								<DeviceRow device={device} palette={palette} modifiers={cardModifiers} />
							</Section>
						)),
					)}

					{!isLoadingDevices && devices.length === 0 && (
						<Section>
							<HStack
								modifiers={[
									padding({ top: 100 }),
									listRowBackground("#00000000"),
								]}
							>
								<Spacer />
								<SwiftText
									modifiers={[font({ size: 16 }), foregroundStyle(palette.secondaryText)]}
								>
									{t("devices.empty")}
								</SwiftText>
								<Spacer />
							</HStack>
						</Section>
					)}
				</List>
			</Host>
		</View>
	);
}
