import { NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";
import { t } from "@/i18n";
import { useRouter } from "@/context/router-context";

import { Colors, useThemePalette } from "@/constants/Colors";

export default function TabsLayout() {
	const palette = useThemePalette();
	const { conversations } = useRouter();

	const hasUnread = conversations.some((c) => c.unreadCount > 0);

	return (
		<NativeTabs backgroundColor={palette.background} tintColor={Colors.routyBlue}>
			<NativeTabs.Trigger name="index">
				<NativeTabs.Trigger.Label>{t("tabs.home")}</NativeTabs.Trigger.Label>
				{/* Private system symbol (resolved by our react-native-screens patch), house.fill before iOS 17.4. */}
				<NativeTabs.Trigger.Icon sf={"home.fill|house.fill" as any} md="home" />
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
										// Blue dot; the bubble matches the idle icons (white/black).
										`message.badge.filled.fill:palette(#208AEF,${palette.text})` as any,
									selected:
										`message.badge.filled.fill:palette(${palette.text},#208AEF)` as any,
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
