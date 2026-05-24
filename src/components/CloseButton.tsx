import React from "react";
import { Host, Button } from "@expo/ui/swift-ui";
import {
	labelStyle,
	foregroundStyle,
	frame,
	glassEffect,
} from "@expo/ui/swift-ui/modifiers";
import { messageStyles } from "../styles/messageStyles";
import { View } from "react-native";

interface CloseButtonProps {
	onPress: () => void;
}

export function CloseButton({ onPress }: CloseButtonProps) {
	return (
		<View style={messageStyles.closeButtonContainer}>
			<Host matchContents style={{ overflow: "visible" }}>
				<Button
					label="Close"
					systemImage="xmark"
					modifiers={[
						labelStyle("iconOnly"),
						foregroundStyle("white"),
						frame({ width: 44, height: 44 }),
						glassEffect({
							glass: { variant: "regular", interactive: true },
							shape: "ellipse",
						}),
					]}
					onPress={onPress}
				/>
			</Host>
		</View>
	);
}
