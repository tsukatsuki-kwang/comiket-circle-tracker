/**
 * Comiket Circle Tracker Sync - Cross-Browser Extension API Adapter
 * Standardizes chrome.* and browser.* APIs with context invalidation safety & bilingual i18n support.
 */

(function (global) {
  const isFirefox = typeof browser !== 'undefined' && typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.getManifest;

  function isContextValid() {
    try {
      return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  function isJapaneseEnv() {
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage) {
        const lang = chrome.i18n.getUILanguage();
        if (lang && lang.toLowerCase().startsWith('ja')) return true;
      }
      if (typeof navigator !== 'undefined' && navigator.language) {
        if (navigator.language.toLowerCase().startsWith('ja')) return true;
      }
    } catch (e) {
      // Fallback
    }
    return false;
  }

  /**
   * Formats text as Japanese (English) if browser language is Japanese,
   * otherwise Formats text as English (Japanese).
   */
  function getBilingualText(enText, jaText) {
    if (!jaText) return enText;
    if (!enText) return jaText;
    if (isJapaneseEnv()) {
      return `${jaText} (${enText})`;
    } else {
      return `${enText} (${jaText})`;
    }
  }

  function getMessage(key, defaultText = '') {
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
        const msg = chrome.i18n.getMessage(key);
        if (msg) return msg;
      }
      if (typeof browser !== 'undefined' && browser.i18n && browser.i18n.getMessage) {
        const msg = browser.i18n.getMessage(key);
        if (msg) return msg;
      }
    } catch (e) {
      // Fallback
    }
    return defaultText || key;
  }

  const extAPI = {
    isFirefox: isFirefox,
    isContextValid: isContextValid,
    isJapaneseEnv: isJapaneseEnv,
    getBilingualText: getBilingualText,
    getMessage: getMessage,
    storage: {
      get: (keys) => {
        return new Promise((resolve) => {
          try {
            if (!isContextValid()) return resolve({});
            if (isFirefox && typeof browser !== 'undefined' && browser.storage) {
              browser.storage.local.get(keys).then(resolve).catch(() => resolve({}));
            } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              chrome.storage.local.get(keys, (result) => {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                  return resolve({});
                }
                resolve(result || {});
              });
            } else {
              resolve({});
            }
          } catch (e) {
            resolve({});
          }
        });
      },
      set: (items) => {
        return new Promise((resolve) => {
          try {
            if (!isContextValid()) return resolve({});
            if (isFirefox && typeof browser !== 'undefined' && browser.storage) {
              browser.storage.local.set(items).then(resolve).catch(() => resolve({}));
            } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set(items, () => {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                  return resolve({});
                }
                resolve();
              });
            } else {
              resolve();
            }
          } catch (e) {
            resolve();
          }
        });
      }
    },
    runtime: {
      sendMessage: (message) => {
        return new Promise((resolve) => {
          try {
            if (!isContextValid()) return resolve({ success: false, error: 'Extension context invalidated. Please refresh page.' });
            if (isFirefox && typeof browser !== 'undefined' && browser.runtime) {
              browser.runtime.sendMessage(message).then(resolve).catch((err) => resolve({ success: false, error: err.message }));
            } else if (typeof chrome !== 'undefined' && chrome.runtime) {
              chrome.runtime.sendMessage(message, (response) => {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                  return resolve({ success: false, error: chrome.runtime.lastError.message });
                }
                resolve(response || { success: true });
              });
            } else {
              resolve({ success: false, error: 'Runtime API unavailable' });
            }
          } catch (e) {
            resolve({ success: false, error: e.message });
          }
        });
      }
    },
    tabs: {
      create: (createProperties) => {
        try {
          if (!isContextValid()) return;
          if (isFirefox && typeof browser !== 'undefined' && browser.tabs) {
            browser.tabs.create(createProperties);
          } else if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.create(createProperties);
          }
        } catch (e) {
          console.warn('[Comiket Tracker] Tabs API error:', e);
        }
      }
    },
    raw: typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : {})
  };

  global.extAPI = extAPI;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
