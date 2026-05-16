import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import * as SplashScreen from "expo-splash-screen";
import { RouterProvider } from "@/context/router-context";
import { registerBackgroundFetchAsync } from "@/services/background-fetch-service";

import { Colors } from "@/constants/Colors";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Set the animation options.
SplashScreen.setOptions({
	duration: 300,
	fade: true,
});

export default function RootLayout() {
	const colorScheme = useColorScheme();

	React.useEffect(() => {
		async function prepare() {
			try {
				await registerBackgroundFetchAsync();
			} catch (e) {
				console.warn(e);
			} finally {
				// Add a small delay to ensure the splash screen is visible
				await new Promise((resolve) => setTimeout(resolve, 800));

				// Hide the splash screen
				await SplashScreen.hideAsync();
			}
		}

		prepare();
	}, []);

	const customDarkTheme = {
		...DarkTheme,
		colors: {
			...DarkTheme.colors,
			primary: Colors.routyBlue,
		},
	};

	const customDefaultTheme = {
		...DefaultTheme,
		colors: {
			...DefaultTheme.colors,
			primary: Colors.routyBlue,
		},
	};

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<ThemeProvider
				value={colorScheme === "dark" ? customDarkTheme : customDefaultTheme}
			>
				<StatusBar style="light" />
				<RouterProvider>
					<Stack>
						<Stack.Screen name="index" options={{ headerShown: false }} />
						<Stack.Screen
							name="(tabs)"
							options={{ headerShown: false, title: "Tutti" }}
						/>
						<Stack.Screen
							name="messages/[number]"
							options={{
								headerShown: true,
								headerTransparent: true,
								headerStyle: { backgroundColor: Colors.routyTransparent },
								headerShadowVisible: false,
								headerTintColor: Colors.routyWhite,
								headerBackTitle: "Tutti",
							}}
						/>
					</Stack>
				</RouterProvider>
			</ThemeProvider>
		</GestureHandlerRootView>
	);
}
