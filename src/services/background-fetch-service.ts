import * as BackgroundTask from 'expo-background-task';
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
  console.log(`[BackgroundTask] Task triggered at: ${now.toLocaleString()}`);

  try {
    const [savedUrl, savedPw, knownRaw] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_URL),
      AsyncStorage.getItem(STORAGE_KEY_PASSWORD),
      AsyncStorage.getItem(STORAGE_KEY_KNOWN_IDS),
    ]);

    if (!savedUrl || !savedPw) {
      console.log('[BackgroundTask] Missing credentials, skipping.');
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const api = new RouterApi(savedUrl, 4000);
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
      console.log('[BackgroundTask] No new messages found.');
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    console.log(`[BackgroundTask] Found ${newMessages.length} new messages!`);

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
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('[BackgroundTask] Task failed:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// 2. Register the task
export async function registerBackgroundFetchAsync() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (isRegistered) {
      console.log('[BackgroundTask] Task already registered.');
    }

    return BackgroundTask.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 15 * 60, // 15 minutes
    });
  } catch (err) {
    console.error('[BackgroundTask] Registration failed:', err);
  }
}

// 3. Unregister the task (useful for debugging/testing)
export async function unregisterBackgroundFetchAsync() {
  return BackgroundTask.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
}
