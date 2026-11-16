// TradeFacile mobile — Expo SDK 52 (parité complète avec la version web mobile).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiMe, apiServerTime, apiSetLang, apiSettle, configureApi } from './api';
import { isLang, tr } from './i18n';
import { isCurrency, money } from './money';
import { applyOtaReload, checkAndFetchOta, isOtaEnabled } from './ota';
import { CONFIG, ThemeContext, getThemeInk, syncStatusBar } from './theme';
import {
  ChartIcon,
  HistoryIcon,
  SignalIcon,
  WalletIcon,
} from './components/Icons';
import { SplashScreen } from './components/Ui';
import { BienvenueScreen, ConnexionScreen, InscriptionScreen } from './screens/AuthScreens';
import { HistoriqueScreen } from './screens/HistoriqueScreen';
import { ProfilScreen } from './screens/ProfilScreen';
import { SignauxScreen } from './screens/SignauxScreen';
import { TraderScreen } from './screens/TraderScreen';

const TABS = [
  { id: 'Trader', label: 'Trader', Icon: ChartIcon },
  { id: 'Signaux', label: 'Signaux', Icon: SignalIcon },
  { id: 'Historique', label: 'Historique', Icon: HistoryIcon },
];

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [authScreen, setAuthScreen] = useState('login'); // 'login' | 'register' | 'welcome'
  const [screen, setScreen] = useState('Trader'); // 'Trader' | 'Signaux' | 'Historique' | 'Profil'
  const [visited, setVisited] = useState({ Trader: true });
  const [lang, setLangState] = useState('fr');
  const [theme, setThemeState] = useState('dark'); // 'dark' | 'light'

  const goScreen = useCallback((next) => {
    setScreen(next);
    setVisited((prev) => (prev[next] ? prev : { ...prev, [next]: true }));
  }, []);
  const [calm, setCalm] = useState(false);
  const [online, setOnline] = useState(true);
  const [offsetMs, setOffsetMs] = useState(null);
  const [pendingSignal, setPendingSignal] = useState(null);
  const [otaReady, setOtaReady] = useState(false);

  const tokenRef = useRef(token);
  tokenRef.current = token;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const otaCheckingRef = useRef(false);
  const lastOtaCheckRef = useRef(0);
  const syncBusyRef = useRef(false);

  const setTheme = useCallback((next) => {
    const mode = next === 'light' ? 'light' : 'dark';
    setThemeState(mode);
    SecureStore.setItemAsync(CONFIG.STORE.theme, mode).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      SecureStore.setItemAsync(CONFIG.STORE.theme, next).catch(() => {});
      return next;
    });
  }, []);

  const isLight = theme === 'light';
  const ink = useMemo(() => getThemeInk(theme), [theme]);
  const styles = useMemo(() => makeStyles(ink), [ink]);
  const themeCtx = useMemo(
    () => ({ theme, isLight, ink, setTheme, toggleTheme }),
    [theme, isLight, ink, setTheme, toggleTheme]
  );

  // Maintient la StatusBar verrouillée sur le thème actif (empêche les changements intempestifs sur Android).
  useEffect(() => {
    syncStatusBar(theme);
  }, [theme]);

  useEffect(() => {
    if (!AppState || typeof AppState.addEventListener !== 'function') return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncStatusBar(themeRef.current);
    });
    return () => {
      if (sub && typeof sub.remove === 'function') sub.remove();
    };
  }, []);

  const t = useCallback((key, vars) => tr(lang, key, vars), [lang]);
  const currency = user && isCurrency(user.currency) ? user.currency : 'USD';

  const handleExpired = useCallback(() => {
    if (!tokenRef.current) return;
    SecureStore.deleteItemAsync(CONFIG.STORE.token).catch(() => {});
    setToken(null);
    setUser(null);
    setSessionExpired(true);
    setAuthScreen('login');
    setScreen('Trader');
    setVisited({ Trader: true });
  }, []);

  // Synchronise le contexte HTTP (token, langue, gestion expiration & réseau).
  useEffect(() => {
    configureApi({
      token,
      lang,
      onExpired: handleExpired,
      onNetworkState: setOnline,
    });
  }, [token, lang, handleExpired]);

  // Charge session, langue, thème et mode calme au démarrage.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [savedToken, savedLang, savedCalm, savedTheme] = await Promise.all([
          SecureStore.getItemAsync(CONFIG.STORE.token).catch(() => null),
          SecureStore.getItemAsync(CONFIG.STORE.lang).catch(() => null),
          SecureStore.getItemAsync(CONFIG.STORE.calm).catch(() => null),
          SecureStore.getItemAsync(CONFIG.STORE.theme).catch(() => null),
        ]);
        if (!live) return;
        if (savedLang && isLang(savedLang)) setLangState(savedLang);
        if (savedCalm === '1') setCalm(true);
        if (savedTheme === 'light' || savedTheme === 'dark') setThemeState(savedTheme);

        if (savedToken) {
          configureApi({ token: savedToken, lang: savedLang && isLang(savedLang) ? savedLang : 'fr' });
          const data = await apiMe(savedToken);
          if (!live) return;
          if (data && data.user) {
            setUser(data.user);
            setToken(savedToken);
            if (isLang(data.user.lang)) {
              setLangState(data.user.lang);
              SecureStore.setItemAsync(CONFIG.STORE.lang, data.user.lang).catch(() => {});
            }
          }
        }
      } catch (err) {
        if (err && (err.status === 401 || err.status === 403)) {
          SecureStore.deleteItemAsync(CONFIG.STORE.token).catch(() => {});
          if (live) setSessionExpired(true);
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  // Écart d'horloge serveur partagé (identique à hooks/useServerOffset.ts).
  const syncClock = useCallback(async () => {
    const t0 = Date.now();
    try {
      const serverTime = await apiServerTime();
      if (Number.isFinite(serverTime)) {
        setOffsetMs(serverTime - (t0 + Date.now()) / 2);
      }
    } catch {
      /* horloge locale en secours */
    }
  }, []);

  useEffect(() => {
    syncClock();
    const timer = setInterval(syncClock, CONFIG.CLOCK_SYNC_MS);
    return () => clearInterval(timer);
  }, [syncClock]);

  const setBalance = useCallback((balance, balanceExact) => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            balance,
            ...(balanceExact !== undefined ? { balanceExact } : {}),
          }
        : prev
    );
  }, []);

  // Synchronisation globale du solde (identique à BalanceSync dans AppShell.tsx).
  const syncBalance = useCallback(async () => {
    if (!tokenRef.current || syncBusyRef.current) return;
    syncBusyRef.current = true;
    try {
      const res = await apiSettle();
      if (res) setBalance(res.balance, res.balanceExact);
    } catch {
      /* garde le dernier solde connu */
    } finally {
      syncBusyRef.current = false;
    }
  }, [setBalance]);

  // Rafraîchissement manuel (tirer pour actualiser).
  const refreshAll = useCallback(async () => {
    await Promise.all([syncClock(), syncBalance()]);
  }, [syncClock, syncBalance]);

  const refreshProfile = useCallback(async () => {
    await Promise.all([
      syncClock(),
      (async () => {
        if (!tokenRef.current) return;
        try {
          await syncBalance();
          const data = await apiMe();
          if (data && data.user) {
            setUser(data.user);
            if (isLang(data.user.lang)) {
              setLangState(data.user.lang);
              configureApi({ lang: data.user.lang });
              SecureStore.setItemAsync(CONFIG.STORE.lang, data.user.lang).catch(() => {});
            }
          }
        } catch {
          /* garde le profil actuel */
        }
      })(),
    ]);
  }, [syncClock, syncBalance]);

  useEffect(() => {
    if (!token) return;
    syncBalance();
    const timer = setInterval(syncBalance, CONFIG.CLOCK_SYNC_MS);
    const sub =
      AppState && typeof AppState.addEventListener === 'function'
        ? AppState.addEventListener('change', (state) => {
            if (state === 'active') {
              syncBalance();
              syncClock();
            }
          })
        : null;
    return () => {
      clearInterval(timer);
      if (sub && typeof sub.remove === 'function') sub.remove();
    };
  }, [token, syncBalance, syncClock]);

  // Mises à jour automatiques OTA (au démarrage + au retour au premier plan).
  const checkOtaUpdate = useCallback(async ({ force = false, autoReload = false } = {}) => {
    if (!isOtaEnabled() || otaCheckingRef.current) {
      return isOtaEnabled() ? { status: 'busy' } : { status: 'disabled' };
    }
    const nowMs = Date.now();
    if (!force && nowMs - lastOtaCheckRef.current < 5 * 60 * 1000) {
      return { status: 'skipped' };
    }
    otaCheckingRef.current = true;
    lastOtaCheckRef.current = nowMs;
    try {
      const res = await checkAndFetchOta();
      if (res.status === 'downloaded') {
        setOtaReady(true);
        if (autoReload || loadingRef.current) {
          await applyOtaReload();
        }
      }
      return res;
    } finally {
      otaCheckingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isOtaEnabled()) return undefined;
    void checkOtaUpdate({ force: true, autoReload: false });
    const sub =
      AppState && typeof AppState.addEventListener === 'function'
        ? AppState.addEventListener('change', (state) => {
            if (state === 'active') void checkOtaUpdate({ force: false, autoReload: false });
          })
        : null;
    return () => {
      if (sub && typeof sub.remove === 'function') sub.remove();
    };
  }, [checkOtaUpdate]);

  const handleApplyOta = useCallback(() => {
    void applyOtaReload();
  }, []);

  // Bouton retour Android.
  useEffect(() => {
    if (Platform.OS !== 'android' || !BackHandler || typeof BackHandler.addEventListener !== 'function') {
      return undefined;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (token && screen !== 'Trader') {
        goScreen('Trader');
        return true;
      }
      if (!token && authScreen !== 'login') {
        setAuthScreen('login');
        return true;
      }
      return false;
    });
    return () => {
      if (sub && typeof sub.remove === 'function') sub.remove();
    };
  }, [token, screen, authScreen, goScreen]);

  const setLang = useCallback(
    async (nextLang) => {
      if (!isLang(nextLang)) return;
      setLangState(nextLang);
      SecureStore.setItemAsync(CONFIG.STORE.lang, nextLang).catch(() => {});
      configureApi({ lang: nextLang });
      if (tokenRef.current) {
        try {
          const res = await apiSetLang(nextLang);
          if (res && res.user) setUser(res.user);
        } catch {
          /* la langue locale reste active */
        }
      }
    },
    []
  );

  const toggleCalm = useCallback(() => {
    setCalm((prev) => {
      const next = !prev;
      SecureStore.setItemAsync(CONFIG.STORE.calm, next ? '1' : '0').catch(() => {});
      return next;
    });
  }, []);

  const handleAuthSuccess = useCallback(async (newToken, newUser) => {
    await SecureStore.setItemAsync(CONFIG.STORE.token, newToken).catch(() => {});
    configureApi({ token: newToken });
    setToken(newToken);
    setUser(newUser);
    setSessionExpired(false);
    setScreen('Trader');
    setVisited({ Trader: true });
    if (newUser && isLang(newUser.lang)) {
      setLangState(newUser.lang);
      SecureStore.setItemAsync(CONFIG.STORE.lang, newUser.lang).catch(() => {});
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await SecureStore.deleteItemAsync(CONFIG.STORE.token).catch(() => {});
    configureApi({ token: null });
    setToken(null);
    setUser(null);
    setSessionExpired(false);
    setAuthScreen('login');
    setScreen('Trader');
    setVisited({ Trader: true });
  }, []);

  const handlePrepareSignal = useCallback(
    (payload) => {
      setPendingSignal(payload);
      goScreen('Trader');
    },
    [goScreen]
  );

  const consumeSignal = useCallback(() => setPendingSignal(null), []);

  // UN SEUL <StatusBar> persistant à la racine : jamais démonté entre splash / auth / app,
  // translucent={false} + backgroundColor={ink.fond} -> zéro changement spontané de couleur.
  return (
    <ThemeContext.Provider value={themeCtx}>
      <SafeAreaView style={styles.root}>
        <StatusBar
          barStyle={isLight ? 'dark-content' : 'light-content'}
          backgroundColor={ink.fond}
          translucent={false}
          animated={false}
        />

        {loading ? (
          <SplashScreen calm={calm} />
        ) : !token || !user ? (
          <>
            {!online ? (
              <View style={styles.offlineBanner}>
                <Text style={styles.offlineText}>
                  {t('Hors ligne : reconnecte-toi, tes actions sont en pause.')}
                </Text>
              </View>
            ) : null}

            {authScreen === 'welcome' ? (
              <BienvenueScreen
                lang={lang}
                setLang={setLang}
                currency={currency}
                t={t}
                onFinish={() => setAuthScreen('register')}
              />
            ) : authScreen === 'register' ? (
              <InscriptionScreen
                lang={lang}
                setLang={setLang}
                t={t}
                onAuthSuccess={handleAuthSuccess}
                onGoLogin={() => setAuthScreen('login')}
              />
            ) : (
              <ConnexionScreen
                lang={lang}
                setLang={setLang}
                t={t}
                sessionExpired={sessionExpired}
                onAuthSuccess={handleAuthSuccess}
                onGoRegister={() => setAuthScreen('register')}
                onGoWelcome={() => setAuthScreen('welcome')}
              />
            )}
          </>
        ) : (
          <>
            {/* En-tête fixe (identique à HEADER dans AppShell.tsx) */}
            <View style={styles.headerBar}>
              <View style={styles.headerWrap}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('Accueil Trader')}
                  onPress={() => goScreen('Trader')}
                  style={styles.logo}
                >
                  <View style={styles.logoMark}>
                    <Text style={styles.markUp}>▲</Text>
                    <Text style={styles.markDown}>▼</Text>
                  </View>
                  <Text style={styles.logoName}>TradeFacile</Text>
                </TouchableOpacity>

                <View style={styles.headerRight}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('Mon solde : {x}. Aller au profil.', {
                      x: money(user.balance, user.balanceExact, currency, lang),
                    })}
                    onPress={() => goScreen('Profil')}
                    style={styles.balancePill}
                  >
                    <WalletIcon size={14} color={ink.action} />
                    <Text style={styles.balanceText}>
                      {money(user.balance, user.balanceExact, currency, lang)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Bandeau hors ligne */}
            {!online ? (
              <View style={styles.offlineBanner}>
                <Text style={styles.offlineText}>
                  {t('Hors ligne : reconnecte-toi, tes actions sont en pause.')}
                </Text>
              </View>
            ) : null}

            {/* Bandeau mise à jour OTA prête */}
            {otaReady ? (
              <View style={styles.otaBanner}>
                <Text style={styles.otaText} numberOfLines={1}>
                  {t('Nouvelle version prête')}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={handleApplyOta}
                  style={styles.otaBtn}
                >
                  <Text style={styles.otaBtnText}>{t('Redémarrer')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Contenu principal : onglets visités conservés en mémoire pour un changement instantané */}
            <View style={styles.main}>
              {visited.Trader ? (
                <View
                  style={[styles.tabPane, screen !== 'Trader' && styles.tabHidden]}
                  pointerEvents={screen === 'Trader' ? 'auto' : 'none'}
                >
                  <TraderScreen
                    user={user}
                    currency={currency}
                    lang={lang}
                    t={t}
                    calm={calm}
                    online={online}
                    offsetMs={offsetMs}
                    isActive={screen === 'Trader'}
                    onBalance={setBalance}
                    onRefresh={refreshAll}
                    pendingSignal={pendingSignal}
                    onConsumeSignal={consumeSignal}
                  />
                </View>
              ) : null}

              {visited.Signaux ? (
                <View
                  style={[styles.tabPane, screen !== 'Signaux' && styles.tabHidden]}
                  pointerEvents={screen === 'Signaux' ? 'auto' : 'none'}
                >
                  <SignauxScreen
                    offsetMs={offsetMs}
                    online={online}
                    calm={calm}
                    t={t}
                    isActive={screen === 'Signaux'}
                    onPrepare={handlePrepareSignal}
                    onRetrySync={syncClock}
                    onRefresh={refreshAll}
                  />
                </View>
              ) : null}

              {visited.Historique ? (
                <View
                  style={[styles.tabPane, screen !== 'Historique' && styles.tabHidden]}
                  pointerEvents={screen === 'Historique' ? 'auto' : 'none'}
                >
                  <HistoriqueScreen
                    currency={currency}
                    lang={lang}
                    calm={calm}
                    offsetMs={offsetMs}
                    t={t}
                    isActive={screen === 'Historique'}
                    onBalance={setBalance}
                    onRefresh={refreshAll}
                  />
                </View>
              ) : null}

              {visited.Profil ? (
                <View
                  style={[styles.tabPane, screen !== 'Profil' && styles.tabHidden]}
                  pointerEvents={screen === 'Profil' ? 'auto' : 'none'}
                >
                  <ProfilScreen
                    user={user}
                    currency={currency}
                    lang={lang}
                    setLang={setLang}
                    calm={calm}
                    onToggleCalm={toggleCalm}
                    t={t}
                    onUserUpdated={setUser}
                    onRefresh={refreshProfile}
                    onLogout={handleLogout}
                    otaReady={otaReady}
                    onCheckOta={() => checkOtaUpdate({ force: true, autoReload: true })}
                    onApplyOta={handleApplyOta}
                  />
                </View>
              ) : null}
            </View>

            {/* Barre de navigation basse (identique à BottomNav.tsx) */}
            <View style={styles.navBar}>
              {TABS.map(({ id, label, Icon }) => {
                const active = screen === id;
                return (
                  <TouchableOpacity
                    key={id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    activeOpacity={0.7}
                    onPress={() => goScreen(id)}
                    style={styles.navTab}
                  >
                    {active ? <View style={styles.navTick} /> : null}
                    <Icon size={18} color={active ? ink.texte : ink.doux} />
                    <Text style={[styles.navLabel, active ? styles.navOn : styles.navOff]}>
                      {t(label)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </SafeAreaView>
    </ThemeContext.Provider>
  );
}

const makeStyles = (INK) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: INK.fond,
    },
    headerBar: {
      borderBottomWidth: 1,
      borderBottomColor: INK.ligne,
      backgroundColor: INK.fond,
    },
    headerWrap: {
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 12,
    },
    logo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    logoMark: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    markUp: {
      fontSize: 9,
      lineHeight: 9,
      fontWeight: '700',
      color: INK.hausse,
    },
    markDown: {
      fontSize: 9,
      lineHeight: 9,
      fontWeight: '700',
      color: INK.baisse,
    },
    logoName: {
      fontSize: 15,
      fontWeight: '700',
      color: INK.texte,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    balancePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: INK.ligne,
      backgroundColor: INK.carte,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    balanceText: {
      fontSize: 13,
      fontWeight: '700',
      color: INK.texte,
      fontVariant: ['tabular-nums'],
    },
    offlineBanner: {
      backgroundColor: INK.vente,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    offlineText: {
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    otaBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      backgroundColor: INK.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    otaText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    otaBtn: {
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    otaBtnText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    main: {
      flex: 1,
    },
    tabPane: {
      flex: 1,
    },
    tabHidden: {
      display: 'none',
    },
    navBar: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: INK.ligne,
      backgroundColor: INK.carte,
    },
    navTab: {
      flex: 1,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      position: 'relative',
    },
    navTick: {
      position: 'absolute',
      top: 0,
      height: 2,
      width: 22,
      borderRadius: 999,
      backgroundColor: INK.primary,
    },
    navLabel: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    navOn: {
      color: INK.texte,
    },
    navOff: {
      color: INK.doux,
    },
  });
