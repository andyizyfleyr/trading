import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

// La vue affiche le site existant, sans pont JavaScript ni copie des jetons.
const SITE = 'https://tradefacile-sand.vercel.app';
const HOST = 'tradefacile-sand.vercel.app';

export default function App() {
  const web = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false;
      web.current?.goBack();
      return true;
    });
    return () => listener.remove();
  }, [canGoBack]);

  const allowNavigation = useCallback((request) => {
    const url = request.url;
    // Comparaison stricte de l'origine : un sous-domaine ou un nom trompeur
    // ne doit jamais accéder à la session stockée dans la vue.
    if (new RegExp('^https://' + HOST.replace(/\./g, '\\.') + '(?::443)?(?:[/?#]|$)', 'i').test(url)) return true;
    // Les liens externes ne sont jamais chargés dans la vue connectée.
    if (/^(https:\/\/|mailto:)/i.test(url)) Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1C1F2E" />
      {failed ? (
        <View style={styles.center}>
          <Text style={styles.title}>Connexion impossible</Text>
          <Text style={styles.message}>Vérifie ta connexion Internet puis réessaie.</Text>
          <TouchableOpacity style={styles.button} accessibilityRole="button" onPress={() => { setFailed(false); setAttempt(n => n + 1); }}>
            <Text style={styles.buttonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          key={attempt}
          ref={web}
          source={{ uri: SITE }}
          originWhitelist={['https://*', 'mailto:*']}
          onShouldStartLoadWithRequest={allowNavigation}
          onNavigationStateChange={state => setCanGoBack(state.canGoBack)}
          onError={() => setFailed(true)}
          startInLoadingState
          renderLoading={() => <View style={styles.loading}><ActivityIndicator size="large" color="#2E99FB" /></View>}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          style={styles.web}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1C1F2E' },
  web: { flex: 1, backgroundColor: '#1C1F2E' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C1F2E' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { color: '#F0F0F0', fontSize: 22, fontWeight: '700', marginBottom: 10 },
  message: { color: '#8E93A7', fontSize: 16, textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#0270D1', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
