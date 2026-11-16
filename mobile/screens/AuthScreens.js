// Écrans Bienvenue, Connexion et Inscription : miroir exact des pages web.
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiLogin, apiRegister, ApiError } from '../api';
import { LANGS } from '../i18n';
import { money } from '../money';
import { CONFIG, useTheme, useThemedStyles } from '../theme';
import { ChevronDownIcon, SlideArt } from '../components/Icons';
import { Btn, Field, SelectSheet } from '../components/Ui';

function BrandRow({ compact = false }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.brandRow, compact && { marginBottom: 0 }]}>
      <View style={styles.brandMark}>
        <Text style={styles.brandUp}>▲</Text>
        <Text style={styles.brandDown}>▼</Text>
      </View>
      <Text style={styles.brandName}>TradeFacile</Text>
    </View>
  );
}

function LangPicker({ lang, setLang, t }) {
  const { ink } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.code === lang) || LANGS[0];
  return (
    <View style={styles.langRow}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('Langue')}
        onPress={() => setOpen(true)}
        style={styles.langSelect}
      >
        <Text style={styles.langSelectText}>{current.label}</Text>
        <ChevronDownIcon size={14} color={ink.doux} />
      </TouchableOpacity>
      <SelectSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('Langue')}
        options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
        selectedValue={lang}
        onSelect={setLang}
      />
    </View>
  );
}

/* ---------- Connexion (identique à app/connexion/page.tsx) ---------- */

