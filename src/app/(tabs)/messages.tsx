import { MessageInputBar } from "@/components/MessageInputBar";
import { ComposeButton } from "@/components/ComposeButton";
import { contactsService } from "@/services/contacts-service";
import { NativeGlassView as GlassView } from "@/components/NativeGlassView";
import { CloseButton } from "@/components/CloseButton";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter as useExpoRouter } from "expo-router";
import { NavArrowRight, Trash } from "iconoir-react-native";
import React, { useCallback, useEffect } from "react";
import {
	ActivityIndicator,
	Alert,
	Animated,
	Dimensions,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { RectButton } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, {
	Extrapolation,
	interpolate,
	interpolateColor,
	useAnimatedReaction,
	useAnimatedStyle,
	useSharedValue,
	type SharedValue,
} from "react-native-reanimated";

import { Colors } from "@/constants/Colors";
import { useRouter } from "@/context/router-context";
import { t } from "@/i18n";
import { Layout } from "@/styles/globalStyles";
import { messageStyles } from "@/styles/messageStyles";
import { Conversation, formatMessageDate } from "@/utils/sms";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
		<LinearGradient
			colors={[Colors.routyLightGray, Colors.routyDarkGray]}
			style={messageStyles.avatar}
		>
			<Text style={messageStyles.avatarText}>
				{isNumeric ? "👤" : initials}
			</Text>
		</LinearGradient>
	);
}

