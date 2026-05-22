import { NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";
import { useColorScheme } from "react-native";
import { t } from "@/i18n";
import { useRouter } from "@/context/router-context";

import { Colors } from "@/constants/Colors";

export default function TabsLayout() {
	const scheme = useColorScheme();
	const bg = scheme === "dark" ? Colors.routyBlack : Colors.routyWhite;
	const { conversations } = useRouter();

	const hasUnread = conversations.some((c) => c.unreadCount > 0);

	return (
		<NativeTabs backgroundColor={bg} tintColor={Colors.routyBlue}>
			<NativeTabs.Trigger name="index">
				<NativeTabs.Trigger.Label>{t("tabs.home")}</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="house.fill" md="home" />
			</NativeTabs.Trigger>

			<NativeTabs.Trigger name="messages">
				<NativeTabs.Trigger.Label>
					{t("tabs.messages")}
				</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon
					sf={
						hasUnread
							? {
									default:
										"message.badge.filled.fill:palette(#208AEF,#FFFFFF)" as any,
									selected:
										"message.badge.filled.fill:palette(#208AEF,#208AEF)" as any,
								}
							: "message.fill"
					}
					md="message"
				/>
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
