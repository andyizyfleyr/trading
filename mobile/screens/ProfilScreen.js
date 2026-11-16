// Écran Profil : miroir exact de app/profil/page.tsx.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { apiDeposit, apiSetCurrency, apiWithdraw, ApiError } from '../api';
import { LANGS } from '../i18n';
import { CURRENCIES, isCurrency, money } from '../money';
import { CONFIG, COUNTRIES, CURRENCY_LABELS, INK } from '../theme';
import { ChevronDownIcon, LogoutIcon, MinusIcon, PlusIcon } from '../components/Icons';
import { BottomSheet, Btn, SelectSheet } from '../components/Ui';

export function ProfilScreen({
  user,
  currency,
  lang,
  setLang,
  calm,
  onToggleCalm,
  t,
  onUserUpdated,
  onLogout,
}) {
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null); // 'deposit' | 'withdraw' | 'country' | 'currency' | 'lang' | null

  const vibrateTap = () => {
    if (calm) return;
    try {
      if (Vibration && typeof Vibration.vibrate === 'function') Vibration.vibrate(CONFIG.VIBRATE.tap);
    } catch {
      /* ignore */
    }
  };

  const runAction = async (fn, okText) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fn();
      if (res && res.user) onUserUpdated(res.user);
      vibrateTap();
      setSheet(null);
      setMessage({ kind: 'ok', text: okText });
    } catch (err) {
      setMessage({
        kind: 'err',
        text: err instanceof ApiError ? err.message : t('Opération impossible pour le moment.'),
      });
    } finally {
      setBusy(false);
    }
  };

  const initial = ((user && user.email && user.email[0]) || '?').toUpperCase();
  const activeCurrency = user && isCurrency(user.currency) ? user.currency : 'USD';
  const selectedCountry = COUNTRIES.find((c) => c.code === (user && user.country));
  const selectedLang = LANGS.find((l) => l.code === lang) || LANGS[0];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.root}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{t('Profil')}</Text>

      {/* Identité + solde */}
      <View style={styles.idCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.acctMain}>
          <Text style={styles.mail} numberOfLines={1}>
            {user ? user.email : ''}
          </Text>
          <Text style={styles.balance}>
            {user ? money(user.balance, user.balanceExact, currency, lang) : '…'}
          </Text>
        </View>
      </View>

      {message ? (
        <View style={message.kind === 'ok' ? styles.msgOk : styles.msgErr}>
          <Text style={message.kind === 'ok' ? styles.msgOkText : styles.msgErrText}>
            {message.text}
          </Text>
        </View>
      ) : null}

      {/* Ajouter / Retirer : ouvrent un panneau */}
      <View style={styles.addRow}>
        <Btn variant="card" onPress={() => setSheet('deposit')} style={styles.bigBtn}>
          <PlusIcon size={20} color={INK.texte} />
          <Text style={styles.bigBtnText}>{t('Ajouter')}</Text>
        </Btn>
        <Btn variant="card" onPress={() => setSheet('withdraw')} style={styles.bigBtn}>
          <MinusIcon size={20} color={INK.texte} />
          <Text style={styles.bigBtnText}>{t('Retirer')}</Text>
        </Btn>
      </View>

      {/* Pays & Devise */}
      <View style={styles.curBox}>
        <View style={styles.curCol}>
          <Text style={styles.curLabel}>{t('Pays')}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('Pays')}
            disabled={busy}
            onPress={() => setSheet('country')}
            style={[styles.curSelect, busy && styles.disabled]}
          >
            <Text style={styles.curSelectText} numberOfLines={1}>
              {selectedCountry ? t(selectedCountry.name) : t('Choisir…')}
            </Text>
            <ChevronDownIcon size={14} color={INK.doux} />
          </TouchableOpacity>
        </View>

        <View style={styles.curCol}>
          <Text style={styles.curLabel}>{t('Devise')}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("Devise d'affichage")}
            disabled={busy}
            onPress={() => setSheet('currency')}
            style={[styles.curSelect, busy && styles.disabled]}
          >
            <Text style={styles.curSelectText} numberOfLines={1}>
              {activeCurrency} ({CURRENCIES[activeCurrency][0]}) · {t(CURRENCY_LABELS[activeCurrency])}
            </Text>
            <ChevronDownIcon size={14} color={INK.doux} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sheetNote}>
        {t("Solde, mises et gains s'affichent dans cette devise.")}
      </Text>

      {/* Préférences : Langue */}
      <View style={styles.prefRow}>
        <Text style={styles.prefLabel}>{t('Langue')}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('Langue')}
          onPress={() => setSheet('lang')}
          style={styles.langBtn}
        >
          <Text style={styles.curSelectText}>{selectedLang.label}</Text>
          <ChevronDownIcon size={14} color={INK.doux} />
        </TouchableOpacity>
      </View>

      {/* Préférences : Réduire les animations */}
      <TouchableOpacity
        accessibilityRole="switch"
        accessibilityState={{ checked: calm }}
        onPress={onToggleCalm}
        style={styles.prefRow}
      >
        <Text style={styles.prefLabel}>{t('Réduire les animations')}</Text>
        <View style={calm ? styles.calmOn : styles.calmOff}>
          <View style={styles.calmKnob} />
        </View>
      </TouchableOpacity>

      {/* Déconnexion */}
      <Btn variant="ghost" onPress={onLogout} style={styles.logoutBtn}>
        <LogoutIcon size={16} color={INK.baisse} />
        <Text style={styles.logoutText}>{t('Se déconnecter')}</Text>
      </Btn>

      {/* Panneau : Ajouter au solde */}
      <BottomSheet
        open={sheet === 'deposit'}
        onClose={() => setSheet(null)}
        title={t('Ajouter au solde')}
      >
        <View style={styles.sheetList}>
          {CONFIG.DEPOSIT_OPTIONS.map((v) => (
            <Btn
              key={v}
              variant="card"
              disabled={busy}
              onPress={() =>
                runAction(
                  () => apiDeposit(v),
                  t('+{amt} ajoutés.', { amt: money(v, null, currency, lang) })
                )
              }
              style={styles.optBtn}
            >
              <PlusIcon size={20} color={INK.texte} />
              <Text style={styles.optBtnText}>{money(v, null, currency, lang)}</Text>
            </Btn>
          ))}
          <Text style={styles.sheetNote}>
            {t("Fonds d'entraînement. Aucun paiement réel, jamais.")}
          </Text>
        </View>
      </BottomSheet>

      {/* Panneau : Retirer du solde */}
      <BottomSheet
        open={sheet === 'withdraw'}
        onClose={() => setSheet(null)}
        title={t('Retirer du solde')}
      >
        <View style={styles.sheetList}>
          {CONFIG.WITHDRAW_OPTIONS.map((v) => (
            <Btn
              key={v}
              variant="card"
              disabled={busy}
              onPress={() =>
                runAction(
                  () => apiWithdraw(v),
                  t('-{amt} retirés.', { amt: money(v, null, currency, lang) })
                )
              }
              style={styles.optBtn}
            >
              <MinusIcon size={20} color={INK.texte} />
              <Text style={styles.optBtnText}>{money(v, null, currency, lang)}</Text>
            </Btn>
          ))}
          <Text style={styles.sheetNote}>{t('Pour te fixer une limite de jeu.')}</Text>
        </View>
      </BottomSheet>

      {/* Panneau : Pays */}
      <SelectSheet
        open={sheet === 'country'}
        onClose={() => setSheet(null)}
        title={t('Pays')}
        options={COUNTRIES.map((c) => ({ value: c.code, label: t(c.name) }))}
        selectedValue={user && user.country}
        onSelect={(code) =>
          runAction(() => apiSetCurrency({ country: code }), t('Pays et devise mis à jour.'))
        }
      />

      {/* Panneau : Devise */}
      <SelectSheet
        open={sheet === 'currency'}
        onClose={() => setSheet(null)}
        title={t('Devise')}
        options={Object.keys(CURRENCIES).map((code) => ({
          value: code,
          label: `${code} (${CURRENCIES[code][0]}) · ${t(CURRENCY_LABELS[code])}`,
        }))}
        selectedValue={activeCurrency}
        onSelect={(code) =>
          runAction(() => apiSetCurrency({ currency: code }), t('Devise mise à jour.'))
        }
      />

      {/* Panneau : Langue */}
      <SelectSheet
        open={sheet === 'lang'}
        onClose={() => setSheet(null)}
        title={t('Langue')}
        options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
        selectedValue={lang}
        onSelect={setLang}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: INK.fond,
  },
  root: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: INK.texte,
  },
  idCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    padding: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: INK.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  acctMain: {
    flex: 1,
    minWidth: 0,
  },
  mail: {
    fontSize: 13,
    fontWeight: '700',
    color: INK.texte,
  },
  balance: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '800',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
  msgOk: {
    borderRadius: 12,
    backgroundColor: 'rgba(12,175,86,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  msgOkText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
    color: INK.hausse,
  },
  msgErr: {
    borderRadius: 12,
    backgroundColor: 'rgba(229,93,79,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  msgErrText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
    color: INK.baisse,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bigBtn: {
    flex: 1,
    minHeight: 52,
  },
  bigBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: INK.texte,
  },
  curBox: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    padding: 10,
  },
  curCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  curLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: INK.doux,
  },
  curSelect: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.puce,
    paddingHorizontal: 8,
  },
  langBtn: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.puce,
    paddingHorizontal: 10,
  },
  curSelectText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: INK.texte,
  },
  disabled: {
    opacity: 0.5,
  },
  sheetNote: {
    textAlign: 'center',
    fontSize: 11,
    color: INK.doux,
  },
  prefRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    paddingHorizontal: 12,
  },
  prefLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: INK.texte,
  },
  calmOn: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: INK.hausse,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  calmOff: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: INK.ligne,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  calmKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  logoutBtn: {
    minHeight: 48,
    borderColor: 'rgba(229,93,79,0.5)',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: INK.baisse,
  },
  sheetList: {
    gap: 8,
    paddingBottom: 8,
  },
  optBtn: {
    width: '100%',
  },
  optBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
});
