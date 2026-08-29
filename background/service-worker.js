/**
 * Comiket Circle Tracker Sync - Background Service Worker (Manifest V3)
 * Handles local storage, Google Sheets API OAuth sync, and export/import actions with 3-Day Comiket support.
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

  if (message.action === 'IMPORT_CIRCLES') {
    handleImportCircles(message.items)
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

function normalizeStr(str) {
  return (str || '').toLowerCase().trim().replace(/[\s\(\)\@＠]/g, '');
}

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
              title: 'Comiket Master Sheet'
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

        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Circle Targets!A1:L1?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [
              ['Circle', 'Product', 'Day 1 Position', 'Day 2 Position', 'Day 3 Position', 'Priority', 'Price (¥)', 'Sample Image', 'Tweet Link', 'Web Purchase', 'Status', 'Note']
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
 * Saves circle data locally with strict duplication check (Day 1 + Day 2 + Day 3 + Artist exact match).
 */
async function handleSaveCircle(circleData) {
  const { webAppUrl, circleItems = [], googleAuthToken, dedicatedSheetId } = await extAPI.storage.get([
    'webAppUrl',
    'circleItems',
    'googleAuthToken',
    'dedicatedSheetId'
  ]);

  const targetArtist = normalizeStr(circleData.artist || circleData.circleName);
  const targetD1 = normalizeStr(circleData.day1Location);
  const targetD2 = normalizeStr(circleData.day2Location);
  const targetD3 = normalizeStr(circleData.day3Location);

  const targetDay = circleData.dayCode || (circleData.day && circleData.day.includes('3') ? 'D3' : (circleData.day && circleData.day.includes('2') ? 'D2' : 'D1'));
  const targetLoc = normalizeStr(circleData.fullLocation || circleData.space);

  const existingIdx = circleItems.findIndex((savedItem) => {
    const savedArtist = normalizeStr(savedItem.artist || savedItem.circleName);
    if (!savedArtist || !targetArtist) return false;

    const artistMatches = savedArtist === targetArtist || savedArtist.includes(targetArtist) || targetArtist.includes(savedArtist);
    if (!artistMatches) return false;

    const savedD1 = normalizeStr(savedItem.day1Location);
    const savedD2 = normalizeStr(savedItem.day2Location);
    const savedD3 = normalizeStr(savedItem.day3Location);

    if (targetD1 && targetD2 && targetD3 && savedD1 && savedD2 && savedD3) {
      return savedD1 === targetD1 && savedD2 === targetD2 && savedD3 === targetD3;
    }

    const savedDay = savedItem.dayCode || (savedItem.day && savedItem.day.includes('3') ? 'D3' : (savedItem.day && savedItem.day.includes('2') ? 'D2' : 'D1'));
    const savedLoc = normalizeStr(savedItem.fullLocation || savedItem.space);

    return savedDay === targetDay && savedLoc === targetLoc;
  });

  let updatedItems = [...circleItems];
  let isUpdate = false;

  if (existingIdx >= 0) {
    updatedItems[existingIdx] = circleData;
    isUpdate = true;
  } else {
    updatedItems.unshift(circleData);
  }

  await extAPI.storage.set({ circleItems: updatedItems });

  let syncNote = isUpdate ? 'Updated existing circle entry in your Comiket Plan.' : 'Saved locally to your Comiket Plan list.';

  const dayCode = targetDay;
  const building = circleData.building || circleData.hall || '東123';
  const block = circleData.block || '';
  const space = circleData.spaceNum || circleData.space || '';
  const fullLoc = circleData.fullLocation || `${dayCode} ${building} ${block ? block + '-' : ''}${space}`.trim();

  const day1Loc = circleData.day1Location || (dayCode === 'D1' ? fullLoc : '');
  const day2Loc = circleData.day2Location || (dayCode === 'D2' ? fullLoc : '');
  const day3Loc = circleData.day3Location || (dayCode === 'D3' ? fullLoc : '');

  // Direct Google Sheets API v4 Sync if token is active
  if (googleAuthToken && dedicatedSheetId) {
    try {
      const imageFormula = circleData.imageUrl ? `=IMAGE("${circleData.imageUrl}")` : '';
      const tweetFormula = circleData.sourceUrl ? `=HYPERLINK("${circleData.sourceUrl}", "View Tweet")` : '';
      const shopFormula = circleData.shopUrl ? `=HYPERLINK("${circleData.shopUrl}", "Shop / Order")` : '';

      const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${dedicatedSheetId}/values/Circle Targets!A:L:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [
            [
              circleData.circleName || 'Unknown Circle',
              circleData.description || circleData.product || '',
              day1Loc,
              day2Loc,
              day3Loc,
              circleData.priority || 'P2 (Medium)',
              circleData.price ? Number(circleData.price) : '',
              imageFormula,
              tweetFormula || circleData.sourceUrl || '',
              shopFormula || circleData.shopUrl || '',
              circleData.status || 'Pending',
              circleData.notes || 'Imported via Extension'
            ]
          ]
        })
      });

      if (appendRes.ok) {
        syncNote = isUpdate ? 'Updated locally & synced to Google Sheet!' : 'Saved locally & appended to Google Sheet!';
      }
    } catch (e) {
      console.warn('[Comiket Tracker] Direct Google Sheet API sync optional failure:', e);
    }
  } else if (webAppUrl) {
    // Fallback Web App Cloud Sync if configured
    try {
      await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(circleData)
      });
      syncNote = isUpdate ? 'Updated locally & synced to Web App!' : 'Saved locally & synced to Web App!';
    } catch (e) {
      console.warn('[Comiket Tracker] Web App sync optional failure:', e);
    }
  }

  return { success: true, count: updatedItems.length, isUpdate: isUpdate, syncNote: syncNote };
}

