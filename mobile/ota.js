// Mises à jour automatiques OTA (expo-updates, protocole v1 auto-hébergé sur Vercel).
import * as Updates from 'expo-updates';

export function isOtaEnabled() {
  try {
    return Boolean(Updates && Updates.isEnabled && typeof Updates.checkForUpdateAsync === 'function');
  } catch {
    return false;
  }
}

export function getOtaInfo() {
  try {
    return {
      enabled: isOtaEnabled(),
      runtimeVersion: (Updates && Updates.runtimeVersion) || '1.0.0',
      updateId: (Updates && Updates.updateId) || null,
      createdAt: (Updates && Updates.createdAt) || null,
      isEmbeddedLaunch: Boolean(!Updates || Updates.isEmbeddedLaunch !== false),
    };
  } catch {
    return {
      enabled: false,
      runtimeVersion: '1.0.0',
      updateId: null,
      createdAt: null,
      isEmbeddedLaunch: true,
    };
  }
}

/**
 * Vérifie si une mise à jour OTA est disponible et la télécharge en arrière-plan.
 * Retourne : { status: 'disabled' | 'up-to-date' | 'downloaded' | 'error', error?: string }
 */
export async function checkAndFetchOta() {
  if (!isOtaEnabled()) {
    return { status: 'disabled' };
  }
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check || !check.isAvailable) {
      return { status: 'up-to-date' };
    }
    const fetched = await Updates.fetchUpdateAsync();
    if (fetched && fetched.isNew === false) {
      return { status: 'up-to-date' };
    }
    return { status: 'downloaded' };
  } catch (err) {
    return { status: 'error', error: err && err.message ? err.message : 'Erreur OTA' };
  }
}

export async function applyOtaReload() {
  if (!isOtaEnabled() || typeof Updates.reloadAsync !== 'function') return false;
  await Updates.reloadAsync();
  return true;
}
