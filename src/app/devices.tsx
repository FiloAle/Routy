import { Stack } from "expo-router";
import React from "react";
import { FlatList, Text, View, RefreshControl, Platform } from "react-native";
import { AppleImac2021, Wifi, WifiOff } from "iconoir-react-native";
import { deviceStyles } from "@/styles/deviceStyles";
import { useRouter } from "@/context/router-context";
import { t } from "@/i18n";
import { Colors } from "@/constants/Colors";
import { globalStyles, Layout } from "@/styles/globalStyles";
import { SectionLabel } from "@/components/SectionLabel";

export default function DevicesScreen() {
	const { devices, isLoadingDevices, loadDevices } = useRouter();

	const connectedDevices = devices.filter((d) => d.ip && d.ip !== "-");
	const knownDevices = devices.filter((d) => !d.ip || d.ip === "-");

	const renderDevice = ({ item }: { item: any }) => {
		const isDisconnected = !item.ip || item.ip === "-";
		const color = isDisconnected ? Colors.routyGray : Colors.routyWhite;
		const strokeWidth = 1.5;

		return (
			<View style={deviceStyles.deviceItem}>
				<View style={deviceStyles.iconContainer}>
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
				<View style={deviceStyles.deviceInfo}>
					<Text
						style={[
							deviceStyles.hostname,
							isDisconnected && { color: Colors.routyGray },
						]}
						numberOfLines={1}
					>
						{item.hostname}
					</Text>
					<Text style={deviceStyles.ip}>
						{item.ip && item.ip !== "-" ? `${item.ip} • ` : ""}
						{item.mac}
					</Text>
				</View>
			</View>
		);
	};

	const sections = [
		{ title: t("devices.connected"), data: connectedDevices },
		{ title: t("devices.disconnected"), data: knownDevices },
	].filter((s) => s.data.length > 0);

	return (
		<View style={globalStyles.container}>
			<Stack.Screen
				options={{
					title: t("devices.title"),
					headerLargeTitle: false,
					headerTransparent: true,
					headerShadowVisible: false,
					headerBackTitle: t("tabs.home"),
					headerTitleStyle: { color: Colors.routyWhite },
				}}
			/>

			<FlatList
				showsVerticalScrollIndicator={false}
				data={[]}
				renderItem={null}
				contentInset={{ top: Layout.headerOffset }}
				contentOffset={{ x: 0, y: -Layout.headerOffset }}
				contentContainerStyle={[
					globalStyles.scroll,
					{
						paddingTop: Platform.OS === "android" ? Layout.headerOffset : 0,
						paddingBottom: 20,
					},
				]}
				ListHeaderComponent={() => (
					<View style={{ gap: 32 }}>
						{sections.map((section, index) => (
							<View
								key={section.title}
								style={[globalStyles.section, index === 0 && { marginTop: 12 }]}
							>
								<SectionLabel>{section.title}</SectionLabel>
								<View style={{ gap: 8 }}>
									{section.data.map((device) => (
										<View key={device.mac}>
											{renderDevice({ item: device })}
										</View>
									))}
								</View>
							</View>
						))}
					</View>
				)}
				refreshControl={
					<RefreshControl
						refreshing={isLoadingDevices}
						onRefresh={loadDevices}
						tintColor={Colors.routyGray}
					/>
				}
				ListEmptyComponent={
					!isLoadingDevices && devices.length === 0 ? (
						<View style={deviceStyles.empty}>
							<Text style={deviceStyles.emptyText}>{t("devices.empty")}</Text>
						</View>
					) : null
				}
			/>
		</View>
	);
}
