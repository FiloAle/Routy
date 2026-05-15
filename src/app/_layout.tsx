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

import { RouterProvider } from "@/context/router-context";
import { registerBackgroundFetchAsync } from "@/services/background-fetch-service";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  React.useEffect(() => {
    registerBackgroundFetchAsync();
  }, []);

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: '#32ADE6',
    },
  };

  const customDefaultTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: '#32ADE6',
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? customDarkTheme : customDefaultTheme}>
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
                headerStyle: { backgroundColor: "transparent" },
                headerShadowVisible: false,
                headerTintColor: "#fff",
                headerBackTitle: "Tutti",
              }}
            />
          </Stack>
        </RouterProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
