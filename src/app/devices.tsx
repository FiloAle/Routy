import { Stack } from "expo-router";
import React from "react";
import {
	FlatList,
	StyleSheet,
	Text,
	View,
	RefreshControl,
	Platform,
} from "react-native";
import { AppleImac2021, Wifi, WifiOff } from "iconoir-react-native";
import { useRouter } from "@/context/router-context";

import { SectionLabel } from "@/components/SectionLabel";

export default function DevicesScreen() {
	const { devices, isLoadingDevices, loadDevices } = useRouter();

	const connectedDevices = devices.filter((d) => d.ip && d.ip !== "-");
	const knownDevices = devices.filter((d) => !d.ip || d.ip === "-");

	const renderDevice = ({ item }: { item: any }) => {
		const isDisconnected = !item.ip || item.ip === "-";
		const color = isDisconnected ? "#8E8E93" : "#fff";
		const strokeWidth = 1.5;

		return (
			<View style={styles.deviceItem}>
				<View style={styles.iconContainer}>
					{isDisconnected ? (
						<WifiOff
							width={22}
							height={22}
							strokeWidth={strokeWidth}
							color={color}
						/>
					) : item.type === "cable" ? (
						<AppleImac2021
							width={22}
							height={22}
							strokeWidth={strokeWidth}
							color={color}
						/>
					) : (
						<Wifi
							width={22}
							height={22}
							strokeWidth={strokeWidth}
							color={color}
						/>
					)}
				</View>
				<View style={styles.deviceInfo}>
					<Text
						style={[styles.hostname, isDisconnected && { color: "#8E8E93" }]}
						numberOfLines={1}
					>
						{item.hostname}
					</Text>
					<Text style={styles.ip}>
						{item.ip && item.ip !== "-" ? `${item.ip} • ` : ""}
						{item.mac}
					</Text>
				</View>
			</View>
		);
	};

	const sections = [
		{ title: "Connessi", data: connectedDevices },
		{ title: "Disconnessi", data: knownDevices },
	].filter((s) => s.data.length > 0);

	return (
		<View style={styles.container}>
			<Stack.Screen
				options={{
					title: "Dispositivi",
					headerLargeTitle: false,
					headerTransparent: true,
					headerShadowVisible: false,
					headerBackTitle: "Home",
					headerTitleStyle: { color: "#fff" },
				}}
			/>

			<FlatList
				showsVerticalScrollIndicator={false}
				data={[]}
				renderItem={null}
				contentInset={{ top: 112 }}
				contentOffset={{ x: 0, y: -112 }}
				ListHeaderComponent={() => (
					<View>
						{sections.map((section) => (
							<View key={section.title} style={styles.section}>
								<SectionLabel style={{ marginTop: 0 }}>
									{section.title}
								</SectionLabel>
								{section.data.map((device) => (
									<View key={device.mac}>{renderDevice({ item: device })}</View>
								))}
							</View>
						))}
					</View>
				)}
				contentContainerStyle={styles.list}
				refreshControl={
					<RefreshControl
						refreshing={isLoadingDevices}
						onRefresh={loadDevices}
					/>
				}
				ListEmptyComponent={
					!isLoadingDevices && devices.length === 0 ? (
						<View style={styles.empty}>
							<Text style={styles.emptyText}>Nessun dispositivo rilevato</Text>
						</View>
					) : null
				}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000",
	},
	list: {
		paddingHorizontal: 16,
		paddingTop: Platform.OS === "android" ? 120 : 0,
	},
	section: {
		marginBottom: 24,
	},
	deviceItem: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#1C1C1E",
		padding: 16,
		borderRadius: 14,
		marginBottom: 8,
	},
	iconContainer: {
		width: 40,
		height: 40,
		borderRadius: 10,
		backgroundColor: "#2C2C2E",
		justifyContent: "center",
		alignItems: "center",
		marginRight: 12,
	},
	deviceInfo: {
		flex: 1,
	},
	hostname: {
		fontSize: 17,
		fontWeight: "600",
		color: "#fff",
		marginBottom: 2,
	},
	ip: {
		fontSize: 13,
		color: "#8E8E93",
	},
	empty: {
		paddingTop: 100,
		alignItems: "center",
	},
	emptyText: {
		color: "#8E8E93",
		fontSize: 16,
	},
});
