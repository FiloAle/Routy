import { StyleSheet } from "react-native";
import { Colors } from "../constants/Colors";
import { Layout } from "./globalStyles";

export const messageStyles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.plainBackground,
	},
	centerContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: Colors.plainBackground,
		gap: 12,
		padding: 24,
	},
	listHost: {
		flex: 1,
		backgroundColor: Colors.plainBackground,
	},
	statusText: {
		color: Colors.routyGray,
		fontSize: 15,
	},
	errorIcon: {
		fontSize: 40,
	},
	errorText: {
		color: Colors.routyRed,
		fontSize: 16,
		fontWeight: "600",
		textAlign: "center",
	},
	errorHint: {
		color: Colors.routyGray,
		fontSize: 13,
		textAlign: "center",
		lineHeight: 18,
	},
	retryButton: {
		marginTop: 8,
		paddingHorizontal: 24,
		paddingVertical: 12,
		backgroundColor: Colors.routyBlue,
		borderRadius: Layout.borderRadius,
	},
	retryButtonText: {
		color: Colors.routyWhite,
		fontWeight: "600",
		fontSize: 15,
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
	headerAction: {
		// Spans the title's box (same insets as `header`) and centers the button on it.
		position: "absolute",
		top: 60,
		bottom: 8,
		right: 16,
		justifyContent: "center",
	},
	headerTitle: {
		fontSize: 34,
		fontWeight: "700",
		color: Colors.text,
		letterSpacing: 0.4,
	},
	modalContainer: {
		flex: 1,
		backgroundColor: Colors.card,
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
		color: Colors.text,
		marginBottom: 2,
	},
	closeButtonContainer: {
		position: "absolute",
		right: 20,
	},
	closeButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		overflow: "hidden",
		justifyContent: "center",
		alignItems: "center",
	},
	recipientGlassContainer: {
		marginHorizontal: 20,
		borderRadius: 99,
		overflow: "hidden",
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: Colors.glassBorder,
	},
	recipientField: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		minHeight: 50,
	},
	recipientLabel: {
		fontSize: 16,
		color: Colors.routyGray,
		marginRight: 8,
	},
	recipientInput: {
		flex: 1,
		fontSize: 16,
		color: Colors.text,
		paddingVertical: 4,
	},
	suggestionsContainer: {
		backgroundColor: Colors.card,
		maxHeight: 200,
	},
	suggestionItem: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.separator,
	},
	suggestionName: {
		fontSize: 16,
		color: Colors.text,
		fontWeight: "600",
	},
	suggestionNumber: {
		fontSize: 13,
		color: Colors.routyGray,
		marginTop: 2,
	},
	selectedRecipientWrapper: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	selectedRecipientName: {
		fontSize: 16,
		color: Colors.text,
		fontWeight: "600",
	},
	selectedRecipientNumber: {
		fontSize: 16,
		color: Colors.routyGray,
	},
	removeRecipientButton: {
		marginLeft: "auto",
		width: 24,
		height: 24,
		borderRadius: 12,
		backgroundColor: Colors.faintFill,
		justifyContent: "center",
		alignItems: "center",
	},
	listContent: {
		paddingHorizontal: 8,
		paddingTop: Layout.headerOffset,
		paddingBottom: 84,
		flexGrow: 1,
		justifyContent: "flex-end",
	},
	dateSeparator: {
		alignItems: "center",
		marginVertical: 12,
	},
	dateSeparatorText: {
		fontSize: 12,
		color: Colors.routyGray,
	},
	bubbleRow: {
		flexDirection: "row",
		justifyContent: "flex-start",
		marginVertical: 1,
		paddingHorizontal: 8,
	},
	bubbleRowSent: {
		justifyContent: "flex-end",
	},
	bubbleRowGroupStart: {
		marginTop: 8,
	},
	bubble: {
		maxWidth: "75%",
		paddingHorizontal: 14,
		paddingTop: 8,
		paddingBottom: 10,
		borderRadius: Layout.borderRadius - 4,
	},
	bubbleReceived: {
		backgroundColor: Colors.bubbleReceived,
	},
	bubbleSent: {
		backgroundColor: Colors.routyBlue,
	},
	bubbleText: {
		fontSize: 16,
		color: Colors.text,
		lineHeight: 22,
	},
	bubbleTextSent: {
		color: Colors.routyWhite,
	},
	headerGradient: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 120,
	},
	flex1: {
		flex: 1,
	},
	chatList: {
		flex: 1,
		marginBottom: -90,
	},
	chatListHidden: {
		opacity: 0,
	},
	// Covers the transparent header, where the chat list draws its top edge blur.
	headerEdge: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: Layout.headerOffset,
	},
	keyboardAvoidingView: {
		flex: 1,
	},
	headerComposeIcon: {
		marginTop: -2,
	},
});

export default messageStyles;
