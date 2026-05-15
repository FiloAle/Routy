import { useRouter as useExpoRouter, Stack } from "expo-router";
import React, { useCallback, useEffect } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	View,
	Animated,
	Platform,
	RefreshControl,
	Dimensions,
	Modal,
	TextInput,
	KeyboardAvoidingView,
	TouchableOpacity,
	Alert,
} from "react-native";
import { RectButton } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { LinearGradient } from "expo-linear-gradient";
import { Trash, NavArrowRight } from "iconoir-react-native";
import { GlassView } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { contactsService } from "@/services/contacts-service";
import { MessageInputBar } from "@/components/MessageInputBar";
import Reanimated, {
	useAnimatedStyle,
	interpolate,
	Extrapolation,
	useSharedValue,
	interpolateColor,
	useAnimatedReaction,
	type SharedValue,
} from "react-native-reanimated";

const AnimatedGlassView = Reanimated.createAnimatedComponent(GlassView);

import { useRouter } from "@/context/router-context";
import { Conversation, formatMessageDate } from "@/utils/sms";
import { t } from "@/i18n";

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
		<LinearGradient colors={["#3A3A3C", "#1C1C1E"]} style={styles.avatar}>
			<Text style={styles.avatarText}>{isNumeric ? "👤" : initials}</Text>
		</LinearGradient>
	);
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
			["#000000", "#1C1C1E"],
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
			<View style={styles.deleteActionWrapper}>
				<Reanimated.View style={[styles.deleteAction, animatedStyles]}>
					<RectButton
						style={styles.deleteActionButton}
						onPress={() => {
							onDelete(conversation.number, () => {
								swipeableRef.current?.close();
							});
						}}
					>
						<Reanimated.View style={iconStyles}>
							<Trash color="#fff" width={24} height={24} />
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
				style={[styles.row, { backgroundColor: "transparent" }]}
				underlayColor="#1C1C1E"
				onPress={onPress}
			>
				<Reanimated.View
					style={[StyleSheet.absoluteFill, rowAnimatedStyle]}
					pointerEvents="none"
				/>
				<ConversationAvatar name={conversation.displayName} />
				<View style={styles.rowContent}>
					<View style={styles.rowHeader}>
						<Text style={styles.rowName} numberOfLines={1}>
							{conversation.displayName}
						</Text>
						<Text style={styles.rowDate}>{dateStr}</Text>
					</View>
					<View style={styles.rowFooter}>
						<Text
							style={[
								styles.rowPreview,
								conversation.unreadCount > 0 && styles.rowPreviewUnread,
							]}
							numberOfLines={1}
						>
							{preview}
						</Text>
						<View style={styles.rowRightSide}>
							{conversation.unreadCount > 0 && (
								<View style={styles.unreadDot} />
							)}
							<NavArrowRight
								width={14}
								height={14}
								strokeWidth={2.5}
								style={{ marginBottom: -2 }}
								color="#3C3C3C"
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
		setRecipient(`${contact.name} (${contact.number})`);
		setSuggestions([]);
	};

	const handleSendMessage = async () => {
		if (!recipient || !messageText.trim() || isSending) return;

		let finalNumber = recipient;
		// Extract number from parentheses if present: "Name (Number)"
		const match = recipient.match(/\(([^)]+)\)/);
		if (match && match[1]) {
			finalNumber = match[1];
		}

		setIsSending(true);
		try {
			await sendSms(finalNumber, messageText.trim());
			setIsModalVisible(false);
			setRecipient("");
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
			<View style={styles.centerContainer}>
				<ActivityIndicator size="large" />
				<Text style={styles.statusText}>{t("settings.status_connecting")}</Text>
			</View>
		);
	}

	if (authStatus === "error") {
		return (
			<View style={styles.centerContainer}>
				<Text style={styles.errorIcon}>⚠️</Text>
				<Text style={styles.errorText}>{authError}</Text>
				<Text style={styles.errorHint}>{t("settings.error_hint")}</Text>
				<Pressable style={styles.retryButton} onPress={login}>
					<Text style={styles.retryButtonText}>{t("settings.retry")}</Text>
				</Pressable>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ headerShown: false }} />

			<LinearGradient
				colors={["rgba(0,0,0,0.8)", "transparent"]}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					height: 120,
					zIndex: 10,
				}}
				pointerEvents="none"
			/>

			<Animated.View
				style={[
					styles.header,
					{
						opacity: titleOpacity,
						transform: [{ translateY: titleTranslateY }],
					},
				]}
			>
				<Text style={styles.headerTitle}>{t("messages.title")}</Text>
				<TouchableOpacity
					onPress={() => setIsModalVisible(true)}
					activeOpacity={0.7}
				>
					<GlassView style={styles.composeButton} glassEffectStyle="regular">
						<SymbolView
							name="square.and.pencil"
							size={22}
							tintColor="#fff"
							weight="regular"
							style={{ marginTop: -2 }}
						/>
					</GlassView>
				</TouchableOpacity>
			</Animated.View>

			{isLoadingSms && conversations.length === 0 ? (
				<View style={styles.centerContainer}>
					<ActivityIndicator size="large" />
					<Text style={styles.statusText}>{t("messages.loading")}</Text>
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
					contentInset={{ top: 112 }}
					contentOffset={{ x: 0, y: -112 }}
					ListHeaderComponent={() => <View style={{ height: 0 }} />}
					keyExtractor={(item) => item.number}
					renderItem={({ item }) => (
						<ConversationRow
							conversation={item}
							onPress={() => handleOpen(item)}
							onDelete={handleDelete}
						/>
					)}
					ItemSeparatorComponent={() => <View style={styles.separator} />}
					refreshControl={
						<RefreshControl
							refreshing={isLoadingSms}
							onRefresh={handleRefresh}
						/>
					}
					contentContainerStyle={[
						styles.listContent,
						{ minHeight: Dimensions.get("window").height - 112 - 90 },
					]}
					alwaysBounceVertical={true}
					ListEmptyComponent={
						<View style={styles.emptyContent}>
							<Text style={styles.emptyIcon}>💬</Text>
							<Text style={styles.emptyText}>{t("messages.empty")}</Text>
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
				<View style={styles.modalContainer}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>{t("messages.new")}</Text>
						<TouchableOpacity
							style={styles.closeButtonContainer}
							onPress={() => setIsModalVisible(false)}
							activeOpacity={0.7}
						>
							<GlassView style={styles.closeButton} glassEffectStyle="regular">
								<SymbolView
									name="xmark"
									size={20}
									tintColor="#fff"
									weight="regular"
								/>
							</GlassView>
						</TouchableOpacity>
					</View>

					<GlassView
						style={styles.recipientGlassContainer}
						glassEffectStyle="regular"
					>
						<View style={styles.recipientField}>
							<Text style={styles.recipientLabel}>{t('messages.to')}</Text>
							<TextInput
								style={styles.recipientInput}
								value={recipient}
								onChangeText={handleRecipientChange}
								placeholder={t("messages.recipient_placeholder")}
								placeholderTextColor="#636366"
								autoFocus
								keyboardType="default"
							/>
						</View>
					</GlassView>

					{suggestions.length > 0 && (
						<View style={styles.suggestionsContainer}>
							{suggestions.map((s, i) => (
								<TouchableOpacity
									key={i}
									style={styles.suggestionItem}
									onPress={() => selectRecipient(s)}
								>
									<Text style={styles.suggestionName}>{s.name}</Text>
									<Text style={styles.suggestionNumber}>{s.number}</Text>
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

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000",
	},
	header: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		zIndex: 11,
		paddingTop: 60,
		paddingBottom: 8,
		paddingHorizontal: 16,
		backgroundColor: "transparent",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	headerTitle: {
		fontSize: 34,
		fontWeight: "700",
		color: "#fff",
		letterSpacing: 0.4,
	},
	composeButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		overflow: "hidden",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: -2,
	},
	modalContainer: {
		flex: 1,
		backgroundColor: "#1C1C1E",
	},
	modalHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 30,
		paddingVertical: 30,
	},
	modalTitle: {
		fontSize: 17,
		fontWeight: "600",
		color: "#fff",
	},
	closeButtonContainer: {
		position: "absolute",
		right: 20,
	},
	closeButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		overflow: "hidden",
		justifyContent: "center",
		alignItems: "center",
	},
	recipientGlassContainer: {
		marginHorizontal: 20,
		marginTop: 4,
		borderRadius: 99,
		overflow: "hidden",
	},
	recipientField: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	recipientLabel: {
		fontSize: 16,
		color: "#8E8E93",
		marginRight: 8,
	},
	recipientInput: {
		flex: 1,
		fontSize: 16,
		color: "#fff",
		paddingVertical: 4,
	},
	addContactButton: {
		width: 24,
		height: 24,
		borderRadius: 12,
		backgroundColor: "rgba(255, 255, 255, 0.1)",
		justifyContent: "center",
		alignItems: "center",
		marginLeft: 8,
	},
	suggestionsContainer: {
		backgroundColor: "#1C1C1E",
		maxHeight: 200,
	},
	suggestionItem: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#38383A",
	},
	suggestionName: {
		fontSize: 16,
		color: "#fff",
		fontWeight: "500",
	},
	suggestionNumber: {
		fontSize: 13,
		color: "#8E8E93",
		marginTop: 2,
	},
	centerContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#000",
		gap: 12,
		padding: 24,
	},
	statusText: {
		color: "#8E8E93",
		fontSize: 15,
	},
	errorIcon: { fontSize: 40 },
	errorText: {
		color: "#FF3B30",
		fontSize: 16,
		fontWeight: "600",
		textAlign: "center",
	},
	errorHint: {
		color: "#8E8E93",
		fontSize: 13,
		textAlign: "center",
		lineHeight: 18,
	},
	retryButton: {
		marginTop: 8,
		paddingHorizontal: 24,
		paddingVertical: 12,
		backgroundColor: "#208AEF",
		borderRadius: 12,
	},
	retryButtonText: {
		color: "#fff",
		fontWeight: "600",
		fontSize: 15,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		gap: 12,
		backgroundColor: "#000",
	},
	rowPressed: {
		backgroundColor: "#1C1C1E",
	},
	deleteActionWrapper: {
		justifyContent: "center",
		alignItems: "flex-end",
		paddingHorizontal: 12,
		backgroundColor: "transparent",
		overflow: "hidden",
	},
	deleteAction: {
		backgroundColor: "#FF3B30",
		height: 50,
		justifyContent: "center",
		alignItems: "center",
		overflow: "hidden",
	},
	deleteActionButton: {
		flex: 1,
		width: "100%",
		justifyContent: "center",
		alignItems: "center",
	},
	avatar: {
		width: 50,
		height: 50,
		borderRadius: 25,
		justifyContent: "center",
		alignItems: "center",
	},
	avatarText: {
		fontSize: 24,
		color: "#fff",
		fontWeight: "700",
		fontFamily: "ui-rounded",
		marginTop: -2,
		textAlign: "center",
	},
	rowContent: {
		flex: 1,
		gap: 2,
	},
	rowHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	rowName: {
		fontSize: 16,
		fontWeight: "600",
		color: "#fff",
		flex: 1,
		marginRight: 8,
	},
	rowDate: {
		fontSize: 13,
		color: "#8E8E93",
	},
	rowFooter: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	rowPreview: {
		fontSize: 14,
		color: "#8E8E93",
		flex: 1,
		marginRight: 4,
	},
	rowPreviewUnread: {
		color: "#FFFFFF",
		fontWeight: "600",
	},
	rowRightSide: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	unreadDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: "#208AEF",
		marginTop: 1,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: "#2C2C2E",
		marginLeft: 78,
	},
	listContent: {
		paddingTop: Platform.OS === "android" ? 112 : 0,
		paddingBottom: 20,
	},
	emptyContainer: {
		flex: 1,
	},
	emptyContent: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		gap: 12,
		paddingTop: 80,
	},
	emptyIcon: { fontSize: 48 },
	emptyText: {
		color: "#8E8E93",
		fontSize: 16,
	},
});
