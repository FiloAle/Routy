import { Stack, router } from "expo-router";
import React, { useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Platform,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { Check } from "iconoir-react-native";
import { useRouter } from "@/context/router-context";
import { t } from "@/i18n";
import { Colors } from "@/constants/Colors";
import { globalStyles, Layout } from "@/styles/globalStyles";
import { SectionLabel } from "@/components/SectionLabel";

export default function DnsScreen() {
	const { dataUsage, setDns } = useRouter();

	const [initialState, setInitialState] = useState({
		mode: (dataUsage?.dnsMode as "auto" | "manual") || "auto",
		preferDns: dataUsage?.preferDns || "",
		standbyDns: dataUsage?.standbyDns || "",
	});

	const [mode, setMode] = useState<"auto" | "manual">(initialState.mode);
	const [preferDns, setPreferDns] = useState(initialState.preferDns);
	const [standbyDns, setStandbyDns] = useState(initialState.standbyDns);
	const [isSaving, setIsSaving] = useState(false);

	const hasChanges =
		mode !== initialState.mode ||
		(mode === "manual" &&
			(preferDns !== initialState.preferDns || standbyDns !== initialState.standbyDns));

	const handleSave = async () => {
		if (!hasChanges) return;

		if (mode === "manual" && !preferDns.trim()) {
			Alert.alert(t("settings.attention"), t("settings.dns_error_msg"));
			return;
		}

		setIsSaving(true);
		try {
			// If mode is auto, we pass "auto" to api, and the api handles setting the dns.
			// ZTE Router usually expects "auto" to set auto and can ignore secondary values,
			// but we pass them clean or as empty.
			await setDns(
				mode,
				mode === "manual" ? preferDns.trim() : "",
				mode === "manual" ? standbyDns.trim() : "",
			);
			Alert.alert(t("settings.saved_title"), t("settings.dns_success_msg"));
			setInitialState({
				mode: mode,
				preferDns: mode === "manual" ? preferDns.trim() : "",
				standbyDns: mode === "manual" ? standbyDns.trim() : "",
			});
		} catch (error) {
			Alert.alert(t("settings.attention"), t("settings.dns_error_msg"));
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<View style={globalStyles.container}>
			<Stack.Screen
				options={{
					title: t("settings.config_dns"),
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
					<View style={globalStyles.card}>
						<TouchableOpacity
							style={globalStyles.field}
							onPress={() => setMode("auto")}
						>
							<Text style={globalStyles.fieldLabel}>
								{t("settings.dns_automatic")}
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
								{t("settings.dns_manual")}
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
					<SectionLabel>{t("settings.dns_server")}</SectionLabel>
					<View
						style={[globalStyles.card, mode === "auto" && { opacity: 0.5 }]}
					>
						<View style={globalStyles.field}>
							<Text style={globalStyles.fieldLabel}>
								{t("settings.dns_primary")}
							</Text>
							<TextInput
								style={[
									globalStyles.fieldInput,
									{
										color:
											mode === "manual" ? Colors.routyWhite : Colors.routyGray,
									},
								]}
								value={preferDns}
								onChangeText={(text) => setPreferDns(text.replace(/,/g, "."))}
								editable={mode === "manual"}
								placeholder="1.1.1.1"
								placeholderTextColor={Colors.routyGray}
								keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"}
								autoCapitalize="none"
								autoCorrect={false}
							/>
						</View>
						<View style={globalStyles.divider} />
						<View style={globalStyles.field}>
							<Text style={globalStyles.fieldLabel}>
								{t("settings.dns_secondary")}
							</Text>
							<TextInput
								style={[
									globalStyles.fieldInput,
									{
										color:
											mode === "manual" ? Colors.routyWhite : Colors.routyGray,
									},
								]}
								value={standbyDns}
								onChangeText={(text) => setStandbyDns(text.replace(/,/g, "."))}
								editable={mode === "manual"}
								placeholder="1.0.0.1"
								placeholderTextColor={Colors.routyGray}
								keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"}
								autoCapitalize="none"
								autoCorrect={false}
							/>
						</View>
					</View>
				</View>
			</ScrollView>
		</View>
	);
}