export function ConnexionScreen({ lang, setLang, t, sessionExpired, onAuthSuccess, onGoRegister, onGoWelcome }) {
  const { ink } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const data = await apiLogin(email.trim(), password);
      await onAuthSuccess(data.token, data.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('Connexion impossible.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.shell}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BrandRow />

        <Text style={styles.title}>{t('Bon retour !')}</Text>
        <Text style={styles.sub}>
          {sessionExpired
            ? t('Ta session a expiré après 30 jours : reconnecte-toi pour continuer.')
            : t('Connecte-toi pour continuer à jouer.')}
        </Text>

        <View style={styles.form}>
          <Field label={t('E-mail')}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="toi@exemple.com"
              placeholderTextColor={ink.doux}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              style={styles.input}
            />
          </Field>
          <Field label={t('Mot de passe')}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('Ton mot de passe')}
              placeholderTextColor={ink.doux}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
              style={styles.input}
            />
          </Field>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Btn onPress={submit} disabled={busy}>
            {busy ? t('Connexion…') : t('Se connecter')}
          </Btn>
        </View>

        <View style={styles.footRow}>
          <Text style={styles.footText}>{t('Pas encore de compte ?')} </Text>
          <TouchableOpacity accessibilityRole="button" onPress={onGoRegister}>
            <Text style={styles.link}>{t('Créer un compte')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footRow}>
          <TouchableOpacity accessibilityRole="button" onPress={onGoWelcome}>
            <Text style={styles.link}>{t("Découvrir l'app en 3 écrans")}</Text>
          </TouchableOpacity>
        </View>

        <LangPicker lang={lang} setLang={setLang} t={t} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---------- Inscription (identique à app/inscription/page.tsx) ---------- */

export function InscriptionScreen({ lang, setLang, t, onAuthSuccess, onGoLogin }) {
  const { ink } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const data = await apiRegister(email.trim(), password);
      await onAuthSuccess(data.token, data.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('Inscription impossible.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.shell}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BrandRow />

        <Text style={styles.title}>{t('Crée ton compte')}</Text>
        <Text style={styles.sub}>
          {t("Crée ton compte, puis touche « Ajouter » dans ton profil pour recharger ton solde.")}
        </Text>

        <View style={styles.form}>
          <Field label={t('E-mail')}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="toi@exemple.com"
              placeholderTextColor={ink.doux}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              style={styles.input}
            />
          </Field>
          <Field label={t('Mot de passe ({min} caractères minimum)', { min: CONFIG.PASSWORD_MIN })}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('Choisis un mot de passe')}
              placeholderTextColor={ink.doux}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              style={styles.input}
            />
          </Field>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Btn onPress={submit} disabled={busy}>
            {busy ? t('Création…') : t('Créer mon compte')}
          </Btn>
        </View>

        <View style={styles.footRow}>
          <Text style={styles.footText}>{t('Déjà un compte ?')} </Text>
          <TouchableOpacity accessibilityRole="button" onPress={onGoLogin}>
            <Text style={styles.link}>{t('Se connecter')}</Text>
          </TouchableOpacity>
        </View>

        <LangPicker lang={lang} setLang={setLang} t={t} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---------- Bienvenue (identique à app/bienvenue/page.tsx) ---------- */

const SLIDES = [
  {
    title: 'Prédis si le prix monte ou descend',
    text: 'Regarde le graphique en bougies, choisis une durée et une mise, puis touche Hausse ▲ ou Baisse ▼.',
  },
  {
    title: '3 jeux, 100 % hasard',
    text: 'Lucky 7, Jackpot et Turbo : des jeux de hasard pur, sans lien avec les vrais marchés.',
  },
  {
    title: 'Apprends sans risque',
    text: 'Ton solde commence à 0 : touche « Ajouter » dans ton profil pour le recharger. Aucun argent réel, jamais.',
  },
];

export function BienvenueScreen({ lang, setLang, currency = 'USD', t, onFinish }) {
  const styles = useThemedStyles(makeStyles);
  const [slide, setSlide] = useState(0);
  const last = slide === SLIDES.length - 1;

  return (
    <View style={styles.welcomeShell}>
      <View style={styles.topRow}>
        <BrandRow compact />
        {!last ? (
          <TouchableOpacity accessibilityRole="button" onPress={onFinish} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('Passer')}</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
      </View>

      <View style={styles.slideBox}>
        <SlideArt variant={slide} t={t} zeroText={money(0, null, currency, lang)} />
        <Text style={[styles.title, styles.centerText]}>{t(SLIDES[slide].title)}</Text>
        <Text style={[styles.slideText, styles.centerText]}>{t(SLIDES[slide].text)}</Text>
      </View>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={i === slide ? styles.dotOn : styles.dotOff} />
        ))}
      </View>

      <LangPicker lang={lang} setLang={setLang} t={t} />

      <View style={styles.bottomBar}>
        {slide > 0 ? (
          <Btn variant="ghost" onPress={() => setSlide((s) => s - 1)} style={{ flex: 1 }}>
            {t('Retour')}
          </Btn>
        ) : null}
        <Btn onPress={() => (last ? onFinish() : setSlide((s) => s + 1))} style={{ flex: 2 }}>
          {last ? t('Commencer') : t('Suivant')}
        </Btn>
      </View>
    </View>
  );
}

const makeStyles = (INK) =>
  StyleSheet.create({
    flex: {
    flex: 1,
  },
  shell: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  welcomeShell: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: INK.carte,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandUp: {
    fontSize: 15,
    fontWeight: '800',
    color: INK.hausse,
  },
  brandDown: {
    fontSize: 15,
    fontWeight: '800',
    color: INK.baisse,
  },
  brandName: {
    fontSize: 15,
    fontWeight: '800',
    color: INK.texte,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: INK.texte,
  },
  sub: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: INK.doux,
  },
  form: {
    marginTop: 16,
    gap: 12,
  },
  input: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    paddingHorizontal: 12,
    fontSize: 16,
    color: INK.texte,
  },
  errorBox: {
    borderRadius: 12,
    backgroundColor: 'rgba(229,93,79,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
    color: INK.baisse,
  },
  footRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  footText: {
    fontSize: 13,
    color: INK.doux,
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    color: INK.action,
    textDecorationLine: 'underline',
  },
  langRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  langSelect: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    paddingHorizontal: 12,
  },
  langSelectText: {
    fontSize: 12,
    fontWeight: '700',
    color: INK.texte,
  },
  skipBtn: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: INK.doux,
  },
  slideBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
  },
  slideText: {
    fontSize: 13,
    lineHeight: 19,
    color: INK.doux,
    paddingHorizontal: 8,
  },
  centerText: {
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  dotOn: {
    height: 8,
    width: 32,
    borderRadius: 999,
    backgroundColor: INK.action,
  },
  dotOff: {
    height: 8,
    width: 8,
    borderRadius: 999,
    backgroundColor: INK.ligne,
  },
  bottomBar: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
  },
});
