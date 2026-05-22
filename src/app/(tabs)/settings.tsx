import { Link, Stack } from "expo-router";
import { NavArrowRight } from "iconoir-react-native";
import React, { useState, useEffect } from "react";
import {
	ActivityIndicator,
	Alert,
	Platform,
	Text,
	TextInput,
	View,
	Animated,
	Switch,
	TouchableOpacity,
	Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "@/context/router-context";
import { SectionLabel } from "@/components/SectionLabel";
import { PrimaryButton } from "@/components/PrimaryButton";
import { t } from "@/i18n";
import { Colors } from "@/constants/Colors";
import { globalStyles } from "@/styles/globalStyles";
import { settingsStyles } from "@/styles/settingsStyles";

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
		dataLimitValue,
		dataLimitUnit,
		setDataLimit,
	} = useRouter();

	const getDisplayUrl = (url: string) => {
		return url.replace(/^https?:\/\//i, "");
	};

	const [urlInput, setUrlInput] = useState(getDisplayUrl(routerUrl));

	useEffect(() => {
		setUrlInput(getDisplayUrl(routerUrl));
	}, [routerUrl]);

	const [passwordInput, setPasswordInput] = useState(password);

	useEffect(() => {
		setPasswordInput(password);
	}, [password]);

	const [isSaving, setIsSaving] = useState(false);
	const [limitSelection, setLimitSelection] = useState({ start: 0, end: 0 });

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
		const trimmed = urlInput.trim() || "192.168.0.1";
		let url = trimmed;
		if (!url.startsWith("http://") && !url.startsWith("https://")) {
			url = `http://${url}`;
		}
		if (!passwordInput.trim()) {
			Alert.alert(t("settings.attention"), t("settings.enter_pw_alert"));
			return;
		}
		setIsSaving(true);
		await saveSettings(url, passwordInput.trim());
		const success = await login(passwordInput.trim());
		setIsSaving(false);
		Alert.alert(
			success
				? t("settings.login_success_title")
				: t("settings.saved_title"),
			success
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
		} catch (error) {
			Alert.alert(t("common.error"), t("settings.error_conn"));
		}
	};

	const toggleNightMode = async (enabled: boolean) => {
		if (!nightMode) return;
		try {
			await setNightMode(enabled, nightMode.start, nightMode.end);
		} catch (error) {
			Alert.alert(t("common.error"), t("common.error_generic"));
		}
	};

	const handleNightModeStartChange = async (event: any, date?: Date) => {
		if (!nightMode || !date) return;
		const newStart = dateToTimeString(date);
		try {
			await setNightMode(nightMode.enabled, newStart, nightMode.end);
		} catch (error) {
			Alert.alert(t("common.error"), t("common.error_generic"));
		}
	};

	const handleNightModeEndChange = async (event: any, date?: Date) => {
		if (!nightMode || !date) return;
		const newEnd = dateToTimeString(date);
		try {
			await setNightMode(nightMode.enabled, nightMode.start, newEnd);
		} catch (error) {
			Alert.alert(t("common.error"), t("common.error_generic"));
		}
	};

	const handleReboot = () => {
		Alert.alert(t("settings.reboot"), t("common.confirm_reboot"), [
			{ text: t("common.cancel"), style: "cancel" },
			{
				text: t("settings.reboot"),
				style: "destructive",
				onPress: async () => {
					try {
						await reboot();
						Alert.alert(t("common.success"), t("settings.reboot_success"));
					} catch (error) {
						Alert.alert(t("common.error"), t("settings.reboot_error"));
					}
				},
			},
		]);
	};

	const unitAnim = React.useRef(
		new Animated.Value(dataLimitUnit === "GB" ? 0 : 1),
	).current;

	useEffect(() => {
		Animated.spring(unitAnim, {
			toValue: dataLimitUnit === "GB" ? 0 : 1,
			useNativeDriver: true,
			friction: 8,
			tension: 50,
		}).start();
	}, [dataLimitUnit, unitAnim]);

	const sliderTranslateX = unitAnim.interpolate({
		inputRange: [0, 1],
		outputRange: [2, 42], // Adjust based on button width
	});

	const scrollY = React.useRef(new Animated.Value(0)).current;

	const titleOpacity = scrollY.interpolate({
		inputRange: Platform.OS === "ios" ? [-112, -72] : [0, 40],
		outputRange: [1, 0],
		extrapolate: "clamp",
	});

	return (
		<View style={globalStyles.container}>
			<Stack.Screen options={{ headerShown: false }} />

			<LinearGradient
				colors={["rgba(0,0,0,0.8)", "transparent"]}
				style={settingsStyles.headerGradient}
				pointerEvents="none"
			/>

			<Animated.View
				style={[
					settingsStyles.header,
					{
						opacity: titleOpacity,
					},
				]}
			>
				<Text style={settingsStyles.headerTitle}>{t("settings.title")}</Text>
			</Animated.View>

			<View style={{ flex: 1 }}>
				<Animated.ScrollView
					contentContainerStyle={[
						globalStyles.scroll,
						{ paddingTop: Platform.OS === "ios" ? 0 : 112 },
					]}
					onScroll={Animated.event(
						[{ nativeEvent: { contentOffset: { y: scrollY } } }],
						{ useNativeDriver: true },
					)}
					scrollEventThrottle={16}
					contentInset={{ top: 112 }}
					contentOffset={{ x: 0, y: -112 }}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					{/* Router section */}
					<View style={[globalStyles.section, globalStyles.firstSection]}>
						<SectionLabel>{t("settings.router")}</SectionLabel>
						<View style={globalStyles.card}>
							<View style={globalStyles.field}>
								<Text style={globalStyles.fieldLabel}>
									{t("settings.address")}
								</Text>
								<TextInput
									style={globalStyles.fieldInput}
									value={urlInput}
									onChangeText={(val) =>
										setUrlInput(val.replace(/^https?:\/\//i, ""))
									}
									placeholder="192.168.0.1"
									placeholderTextColor={Colors.routyGray}
									autoCapitalize="none"
									autoCorrect={false}
									keyboardType="url"
								/>
							</View>
							<View style={globalStyles.divider} />
							<View style={globalStyles.field}>
								<Text style={globalStyles.fieldLabel}>
									{t("settings.password")}
								</Text>
								<TextInput
									style={globalStyles.fieldInput}
									value={passwordInput}
									onChangeText={setPasswordInput}
									placeholder="••••••••"
									placeholderTextColor={Colors.routyGray}
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
						/>
					</View>

					{/* Network section */}
					<View style={globalStyles.section}>
						<SectionLabel>{t("settings.network")}</SectionLabel>
						<View style={globalStyles.card}>
							{dataUsage?.ssid && (
								<>
									<View style={globalStyles.infoRow}>
										<Text style={globalStyles.infoLabel}>SSID</Text>
										<Text style={globalStyles.infoValue}>{dataUsage.ssid}</Text>
									</View>
									<View style={globalStyles.divider} />
								</>
							)}
							<View style={globalStyles.field}>
								<Text style={globalStyles.fieldLabel}>
									{t("settings.data_network")}
								</Text>
								<Switch
									value={
										networkStatus === "connected" ||
										networkStatus === "connecting"
									}
									onValueChange={toggleNetwork}
									trackColor={{
										false: Colors.routyLightGray,
										true: Colors.routyBlue,
									}}
									disabled={
										networkStatus === "connecting" ||
										networkStatus === "disconnecting"
									}
								/>
							</View>
							{dataUsage?.wanIp && (
								<>
									<View style={globalStyles.divider} />
									<View style={globalStyles.infoRow}>
										<Text style={globalStyles.infoLabel}>
											{t("settings.public_ip")}
										</Text>
										<Text style={globalStyles.infoValue}>
											{dataUsage.wanIp}
										</Text>
									</View>
								</>
							)}
							<View style={globalStyles.divider} />
							<Link href="/settings/dns" asChild>
								<TouchableOpacity style={globalStyles.field}>
									<Text style={globalStyles.fieldLabel}>
										{t("settings.dns")}
									</Text>
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 2,
										}}
									>
										<Text style={globalStyles.infoValue}>
											{dataUsage?.dnsMode === "manual"
												? t("settings.dns_manual")
												: t("settings.dns_automatic")}
										</Text>
										<NavArrowRight
											width={20}
											height={20}
											strokeWidth={2}
											color={Colors.routyGray}
											opacity={0.5}
											style={{ marginBottom: -2, marginRight: -2 }}
										/>
									</View>
								</TouchableOpacity>
							</Link>
							<View style={globalStyles.divider} />
							<View style={globalStyles.field}>
								<Text style={globalStyles.fieldLabel}>
									{t("settings.data_limit")}
								</Text>
								<View style={settingsStyles.fieldRow}>
									<TextInput
										style={[
											globalStyles.fieldInput,
											settingsStyles.dataLimitInput,
										]}
										value={dataLimitValue}
										onChangeText={(val) => {
											const clean = val.replace(/[^0-9]/g, "");
											setDataLimit(clean, dataLimitUnit);
											setLimitSelection({
												start: clean.length,
												end: clean.length,
											});
										}}
										onFocus={() => {
											setTimeout(() => {
												setLimitSelection({
													start: dataLimitValue.length,
													end: dataLimitValue.length,
												});
											}, 50);
										}}
										selection={limitSelection}
										onSelectionChange={(e) =>
											setLimitSelection(e.nativeEvent.selection)
										}
										keyboardType="numeric"
										placeholder="0"
										placeholderTextColor={Colors.routyGray}
									/>
									<View style={settingsStyles.unitSelector}>
										<Animated.View
											style={[
												settingsStyles.unitButtonActive,
												{
													position: "absolute",
													left: 0,
													top: 2,
													bottom: 2,
													width: 40,
													transform: [{ translateX: sliderTranslateX }],
												},
											]}
										/>
										<TouchableOpacity
											style={settingsStyles.unitButton}
											onPress={() => setDataLimit(dataLimitValue, "GB")}
										>
											<Text
												style={[
													settingsStyles.unitText,
													dataLimitUnit === "GB" &&
														settingsStyles.unitTextActive,
												]}
											>
												{t("settings.gb")}
											</Text>
										</TouchableOpacity>
										<TouchableOpacity
											style={settingsStyles.unitButton}
											onPress={() => setDataLimit(dataLimitValue, "TB")}
										>
											<Text
												style={[
													settingsStyles.unitText,
													dataLimitUnit === "TB" &&
														settingsStyles.unitTextActive,
												]}
											>
												{t("settings.tb")}
											</Text>
										</TouchableOpacity>
									</View>
								</View>
							</View>
						</View>
					</View>

					{/* Night Mode section */}
					<View style={globalStyles.section}>
						<SectionLabel>{t("settings.night_mode")}</SectionLabel>
						<View style={globalStyles.card}>
							<View style={globalStyles.field}>
								<Text style={globalStyles.fieldLabel}>
									{t("settings.night_mode")}
								</Text>
								<Switch
									value={nightMode?.enabled || false}
									onValueChange={toggleNightMode}
									trackColor={{
										false: Colors.routyLightGray,
										true: Colors.routyBlue,
									}}
								/>
							</View>
							<View style={globalStyles.divider} />

							{/* Start Time Picker */}
							<View style={globalStyles.field}>
								<Text style={globalStyles.fieldLabel}>
									{t("settings.night_mode_start")}
								</Text>
								<DateTimePicker
									value={timeStringToDate(nightMode?.start || "00:00")}
									mode="time"
									display="default"
									onChange={handleNightModeStartChange}
									themeVariant="dark"
								/>
							</View>

							<View style={globalStyles.divider} />

							{/* End Time Picker */}
							<View style={globalStyles.field}>
								<Text style={globalStyles.fieldLabel}>
									{t("settings.night_mode_end")}
								</Text>
								<DateTimePicker
									value={timeStringToDate(nightMode?.end || "00:00")}
									mode="time"
									display="default"
									onChange={handleNightModeEndChange}
									themeVariant="dark"
								/>
							</View>
						</View>
					</View>

					{/* Info section */}
					<View style={globalStyles.section}>
						<SectionLabel>{t("settings.info")}</SectionLabel>
						<View style={globalStyles.card}>
							<View style={globalStyles.infoRow}>
								<Text style={globalStyles.infoLabel}>
									{t("settings.model")}
								</Text>
								<Text style={globalStyles.infoValue}>
									{softwareModel || "..."}
								</Text>
							</View>
							<View style={globalStyles.divider} />
							<View style={globalStyles.infoRow}>
								<Text style={globalStyles.infoLabel}>
									{t("settings.info_connection")}
								</Text>
								<View style={globalStyles.statusRow}>
									<View
										style={[
											globalStyles.statusDot,
											authStatus === "logged_in" &&
												globalStyles.statusDotOnline,
											authStatus === "error" && globalStyles.statusDotError,
											authStatus === "loading" && globalStyles.statusDotLoading,
										]}
									/>
									<Text style={globalStyles.infoValue}>
										{authStatus === "idle" && t("settings.status_idle")}
										{authStatus === "loading" &&
											t("settings.status_connecting")}
										{authStatus === "logged_in" &&
											t("settings.status_connected")}
										{authStatus === "error" && t("settings.status_error")}
									</Text>
									{authStatus === "loading" && (
										<ActivityIndicator size="small" color={Colors.routyGray} />
									)}
								</View>
							</View>
							<View style={globalStyles.divider} />
							<View style={globalStyles.infoRow}>
								<Text style={globalStyles.infoLabel}>
									{t("settings.software_version")}
								</Text>
								<Text style={globalStyles.infoValue}>
									{softwareVersion || "..."}
								</Text>
							</View>
						</View>
						<Pressable style={globalStyles.dangerButton} onPress={handleReboot}>
							<Text style={globalStyles.dangerButtonText}>
								{t("settings.reboot")}
							</Text>
						</Pressable>
					</View>
				</Animated.ScrollView>
			</View>
		</View>
	);
}
