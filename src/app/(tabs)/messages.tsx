import { MessageInputBar } from "@/components/MessageInputBar";
import { ComposeButton } from "@/components/ComposeButton";
import { contactsService } from "@/services/contacts-service";
import { NativeGlassView as GlassView } from "@/components/NativeGlassView";
import { CloseButton } from "@/components/CloseButton";
import {
	Button,
	Circle,
	HStack,
	Host,
	Image,
	List,
	Spacer,
	SwipeActions,
	Text as SwiftText,
	VStack,
	ZStack,
} from "@expo/ui/swift-ui";
import {
	clipShape,
	font,
	foregroundStyle,
	frame,
	labelStyle,
	layoutPriority,
	lineLimit,
	listRowBackground,
	listRowInsets,
	listRowSeparator,
	listStyle,
	offset,
	padding,
	refreshable,
	scrollContentBackground,
	scrollIndicators,
	tint,
	useScrollGeometryChange,
} from "@expo/ui/swift-ui/modifiers";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter as useExpoRouter } from "expo-router";
import React, { useCallback, useEffect } from "react";
import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import Reanimated, {
	Extrapolation,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import { scrollTopInset } from "../../../modules/routy-ui-modifiers";
import { useRouter } from "@/context/router-context";
import { t } from "@/i18n";
import { Layout } from "@/styles/globalStyles";
import { messageStyles } from "@/styles/messageStyles";
import { Conversation, formatMessageDate } from "@/utils/sms";

// Row modifiers shared by every SwiftUI list row on this screen.
const rowBackground = listRowBackground(Colors.routyBlack);

function ConversationAvatar({ name }: { name: string }) {
	const isNumeric = /^\+?\d+$/.test(name);
	let initials = "";

	if (!isNumeric) {
		const parts = name.trim().split(/\s+/);
		if (parts.length >= 2) {
			initials = (
				parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)
			).toUpperCase();
		} else if (parts.length === 1 && parts[0]) {
			initials = parts[0].charAt(0).toUpperCase();
		}
	}

	return (
		<ZStack modifiers={[frame({ width: 50, height: 50 }), clipShape("circle")]}>
			<Circle
				modifiers={[
					foregroundStyle({
						type: "linearGradient",
						colors: [Colors.routyLightGray, Colors.routyDarkGray],
						startPoint: { x: 0.5, y: 0 },
						endPoint: { x: 0.5, y: 1 },
					}),
				]}
			/>
			{isNumeric ? (
				<Image
					systemName="person.fill"
					color={Colors.routyWhite}
					// Pushed down so the avatar circle crops the shoulders.
					modifiers={[font({ size: 44 }), offset({ y: 6 })]}
				/>
			) : (
				<SwiftText
					modifiers={[
						font({ size: 24, weight: "bold", design: "rounded" }),
						foregroundStyle(Colors.routyWhite),
					]}
				>
					{initials}
				</SwiftText>
			)}
		</ZStack>
	);
}

