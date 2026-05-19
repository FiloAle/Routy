# Routy

Routy is an iOS-first Expo client designed to interface with ZTE routers. It allows to manage SMS messages and monitor device status directly from an iPhone without using the router's web interface.

## Overview

The application connects to the ZTE router over the local network (Wi-Fi) using its internal API. It provides a native messaging experience, background monitoring for new messages, and a real-time dashboard for network statistics.

## Key Features

- **SMS Management**: Read, send, and delete SMS messages with a native interface.
- **Background Monitoring**: Periodic background polling for new messages with local system notifications (using `expo-background-fetch`).
- **Network Dashboard**: Real-time monitoring of signal strength (RSRP/SINR), active bands (Carrier Aggregation support), and current network operator.
- **Data Tracking**: Monthly data usage visualization and real-time throughput monitoring.
- **Device Management**: View and monitor all devices currently connected to the router's network.
- **Privacy Focused**: All communications happen locally between the iPhone and the router. No external servers or push notification services are used.

## How it Works

The app interacts with the ZTE router's `goform` API. It handles authentication, session management, and data parsing locally.

Since it bypasses the need for a central server for notifications, it utilizes a background task that polls the router at defined intervals. This approach ensures privacy and avoids the requirement for paid developer accounts or complex server infrastructures.

## Tech Stack

- **Framework**: [Expo](https://expo.dev) / React Native
- **Navigation**: Expo Router (File-based routing)
- **Styling**: Vanilla CSS with a focus on native iOS aesthetics
- **Animations**: React Native Reanimated
- **Storage**: AsyncStorage for local credentials and message tracking
- **Background Tasks**: Expo Task Manager & Background Fetch

## Requirements

- A compatible ZTE mobile router (only tested on MF289F).
- The smartphone must be connected to the router's Wi-Fi network.
- Local Network permissions must be granted to allow communication with the router's IP.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npx expo start
   ```

3. Run on a physical device (recommended for testing background fetch and local network features):
   ```bash
   npx expo run:ios --device
   ```

## Screenshots

<div style="display: flex; flex-wrap: wrap; gap: 2%;">
  <img src="./docs/images/home.png" width="32%" alt="Dashboard Home">
  <img src="./docs/images/devices.png" width="32%" alt="Connected Devices">
  <img src="./docs/images/messages.png" width="32%" alt="Messages List">
  <img src="./docs/images/chat.png" width="32%" alt="Chat View">
  <img src="./docs/images/settings.png" width="32%" alt="Settings">
  <img src="./docs/images/dns.png" width="32%" alt="DNS Configuration">
</div>

---

_Note: This is a third-party application and is not affiliated with ZTE Corporation._
