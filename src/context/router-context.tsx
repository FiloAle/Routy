import { useRouter as useExpoRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Contacts from 'expo-contacts';
import { Alert } from 'react-native';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { contactsService } from '../services/contacts-service';
import { RouterApi, DataUsage } from '../services/router-api';
import { Conversation, SmsMessage } from '../utils/sms';
import { t } from '../i18n';

const STORAGE_KEY_URL = '@routy/router_url';
const STORAGE_KEY_PASSWORD = '@routy/password';
const STORAGE_KEY_KNOWN_IDS = '@routy/known_sms_ids';
const STORAGE_KEY_READ_IDS = '@routy/read_ids';
const STORAGE_KEY_DATA_LIMIT_VALUE = '@routy/data_limit_value';
const STORAGE_KEY_DATA_LIMIT_UNIT = '@routy/data_limit_unit';
const DEFAULT_URL = 'http://192.168.0.1';
const POLL_INTERVAL_MS = 3_000;

export type AuthStatus = 'idle' | 'loading' | 'logged_in' | 'error';

interface RouterContextValue {
  routerUrl: string;
  password: string;
  authStatus: AuthStatus;
  authError: string | null;
  conversations: Conversation[];
  dataUsage: DataUsage | null;
  devices: Device[];
  isLoadingSms: boolean;
  isLoadingData: boolean;
  isLoadingDevices: boolean;

  // Advanced Network
  networkStatus: "idle" | "connecting" | "connected" | "disconnecting" | "disconnected" | "error";
  connectNetwork: () => Promise<void>;
  disconnectNetwork: () => Promise<void>;
  reboot: () => Promise<void>;

  // Software & Updates
  softwareVersion: string | null;
  softwareModel: string | null;

  // Night Mode
  nightMode: { enabled: boolean; start: string; end: string } | null;
  fetchNightMode: () => Promise<void>;
  setNightMode: (enabled: boolean, start: string, end: string) => Promise<void>;

  dataLimitValue: string;
  dataLimitUnit: "GB" | "TB";
  setDataLimit: (value: string, unit: "GB" | "TB") => Promise<void>;

  saveSettings: (url: string, pw: string) => Promise<void>;
  login: () => Promise<void>;
  loadSms: () => Promise<void>;
  loadDataUsage: () => Promise<void>;
  loadDevices: () => Promise<void>;
  sendSms: (number: string, text: string) => Promise<void>;
  markAsRead: (number: string) => Promise<void>;
  deleteConversation: (number: string) => Promise<void>;
  addOptimisticMessage: (number: string, msg: SmsMessage) => void;
  getDisplayName: (number: string) => string;
}

const RouterContext = createContext<RouterContextValue | null>(null);

import { Device } from '../services/router-api';

// Configure notifications (foreground support)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [routerUrl, setRouterUrl] = useState(DEFAULT_URL);
  const [password, setPassword] = useState('');
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [authError, setAuthError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [dataUsage, setDataUsage] = useState<DataUsage | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoadingSms, setIsLoadingSms] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);

  // Advanced states
  const [networkStatus, setNetworkStatus] = useState<
    "idle" | "connecting" | "connected" | "disconnecting" | "disconnected" | "error"
  >("idle");
  const [softwareVersion, setSoftwareVersion] = useState<string | null>(null);
  const [softwareModel, setSoftwareModel] = useState<string | null>(null);
  const [nightMode, setNightModeState] = useState<{
    enabled: boolean;
    start: string;
    end: string;
  } | null>(null);
  const [dataLimitValue, setDataLimitValueState] = useState('1');
  const [dataLimitUnit, setDataLimitUnitState] = useState<'GB' | 'TB'>('TB');
  const expoRouter = useExpoRouter();

  const apiRef = useRef<RouterApi>(new RouterApi(DEFAULT_URL));
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const readIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  // Handle notification clicks
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const number = response.notification.request.content.data?.number;
      if (number && typeof number === "string") {
        expoRouter.push({
          pathname: "/messages/[number]",
          params: { number: encodeURIComponent(number) },
        });
      }
    });
    return () => subscription.remove();
  }, [expoRouter]);

  const getDisplayName = useCallback(
    (number: string) => contactsService.getName(number) ?? number,
    []
  );

  const enrichWithContacts = useCallback(
    (convs: Conversation[]) =>
      convs.map((c) => ({
        ...c,
        displayName: contactsService.getName(c.number) ?? c.number,
      })),
    []
  );

  const detectAndNotify = useCallback(
    async (convs: Conversation[]) => {
      try {
        const newIncoming = convs.flatMap((c) =>
          c.messages.filter((m) => !m.isSent && !knownIdsRef.current.has(m.id))
        );

        if (newIncoming.length === 0) return;

        for (const msg of newIncoming) {
          const name = getDisplayName(msg.number);
          await Notifications.scheduleNotificationAsync({
            content: { 
              title: name, 
              body: msg.content, 
              sound: 'default',
              data: { number: msg.number } 
            },
            trigger: null,
          });
          knownIdsRef.current.add(msg.id);
        }

        const allIds = Array.from(knownIdsRef.current);
        await AsyncStorage.setItem(STORAGE_KEY_KNOWN_IDS, JSON.stringify(allIds));
      } catch (e) {
        console.warn('[detectAndNotify] error:', e);
      }
    },
    [getDisplayName]
  );

  const lastLoginRef = useRef<number>(0);
  const LOGIN_RENEWAL_MS = 4 * 60 * 1000; // 4 minuti

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const fetchAndUpdate = useCallback(async () => {
    if (!mountedRef.current || authStatus !== 'logged_in') return;
    
    try {
      // Check if we need to renew session
      const now = Date.now();
      if (now - lastLoginRef.current > LOGIN_RENEWAL_MS) {
        console.log(`[RouterContext] ${t('dashboard.renewing')}`);
        await apiRef.current.login(password);
        lastLoginRef.current = now;
      }

      // Fetch SMS, Data Usage and Devices in parallel
      const [convs, usage, devs] = await Promise.all([
        apiRef.current.fetchConversations(readIdsRef.current),
        apiRef.current.fetchDataUsage(),
        apiRef.current.fetchDevices(),
      ]);

      const enriched = enrichWithContacts(convs);
      
      await detectAndNotify(enriched);

      if (mountedRef.current) {
        setConversations(enriched);
        setDataUsage(usage);
        setDevices(devs);
      }
    } catch (e) {
      console.warn('[fetchAndUpdate] error:', e);
    }
  }, [authStatus, detectAndNotify, enrichWithContacts]);



  const startPolling = useCallback(() => {
    stopPolling();
    pollTimerRef.current = setInterval(fetchAndUpdate, POLL_INTERVAL_MS);
  }, [fetchAndUpdate, stopPolling]);

  // Init
  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      try {
        const [savedUrl, savedPw, knownRaw, readRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_URL),
          AsyncStorage.getItem(STORAGE_KEY_PASSWORD),
          AsyncStorage.getItem(STORAGE_KEY_KNOWN_IDS),
          AsyncStorage.getItem(STORAGE_KEY_READ_IDS),
        ]);

        const url = savedUrl ?? DEFAULT_URL;
        const pw = savedPw ?? '';

        if (mountedRef.current) {
          setRouterUrl(url);
          if (pw) setPassword(pw);
        }
        apiRef.current = new RouterApi(url);

        if (knownRaw) {
          try {
            const ids = JSON.parse(knownRaw);
            knownIdsRef.current = new Set(Array.isArray(ids) ? ids : []);
          } catch { knownIdsRef.current = new Set(); }
        }

        const [savedLimitValue, savedLimitUnit] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_DATA_LIMIT_VALUE),
          AsyncStorage.getItem(STORAGE_KEY_DATA_LIMIT_UNIT),
        ]);

        if (mountedRef.current) {
          if (savedLimitValue) setDataLimitValueState(savedLimitValue);
          if (savedLimitUnit === 'GB' || savedLimitUnit === 'TB') {
            setDataLimitUnitState(savedLimitUnit);
          }
        }
        
        if (readRaw) {
          try {
            const ids = JSON.parse(readRaw);
            readIdsRef.current = new Set(Array.isArray(ids) ? ids : []);
          } catch { readIdsRef.current = new Set(); }
        }

        // 1. Notifications Permissions
        try {
          await Notifications.requestPermissionsAsync();
        } catch (e) { console.log('Notifications error', e); }

        // 2. Request Contacts permissions (Instant)
        try {
          const { status } = await Contacts.requestPermissionsAsync();
          if (status === 'granted') {
            await contactsService.load();
            if (mountedRef.current) {
              setConversations(prev => enrichWithContacts(prev));
            }
          }
        } catch (e) { console.log('Contacts error', e); }

        // 3. Auto-login
        if (pw && mountedRef.current) {
          setAuthStatus('loading');
          try {
            await apiRef.current.login(pw);
            if (mountedRef.current) {
              setAuthStatus('logged_in');
              lastLoginRef.current = Date.now();
              const convs = await apiRef.current.fetchConversations(readIdsRef.current);
              const enriched = enrichWithContacts(convs);
              
              // Mark initial messages as known on first load to avoid spam
              const initialIds = enriched.flatMap(c => c.messages.map(m => m.id));
              knownIdsRef.current = new Set([...Array.from(knownIdsRef.current), ...initialIds]);
              
              setConversations(enriched);
            }
          } catch (e: any) {
            if (mountedRef.current) {
              setAuthStatus('error');
              setAuthError(e?.message ?? t('settings.error_conn'));
            }
          }
        }
      } catch (e) {
        console.error('[RouterProvider] init error:', e);
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (authStatus === 'logged_in') startPolling();
    else stopPolling();
  }, [authStatus, startPolling, stopPolling]);

  const saveSettings = useCallback(
    async (url: string, pw: string) => {
      stopPolling();
      setRouterUrl(url);
      setPassword(pw);
      apiRef.current = new RouterApi(url);
      setAuthStatus('idle');
      setAuthError(null);
      setConversations([]);
      await AsyncStorage.setItem(STORAGE_KEY_URL, url);
      await AsyncStorage.setItem(STORAGE_KEY_PASSWORD, pw);
    },
    [stopPolling]
  );

  const login = useCallback(async () => {
    if (!password) {
      setAuthError(t('settings.error_pw'));
      setAuthStatus('error');
      return;
    }
    setAuthStatus('loading');
    setAuthError(null);
    try {
      await apiRef.current.login(password);
      setAuthStatus('logged_in');
    } catch (e: any) {
      setAuthStatus('error');
      setAuthError(e?.message ?? t('settings.error_conn'));
    }
  }, [password]);

  const loadSms = useCallback(async () => {
    if (authStatus !== 'logged_in') return;
    setIsLoadingSms(true);
    try {
      await fetchAndUpdate();
    } finally {
      setIsLoadingSms(false);
    }
  }, [authStatus, fetchAndUpdate]);

  const loadDataUsage = useCallback(async () => {
    if (authStatus !== 'logged_in') return;
    setIsLoadingData(true);
    try {
      const usage = await apiRef.current.fetchDataUsage();
      if (mountedRef.current) {
        setDataUsage(usage);
        console.log('[RouterContext] ppp_status:', usage.pppStatus);
        
        if (usage.pppStatus === "ppp_connected" || usage.pppStatus === "connected") {
          setNetworkStatus("connected");
        } else {
          setNetworkStatus("disconnected");
        }

        if (!softwareVersion) {
          apiRef.current.fetchSoftwareVersion().then(({ model, version }) => {
            if (mountedRef.current) {
              setSoftwareVersion(version);
              setSoftwareModel(model);
            }
          });
        }
      }
    } catch (e) {
      console.warn('[loadDataUsage] error:', e);
    } finally {
      setIsLoadingData(false);
    }
  }, [authStatus]);

  const connectNetwork = useCallback(async () => {
    try {
      setNetworkStatus("connecting");
      await apiRef.current.connectNetwork();
      setNetworkStatus("connected");
      await loadDataUsage();
    } catch (e) {
      setNetworkStatus("disconnected");
      throw e;
    }
  }, [loadDataUsage]);

  const disconnectNetwork = useCallback(async () => {
    try {
      setNetworkStatus("disconnecting");
      await apiRef.current.disconnectNetwork();
      setNetworkStatus("disconnected");
      await loadDataUsage();
    } catch (e) {
      setNetworkStatus("connected");
      throw e;
    }
  }, [loadDataUsage]);

  const reboot = useCallback(async () => {
    try {
      await apiRef.current.reboot();
      Alert.alert(t('settings.login_success_title'), t('settings.reboot_success'));
    } catch (e) {
      console.warn("[reboot] error:", e);
      Alert.alert(t('common.error'), t('settings.reboot_error'));
      throw e;
    }
  }, []);

  const fetchNightMode = useCallback(async () => {
    try {
      const settings = await apiRef.current.fetchNightMode();
      if (mountedRef.current) setNightModeState(settings);
    } catch (e) {
      console.warn("[fetchNightMode] error:", e);
    }
  }, []);

  const setNightMode = useCallback(
    async (enabled: boolean, start: string, end: string) => {
      try {
        await apiRef.current.setNightMode(enabled, start, end);
        if (mountedRef.current) setNightModeState({ enabled, start, end });
      } catch (e) {
        console.warn("[setNightMode] error:", e);
        throw e;
      }
    },
    [],
  );

  const loadDevices = useCallback(async () => {
    if (authStatus !== 'logged_in') return;
    setIsLoadingDevices(true);
    try {
      const devs = await apiRef.current.fetchDevices();
      if (mountedRef.current) setDevices(devs);
    } catch (e) {
      console.warn('[loadDevices] error:', e);
    } finally {
      setIsLoadingDevices(false);
    }
  }, [authStatus]);

  const sendSms = useCallback(
    async (number: string, text: string) => apiRef.current.sendSms(number, text),
    []
  );

  const markAsRead = useCallback(async (number: string) => {
    const conv = conversations.find(c => c.number === number);
    if (!conv || conv.unreadCount === 0) return;

    setConversations(prev => prev.map(c => 
      c.number === number ? { ...c, unreadCount: 0 } : c
    ));

    try {
      const receivedIds = conv.messages.filter(m => !m.isSent).map(m => m.id);
      
      // PERSIST LOCALLY
      receivedIds.forEach(id => readIdsRef.current.add(id));
      await AsyncStorage.setItem(STORAGE_KEY_READ_IDS, JSON.stringify(Array.from(readIdsRef.current)));
      
      await apiRef.current.markAsRead(receivedIds);
    } catch (e) {
      console.warn('[markAsRead] API failed:', e);
    }
  }, [conversations]);

  const deleteConversation = useCallback(async (number: string) => {
    const conv = conversations.find(c => c.number === number);
    if (!conv) return;

    // Optimistic update
    setConversations(prev => prev.filter(c => c.number !== number));

    try {
      const msgIds = conv.messages.map(m => m.id);
      await apiRef.current.deleteSms(msgIds);
    } catch (e) {
      console.warn('[deleteConversation] API failed:', e);
      // Revert if failed (optional, but good for UX)
      await loadSms(); 
    }
  }, [conversations, loadSms]);

  const addOptimisticMessage = useCallback((number: string, msg: SmsMessage) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.number === number);
      if (idx >= 0) {
        const conv = prev[idx]!;
        const updated = { ...conv, messages: [...conv.messages, msg], lastMessage: msg };
        return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
      }
      return [
        {
          number,
          displayName: getDisplayName(number),
          messages: [msg],
          lastMessage: msg,
          unreadCount: 0,
        },
        ...prev,
      ];
    });
    knownIdsRef.current.add(msg.id);
  }, [getDisplayName]);

  const setDataLimit = useCallback(async (value: string, unit: "GB" | "TB") => {
    setDataLimitValueState(value);
    setDataLimitUnitState(unit);
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEY_DATA_LIMIT_VALUE, value),
      AsyncStorage.setItem(STORAGE_KEY_DATA_LIMIT_UNIT, unit),
    ]);
  }, []);

  return (
    <RouterContext.Provider
      value={{
        routerUrl,
        password,
        authStatus,
        authError,
        conversations,
        dataUsage,
        devices,
        isLoadingSms,
        isLoadingData,
        isLoadingDevices,
        networkStatus,
        connectNetwork,
        disconnectNetwork,
        reboot,
        softwareVersion,
        softwareModel,
        nightMode,
        fetchNightMode,
        setNightMode,
        dataLimitValue,
        dataLimitUnit,
        setDataLimit,
        saveSettings,
        login,
        loadSms,
        loadDataUsage,
        loadDevices,
        sendSms,
        markAsRead,
        deleteConversation,
        addOptimisticMessage,
        getDisplayName,
      }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider');
  return ctx;
}