/**
 * Imports an array of circle target items from Google Sheet into local storage with 3-Day Comiket support.
 */
async function handleImportCircles(itemsToImport) {
  if (!Array.isArray(itemsToImport) || itemsToImport.length === 0) {
    return { success: false, error: 'No valid items to import.' };
  }

  const { circleItems = [] } = await extAPI.storage.get(['circleItems']);
  let updatedItems = [...circleItems];
  let newCount = 0;
  let updateCount = 0;

  for (const item of itemsToImport) {
    const targetArtist = normalizeStr(item.artist || item.circleName);
    const targetD1 = normalizeStr(item.day1Location);
    const targetD2 = normalizeStr(item.day2Location);
    const targetD3 = normalizeStr(item.day3Location);

    const targetDay = item.dayCode || (item.day && item.day.includes('3') ? 'D3' : (item.day && item.day.includes('2') ? 'D2' : 'D1'));
    const targetLoc = normalizeStr(item.fullLocation || item.space);

    const existingIdx = updatedItems.findIndex((savedItem) => {
      const savedArtist = normalizeStr(savedItem.artist || savedItem.circleName);
      if (!savedArtist || !targetArtist) return false;

      const artistMatches = savedArtist === targetArtist || savedArtist.includes(targetArtist) || targetArtist.includes(savedArtist);
      if (!artistMatches) return false;

      const savedD1 = normalizeStr(savedItem.day1Location);
      const savedD2 = normalizeStr(savedItem.day2Location);
      const savedD3 = normalizeStr(savedItem.day3Location);

      if (targetD1 && targetD2 && targetD3 && savedD1 && savedD2 && savedD3) {
        return savedD1 === targetD1 && savedD2 === targetD2 && savedD3 === targetD3;
      }

      const savedDay = savedItem.dayCode || (savedItem.day && savedItem.day.includes('3') ? 'D3' : (savedItem.day && savedItem.day.includes('2') ? 'D2' : 'D1'));
      const savedLoc = normalizeStr(savedItem.fullLocation || savedItem.space);

      return savedDay === targetDay && savedLoc === targetLoc;
    });

    if (existingIdx >= 0) {
      updatedItems[existingIdx] = { ...updatedItems[existingIdx], ...item };
      updateCount++;
    } else {
      updatedItems.unshift(item);
      newCount++;
    }
  }

  await extAPI.storage.set({ circleItems: updatedItems });
  return { success: true, total: updatedItems.length, newCount, updateCount };
}
