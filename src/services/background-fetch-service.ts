import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouterApi } from './router-api';
import { contactsService } from './contacts-service';

const BACKGROUND_FETCH_TASK = 'background-fetch-messages';

const STORAGE_KEY_URL = '@routy/router_url';
const STORAGE_KEY_PASSWORD = '@routy/password';
const STORAGE_KEY_KNOWN_IDS = '@routy/known_sms_ids';

// 1. Define the task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  const now = new Date();
  console.log(`[BackgroundFetch] Task triggered at: ${now.toLocaleString()}`);

  try {
    const [savedUrl, savedPw, knownRaw] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_URL),
      AsyncStorage.getItem(STORAGE_KEY_PASSWORD),
      AsyncStorage.getItem(STORAGE_KEY_KNOWN_IDS),
    ]);

    if (!savedUrl || !savedPw) {
      console.log('[BackgroundFetch] Missing credentials, skipping.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const api = new RouterApi(savedUrl);
    await api.login(savedPw);
    
    // Fetch latest conversations
    const conversations = await api.fetchConversations();
    
    let knownIds = new Set<string>();
    if (knownRaw) {
      try {
        const ids = JSON.parse(knownRaw);
        knownIds = new Set(Array.isArray(ids) ? ids : []);
      } catch { /* ignore */ }
    }

    const newMessages = conversations.flatMap(c => 
      c.messages.filter(m => !m.isSent && !knownIds.has(m.id))
    );

    if (newMessages.length === 0) {
      console.log('[BackgroundFetch] No new messages found.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    console.log(`[BackgroundFetch] Found ${newMessages.length} new messages!`);

    // Load contacts to show names if possible
    await contactsService.load();

    for (const msg of newMessages) {
      const name = contactsService.getName(msg.number) ?? msg.number;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: name,
          body: msg.content,
          sound: 'default',
          data: { number: msg.number },
        },
        trigger: null,
      });
      
      knownIds.add(msg.id);
    }

    // Save updated known IDs
    await AsyncStorage.setItem(STORAGE_KEY_KNOWN_IDS, JSON.stringify(Array.from(knownIds)));

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[BackgroundFetch] Task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// 2. Register the task
export async function registerBackgroundFetchAsync() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (isRegistered) {
      console.log('[BackgroundFetch] Task already registered.');
    }

    return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (iOS minimum)
      stopOnTerminate: false, // keep running after app is closed
      startOnBoot: true, // start after device reboot
    });
  } catch (err) {
    console.error('[BackgroundFetch] Registration failed:', err);
  }
}

// 3. Unregister the task (useful for debugging/testing)
export async function unregisterBackgroundFetchAsync() {
  return BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
}
