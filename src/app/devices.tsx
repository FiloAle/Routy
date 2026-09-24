import { Stack } from "expo-router";
import React from "react";
import { FlatList, Text, View, RefreshControl } from "react-native";
import { AppleImac2021, Wifi, WifiOff } from "iconoir-react-native";
import { deviceStyles } from "@/styles/deviceStyles";
import { useRouter } from "@/context/router-context";
import { t } from "@/i18n";
import { Colors, useThemePalette } from "@/constants/Colors";
import { globalStyles, Layout } from "@/styles/globalStyles";
import { SectionLabel } from "@/components/SectionLabel";

export default function DevicesScreen() {
	const palette = useThemePalette();
	const { devices, isLoadingDevices, loadDevices } = useRouter();

	const connectedDevices = devices.filter((d) => d.ip && d.ip !== "-");
	const knownDevices = devices.filter((d) => !d.ip || d.ip === "-");

	const renderDevice = ({ item }: { item: any }) => {
		const isDisconnected = !item.ip || item.ip === "-";
		const color = isDisconnected ? palette.secondaryText : palette.text;
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
					headerBackButtonDisplayMode: "minimal",
					headerTitleStyle: { color: palette.text },
				}}
			/>

			<FlatList
				showsVerticalScrollIndicator={false}
				data={[]}
				renderItem={null}
				contentContainerStyle={[
					globalStyles.scroll,
					globalStyles.scrollNoTab,
				]}
				ListHeaderComponent={() => (
					<View style={deviceStyles.listContainer}>
						{sections.map((section, index) => (
							<View
								key={section.title}
								style={[
									globalStyles.section,
									index === 0 && globalStyles.firstSection,
								]}
							>
								<SectionLabel>{section.title}</SectionLabel>
								<View style={deviceStyles.sectionCards}>
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
						progressViewOffset={Layout.headerOffset}
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
