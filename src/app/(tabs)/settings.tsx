import { Stack } from "expo-router";
import React, { useState } from "react";
import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
	Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "@/context/router-context";
import { SectionLabel } from "@/components/SectionLabel";
import { t } from "@/i18n";

export default function SettingsScreen() {
	const { routerUrl, password, saveSettings, login, authStatus } = useRouter();

	const [urlInput, setUrlInput] = useState(routerUrl);
	const [passwordInput, setPasswordInput] = useState(password);
	const [isSaving, setIsSaving] = useState(false);

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

					{/* Save button */}
					<Pressable
						style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
						onPress={handleSave}
						disabled={isSaving}
					>
						{isSaving ? (
							<ActivityIndicator color="#fff" />
						) : (
							<Text style={styles.saveButtonText}>
								{t("settings.save_and_connect")}
							</Text>
						)}
					</Pressable>

					{/* Info section */}
					<SectionLabel>{t("settings.info")}</SectionLabel>
					<View style={styles.card}>
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>{t("settings.router")}</Text>
							<Text style={styles.infoValue}>ZTE MF289F</Text>
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
					</View>
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
		paddingBottom: 48,
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
	sectionFooter: {
		fontSize: 12,
		color: "#636366",
		lineHeight: 16,
		textAlign: "center",
	},
	card: {
		backgroundColor: "#1C1C1E",
		borderRadius: 12,
		overflow: "hidden",
		marginBottom: 8,
	},
	field: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		gap: 4,
	},
	fieldLabel: {
		fontSize: 12,
		color: "#8E8E93",
		fontWeight: "500",
	},
	fieldInput: {
		fontSize: 16,
		color: "#fff",
		paddingVertical: 0,
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
	statusText: {
		fontSize: 14,
		color: "#8E8E93",
		flex: 1,
	},
	saveButton: {
		backgroundColor: "#208AEF",
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: "center",
		marginTop: 4,
	},
	saveButtonDisabled: {
		opacity: 0.6,
	},
	saveButtonText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "600",
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
