import React, { useEffect } from "react";
import {
	ActivityIndicator,
	RefreshControl,
	StyleSheet,
	Text,
	View,
	Dimensions,
	Animated,
	Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { Link, Stack } from "expo-router";

import { useRouter } from "@/context/router-context";
import { t } from "@/i18n";

const { width } = Dimensions.get("window");
const CIRCLE_SIZE = 120;
const STROKE_WIDTH = 12;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TARGET_GB = 1000; // 1TB Target

function formatGB(bytes: number) {
	return bytes / (1024 * 1024 * 1024);
}

import { SectionLabel } from "@/components/SectionLabel";
import { DashboardCard } from "@/components/DashboardCard";

export default function HomeScreen() {
	const { authStatus, dataUsage, devices, isLoadingData, loadDataUsage } =
		useRouter();

	useEffect(() => {
		if (authStatus === "logged_in" && !dataUsage) {
			loadDataUsage();
		}
	}, [authStatus, dataUsage, loadDataUsage]);

	const consumedGB = dataUsage ? formatGB(dataUsage.monthlyTotalBytes) : 0;
	const receivedGB = dataUsage ? formatGB(dataUsage.monthlyRxBytes) : 0;
	const sentGB = dataUsage ? formatGB(dataUsage.monthlyTxBytes) : 0;

	const percentage = Math.min(consumedGB / TARGET_GB, 1);
	const strokeDashoffset = CIRCUMFERENCE - CIRCUMFERENCE * percentage;

	const scrollY = React.useRef(new Animated.Value(0)).current;

	const titleOpacity = scrollY.interpolate({
		inputRange: Platform.OS === "ios" ? [-112, -72] : [0, 40],
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
				<Text style={styles.headerTitle}>{t("tabs.home")}</Text>
			</Animated.View>

			<Animated.ScrollView
				contentContainerStyle={styles.scroll}
				onScroll={Animated.event(
					[{ nativeEvent: { contentOffset: { y: scrollY } } }],
					{ useNativeDriver: true },
				)}
				scrollEventThrottle={16}
				contentInset={{ top: 112 }}
				contentOffset={{ x: 0, y: -112 }}
				refreshControl={
					<RefreshControl
						refreshing={isLoadingData}
						onRefresh={loadDataUsage}
					/>
				}
			>
				<SectionLabel style={{ marginTop: 0 }}>
					{t("dashboard.usage")}
				</SectionLabel>

				<View style={styles.usageCard}>
					{/* Progress Section */}
					<View style={styles.chartSection}>
						<Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
							<Circle
								cx={CIRCLE_SIZE / 2}
								cy={CIRCLE_SIZE / 2}
								r={RADIUS}
								stroke="#208AEF"
								strokeWidth={STROKE_WIDTH}
								fill="transparent"
								opacity={0.2}
							/>
							<Circle
								cx={CIRCLE_SIZE / 2}
								cy={CIRCLE_SIZE / 2}
								r={RADIUS}
								stroke="#208AEF"
								strokeWidth={STROKE_WIDTH}
								fill="transparent"
								strokeDasharray={CIRCUMFERENCE}
								strokeDashoffset={strokeDashoffset}
								strokeLinecap="round"
								transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
							/>
						</Svg>
						<View style={styles.chartTextContainer}>
							<Text style={styles.chartValue}>{Math.round(consumedGB)}</Text>
							<Text style={styles.chartSubtext}>
								{t("dashboard.usage_limit", { limit: "1TB" })}
							</Text>
						</View>
					</View>

					{/* Stats Section */}
					<View style={styles.statsSection}>
						<View style={styles.statGroup}>
							<Text style={styles.statLabel}>{t("dashboard.received")}</Text>
							<View style={styles.valueRow}>
								<Text style={[styles.statValueMain, { color: "#FF2D55" }]}>
									{receivedGB.toFixed(1)}
								</Text>
								<Text style={[styles.unitText, { color: "#FF2D55" }]}>GB</Text>
							</View>
						</View>

						<View style={styles.statGroup}>
							<Text style={styles.statLabel}>{t("dashboard.sent")}</Text>
							<View style={styles.valueRow}>
								<Text style={[styles.statValueMain, { color: "#A7FF00" }]}>
									{sentGB.toFixed(1)}
								</Text>
								<Text style={[styles.unitText, { color: "#A7FF00" }]}>GB</Text>
							</View>
						</View>
					</View>
				</View>

				{/* Info Cards Row 1 */}
				<SectionLabel>{t("dashboard.network")}</SectionLabel>
				<View style={styles.infoRow}>
					<DashboardCard
						label={t("dashboard.operator")}
						value={`${dataUsage?.networkProvider} ${dataUsage?.networkType}${dataUsage?.isCA ? "+" : ""}`}
					/>

					<DashboardCard
						label={t("dashboard.bands")}
						value={dataUsage?.bands}
					/>
				</View>

				{/* Info Cards Row 2 */}
				<View style={styles.infoRow}>
					<DashboardCard label={t("dashboard.speed")}>
						<View
							style={{
								flexDirection: "row",
								justifyContent: "space-between",
								alignItems: "center",
							}}
						>
							<Text style={styles.infoValueSmall}>
								<Text style={{ color: "#FF2D55" }}>↓</Text>{" "}
								{dataUsage?.realtimeRxThrpt}
							</Text>
							<Text style={[styles.infoValueSmall, { marginRight: 4 }]}>
								<Text style={{ color: "#A7FF00" }}>↑</Text>{" "}
								{dataUsage?.realtimeTxThrpt}
							</Text>
						</View>
					</DashboardCard>

					<Link href="/devices" asChild>
						<DashboardCard
							label={t("dashboard.devices")}
							value={devices.filter((d) => d.ip && d.ip !== "-").length}
							showChevron
						/>
					</Link>
				</View>

				<SectionLabel>{t("dashboard.signal")}</SectionLabel>
				<View style={styles.infoRow}>
					<DashboardCard
						label={t("dashboard.rsrp")}
						value={`${dataUsage?.rsrp} dBm`}
					/>

					<DashboardCard
						label={t("dashboard.sinr")}
						value={`${dataUsage?.sinr} dB`}
					/>
				</View>
			</Animated.ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000",
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
	scroll: {
		paddingHorizontal: 16,
		paddingBottom: 48,
		paddingTop: Platform.OS === "android" ? 112 : 0,
	},
	centerContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#000",
	},
	usageCard: {
		flexDirection: "row",
		backgroundColor: "#1C1C1E",
		borderRadius: 12,
		padding: 20,
		alignItems: "center",
		gap: 24,
	},
	chartSection: {
		width: CIRCLE_SIZE,
		height: CIRCLE_SIZE,
		justifyContent: "center",
		alignItems: "center",
	},
	chartTextContainer: {
		position: "absolute",
		alignItems: "center",
	},
	chartValue: {
		fontSize: 24,
		fontWeight: "800",
		color: "#fff",
		fontFamily: "ui-rounded",
	},
	chartSubtext: {
		fontSize: 10,
		color: "#8E8E93",
		fontWeight: "600",
	},
	statsSection: {
		flex: 1,
		gap: 16,
	},
	statGroup: {
		gap: 0,
	},
	statLabel: {
		fontSize: 15,
		fontWeight: "400",
		color: "#fff",
	},
	statValueMain: {
		fontSize: 26,
		fontWeight: "700",
		fontFamily: "ui-rounded",
	},
	valueRow: {
		flexDirection: "row",
		alignItems: "baseline",
	},
	unitText: {
		fontSize: 14,
		fontWeight: "800",
		marginLeft: 2,
		fontFamily: "ui-rounded",
	},
	infoRow: {
		flexDirection: "row",
		gap: 8,
	},
	infoValueSmall: {
		fontSize: 17,
		color: "#fff",
		fontWeight: "600",
		fontFamily: "ui-rounded",
	},
	infoUnit: {
		fontSize: 10,
		color: "#8E8E93",
		fontWeight: "400",
		fontFamily: "ui-rounded",
	},
});
