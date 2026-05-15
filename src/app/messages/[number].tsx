import { Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	FlatList,
	KeyboardAvoidingView,
	Platform,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRouter } from "@/context/router-context";
import { SmsMessage } from "@/utils/sms";
import { MessageInputBar } from "@/components/MessageInputBar";

// ── Day label separator ───────────────────────────────────────────────────────

function dayLabel(date: Date): string {
	const now = new Date();

	const startOfDay = (d: Date) =>
		new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

	const todayStart = startOfDay(now);
	const dateStart = startOfDay(date);
	const diffDays = Math.round((todayStart - dateStart) / 86400000);

	if (diffDays === 0) return "Oggi";
	if (diffDays === 1) return "Ieri";
	// Same calendar week (within last 6 days)
	if (diffDays < 7)
		return date.toLocaleDateString("it-IT", { weekday: "long" });
	// Older: "7 maggio"
	return date.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
}

function isSameCalendarDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function DaySeparator({ date }: { date: Date }) {
	return (
		<View style={styles.dateSeparator}>
			<Text style={styles.dateSeparatorText}>{dayLabel(date)}</Text>
		</View>
	);
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
	message,
	showDay,
}: {
	message: SmsMessage;
	showDay: boolean;
}) {
	return (
		<>
			{showDay && <DaySeparator date={message.date} />}
			<View style={[styles.bubbleRow, message.isSent && styles.bubbleRowSent]}>
				<View
					style={[
						styles.bubble,
						message.isSent ? styles.bubbleSent : styles.bubbleReceived,
					]}
				>
					<Text style={styles.bubbleText}>{message.content}</Text>
				</View>
			</View>
		</>
	);
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
	const { number: rawNumber } = useLocalSearchParams<{ number: string }>();
	const number = rawNumber ? decodeURIComponent(rawNumber) : rawNumber;
	const {
		conversations,
		sendSms,
		addOptimisticMessage,
		getDisplayName,
		markAsRead,
	} = useRouter();
	const [text, setText] = useState("");
	const [isSending, setIsSending] = useState(false);
	const listRef = useRef<FlatList>(null);

	const conversation = conversations.find((c) => c.number === number);
	const messages = conversation?.messages ?? [];

	useEffect(() => {
		if (number) markAsRead(number);
	}, [number, markAsRead]);

	useEffect(() => {
		if (messages.length > 0) {
			setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
		}
	}, [messages.length]);

	const handleSend = useCallback(async () => {
		const trimmed = text.trim();
		if (!trimmed || isSending || !number) return;
		setText("");
		setIsSending(true);

		const optimistic: SmsMessage = {
			id: `opt-${Date.now()}`,
			number,
			content: trimmed,
			date: new Date(),
			isSent: true,
		};
		addOptimisticMessage(number, optimistic);

		try {
			await sendSms(number, trimmed);
		} catch {
			// toast future
		} finally {
			setIsSending(false);
		}
	}, [text, isSending, number, sendSms, addOptimisticMessage]);

	// Show day label only on the first message of each calendar day
	const shouldShowDay = (index: number) => {
		if (index === 0) return true;
		const prev = messages[index - 1];
		const curr = messages[index];
		if (!prev || !curr) return false;
		return !isSameCalendarDay(prev.date, curr.date);
	};

	return (
		<View style={styles.container}>
			{/* Dynamic title in native header - Only first name */}
			<Stack.Screen
				options={{
					title: getDisplayName(number ?? "").split(" ")[0] ?? "",
				}}
			/>

			{/* Message list + gradient overlay */}
			<KeyboardAvoidingView
				style={{ flex: 1 }}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				keyboardVerticalOffset={-6}
			>
				<FlatList
					ref={listRef}
					showsVerticalScrollIndicator={false}
					data={messages}
					keyExtractor={(item) => item.id}
					renderItem={({ item, index }) => (
						<MessageBubble message={item} showDay={shouldShowDay(index)} />
					)}
					contentContainerStyle={styles.listContent}
					onContentSizeChange={() =>
						listRef.current?.scrollToEnd({ animated: false })
					}
				/>

				<MessageInputBar
					value={text}
					onChangeText={setText}
					onSend={handleSend}
					isSending={isSending}
					bottomOffset={8}
				/>
			</KeyboardAvoidingView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000",
	},
	listContent: {
		paddingHorizontal: 8,
		paddingVertical: 12,
		flexGrow: 1,
		justifyContent: "flex-end",
	},
	dateSeparator: {
		alignItems: "center",
		marginVertical: 12,
	},
	dateSeparatorText: {
		fontSize: 12,
		color: "#8E8E93",
	},
	bubbleRow: {
		flexDirection: "row",
		justifyContent: "flex-start",
		marginVertical: 2,
		paddingHorizontal: 8,
	},
	bubbleRowSent: {
		justifyContent: "flex-end",
	},
	bubble: {
		maxWidth: "75%",
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 18,
	},
	bubbleReceived: {
		backgroundColor: "#1C1C1E",
		borderBottomLeftRadius: 4,
	},
	bubbleSent: {
		backgroundColor: "#007AFF",
		borderBottomRightRadius: 4,
	},
	bubbleText: {
		fontSize: 16,
		color: "#fff",
		lineHeight: 22,
	},
});
