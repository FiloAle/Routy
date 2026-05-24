import React, { forwardRef } from "react";
import { View, ViewProps, StyleSheet } from "react-native";
import { Host, Rectangle } from "@expo/ui/swift-ui";
import { glassEffect, foregroundStyle } from "@expo/ui/swift-ui/modifiers";

export interface NativeGlassViewProps extends ViewProps {
	glassEffectStyle?: "regular" | "clear" | "identity";
	children?: React.ReactNode;
}

export const NativeGlassView = forwardRef<View, NativeGlassViewProps>(
	({ style, glassEffectStyle = "regular", children, ...rest }, ref) => {
		return (
			<View ref={ref} style={[style, { overflow: "hidden" }]} {...rest}>
				<View style={StyleSheet.absoluteFill}>
					<Host style={{ flex: 1, overflow: "visible" }}>
						<Rectangle
							modifiers={[
								foregroundStyle("clear"),
								glassEffect({
									glass: { variant: glassEffectStyle, interactive: true },
								}),
							]}
						/>
					</Host>
				</View>
				{children}
			</View>
		);
	},
);