function ConversationRow({
	conversation,
	isFirst,
	onPress,
	onDelete,
}: {
	conversation: Conversation;
	isFirst: boolean;
	onPress: () => void;
	onDelete: (number: string) => void;
}) {
	const lastMsg = conversation.lastMessage;
	const preview = lastMsg.isSent
		? `${t("messages.you")}${lastMsg.content}`
		: lastMsg.content;
	const dateStr = formatMessageDate(lastMsg.date);
	const isUnread = conversation.unreadCount > 0;

	return (
		<SwipeActions
			modifiers={[
				listRowInsets({ top: 12, bottom: 12, leading: 16, trailing: 16 }),
				rowBackground,
				// No separator between the top spacer and the first conversation.
				...(isFirst ? [listRowSeparator("hidden", "top")] : []),
			]}
		>
			<Button onPress={onPress}>
				<HStack spacing={12}>
					<ConversationAvatar name={conversation.displayName} />
					<VStack alignment="leading" spacing={2}>
						<HStack spacing={8}>
							<SwiftText
								modifiers={[
									font({ size: 16, weight: "semibold" }),
									foregroundStyle(Colors.routyWhite),
									lineLimit(1),
								]}
							>
								{conversation.displayName}
							</SwiftText>
							<Spacer />
							<SwiftText
								modifiers={[
									font({ size: 13 }),
									foregroundStyle(Colors.routyGray),
									layoutPriority(1),
								]}
							>
								{dateStr}
							</SwiftText>
						</HStack>
						<HStack spacing={8}>
							<SwiftText
								modifiers={[
									font({ size: 14, weight: isUnread ? "semibold" : "regular" }),
									foregroundStyle(isUnread ? Colors.routyWhite : Colors.routyGray),
									lineLimit(1),
								]}
							>
								{preview}
							</SwiftText>
							<Spacer />
							{isUnread && (
								<Circle
									modifiers={[
										foregroundStyle(Colors.routyBlue),
										frame({ width: 10, height: 10 }),
									]}
								/>
							)}
							<Image
								systemName="chevron.right"
								color={Colors.routyLightGray}
								modifiers={[font({ size: 14, weight: "semibold" })]}
							/>
						</HStack>
					</VStack>
				</HStack>
			</Button>
			<SwipeActions.Actions edge="trailing">
				{/* No `destructive` role: SwiftUI would remove the row before the confirmation alert. */}
				<Button
					label={t("messages.delete")}
					systemImage="trash"
					// Icon only; the label stays as the VoiceOver name.
					modifiers={[labelStyle("iconOnly"), tint(Colors.routyRed)]}
					onPress={() => onDelete(conversation.number)}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export default function MessagesScreen() {
	const {
		authStatus,
		authError,
		conversations,
		isLoadingSms,
		login,
		loadSms,
		sendSms,
		deleteConversation,
	} = useRouter();
	const expoRouter = useExpoRouter();
	const inputRef = React.useRef<TextInput>(null);

	useEffect(() => {
		if (authStatus === "logged_in" && conversations.length === 0) {
			loadSms();
		}
	}, [authStatus, conversations.length, loadSms]);

	const handleRefresh = useCallback(() => loadSms(), [loadSms]);

	const handleOpen = useCallback(
		(conv: Conversation) => {
			expoRouter.push({
				pathname: "/messages/[number]",
				params: { number: encodeURIComponent(conv.number) },
			});
		},
		[expoRouter],
	);

	const handleDelete = useCallback(
		(number: string) => {
			const name = conversations.find((c) => c.number === number)?.displayName;
			Alert.alert(
				t("messages.delete_title"),
				t("messages.delete_confirm", { name: name || number }),
				[
					{ text: t("messages.cancel"), style: "cancel" },
					{
						text: t("messages.delete"),
						style: "destructive",
						onPress: () => deleteConversation(number),
					},
				],
			);
		},
		[conversations, deleteConversation],
	);

	// ── Render ────────────────────────────────────────────────────────────────

	// The SwiftUI List respects the top safe area; inset the rest so the first row
	// starts below the header, as the FlatList `contentInset` did.
	const { top: safeAreaTop } = useSafeAreaInsets();
	const listTopSpacing = Layout.headerOffset - safeAreaTop;

	// Scroll distance from the resting position: > 0 scrolling up, < 0 pulling to refresh.
	// At rest SwiftUI reports `contentOffsetY === -(safe area + top inset)`, i.e. -headerOffset.
	const scrollDelta = useSharedValue(0);
	const scrollGeometryModifier = useScrollGeometryChange((geometry) => {
		"worklet";
		scrollDelta.value = geometry.contentOffsetY + Layout.headerOffset;
	});

	const headerAnimatedStyle = useAnimatedStyle(() => {
		const delta = scrollDelta.value;
		return {
			opacity: interpolate(delta, [0, 40], [1, 0], Extrapolation.CLAMP),
			// Stays put while pulling to refresh; the spinner appears below it.
			transform: [
				{ translateY: interpolate(delta, [0, 40], [0, -10], Extrapolation.CLAMP) },
			],
		};
	});

	const [isModalVisible, setIsModalVisible] = React.useState(false);
	const [recipient, setRecipient] = React.useState("");
	const [messageText, setMessageText] = React.useState("");
	const [isSending, setIsSending] = React.useState(false);
	const [suggestions, setSuggestions] = React.useState<
		{ name: string; number: string }[]
	>([]);
	const [selectedContact, setSelectedContact] = React.useState<{
		name: string;
		number: string;
	} | null>(null);

	React.useEffect(() => {
		if (!isModalVisible) {
			setRecipient("");
			setMessageText("");
			setSuggestions([]);
			setSelectedContact(null);
		}
	}, [isModalVisible]);

	const handleRecipientChange = (text: string) => {
		setRecipient(text);
		if (text.length > 0) {
			const filtered = contactsService
				.getAll()
				.filter(
					(c) =>
						c.name.toLowerCase().includes(text.toLowerCase()) ||
						c.number.includes(text),
				)
				.slice(0, 5);
			setSuggestions(filtered);
		} else {
			setSuggestions([]);
		}
	};

	const selectRecipient = (contact: { name: string; number: string }) => {
		setSelectedContact(contact);
		setRecipient(contact.number);
		setSuggestions([]);
	};

	const removeSelectedContact = () => {
		setSelectedContact(null);
		setRecipient("");
	};

	const handleSendMessage = async () => {
		if (!recipient.trim() || !messageText.trim() || isSending) return;

		// 1. Clean the number (remove spaces, parentheses, dashes)
		let finalNumber = recipient.trim().replace(/[\s\(\)\-\.]/g, "");

		// 2. Handle international prefix
		if (finalNumber.startsWith("00")) {
			finalNumber = "+" + finalNumber.slice(2);
		} else if (!finalNumber.startsWith("+")) {
			// If it's a standard 10-digit Italian mobile number starting with 3
			if (finalNumber.length === 10 && finalNumber.startsWith("3")) {
				finalNumber = "+39" + finalNumber;
			}
		}

		setIsSending(true);
		try {
			await sendSms(finalNumber, messageText.trim());
			setIsModalVisible(false);
			setRecipient("");
			setSelectedContact(null);
			setMessageText("");
			loadSms();
		} catch (error) {
			Alert.alert(t("common.error"), t("messages.error_send"));
		} finally {
			setIsSending(false);
		}
	};

	if (authStatus === "loading") {
		return (
			<View style={messageStyles.centerContainer}>
				<ActivityIndicator size="large" color={Colors.routyBlue} />
				<Text style={messageStyles.statusText}>
					{t("settings.status_connecting")}
				</Text>
			</View>
		);
	}

	if (authStatus === "error") {
		const isTimeout =
			authError?.toLowerCase().includes("timeout") ||
			authError?.toLowerCase().includes("10000ms");
		const displayError = isTimeout ? t("settings.error_timeout") : authError;

		return (
			<View style={messageStyles.centerContainer}>
				<Text style={messageStyles.errorIcon}>⚠️</Text>
				<Text style={messageStyles.errorText}>{displayError}</Text>
				<Text style={messageStyles.errorHint}>{t("settings.error_hint")}</Text>
				<Pressable
					style={messageStyles.retryButton}
					onPress={() => {
						login();
					}}
				>
					<Text style={messageStyles.retryButtonText}>
						{t("settings.retry")}
					</Text>
				</Pressable>
			</View>
		);
	}

	return (
		<View style={messageStyles.container}>
			<Stack.Screen options={{ headerShown: false }} />

			<LinearGradient
				colors={["rgba(0,0,0,0.8)", "transparent"]}
				style={localStyles.headerGradient}
				pointerEvents="none"
			/>

			<Reanimated.View style={[messageStyles.header, headerAnimatedStyle]}>
				<Text style={messageStyles.headerTitle}>{t("messages.title")}</Text>
				{/* Out of the flow so the 44pt button doesn't push the title below Home/Settings. */}
				<View style={messageStyles.headerAction}>
					<ComposeButton onPress={() => setIsModalVisible(true)} />
				</View>
			</Reanimated.View>

			{isLoadingSms && conversations.length === 0 ? (
				<View style={messageStyles.centerContainer}>
					<Text style={messageStyles.statusText}>{t("messages.loading")}</Text>
				</View>
			) : (
				<Host style={messageStyles.listHost} colorScheme="dark">
					<List
						modifiers={[
							listStyle("plain"),
							scrollContentBackground("hidden"),
							scrollIndicators("hidden"),
							refreshable(handleRefresh),
							// Content starts below the header but still scrolls under it.
							scrollTopInset(listTopSpacing),
							...(scrollGeometryModifier ? [scrollGeometryModifier] : []),
						]}
					>

						{conversations.length === 0 ? (
							<HStack
								modifiers={[
									padding({ top: 100 }),
									rowBackground,
									listRowSeparator("hidden"),
								]}
							>
								<Spacer />
								<VStack spacing={12}>
									<SwiftText modifiers={[font({ size: 40 })]}>💬</SwiftText>
									<SwiftText
										modifiers={[
											font({ size: 16 }),
											foregroundStyle(Colors.routyGray),
										]}
									>
										{t("messages.empty")}
									</SwiftText>
								</VStack>
								<Spacer />
							</HStack>
						) : (
							conversations.map((item, index) => (
								<ConversationRow
									key={item.number}
									conversation={item}
									isFirst={index === 0}
									onPress={() => handleOpen(item)}
									onDelete={handleDelete}
								/>
							))
						)}
					</List>
				</Host>
			)}

			<Modal
				visible={isModalVisible}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setIsModalVisible(false)}
			>
				<View style={messageStyles.modalContainer}>
					<View style={messageStyles.modalHeader}>
						<Text style={messageStyles.modalTitle}>{t("messages.new")}</Text>
						<CloseButton onPress={() => setIsModalVisible(false)} />
					</View>

					<GlassView
						style={messageStyles.recipientGlassContainer}
						glassEffectStyle="regular"
					>
						<Pressable
							style={messageStyles.recipientField}
							onPress={() => {
								// Always focus input when tapping the field
								inputRef.current?.focus();
							}}
						>
							<Text style={messageStyles.recipientLabel}>
								{t("messages.to")}
							</Text>
							<View
								style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
							>
								{selectedContact && (
									<View style={messageStyles.selectedRecipientWrapper}>
										<Text style={messageStyles.selectedRecipientName}>
											{selectedContact.name}
										</Text>
										<Text style={messageStyles.selectedRecipientNumber}>
											{selectedContact.number}
										</Text>
									</View>
								)}
								<TextInput
									ref={inputRef}
									style={[messageStyles.recipientInput, { flex: 1 }]}
									value={selectedContact ? "" : recipient}
									onChangeText={handleRecipientChange}
									onKeyPress={({ nativeEvent }) => {
										if (nativeEvent.key === "Backspace" && selectedContact) {
											removeSelectedContact();
										}
									}}
									placeholder={
										selectedContact ? "" : t("messages.recipient_placeholder")
									}
									placeholderTextColor={Colors.routyGray}
									autoFocus
									keyboardType="default"
								/>
							</View>
						</Pressable>
					</GlassView>

					{suggestions.length > 0 && (
						<View style={messageStyles.suggestionsContainer}>
							{suggestions.map((s, i) => (
								<TouchableOpacity
									key={i}
									style={messageStyles.suggestionItem}
									onPress={() => selectRecipient(s)}
								>
									<Text style={messageStyles.suggestionName}>{s.name}</Text>
									<Text style={messageStyles.suggestionNumber}>{s.number}</Text>
								</TouchableOpacity>
							))}
						</View>
					)}

					<KeyboardAvoidingView
						style={{ flex: 1, justifyContent: "flex-end" }}
						behavior={Platform.OS === "ios" ? "padding" : "height"}
						keyboardVerticalOffset={40}
					>
						<MessageInputBar
							value={messageText}
							onChangeText={setMessageText}
							onSend={handleSendMessage}
							isSending={isSending}
							disabled={!recipient.trim()}
							bottomOffset={8}
						/>
					</KeyboardAvoidingView>
				</View>
			</Modal>
		</View>
	);
}

const localStyles = StyleSheet.create({
	headerGradient: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		fontSize: 16,
	},
});
