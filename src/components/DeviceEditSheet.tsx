import React, { useRef, useState } from "react";
import {
	BottomSheet,
	Button,
	Circle,
	Grid,
	HStack,
	Image,
	ProgressView,
	Text as SwiftText,
	TextField,
	type TextFieldRef,
	VStack,
	ZStack,
	useNativeState,
} from "@expo/ui/swift-ui";
import {
	Animation,
	accessibilityLabel,
	accessibilityValue,
	animation,
	autocorrectionDisabled,
	background,
	buttonStyle,
	clipShape,
	controlSize,
	disabled,
	font,
	foregroundStyle,
	frame,
	padding,
	presentationDragIndicator,
	strokeBorder,
	submitLabel,
	tint,
	textFieldStyle,
	textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers";
import { Colors, useThemePalette } from "@/constants/Colors";
import { DEVICE_ICONS, DeviceIconId, deviceSymbol, symbolFor } from "@/constants/deviceIcons";
import { t } from "@/i18n";
import { Device } from "@/services/router-api";
import { symbolMonochrome } from "../../modules/routy-ui-modifiers";

type Palette = ReturnType<typeof useThemePalette>;

// Wide enough to fill the sheet: `Infinity` doesn't survive the bridge.
const FILL_WIDTH = 10000;
const COLUMNS = 4;

// Same rules as the router's own dashboard (wifi/station_info.js).
export function hostnameError(hostname: string): string | null {
	if (hostname === "") return t("devices.rename_required");
	if (hostname.startsWith(" ") || hostname.endsWith(" ") || /[+;"\\]/.test(hostname))
		return t("devices.rename_invalid");
	return null;
}

// "Automatic" first, then the catalog; `null` stands for the automatic icon.
const GRID_OPTIONS: (DeviceIconId | null)[] = [null, ...DEVICE_ICONS.map((icon) => icon.id)];
const GRID_ROWS = Array.from({ length: Math.ceil(GRID_OPTIONS.length / COLUMNS) }, (_, row) =>
	GRID_OPTIONS.slice(row * COLUMNS, row * COLUMNS + COLUMNS),
);

function IconCell({
	option,
	selected,
	palette,
	onPress,
}: {
	option: DeviceIconId | null;
	selected: boolean;
	palette: Palette;
	onPress: () => void;
}) {
	const label = option ? t(`devices.icons.${option}`) : t("devices.automatic_icon");
	return (
		<Button modifiers={[buttonStyle("plain"), accessibilityLabel(label)]} onPress={onPress}>
			<ZStack modifiers={[frame({ width: 52, height: 52 })]}>
				{selected && (
					// Transparent fill: only the ring shows around the selected icon.
					<Circle
						modifiers={[
							foregroundStyle("#00000000"),
							strokeBorder({
								content: Colors.routyBlue,
								style: { lineWidth: 2 },
								shape: "circle",
							}),
						]}
					/>
				)}
				<Circle
					modifiers={[
						foregroundStyle(selected ? Colors.routyBlue : palette.pickerFill),
						frame({ width: 44, height: 44 }),
					]}
				/>
				<Image
					systemName={option ? symbolFor(option) : "sparkles"}
					// "Automatic" stands apart in the app blue until it's the selected cell.
					color={selected ? Colors.routyWhite : option ? palette.text : Colors.routyBlue}
					size={20}
					modifiers={[symbolMonochrome()]}
				/>
			</ZStack>
		</Button>
	);
}

function EditContent({
	device,
	manualIcon,
	onClose,
	onSetIcon,
	onRename,
}: {
	device: Device;
	manualIcon: DeviceIconId | null;
	onClose: () => void;
	onSetIcon: (mac: string, id: DeviceIconId | null) => Promise<void>;
	onRename: (mac: string, hostname: string) => Promise<void>;
}) {
	const palette = useThemePalette();
	const fieldRef = useRef<TextFieldRef>(null);
	const nameState = useNativeState(device.hostname);
	const [name, setName] = useState(device.hostname);
	const [draftIcon, setDraftIcon] = useState<DeviceIconId | null>(manualIcon);
	const [gridOpen, setGridOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	const nameChanged = name !== device.hostname;
	const iconChanged = draftIcon !== manualIcon;
	// Only a new name is checked: a router-given name may break the rules and still be kept.
	const nameError = nameChanged ? hostnameError(name) : null;
	const canSave = (nameChanged || iconChanged) && !nameError && !saving;
	// The preview follows the name while typing, so an automatic icon updates live.
	const previewSymbol = deviceSymbol({ ...device, hostname: name }, draftIcon);

	const toggleGrid = () => {
		// One at a time: the keyboard and the open grid don't both fit.
		fieldRef.current?.blur();
		setGridOpen((open) => !open);
	};

	const save = async () => {
		setSaving(true);
		setSaveError(null);
		try {
			if (iconChanged) await onSetIcon(device.mac, draftIcon);
			if (nameChanged) await onRename(device.mac, name);
			onClose();
		} catch {
			// The icon is saved locally first, so only the rename can fail here.
			setSaveError(t("devices.rename_failed"));
			setSaving(false);
		}
	};

	const error = nameError ?? saveError;

	return (
		<VStack
			spacing={20}
			modifiers={[
				padding({ top: 32, horizontal: 20, bottom: 16 }),
				presentationDragIndicator("visible"),
				animation(Animation.easeInOut({ duration: 0.25 }), gridOpen),
			]}
		>
			<Button
				modifiers={[
					buttonStyle("plain"),
					accessibilityLabel(t("devices.change_icon")),
					accessibilityValue(
						draftIcon ? t(`devices.icons.${draftIcon}`) : t("devices.automatic_icon"),
					),
				]}
				onPress={toggleGrid}
			>
				<ZStack modifiers={[frame({ width: 72, height: 72 })]}>
					<Circle modifiers={[foregroundStyle(Colors.routyBlue)]} />
					<Image
						systemName={previewSymbol}
						color={Colors.routyWhite}
						size={32}
						modifiers={[symbolMonochrome()]}
					/>
				</ZStack>
			</Button>

			{gridOpen && (
				<Grid horizontalSpacing={12} verticalSpacing={12}>
					{GRID_ROWS.map((row, index) => (
						<Grid.Row key={index}>
							{row.map((option) => (
								<IconCell
									key={option ?? "automatic"}
									option={option}
									selected={option === draftIcon}
									palette={palette}
									// The grid stays open to compare icons; focusing the name closes it.
									onPress={() => setDraftIcon(option)}
								/>
							))}
						</Grid.Row>
					))}
				</Grid>
			)}

			<VStack alignment="leading" spacing={6}>
				<TextField
					ref={fieldRef}
					text={nameState}
					placeholder={t("devices.name_placeholder")}
					onTextChange={setName}
					onFocusChange={(focused) => {
						if (focused) setGridOpen(false);
					}}
					modifiers={[
						textFieldStyle("plain"),
						autocorrectionDisabled(),
						textInputAutocapitalization("never"),
						submitLabel("done"),
						font({ size: 17 }),
						padding({ horizontal: 14, vertical: 12 }),
						background(palette.faintFill),
						clipShape("roundedRectangle", 12),
					]}
				/>
				{error && (
					<SwiftText
						modifiers={[font({ size: 13 }), foregroundStyle(Colors.routyRed), padding({ leading: 4 })]}
					>
						{error}
					</SwiftText>
				)}
			</VStack>

			<HStack spacing={12}>
				<Button
					modifiers={[buttonStyle("bordered"), controlSize("large"), disabled(saving)]}
					onPress={onClose}
				>
					<SwiftText modifiers={[frame({ maxWidth: FILL_WIDTH })]}>{t("common.cancel")}</SwiftText>
				</Button>
				<Button
					modifiers={[
						buttonStyle("borderedProminent"),
						controlSize("large"),
						// Same blue as the selection ring and the app's primary buttons.
						tint(Colors.routyBlue),
						disabled(!canSave),
					]}
					onPress={save}
				>
					{saving ? (
						<ProgressView modifiers={[frame({ maxWidth: FILL_WIDTH })]} />
					) : (
						<SwiftText modifiers={[frame({ maxWidth: FILL_WIDTH })]}>
							{t("common.confirm")}
						</SwiftText>
					)}
				</Button>
			</HStack>
		</VStack>
	);
}

/**
 * Bottom sheet to change a device's icon and name. It edits a draft: nothing is
 * saved until "Confirm", and "Cancel" or a swipe down discards the changes.
 */
export function DeviceEditSheet({
	device,
	isPresented,
	manualIcon,
	onClose,
	onDismissed,
	onSetIcon,
	onRename,
}: {
	/** Kept after `isPresented` turns false, so the content survives the closing animation. */
	device: Device | null;
	isPresented: boolean;
	manualIcon: DeviceIconId | null;
	onClose: () => void;
	onDismissed: () => void;
	onSetIcon: (mac: string, id: DeviceIconId | null) => Promise<void>;
	onRename: (mac: string, hostname: string) => Promise<void>;
}) {
	return (
		<BottomSheet
			isPresented={isPresented}
			onIsPresentedChange={(presented) => {
				if (!presented) onClose();
			}}
			onDismiss={onDismissed}
			fitToContents
		>
			{device && (
				<EditContent
					// A fresh draft for every device.
					key={device.mac}
					device={device}
					manualIcon={manualIcon}
					onClose={onClose}
					onSetIcon={onSetIcon}
					onRename={onRename}
				/>
			)}
		</BottomSheet>
	);
}