function ConversationRow({
	conversation,
	onPress,
	onDelete,
}: {
	conversation: Conversation;
	onPress: () => void;
	onDelete: (number: string, onCancel?: () => void) => void;
}) {
	const lastMsg = conversation.lastMessage;
	const preview = lastMsg.isSent
		? `${t("messages.you")}${lastMsg.content}`
		: lastMsg.content;
	const dateStr = formatMessageDate(lastMsg.date);
	const swipeableRef = React.useRef<any>(null);
	const isFullSwipe = useSharedValue(false);
	const dragValue = useSharedValue(0);
	const rowAnimatedStyle = useAnimatedStyle(() => {
		const drag = Math.abs(dragValue.value);
		const backgroundColor = interpolateColor(
			drag,
			[0, 80],
			[Colors.routyBlack, Colors.routyDarkGray],
		);
		const borderRadius = interpolate(
			drag,
			[0, 40],
			[0, 12],
			Extrapolation.CLAMP,
		);
		return {
			backgroundColor,
			borderRadius,
			overflow: "hidden",
		};
	});

	const renderRightActions = (
		progress: SharedValue<number>,
		dragX: SharedValue<number>,
	) => {
		// Synchronize dragX with the row background
		useAnimatedReaction(
			() => dragX.value,
			(val) => {
				dragValue.value = val;
			},
		);

		const animatedStyles = useAnimatedStyle(() => {
			const drag = Math.abs(dragX.value);
			const threshold = SCREEN_WIDTH * 0.35;

			if (drag > threshold && !isFullSwipe.value) {
				isFullSwipe.value = true;
			} else if (drag <= threshold && isFullSwipe.value) {
				isFullSwipe.value = false;
			}

			// Width logic:
			// 1. Stays 50 until threshold
			// 2. Stretches to match the 'drag' minus margins
			const width =
				drag > threshold
					? interpolate(
							drag,
							[threshold, threshold + 40],
							[50, threshold + 40 - 24],
							Extrapolation.CLAMP,
						) + (drag > threshold + 40 ? drag - (threshold + 40) : 0)
					: 50;

			return {
				width,
				borderRadius: 25,
			};
		});

		const iconStyles = useAnimatedStyle(() => {
			const drag = Math.abs(dragX.value);
			const threshold = SCREEN_WIDTH * 0.35;
			const scale = interpolate(
				drag,
				[0, 50, threshold, SCREEN_WIDTH],
				[0.8, 1, 1, 1.3],
				Extrapolation.CLAMP,
			);

			return {
				transform: [{ scale }],
			};
		});

		return (
			<View style={messageStyles.deleteActionWrapper}>
				<Reanimated.View style={[messageStyles.deleteAction, animatedStyles]}>
					<RectButton
						style={messageStyles.deleteActionButton}
						onPress={() => {
							onDelete(conversation.number, () => {
								swipeableRef.current?.close();
							});
						}}
					>
						<Reanimated.View style={iconStyles}>
							<Trash color={Colors.routyWhite} width={24} height={24} />
						</Reanimated.View>
					</RectButton>
				</Reanimated.View>
			</View>
		);
	};

	return (
		<ReanimatedSwipeable
			ref={swipeableRef}
			renderRightActions={renderRightActions}
			onSwipeableWillOpen={(direction) => {
				if (direction === "right" && isFullSwipe.value) {
					onDelete(conversation.number, () => {
						swipeableRef.current?.close();
					});
				}
			}}
			friction={1.2}
			rightThreshold={40}
		>
			<RectButton
				style={[
					messageStyles.row,
					{ backgroundColor: Colors.routyTransparent },
				]}
				underlayColor={Colors.routyDarkGray}
				onPress={onPress}
			>
				<Reanimated.View
					style={[StyleSheet.absoluteFill, rowAnimatedStyle]}
					pointerEvents="none"
				/>
				<ConversationAvatar name={conversation.displayName} />
				<View style={messageStyles.rowContent}>
					<View style={messageStyles.rowHeader}>
						<Text style={messageStyles.rowName} numberOfLines={1}>
							{conversation.displayName}
						</Text>
						<Text style={messageStyles.rowDate}>{dateStr}</Text>
					</View>
					<View style={messageStyles.rowFooter}>
						<Text
							style={[
								messageStyles.rowPreview,
								conversation.unreadCount > 0 && messageStyles.rowPreviewUnread,
							]}
							numberOfLines={1}
						>
							{preview}
						</Text>
						<View style={messageStyles.rowRightSide}>
							{conversation.unreadCount > 0 && (
								<View style={messageStyles.unreadDot} />
							)}
							<NavArrowRight
								width={14}
								height={14}
								strokeWidth={2.5}
								style={{ marginBottom: -2 }}
								color={Colors.routyLightGray}
							/>
						</View>
					</View>
				</View>
			</RectButton>
		</ReanimatedSwipeable>
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

	const handleRefresh = useCallback(() => {
		loadSms();
	}, [loadSms]);

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
		(number: string, onCancel?: () => void) => {
			const name = conversations.find((c) => c.number === number)?.displayName;
			Alert.alert(
				t("messages.delete_title"),
				t("messages.delete_confirm", { name: name || number }),
				[
					{
						text: t("messages.cancel"),
						style: "cancel",
						onPress: () => onCancel?.(),
					},
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

	const scrollY = React.useRef(
		new Animated.Value(Platform.OS === "ios" ? -112 : 0),
	).current;

	const titleOpacity = scrollY.interpolate({
		inputRange: Platform.OS === "ios" ? [-112, -72] : [0, 40],
		outputRange: [1, 0],
		extrapolate: "clamp",
	});

	const titleTranslateY = scrollY.interpolate({
		inputRange: Platform.OS === "ios" ? [-112, -72] : [0, 40],
		outputRange: [0, -10],
		extrapolate: "clamp",
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

			<Animated.View
				style={[
					messageStyles.header,
					{
						opacity: titleOpacity,
						transform: [{ translateY: titleTranslateY }],
					},
				]}
			>
				<Text style={messageStyles.headerTitle}>{t("messages.title")}</Text>
				<ComposeButton onPress={() => setIsModalVisible(true)} />
			</Animated.View>

			{isLoadingSms && conversations.length === 0 ? (
				<View style={messageStyles.centerContainer}>
					<Text style={messageStyles.statusText}>{t("messages.loading")}</Text>
				</View>
			) : (
				<Animated.FlatList
					style={{ flex: 1 }}
					showsVerticalScrollIndicator={false}
					data={conversations}
					onScroll={Animated.event(
						[{ nativeEvent: { contentOffset: { y: scrollY } } }],
						{ useNativeDriver: true },
					)}
					scrollEventThrottle={16}
					contentInset={{ top: Layout.headerOffset }}
					contentOffset={{ x: 0, y: -Layout.headerOffset }}
					ListHeaderComponent={() => <View style={{ height: 0 }} />}
					keyExtractor={(item) => item.number}
					renderItem={({ item }) => (
						<ConversationRow
							conversation={item}
							onPress={() => handleOpen(item)}
							onDelete={handleDelete}
						/>
					)}
					ItemSeparatorComponent={() => (
						<View style={messageStyles.separator} />
					)}
					refreshControl={
						<RefreshControl
							refreshing={isLoadingSms}
							onRefresh={handleRefresh}
							tintColor={Colors.routyGray}
						/>
					}
					contentContainerStyle={messageStyles.listContainer}
					alwaysBounceVertical={true}
					ListEmptyComponent={
						<View style={messageStyles.emptyContent}>
							<Text style={messageStyles.emptyIcon}>💬</Text>
							<Text style={messageStyles.emptyText}>{t("messages.empty")}</Text>
						</View>
					}
				/>
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
