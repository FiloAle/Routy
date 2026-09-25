import { Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	FlatList,
	KeyboardAvoidingView,
	Platform,
	Text,
	View,
	Keyboard,
} from "react-native";

import { useRouter } from "@/context/router-context";
import { SmsMessage } from "@/utils/sms";
import { MessageInputBar } from "@/components/MessageInputBar";
import i18n, { t } from "@/i18n";
import { messageStyles } from "@/styles/messageStyles";

// ── Day label separator ───────────────────────────────────────────────────────

function dayLabel(date: Date): string {
	const now = new Date();

	const startOfDay = (d: Date) =>
		new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

	const todayStart = startOfDay(now);
	const dateStart = startOfDay(date);
	const diffDays = Math.round((todayStart - dateStart) / 86400000);

	if (diffDays === 0) return t("common.today");
	if (diffDays === 1) return t("common.yesterday");
	// Same calendar week (within last 6 days)
	if (diffDays < 7)
		return date.toLocaleDateString(i18n.locale, { weekday: "long" });
	// Older: "7 maggio"
	return date.toLocaleDateString(i18n.locale, {
		day: "numeric",
		month: "long",
	});
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
		<View style={messageStyles.dateSeparator}>
			<Text style={messageStyles.dateSeparatorText}>{dayLabel(date)}</Text>
		</View>
	);
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
	message,
	showDay,
	startsGroup,
}: {
	message: SmsMessage;
	showDay: boolean;
	startsGroup: boolean;
}) {
	return (
		<>
			{showDay && <DaySeparator date={message.date} />}
			<View
				style={[
					messageStyles.bubbleRow,
					message.isSent && messageStyles.bubbleRowSent,
					startsGroup && messageStyles.bubbleRowGroupStart,
				]}
			>
				<View
					style={[
						messageStyles.bubble,
						message.isSent
							? messageStyles.bubbleSent
							: messageStyles.bubbleReceived,
					]}
				>
					<Text
						style={[
							messageStyles.bubbleText,
							message.isSent && messageStyles.bubbleTextSent,
						]}
					>
						{message.content}
					</Text>
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

	// Hidden until the first jump to the end, so the chat opens on its latest message
	// instead of showing the oldest ones and scrolling down.
	const [isReady, setIsReady] = useState(false);
	const contentHeightRef = useRef(0);
	// Rendering every message in the first pass gives the final content height at once,
	// so a single scroll reaches the end; later batches would each move it further.
	const [initialNumToRender] = useState(() => Math.max(messages.length, 10));

	useEffect(() => {
		const keyboardEvent =
			Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const subscription = Keyboard.addListener(keyboardEvent, () => {
			if (contentHeightRef.current > 0) {
				listRef.current?.scrollToOffset({
					offset: contentHeightRef.current,
					animated: true,
				});
			}
		});
		return () => subscription.remove();
	}, []);

	useEffect(() => {
		if (number) markAsRead(number);
	}, [number, markAsRead]);

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

	const shouldShowDay = (index: number) => {
		if (index === 0) return true;
		const prev = messages[index - 1];
		const curr = messages[index];
		if (!prev || !curr) return false;
		return !isSameCalendarDay(prev.date, curr.date);
	};

	// Extra space when the sender changes; consecutive messages stay tight.
	const startsGroup = (index: number) => {
		const prev = messages[index - 1];
		const curr = messages[index];
		return !!prev && !!curr && prev.isSent !== curr.isSent && !shouldShowDay(index);
	};

	return (
		<View style={messageStyles.container}>
			<Stack.Screen
				options={{
					title: getDisplayName(number ?? "") ?? "",
					headerBackButtonDisplayMode: "minimal",
				}}
			/>

			<KeyboardAvoidingView
				style={messageStyles.keyboardAvoidingView}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				keyboardVerticalOffset={Platform.OS === "ios" ? -6 : 0}
			>
				<FlatList
					ref={listRef}
					style={[messageStyles.chatList, !isReady && messageStyles.chatListHidden]}
					initialNumToRender={initialNumToRender}
					showsVerticalScrollIndicator={false}
					data={messages}
					keyExtractor={(item) => item.id}
					renderItem={({ item, index }) => (
						<MessageBubble
							message={item}
							showDay={shouldShowDay(index)}
							startsGroup={startsGroup(index)}
						/>
					)}
					contentContainerStyle={messageStyles.listContent}
					onContentSizeChange={(w, h) => {
						contentHeightRef.current = h;
						// Animated only for new messages, once the chat is on screen.
						listRef.current?.scrollToOffset({ offset: h, animated: isReady });
						if (!isReady) requestAnimationFrame(() => setIsReady(true));
					}}
					onLayout={() => {
						if (isReady && contentHeightRef.current > 0) {
							setTimeout(() => {
								listRef.current?.scrollToOffset({
									offset: contentHeightRef.current,
									animated: true,
								});
							}, 50);
						}
					}}
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
