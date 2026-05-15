import { NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";
import { useColorScheme } from "react-native";
import { t } from "@/i18n";

export default function TabsLayout() {
	const scheme = useColorScheme();
	const bg = scheme === "dark" ? "#000000" : "#ffffff";

	return (
		<NativeTabs backgroundColor={bg} tintColor="#208AEF">
			<NativeTabs.Trigger name="index">
				<NativeTabs.Trigger.Label>{t("tabs.home")}</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="house.fill" md="home" />
			</NativeTabs.Trigger>

			<NativeTabs.Trigger name="messages">
				<NativeTabs.Trigger.Label>
					{t("tabs.messages")}
				</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="message.fill" md="message" />
			</NativeTabs.Trigger>

			<NativeTabs.Trigger name="settings">
				<NativeTabs.Trigger.Label>
					{t("tabs.settings")}
				</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="gear" md="settings" />
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}
