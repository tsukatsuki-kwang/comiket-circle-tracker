/**
 * Comiket Circle Tracker Sync - Background Service Worker (Manifest V3)
 * Handles local storage, Google Sheets API OAuth sync, and export actions.
 */

importScripts('../src/utils/browser-poly.js');
importScripts('../src/utils/exporter.js');

console.log('[Comiket Tracker] Service worker registered.');

extAPI.raw.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SAVE_CIRCLE') {
    handleSaveCircle(message.data)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'CONNECT_GOOGLE_ACCOUNT') {
    handleGoogleAccountConnect()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'GET_ALL_ITEMS') {
    extAPI.storage.get(['circleItems']).then((res) => {
      sendResponse({ items: res.circleItems || [] });
    });
    return true;
  }

  if (message.action === 'CLEAR_ITEMS') {
    extAPI.storage.set({ circleItems: [] }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

/**
 * Handles Google Account Sign-In via chrome.identity
 */
async function handleGoogleAccountConnect() {
  if (!extAPI.raw.identity) {
    return { success: false, error: 'Google Identity API is not available on this browser build.' };
  }

  return new Promise((resolve) => {
    extAPI.raw.identity.getAuthToken({ interactive: true }, async (token) => {
      if (extAPI.raw.runtime.lastError || !token) {
        const errStr = extAPI.raw.runtime.lastError?.message || 'Authentication canceled';
        if (errStr.includes('OAuth2 Client ID') || errStr.includes('invalid client')) {
          return resolve({
            success: false,
            error: 'Google OAuth Client ID not configured in manifest. You can paste your Google Sheet URL directly or use 1-click Ctrl+V copying / Web App sync!'
          });
        }
        return resolve({ success: false, error: errStr });
      }

      try {
        const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            properties: {
              title: 'Comiket 108 Strategy Plan'
            },
            sheets: [
              {
                properties: {
                  title: 'Circle Targets'
                }
              }
            ]
          })
        });

        const sheetData = await createRes.json();
        if (!sheetData.spreadsheetId) {
          return resolve({ success: false, error: sheetData.error?.message || 'Failed to create sheet' });
        }

        const spreadsheetId = sheetData.spreadsheetId;
        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Circle Targets!A1:N1?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [
              ['Day', 'Priority', 'Building', 'Block', 'Space', 'Circle Name', 'Artist / Author', 'Sample Image', 'Item Description', 'Price (JPY)', 'Tweet Link', 'Shop Link', 'Notes', 'Added At']
            ]
          })
        });

        await extAPI.storage.set({
          googleAuthToken: token,
          dedicatedSheetId: spreadsheetId,
          dedicatedSheetUrl: spreadsheetUrl
        });

        resolve({ success: true, sheetId: spreadsheetId, sheetUrl: spreadsheetUrl });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  });
}

/**
 * Saves circle data locally and syncs to Google Sheet if connected.
 */
async function handleSaveCircle(circleData) {
  const { webAppUrl, circleItems = [], googleAuthToken, dedicatedSheetId } = await extAPI.storage.get([
    'webAppUrl',
    'circleItems',
    'googleAuthToken',
    'dedicatedSheetId'
  ]);

  // 1. Save locally
  const existingIdx = circleItems.findIndex((item) => item.space === circleData.space);
  let updatedItems = [...circleItems];

  if (existingIdx >= 0) {
    updatedItems[existingIdx] = circleData;
  } else {
    updatedItems.unshift(circleData);
  }

  await extAPI.storage.set({ circleItems: updatedItems });

  let syncNote = 'Saved locally to your Comiket Plan list.';

  // 2. Direct Google Sheets API v4 Sync if token is active
  if (googleAuthToken && dedicatedSheetId) {
    try {
      const imageFormula = circleData.imageUrl ? `=IMAGE("${circleData.imageUrl}")` : '';
      const tweetFormula = circleData.sourceUrl ? `=HYPERLINK("${circleData.sourceUrl}", "View Tweet")` : '';
      const shopFormula = circleData.shopUrl ? `=HYPERLINK("${circleData.shopUrl}", "Shop / Order")` : '';

      const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${dedicatedSheetId}/values/Circle Targets!A:N:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [
            [
              circleData.day || 'Day 1',
              circleData.priority || 'P2 (Medium)',
              circleData.building || circleData.hall || '',
              circleData.block || '',
              circleData.spaceNum || circleData.space || '',
              circleData.circleName || '',
              circleData.artist || '',
              imageFormula,
              circleData.description || '',
              circleData.price ? Number(circleData.price) : '',
              tweetFormula || circleData.sourceUrl || '',
              shopFormula || circleData.shopUrl || '',
              circleData.notes || 'Imported via Extension',
              new Date().toISOString()
            ]
          ]
        })
      });

      if (appendRes.ok) {
        syncNote = 'Saved locally & appended directly to your dedicated Google Sheet!';
      }
    } catch (e) {
      console.warn('[Comiket Tracker] Direct Google Sheet API sync optional failure:', e);
    }
  } else if (webAppUrl) {
    // 3. Fallback Web App Cloud Sync if configured
    try {
      await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(circleData)
      });
      syncNote = 'Saved locally & synced to Google Sheet Web App!';
    } catch (e) {
      console.warn('[Comiket Tracker] Web App sync optional failure:', e);
    }
  }

  return { success: true, count: updatedItems.length, syncNote: syncNote };
}
