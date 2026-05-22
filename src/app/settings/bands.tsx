import { Stack, router } from "expo-router";
import React, { useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Platform,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { Check } from "iconoir-react-native";
import { useRouter } from "@/context/router-context";
import { t } from "@/i18n";
import { Colors } from "@/constants/Colors";
import { globalStyles, Layout } from "@/styles/globalStyles";
import { SectionLabel } from "@/components/SectionLabel";

const SELECTABLE_BANDS = ["B1", "B3", "B7", "B8", "B20", "B28", "B32", "B38"];

export default function BandsScreen() {
	const { dataUsage, setLteBands } = useRouter();

	const getDecodedBands = () => {
		const hex = dataUsage?.lteBandLock || "";
		// "0x20080800C5" represents AUTO. If empty or matching, we return auto and all bands.
		if (!hex || hex.toUpperCase() === "0X20080800C5") {
			return { mode: "auto" as const, bands: SELECTABLE_BANDS };
		}
		try {
			const val = BigInt(hex);
			const selected: string[] = [];
			SELECTABLE_BANDS.forEach((b) => {
				const bandNum = parseInt(b.replace("B", ""), 10);
				const bit = 1n << BigInt(bandNum - 1);
				if ((val & bit) !== 0n) {
					selected.push(b);
				}
			});
			// If somehow it successfully parsed 0 bands, fallback to auto
			if (selected.length === 0) {
				return { mode: "auto" as const, bands: SELECTABLE_BANDS };
			}
			return { mode: "manual" as const, bands: selected };
		} catch (e) {
			console.warn("Failed to decode bands:", hex, e);
			return { mode: "auto" as const, bands: SELECTABLE_BANDS };
		}
	};

	const decoded = getDecodedBands();

	const [initialState, setInitialState] = useState({
		mode: decoded.mode,
		bands: decoded.bands,
	});

	const [mode, setMode] = useState<"auto" | "manual">(initialState.mode);
	const [selectedBands, setSelectedBands] = useState<string[]>(initialState.bands);
	const [isSaving, setIsSaving] = useState(false);

	const hasChanges = (() => {
		if (mode !== initialState.mode) return true;
		if (mode === "manual") {
			const s1 = [...selectedBands].sort();
			const s2 = [...initialState.bands].sort();
			return JSON.stringify(s1) !== JSON.stringify(s2);
		}
		return false;
	})();

	const handleToggleBand = (band: string) => {
		if (selectedBands.includes(band)) {
			setSelectedBands(selectedBands.filter((b) => b !== band));
		} else {
			setSelectedBands([...selectedBands, band]);
		}
	};

	const handleSave = async () => {
		if (!hasChanges) return;

		if (mode === "manual" && selectedBands.length === 0) {
			Alert.alert(t("settings.attention"), t("settings.bands_empty_error_msg"));
			return;
		}

		setIsSaving(true);
		try {
			await setLteBands(mode, mode === "manual" ? selectedBands : SELECTABLE_BANDS);
			Alert.alert(t("settings.saved_title"), t("settings.bands_success_msg"));
			setInitialState({
				mode: mode,
				bands: mode === "manual" ? selectedBands : SELECTABLE_BANDS,
			});
		} catch (error) {
			Alert.alert(t("settings.attention"), t("settings.bands_error_msg"));
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<View style={globalStyles.container}>
			<Stack.Screen
				options={{
					title: t("settings.config_bands"),
					headerLargeTitle: false,
					headerTransparent: true,
					headerShadowVisible: false,
					headerBackButtonDisplayMode: "minimal",
					headerTitleStyle: { color: Colors.routyWhite },
					headerRight: () => (
						<TouchableOpacity
							onPress={handleSave}
							disabled={isSaving || !hasChanges}
							style={{
								paddingHorizontal: 8,
								paddingVertical: 6,
							}}
						>
							{isSaving ? (
								<ActivityIndicator size="small" color={Colors.routyWhite} />
							) : (
								<Text
									style={{
										color: hasChanges ? Colors.routyWhite : Colors.routyGray,
										fontWeight: "600",
										fontSize: 15,
									}}
								>
									{t("settings.save")}
								</Text>
							)}
						</TouchableOpacity>
					),
				}}
			/>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentInset={{ top: Layout.headerOffset }}
				contentOffset={{ x: 0, y: -Layout.headerOffset }}
				contentContainerStyle={[
					globalStyles.scroll,
					{ paddingTop: Platform.OS === "android" ? Layout.headerOffset : 0 },
					globalStyles.scrollNoTab,
				]}
			>
				<View style={[globalStyles.section, globalStyles.firstSection]}>
					<SectionLabel>{t("settings.bands_mode")}</SectionLabel>
					<View style={globalStyles.card}>
						<TouchableOpacity
							style={globalStyles.field}
							onPress={() => setMode("auto")}
						>
							<Text style={globalStyles.fieldLabel}>
								{t("settings.bands_automatic")}
							</Text>
							{mode === "auto" && (
								<Check
									width={20}
									height={20}
									strokeWidth={2.5}
									color={Colors.routyBlue}
								/>
							)}
						</TouchableOpacity>
						<View style={globalStyles.divider} />
						<TouchableOpacity
							style={globalStyles.field}
							onPress={() => setMode("manual")}
						>
							<Text style={globalStyles.fieldLabel}>
								{t("settings.bands_manual")}
							</Text>
							{mode === "manual" && (
								<Check
									width={20}
									height={20}
									strokeWidth={2.5}
									color={Colors.routyBlue}
								/>
							)}
						</TouchableOpacity>
					</View>
				</View>

				<View style={globalStyles.section}>
					<SectionLabel>{t("settings.bands_list")}</SectionLabel>
					<View
						style={[globalStyles.card, mode === "auto" && { opacity: 0.5 }]}
					>
						{SELECTABLE_BANDS.map((band, idx) => (
							<React.Fragment key={band}>
								{idx > 0 && <View style={globalStyles.divider} />}
								<TouchableOpacity
									style={globalStyles.field}
									onPress={() => handleToggleBand(band)}
									disabled={mode === "auto"}
								>
									<Text style={globalStyles.fieldLabel}>{band}</Text>
									{selectedBands.includes(band) && (
										<Check
											width={20}
											height={20}
											strokeWidth={2.5}
											color={Colors.routyBlue}
										/>
									)}
								</TouchableOpacity>
							</React.Fragment>
						))}
					</View>
				</View>
			</ScrollView>
		</View>
	);
}
