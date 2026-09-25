import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
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
	layoutPriority,
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
import { DeviceIconId, deviceSymbol } from "@/constants/deviceIcons";
import { DeviceEditSheet } from "@/components/DeviceEditSheet";
import { globalStyles } from "@/styles/globalStyles";
import { Device, MAX_BLOCKED_DEVICES, isDisconnected } from "@/services/router-api";
import { SymbolImage, symbolMonochrome, textCaseNone } from "../../modules/routy-ui-modifiers";

type Palette = ReturnType<typeof useThemePalette>;

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
	manualIcon,
	isOwn,
	palette,
}: {
	device: Device;
	kind: GroupKind;
	manualIcon: DeviceIconId | null;
	isOwn: boolean;
	palette: Palette;
}) {
	const disconnected = isDisconnected(device);
	const color = kind === "connected" ? palette.text : palette.secondaryText;
	const symbol = kind === "blocked" ? "nosign" : deviceSymbol(device, manualIcon);

	return (
		<HStack spacing={12}>
			<ZStack modifiers={[frame({ width: 40, height: 40 })]}>
				<RoundedRectangle
					cornerRadius={10}
					modifiers={[foregroundStyle(palette.fill)]}
				/>
				<Image systemName={symbol} color={color} modifiers={[font({ size: 18 }), symbolMonochrome()]} />
			</ZStack>
			<VStack alignment="leading" spacing={2}>
				<HStack spacing={6}>
					<SwiftText
						modifiers={[
							font({ size: 17, weight: "semibold" }),
							foregroundStyle(color),
							lineLimit(1),
						]}
					>
						{device.hostname}
					</SwiftText>
					{isOwn && (
						// Two separate texts: with a long name the name gets the ellipsis, not the label.
						<SwiftText
							modifiers={[
								font({ size: 17 }),
								foregroundStyle(palette.secondaryText),
								lineLimit(1),
								layoutPriority(1),
							]}
						>
							{t("devices.this_device")}
						</SwiftText>
					)}
				</HStack>
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
		ownMac,
		deviceIcons,
		setDeviceIcon,
	} = useRouter();

	// `editing` outlives `editOpen`, so the sheet keeps its content while it slides away.
	const [editing, setEditing] = useState<Device | null>(null);
	const [editOpen, setEditOpen] = useState(false);
	const openEditor = (device: Device) => {
		setEditing(device);
		setEditOpen(true);
	};

	const manualIconOf = (d: Device) => deviceIcons[d.mac.toUpperCase()] ?? null;
	const isOwn = (d: Device) => ownMac !== null && d.mac.toUpperCase() === ownMac;

	// Polling keeps `devices` fresh but not the blacklist, which only this screen needs.
	useEffect(() => {
		loadDevices();
	}, [loadDevices]);

	const blockedMacs = new Set(blockedDevices.map((d) => d.mac.toUpperCase()));
	const isBlocked = (d: Device) => blockedMacs.has(d.mac.toUpperCase());

	// The phone running Routy first, then by name: case- and accent-insensitive,
	// with numbers in order ("iPhone 2" before "iPhone 10"); the MAC breaks ties.
	const byName = (a: Device, b: Device) =>
		Number(isOwn(b)) - Number(isOwn(a)) ||
		a.hostname.localeCompare(b.hostname, undefined, { sensitivity: "base", numeric: true }) ||
		a.mac.localeCompare(b.mac);

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
	]
		.map((g) => ({ ...g, data: [...g.data].sort(byName) }))
		.filter((g) => g.data.length > 0);

	const editButton = (device: Device) => (
		<Button
			key="edit"
			label={t("devices.edit")}
			systemImage="pencil"
			// Icon only; the label stays as the VoiceOver name.
			modifiers={[labelStyle("iconOnly"), tint(Colors.routyBlue)]}
			onPress={() => openEditor(device)}
		/>
	);

	const blockButton = (device: Device, warnAboutSelf: boolean) => (
		<Button
			key="block"
			label={t("devices.block")}
			systemImage="nosign"
			modifiers={[labelStyle("iconOnly"), tint(Colors.routyRed)]}
			onPress={() => {
				if (blockedDevices.length >= MAX_BLOCKED_DEVICES) {
					Alert.alert(t("common.error"), t("devices.block_limit", { max: MAX_BLOCKED_DEVICES }));
					return;
				}
				const message = t("devices.block_message");
				confirmAction({
					title: t("devices.block_title", { name: device.hostname }),
					message: warnAboutSelf ? `${message}\n\n${t("devices.block_self_warning")}` : message,
					errorMessage: t("devices.block_failed"),
					action: () => blockDevice(device.mac, device.hostname),
				});
			}}
		/>
	);

	// Swipe actions fill their symbols; SymbolImage keeps the outline.
	const forgetButton = (device: Device) => (
		<Button
			key="forget"
			modifiers={[tint(Colors.routyOrange), accessibilityLabel(t("devices.forget"))]}
			onPress={() =>
				confirmAction({
					title: t("devices.forget_title", { name: device.hostname }),
					message: t("devices.forget_message"),
					errorMessage: t("common.error_generic"),
					action: () => hideDevice(device.mac),
				})
			}
		>
			<SymbolImage systemName="eye.slash" />
		</Button>
	);

	const unblockButton = (device: Device) => (
		<Button
			key="unblock"
			label={t("devices.unblock")}
			systemImage="checkmark"
			modifiers={[labelStyle("iconOnly"), tint(Colors.routyGreen)]}
			onPress={() =>
				confirmAction({
					title: t("devices.unblock_title", { name: device.hostname }),
					message: t("devices.unblock_message"),
					destructive: false,
					errorMessage: t("devices.unblock_failed"),
					action: () => unblockDevice(device.mac),
				})
			}
		/>
	);

	// The first action sits at the edge and runs on a full swipe, so each list reads
	// from the edge inwards: on screen, left to right, it's the other way round.
	const actionsFor = (kind: GroupKind, device: Device) => {
		switch (kind) {
			case "connected": {
				// The Wi-Fi blacklist can't stop a cable, and blocking yourself cuts you off the router.
				const blockable = device.type !== "cable" && !isOwn(device);
				return [blockable && blockButton(device, ownMac === null), editButton(device)];
			}
			case "disconnected":
				return [blockButton(device, false), forgetButton(device), editButton(device)];
			case "blocked":
				return [unblockButton(device)];
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
									<DeviceRow
										device={device}
										kind={group.kind}
										manualIcon={manualIconOf(device)}
										isOwn={isOwn(device)}
										palette={palette}
									/>
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

			{/* Its own zero-size host: the sheet is presented, so it needs no room in the layout. */}
			<Host style={{ position: "absolute", width: 0, height: 0 }}>
				<DeviceEditSheet
					device={editing}
					isPresented={editOpen}
					manualIcon={editing ? manualIconOf(editing) : null}
					onClose={() => setEditOpen(false)}
					onDismissed={() => setEditing(null)}
					onSetIcon={setDeviceIcon}
					onRename={renameDevice}
				/>
			</Host>
		</View>
	);
}
