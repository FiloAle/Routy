import { Stack } from "expo-router";
import React, { useState, useEffect } from "react";
import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Platform,
	StyleSheet,
	Text,
	TextInput,
	View,
	Animated,
	Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "@/context/router-context";
import { SectionLabel } from "@/components/SectionLabel";
import { PrimaryButton } from "@/components/PrimaryButton";
import { t } from "@/i18n";

export default function SettingsScreen() {
	const {
		routerUrl,
		password,
		saveSettings,
		login,
		authStatus,
		dataUsage,
		networkStatus,
		connectNetwork,
		disconnectNetwork,
		reboot,
		softwareVersion,
		softwareModel,
		nightMode,
		fetchNightMode,
		setNightMode,
		loadDataUsage,
	} = useRouter();

	const [urlInput, setUrlInput] = useState(routerUrl);
	const [passwordInput, setPasswordInput] = useState(password);
	const [isSaving, setIsSaving] = useState(false);

	// Picker states
	const [showStartPicker, setShowStartPicker] = useState(false);
	const [showEndPicker, setShowEndPicker] = useState(false);

	useEffect(() => {
		if (authStatus === "logged_in") {
			fetchNightMode();
			loadDataUsage();
		}
	}, [authStatus, fetchNightMode, loadDataUsage]);

	// Helpers for time conversion
	const timeStringToDate = (timeStr: string) => {
		const [hours, minutes] = (timeStr || "00:00")
			.split(":")
			.map((s) => parseInt(s, 10));
		const date = new Date();
		date.setHours(hours, minutes, 0, 0);
		return date;
	};

	const dateToTimeString = (date: Date) => {
		const hours = date.getHours().toString().padStart(2, "0");
		const minutes = date.getMinutes().toString().padStart(2, "0");
		return `${hours}:${minutes}`;
	};

	const handleSave = async () => {
		const url = urlInput.trim() || "http://192.168.0.1";
		if (!passwordInput.trim()) {
			Alert.alert(t("settings.attention"), t("settings.enter_pw_alert"));
			return;
		}
		setIsSaving(true);
		await saveSettings(url, passwordInput.trim());
		await login();
		setIsSaving(false);
		Alert.alert(
			authStatus === "logged_in"
				? t("settings.login_success_title")
				: t("settings.saved_title"),
			authStatus === "logged_in"
				? t("settings.login_success_msg")
				: t("settings.saved_msg"),
		);
	};

	const toggleNetwork = async () => {
		try {
			if (networkStatus === "connected") {
				await disconnectNetwork();
			} else {
				await connectNetwork();
			}
		} catch (e) {
			Alert.alert("Errore", "Impossibile cambiare lo stato della rete.");
		}
	};

	const toggleNightMode = async (val: boolean) => {
		try {
			await setNightMode(
				val,
				nightMode?.start || "22:00",
				nightMode?.end || "07:00",
			);
		} catch (e) {
			Alert.alert("Errore", "Impossibile aggiornare la modalità notturna.");
		}
	};

	const scrollY = React.useRef(new Animated.Value(0)).current;

	const titleOpacity = scrollY.interpolate({
		inputRange: [0, 40],
		outputRange: [1, 0],
		extrapolate: "clamp",
	});

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ headerShown: false }} />

			<LinearGradient
				colors={["rgba(0,0,0,0.8)", "transparent"]}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					height: 120,
					zIndex: 10,
				}}
				pointerEvents="none"
			/>

			<Animated.View
				style={[
					styles.header,
					{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						zIndex: 11,
						opacity: titleOpacity,
						backgroundColor: "transparent",
					},
				]}
			>
				<Text style={styles.headerTitle}>{t("settings.title")}</Text>
			</Animated.View>

			<KeyboardAvoidingView
				style={{ flex: 1 }}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
			>
				<Animated.ScrollView
					contentContainerStyle={styles.scroll}
					onScroll={Animated.event(
						[{ nativeEvent: { contentOffset: { y: scrollY } } }],
						{ useNativeDriver: true },
					)}
					scrollEventThrottle={16}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					{/* Router section */}
					<SectionLabel style={{ marginTop: 0 }}>
						{t("settings.router")}
					</SectionLabel>
					<View style={styles.card}>
						<View style={styles.field}>
							<Text style={styles.fieldLabel}>{t("settings.address")}</Text>
							<TextInput
								style={styles.fieldInput}
								value={urlInput}
								onChangeText={setUrlInput}
								placeholder="http://192.168.0.1"
								placeholderTextColor="#636366"
								autoCapitalize="none"
								autoCorrect={false}
								keyboardType="url"
							/>
						</View>
						<View style={styles.divider} />
						<View style={styles.field}>
							<Text style={styles.fieldLabel}>{t("settings.password")}</Text>
							<TextInput
								style={styles.fieldInput}
								value={passwordInput}
								onChangeText={setPasswordInput}
								placeholder="••••••••"
								placeholderTextColor="#636366"
								secureTextEntry
								autoCapitalize="none"
								autoCorrect={false}
							/>
						</View>
					</View>

					<PrimaryButton
						label={t("settings.save_and_connect")}
						onPress={handleSave}
						isLoading={isSaving}
						style={{ marginTop: 4, marginBottom: 8 }}
					/>

					{/* Network section */}
					<SectionLabel>{t("settings.network")}</SectionLabel>
					<View style={styles.card}>
						{dataUsage?.ssid && (
							<>
								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>SSID</Text>
									<Text style={styles.infoValue}>{dataUsage.ssid}</Text>
								</View>
								<View style={styles.divider} />
							</>
						)}
						<View style={styles.field}>
							<Text style={styles.fieldLabel}>
								{t("settings.data_network")}
							</Text>
							<Switch
								value={
									networkStatus === "connected" ||
									networkStatus === "connecting"
								}
								onValueChange={toggleNetwork}
								trackColor={{ false: "#3A3A3C", true: "#3B82F6" }}
								disabled={
									networkStatus === "connecting" ||
									networkStatus === "disconnecting"
								}
							/>
						</View>
						{dataUsage?.wanIp && (
							<>
								<View style={styles.divider} />
								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>
										{t("settings.public_ip")}
									</Text>
									<Text style={styles.infoValue}>{dataUsage.wanIp}</Text>
								</View>
							</>
						)}
					</View>

					{/* Night Mode section */}
					<SectionLabel>{t("settings.night_mode")}</SectionLabel>
					<View style={styles.card}>
						<View style={styles.field}>
							<Text style={styles.fieldLabel}>
								{t("settings.night_mode_on")}
							</Text>
							<Switch
								value={nightMode?.enabled || false}
								onValueChange={toggleNightMode}
								trackColor={{ false: "#3A3A3C", true: "#3B82F6" }}
							/>
						</View>
						<View style={styles.divider} />

						{/* Start Time Picker */}
						<View style={styles.field}>
							<Text style={styles.fieldLabel}>
								{t("settings.night_mode_start")}
							</Text>
							<DateTimePicker
								value={timeStringToDate(nightMode?.start || "22:00")}
								mode="time"
								is24Hour={true}
								display="default"
								onChange={(event, date) => {
									if (date) {
										setNightMode(
											nightMode?.enabled || false,
											dateToTimeString(date),
											nightMode?.end || "07:00",
										);
									}
								}}
								themeVariant="dark"
							/>
						</View>

						<View style={styles.divider} />

						{/* End Time Picker */}
						<View style={styles.field}>
							<Text style={styles.fieldLabel}>
								{t("settings.night_mode_end")}
							</Text>
							<DateTimePicker
								value={timeStringToDate(nightMode?.end || "07:00")}
								mode="time"
								is24Hour={true}
								display="default"
								onChange={(event, date) => {
									if (date) {
										setNightMode(
											nightMode?.enabled || false,
											nightMode?.start || "22:00",
											dateToTimeString(date),
										);
									}
								}}
								themeVariant="dark"
							/>
						</View>
					</View>

					{/* Info section */}
					<SectionLabel>{t("settings.info")}</SectionLabel>
					<View style={styles.card}>
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>{t("settings.model")}</Text>
							<Text style={styles.infoValue}>{softwareModel || "..."}</Text>
						</View>
						<View style={styles.divider} />
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>
								{t("settings.info_connection")}
							</Text>
							<View style={styles.statusRow}>
								<View
									style={[
										styles.statusDot,
										authStatus === "logged_in" && styles.statusDotOnline,
										authStatus === "error" && styles.statusDotError,
										authStatus === "loading" && styles.statusDotLoading,
									]}
								/>
								<Text style={styles.infoValue}>
									{authStatus === "idle" && t("settings.status_idle")}
									{authStatus === "loading" && t("settings.status_connecting")}
									{authStatus === "logged_in" && t("settings.status_connected")}
									{authStatus === "error" && t("settings.status_error")}
								</Text>
								{authStatus === "loading" && (
									<ActivityIndicator size="small" color="#8E8E93" />
								)}
							</View>
						</View>
						<View style={styles.divider} />
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>
								{t("settings.software_version")}
							</Text>
							<Text style={styles.infoValue}>{softwareVersion || "..."}</Text>
						</View>
					</View>

					<PrimaryButton
						label={t("settings.reboot")}
						onPress={reboot}
						color="#FF2D55"
						style={{ marginTop: 4, marginBottom: 48 }}
					/>
				</Animated.ScrollView>
			</KeyboardAvoidingView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000",
	},
	scroll: {
		paddingHorizontal: 16,
		paddingBottom: 100,
		paddingTop: 112,
	},
	header: {
		paddingHorizontal: 16,
		paddingBottom: 8,
		paddingTop: 60,
	},
	headerTitle: {
		fontSize: 34,
		fontWeight: "700",
		color: "#fff",
		letterSpacing: 0.4,
	},
	card: {
		backgroundColor: "#1C1C1E",
		borderRadius: 12,
		overflow: "hidden",
		marginBottom: 8,
	},
	field: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	fieldLabel: {
		fontSize: 16,
		color: "#fff",
	},
	fieldInput: {
		fontSize: 16,
		color: "#8E8E93",
		flex: 1,
		textAlign: "right",
	},
	divider: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: "#3A3A3C",
		marginLeft: 16,
	},
	statusRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	statusDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: "#636366",
	},
	statusDotOnline: {
		backgroundColor: "#30D158",
	},
	statusDotError: {
		backgroundColor: "#FF3B30",
	},
	statusDotLoading: {
		backgroundColor: "#FF9F0A",
	},
	infoRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	infoLabel: {
		fontSize: 16,
		color: "#fff",
	},
	infoValue: {
		fontSize: 16,
		color: "#8E8E93",
	},
});
