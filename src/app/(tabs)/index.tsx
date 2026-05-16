import React, { useEffect } from "react";
import {
	RefreshControl,
	Text,
	View,
	Dimensions,
	Animated,
	Platform,
	TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { Link, Stack } from "expo-router";

import { useRouter } from "@/context/router-context";
import { t } from "@/i18n";
import { Colors } from "@/constants/Colors";
import { globalStyles } from "@/styles/globalStyles";
import { dashboardStyles } from "@/styles/dashboardStyles";
import { SectionLabel } from "@/components/SectionLabel";
import { DashboardCard } from "@/components/DashboardCard";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const CIRCLE_SIZE = 120;
const STROKE_WIDTH = 12;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatGB(bytes: number) {
	return bytes / (1024 * 1024 * 1024);
}

export default function HomeScreen() {
	const {
		authStatus,
		dataUsage,
		devices,
		isLoadingData,
		loadDataUsage,
		dataLimitValue,
		dataLimitUnit,
	} = useRouter();

	const [speedUnit, setSpeedUnit] = React.useState<"Kbps" | "Mbps">("Kbps");

	useEffect(() => {
		if (authStatus === "logged_in" && !dataUsage) {
			loadDataUsage();
		}
	}, [authStatus, dataUsage, loadDataUsage]);

	const consumedGB = dataUsage ? formatGB(dataUsage.monthlyTotalBytes) : 0;
	const receivedGB = dataUsage ? formatGB(dataUsage.monthlyRxBytes) : 0;
	const sentGB = dataUsage ? formatGB(dataUsage.monthlyTxBytes) : 0;

	// Calculate target in GB
	const limitVal = parseFloat(dataLimitValue) || 1000;
	const targetGB = dataLimitUnit === "TB" ? limitVal * 1024 : limitVal;

	const percentage = Math.min(consumedGB / targetGB, 1);

	const formatSpeed = (valStr: string | undefined) => {
		if (!valStr) return "0";
		const val = parseFloat(valStr.replace(/[^0-9.]/g, "")) || 0;
		if (speedUnit === "Mbps") {
			return (val / 1024).toFixed(1);
		}
		return Math.round(val).toString();
	};

	const animatedStrokeOffset = React.useRef(
		new Animated.Value(CIRCUMFERENCE),
	).current;

	useEffect(() => {
		Animated.timing(animatedStrokeOffset, {
			toValue: CIRCUMFERENCE - CIRCUMFERENCE * percentage,
			duration: 1000,
			useNativeDriver: true,
		}).start();
	}, [percentage]);

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
				style={dashboardStyles.headerGradient}
				pointerEvents="none"
			/>

			<Animated.View
				style={[
					dashboardStyles.header,
					{
						opacity: titleOpacity,
					},
				]}
			>
				<Text style={dashboardStyles.headerTitle}>{t("tabs.home")}</Text>
			</Animated.View>

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
				refreshControl={
					<RefreshControl
						refreshing={isLoadingData}
						onRefresh={loadDataUsage}
						tintColor={Colors.routyGray}
					/>
				}
			>
				<View style={[globalStyles.section, { marginTop: 12 }]}>
					<SectionLabel>{t("dashboard.usage")}</SectionLabel>

					<View style={dashboardStyles.usageCard}>
						{/* Progress Section */}
						<View style={dashboardStyles.chartSection}>
							<Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
								<Circle
									cx={CIRCLE_SIZE / 2}
									cy={CIRCLE_SIZE / 2}
									r={RADIUS}
									stroke={Colors.routyBlue}
									strokeWidth={STROKE_WIDTH}
									fill="transparent"
									opacity={0.2}
								/>
								<AnimatedCircle
									cx={CIRCLE_SIZE / 2}
									cy={CIRCLE_SIZE / 2}
									r={RADIUS}
									stroke={Colors.routyBlue}
									strokeWidth={STROKE_WIDTH}
									fill="transparent"
									strokeDasharray={CIRCUMFERENCE}
									strokeDashoffset={animatedStrokeOffset}
									strokeLinecap="round"
									transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
								/>
							</Svg>
							<View style={dashboardStyles.chartTextContainer}>
								<Text style={dashboardStyles.chartValue}>
									{Math.round(consumedGB)}
								</Text>
								<Text style={dashboardStyles.chartSubtext}>
									{t("dashboard.usage_limit", {
										limit: `${dataLimitValue}${dataLimitUnit}`,
									})}
								</Text>
							</View>
						</View>

						{/* Stats Section */}
						<View style={dashboardStyles.statsSection}>
							<View style={dashboardStyles.statGroup}>
								<Text style={dashboardStyles.statLabel}>
									{t("dashboard.received")}
								</Text>
								<View style={dashboardStyles.valueRow}>
									<Text
										style={[
											dashboardStyles.statValueMain,
											{ color: Colors.routyRose },
										]}
									>
										{receivedGB.toFixed(1)}
									</Text>
									<Text
										style={[
											dashboardStyles.unitText,
											{ color: Colors.routyRose },
										]}
									>
										GB
									</Text>
								</View>
							</View>

							<View style={dashboardStyles.statGroup}>
								<Text style={dashboardStyles.statLabel}>
									{t("dashboard.sent")}
								</Text>
								<View style={dashboardStyles.valueRow}>
									<Text
										style={[
											dashboardStyles.statValueMain,
											{ color: Colors.routyLime },
										]}
									>
										{sentGB.toFixed(1)}
									</Text>
									<Text
										style={[
											dashboardStyles.unitText,
											{ color: Colors.routyLime },
										]}
									>
										GB
									</Text>
								</View>
							</View>
						</View>
					</View>
				</View>

				<View style={globalStyles.section}>
					<SectionLabel>{t("dashboard.network")}</SectionLabel>
					<View style={dashboardStyles.infoRow}>
						<DashboardCard
							label={t("dashboard.operator")}
							value={`${dataUsage?.networkProvider} ${dataUsage?.networkType}${dataUsage?.isCA ? "+" : ""}`}
						/>

						<DashboardCard
							label={t("dashboard.bands")}
							value={dataUsage?.bands}
						/>
					</View>

					<View style={dashboardStyles.infoRow}>
						<TouchableOpacity
							activeOpacity={0.7}
							onPress={() =>
								setSpeedUnit((prev) => (prev === "Kbps" ? "Mbps" : "Kbps"))
							}
							style={{ flex: 1 }}
						>
							<DashboardCard label={t("dashboard.speed", { unit: speedUnit })}>
								<View
									style={{
										flexDirection: "row",
										justifyContent: "space-between",
										alignItems: "center",
									}}
								>
									<Text style={dashboardStyles.infoValueSmall}>
										<Text style={{ color: Colors.routyRose }}>↓</Text>{" "}
										{formatSpeed(dataUsage?.realtimeRxThrpt)}
									</Text>
									<Text
										style={[dashboardStyles.infoValueSmall, { marginRight: 4 }]}
									>
										<Text style={{ color: Colors.routyLime }}>↑</Text>{" "}
										{formatSpeed(dataUsage?.realtimeTxThrpt)}
									</Text>
								</View>
							</DashboardCard>
						</TouchableOpacity>

						<Link href="/devices" asChild>
							<DashboardCard
								label={t("dashboard.devices")}
								value={devices.filter((d) => d.ip && d.ip !== "-").length}
								showChevron
							/>
						</Link>
					</View>
				</View>

				<View style={globalStyles.section}>
					<SectionLabel>{t("dashboard.signal")}</SectionLabel>
					<View style={dashboardStyles.infoRow}>
						<DashboardCard
							label={t("dashboard.rsrp")}
							value={`${dataUsage?.rsrp} dBm`}
						/>

						<DashboardCard
							label={t("dashboard.sinr")}
							value={`${dataUsage?.sinr} dB`}
						/>
					</View>
				</View>
			</Animated.ScrollView>
		</View>
	);
}
