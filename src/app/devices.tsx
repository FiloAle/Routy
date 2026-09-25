import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { Alert, View } from "react-native";
import {
	Button,
	HStack,
	Host,
	Image,
	List,
	RoundedRectangle,
	Section,
	Spacer,
	SwipeActions,
	Text as SwiftText,
	VStack,
	ZStack,
} from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	font,
	foregroundStyle,
	frame,
	labelStyle,
	lineLimit,
	listRowBackground,
	listRowInsets,
	listSectionSpacing,
	listStyle,
	offset,
	padding,
	refreshable,
	scrollContentBackground,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { useRouter } from "@/context/router-context";
import { t } from "@/i18n";
import { Colors, useThemePalette } from "@/constants/Colors";
import { globalStyles } from "@/styles/globalStyles";
import { Device, MAX_BLOCKED_DEVICES, isDisconnected } from "@/services/router-api";
import { SymbolImage, textCaseNone } from "../../modules/routy-ui-modifiers";

type Palette = ReturnType<typeof useThemePalette>;

// Same rules as the router's own dashboard (wifi/station_info.js).
function hostnameError(hostname: string): string | null {
	if (hostname === "") return t("devices.rename_required");
	if (hostname.startsWith(" ") || hostname.endsWith(" ") || /[+;"\\]/.test(hostname))
		return t("devices.rename_invalid");
	return null;
}

// Asks for the new name; an invalid one reopens the prompt so it can be fixed.
function promptRename(
	device: Device,
	renameDevice: (mac: string, hostname: string) => Promise<void>,
	current = device.hostname,
) {
	Alert.prompt(
		t("devices.rename_title"),
		device.mac,
		[
			{ text: t("common.cancel"), style: "cancel" },
			{
				text: t("common.save"),
				isPreferred: true,
				onPress: async (value?: string) => {
					const hostname = value ?? "";
					if (hostname === device.hostname) return;
					const error = hostnameError(hostname);
					if (error) {
						Alert.alert(t("common.error"), error, [
							{ text: "OK", onPress: () => promptRename(device, renameDevice, hostname) },
						]);
						return;
					}
					try {
						await renameDevice(device.mac, hostname);
					} catch {
						Alert.alert(t("common.error"), t("devices.rename_failed"));
					}
				},
			},
		],
		"plain-text",
		current,
	);
}

function confirmAction({
	title,
	message,
	destructive = true,
	errorMessage,
	action,
}: {
	title: string;
	message: string;
	destructive?: boolean;
	errorMessage: string;
	action: () => Promise<void>;
}) {
	Alert.alert(title, message, [
		{ text: t("common.cancel"), style: "cancel" },
		{
			text: t("common.confirm"),
			style: destructive ? "destructive" : "default",
			// A non-destructive confirmation is the primary button.
			isPreferred: !destructive,
			onPress: async () => {
				try {
					await action();
				} catch {
					Alert.alert(t("common.error"), errorMessage);
				}
			},
		},
	]);
}

type GroupKind = "connected" | "disconnected" | "blocked";

function DeviceRow({
	device,
	kind,
	palette,
}: {
	device: Device;
	kind: GroupKind;
	palette: Palette;
}) {
	const disconnected = isDisconnected(device);
	const color = kind === "connected" ? palette.text : palette.secondaryText;
	const symbol =
		kind === "blocked"
			? "nosign"
			: disconnected
				? "wifi.slash"
				: device.type === "cable"
					? "desktopcomputer"
					: "wifi";

	return (
		<HStack spacing={12}>
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
	const {
		devices,
		isLoadingDevices,
		loadDevices,
		renameDevice,
		hiddenDeviceMacs,
		hideDevice,
		blockedDevices,
		blockDevice,
		unblockDevice,
	} = useRouter();

	// Polling keeps `devices` fresh but not the blacklist, which only this screen needs.
	useEffect(() => {
		loadDevices();
	}, [loadDevices]);

	const blockedMacs = new Set(blockedDevices.map((d) => d.mac.toUpperCase()));
	const isBlocked = (d: Device) => blockedMacs.has(d.mac.toUpperCase());

	// Each device shows up in one group only; "blocked" wins over the others.
	const groups: { kind: GroupKind; title: string; data: Device[] }[] = [
		{
			kind: "connected" as const,
			title: t("devices.connected"),
			data: devices.filter((d) => !isDisconnected(d) && !isBlocked(d)),
		},
		{
			kind: "disconnected" as const,
			title: t("devices.disconnected"),
			data: devices.filter(
				(d) => isDisconnected(d) && !isBlocked(d) && !hiddenDeviceMacs.has(d.mac.toUpperCase()),
			),
		},
		{
			kind: "blocked" as const,
			title: t("devices.blocked"),
			// Prefer the router's current entry (it has renames); the blacklist may list devices it no longer knows.
			data: blockedDevices.map(
				(b) =>
					devices.find((d) => d.mac.toUpperCase() === b.mac.toUpperCase()) ?? {
						hostname: b.hostname,
						ip: "-",
						mac: b.mac.toUpperCase(),
						type: "wireless",
					},
			),
		},
	].filter((g) => g.data.length > 0);

	const actionsFor = (kind: GroupKind, device: Device) => {
		const name = device.hostname;
		switch (kind) {
			case "connected":
				return (
					<Button
						label={t("devices.rename")}
						systemImage="pencil"
						// Icon only; the label stays as the VoiceOver name.
						modifiers={[labelStyle("iconOnly"), tint(Colors.routyBlue)]}
						onPress={() => promptRename(device, renameDevice)}
					/>
				);
			case "disconnected":
				// The first action sits at the edge and runs on a full swipe.
				return (
					<>
						<Button
							label={t("devices.block")}
							systemImage="nosign"
							modifiers={[labelStyle("iconOnly"), tint(Colors.routyRed)]}
							onPress={() => {
								if (blockedDevices.length >= MAX_BLOCKED_DEVICES) {
									Alert.alert(
										t("common.error"),
										t("devices.block_limit", { max: MAX_BLOCKED_DEVICES }),
									);
									return;
								}
								confirmAction({
									title: t("devices.block_title", { name }),
									message: t("devices.block_message"),
									errorMessage: t("devices.block_failed"),
									action: () => blockDevice(device.mac, device.hostname),
								});
							}}
						/>
						{/* Swipe actions fill their symbols; SymbolImage keeps the outline. */}
						<Button
							modifiers={[tint(Colors.routyOrange), accessibilityLabel(t("devices.forget"))]}
							onPress={() =>
								confirmAction({
									title: t("devices.forget_title", { name }),
									message: t("devices.forget_message"),
									errorMessage: t("common.error_generic"),
									action: () => hideDevice(device.mac),
								})
							}
						>
							<SymbolImage systemName="eye.slash" />
						</Button>
					</>
				);
			case "blocked":
				return (
					<Button
						label={t("devices.unblock")}
						systemImage="checkmark"
						modifiers={[labelStyle("iconOnly"), tint(Colors.routyGreen)]}
						onPress={() =>
							confirmAction({
								title: t("devices.unblock_title", { name }),
								message: t("devices.unblock_message"),
								destructive: false,
								errorMessage: t("devices.unblock_failed"),
								action: () => unblockDevice(device.mac),
							})
						}
					/>
				);
		}
	};

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
								{/* Trailing only: a swipe to the right stays the system back gesture.
								    No `destructive` role: SwiftUI would remove the row before the confirmation alert. */}
								<SwipeActions modifiers={cardModifiers}>
									<DeviceRow device={device} kind={group.kind} palette={palette} />
									<SwipeActions.Actions edge="trailing">
										{actionsFor(group.kind, device)}
									</SwipeActions.Actions>
								</SwipeActions>
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
