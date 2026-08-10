/**
 * Comiket Circle Tracker Sync - Popup Interface Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  function setSafeHTML(element, htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    element.replaceChildren(...doc.body.childNodes);
  }

  // Apply i18n translations to elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach((elem) => {
    const key = elem.getAttribute('data-i18n');
    const msg = extAPI.getMessage(key);
    if (msg) elem.textContent = msg;
  });

  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  const manualText = document.getElementById('manual-text');
  const parsedPreview = document.getElementById('parsed-preview');
  const previewDaySpace = document.getElementById('preview-day-space');
  const previewDetails = document.getElementById('preview-details');
  const btnManualSync = document.getElementById('btn-manual-sync');

  const detectedCount = document.getElementById('detected-count');
  const detectedList = document.getElementById('detected-list');

  const statD1 = document.getElementById('stat-d1');
  const statD2 = document.getElementById('stat-d2');
  const statYen = document.getElementById('stat-yen');

  const btnExportCSV = document.getElementById('btn-export-csv');
  const btnCopyTSV = document.getElementById('btn-copy-tsv');
  const btnExportJSON = document.getElementById('btn-export-json');
  const btnClearList = document.getElementById('btn-clear-items');

  const btnOpenImport = document.getElementById('btn-open-import');
  const importModalBackdrop = document.getElementById('import-modal-backdrop');
  const btnCloseImport = document.getElementById('btn-close-import');
  const btnCancelImport = document.getElementById('btn-cancel-import');
  const btnSubmitImport = document.getElementById('btn-submit-import');
  const importText = document.getElementById('import-text');

  const linkOptions = document.getElementById('link-options');
  const linkSheet = document.getElementById('link-sheet');

  let currentParsed = null;

  // 1. Tab Switching Logic
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');

      if (targetId === 'page-tab') scanActivePage();
      if (targetId === 'stats-tab') refreshStats();
    });
  });

  // 2. Real-time Manual Text Parser
  manualText.addEventListener('input', () => {
    const text = manualText.value.trim();
    if (!text) {
      parsedPreview.style.display = 'none';
      btnManualSync.disabled = true;
      currentParsed = null;
      return;
    }

    currentParsed = ComiketParser.parse(text);
    if (currentParsed) {
      const fullLoc = currentParsed.fullLocation || `${currentParsed.dayCode || 'D1'} ${currentParsed.building} ${currentParsed.block}-${currentParsed.spaceNum}`;
      previewDaySpace.textContent = fullLoc;
      previewDetails.textContent = `Circle: ${currentParsed.circleName} | Price: ${currentParsed.price ? '¥' + currentParsed.price : 'TBD'}`;
      parsedPreview.style.display = 'block';
      btnManualSync.disabled = false;
    } else {
      parsedPreview.style.display = 'none';
      btnManualSync.disabled = true;
    }
  });

  // Save manual item
  btnManualSync.addEventListener('click', async () => {
    if (!currentParsed) return;
    btnManualSync.disabled = true;
    btnManualSync.textContent = 'Saving...';

    const res = await extAPI.runtime.sendMessage({
      action: 'SAVE_CIRCLE',
      data: currentParsed
    });

    if (res && res.success) {
      manualText.value = '';
      parsedPreview.style.display = 'none';
      btnManualSync.textContent = res.isUpdate ? '✅ Updated Circle!' : '✅ Saved to Comiket Plan!';
      setTimeout(() => {
        const iconSpan = document.createElement('span');
        iconSpan.textContent = '💾 ';
        const textSpan = document.createElement('span');
        textSpan.textContent = extAPI.getMessage('btnSaveCircle', 'Save Circle to Plan');
        btnManualSync.replaceChildren(iconSpan, textSpan);
      }, 2500);
      refreshStats();
    } else {
      btnManualSync.textContent = '⚠️ Save Failed';
      btnManualSync.disabled = false;
    }
  });

  // 3. Page Inspector Scanner
  async function scanActivePage() {
    detectedCount.textContent = 'Scanning current page...';
    detectedList.replaceChildren();

    try {
      const res = await extAPI.runtime.sendMessage({ action: 'GET_ALL_ITEMS' });
      const savedItems = res?.items || [];

      const [tab] = await extAPI.raw.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        detectedCount.textContent = 'No active tab detected.';
        return;
      }

      extAPI.raw.tabs.sendMessage(tab.id, { action: 'PARSE_ACTIVE_PAGE' }, (response) => {
        if (extAPI.raw.runtime.lastError || !response) {
          detectedCount.textContent = 'Open an X (Twitter) page to inspect circle posts.';
          return;
        }

        if (response.count === 0) {
          detectedCount.textContent = 'No Comiket circle posts detected on this view.';
          return;
        }

        detectedCount.textContent = `Found ${response.count} Comiket circle target(s)!`;

        response.items.forEach((item) => {
          const card = document.createElement('div');
          card.className = 'card';
          card.style.display = 'flex';
          card.style.alignItems = 'center';
          card.style.justifyContent = 'space-between';
          card.style.margin = '0';
          card.style.padding = '8px 12px';

          const infoDiv = document.createElement('div');
          const nameDiv = document.createElement('div');
          nameDiv.style.fontWeight = '700';
          nameDiv.style.color = '#fff';
          nameDiv.style.fontSize = '13px';
          nameDiv.textContent = item.circleName;

          const locDiv = document.createElement('div');
          locDiv.style.fontSize = '11px';
          locDiv.style.color = '#94a3b8';
          const fullLoc = item.fullLocation || `${item.dayCode || 'D1'} ${item.building || item.hall} ${item.block}-${item.spaceNum || item.space}`;
          locDiv.textContent = fullLoc;

          infoDiv.appendChild(nameDiv);
          infoDiv.appendChild(locDiv);

          const isAlreadyTracked = savedItems.some((sv) => {
            const sameDay = (sv.dayCode || sv.day) === (item.dayCode || item.day);
            const sameSpace = (sv.spaceNum || sv.space || '').toLowerCase() === (item.spaceNum || item.space || '').toLowerCase();
            return sameDay && sameSpace;
          });

          const addBtn = document.createElement('button');
          addBtn.className = 'btn-secondary cmt-add-btn';
          addBtn.style.padding = '4px 10px';
          addBtn.style.fontSize = '11px';
          if (isAlreadyTracked) {
            addBtn.textContent = '✅ Tracked';
            addBtn.style.borderColor = '#10b981';
            addBtn.style.color = '#10b981';
          } else {
            addBtn.textContent = '+ Add';
          }

          addBtn.addEventListener('click', async () => {
            addBtn.disabled = true;
            addBtn.textContent = 'Saving...';
            const saveRes = await extAPI.runtime.sendMessage({ action: 'SAVE_CIRCLE', data: item });
            if (saveRes && saveRes.success) {
              addBtn.textContent = saveRes.isUpdate ? '✅ Updated' : '✅ Saved';
              addBtn.style.borderColor = '#10b981';
              addBtn.style.color = '#10b981';
            } else {
              addBtn.textContent = 'Failed';
            }
          });

          card.appendChild(infoDiv);
          card.appendChild(addBtn);
          detectedList.appendChild(card);
        });
      });
    } catch (err) {
      detectedCount.textContent = 'Inspector error: ' + err.message;
    }
  }

  // 4. Saved Circles & Stats
  async function refreshStats() {
    const res = await extAPI.runtime.sendMessage({ action: 'GET_ALL_ITEMS' });
    const items = res?.items || [];

    let d1Count = 0;
    let d2Count = 0;
    let totalYen = 0;

    items.forEach((it) => {
      if (it.day === 'Day 1' || it.dayCode === 'D1') d1Count++;
      if (it.day === 'Day 2' || it.dayCode === 'D2') d2Count++;
      if (it.price) totalYen += Number(it.price);
    });

    statD1.textContent = d1Count;
    statD2.textContent = d2Count;
    statYen.textContent = `¥${totalYen.toLocaleString()}`;
  }

  // 5. Google Sheet Import Modal Logic
  btnOpenImport.addEventListener('click', () => {
    importText.value = '';
    importModalBackdrop.style.display = 'flex';
  });

  const closeImportModal = () => {
    importModalBackdrop.style.display = 'none';
  };

  btnCloseImport.addEventListener('click', closeImportModal);
  btnCancelImport.addEventListener('click', closeImportModal);

  btnSubmitImport.addEventListener('click', async () => {
    const rawText = importText.value.trim();
    if (!rawText) return alert('Please paste copied table cells or CSV text first!');

    btnSubmitImport.disabled = true;
    btnSubmitImport.textContent = 'Importing...';

    const parsedItems = ComiketExporter.parseTableData(rawText);
    if (parsedItems.length === 0) {
      alert('Could not parse any valid circle rows from the pasted text.');
      btnSubmitImport.disabled = false;
      btnSubmitImport.textContent = 'Import & Sync';
      return;
    }

    const res = await extAPI.runtime.sendMessage({
      action: 'IMPORT_CIRCLES',
      items: parsedItems
    });

    if (res && res.success) {
      alert(`✅ Successfully imported ${res.newCount} new circle(s) and updated ${res.updateCount} existing record(s)!`);
      closeImportModal();
      refreshStats();
    } else {
      alert(`⚠️ Import failed: ${res?.error || 'Unknown error'}`);
    }

    btnSubmitImport.disabled = false;
    btnSubmitImport.textContent = 'Import & Sync';
  });

  // Exporters
  btnExportCSV.addEventListener('click', async () => {
    const res = await extAPI.runtime.sendMessage({ action: 'GET_ALL_ITEMS' });
    const items = res?.items || [];
    if (items.length === 0) return alert('No circles saved yet!');

    const csvContent = ComiketExporter.buildCSV(items);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Comiket_C108_Plan_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  btnCopyTSV.addEventListener('click', async () => {
    const res = await extAPI.runtime.sendMessage({ action: 'GET_ALL_ITEMS' });
    const items = res?.items || [];
    if (items.length === 0) return alert('No circles saved yet!');

    const tsvContent = ComiketExporter.buildTSV(items);
    await navigator.clipboard.writeText(tsvContent);

    const origChildNodes = Array.from(btnCopyTSV.childNodes).map(n => n.cloneNode(true));
    btnCopyTSV.textContent = '✅ Table Copied! Press Ctrl+V in Google Sheets';
    setTimeout(() => {
      btnCopyTSV.replaceChildren(...origChildNodes);
    }, 3000);
  });

  btnExportJSON.addEventListener('click', async () => {
    const res = await extAPI.runtime.sendMessage({ action: 'GET_ALL_ITEMS' });
    const items = res?.items || [];
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Comiket_C108_Plan_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  if (btnClearList) {
    btnClearList.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all saved circles?')) {
        await extAPI.runtime.sendMessage({ action: 'CLEAR_ITEMS' });
        refreshStats();
      }
    });
  }

  // Footer Navigation Links
  linkOptions.addEventListener('click', () => {
    if (extAPI.raw.runtime && extAPI.raw.runtime.openOptionsPage) {
      extAPI.raw.runtime.openOptionsPage();
    } else {
      extAPI.tabs.create({ url: 'options/options.html' });
    }
  });

  linkSheet.addEventListener('click', async () => {
    const saved = await extAPI.storage.get(['dedicatedSheetUrl']);
    if (saved.dedicatedSheetUrl) {
      extAPI.tabs.create({ url: saved.dedicatedSheetUrl });
    } else if (extAPI.raw.runtime && extAPI.raw.runtime.openOptionsPage) {
      extAPI.raw.runtime.openOptionsPage();
    } else {
      extAPI.tabs.create({ url: 'options/options.html' });
    }
  });

  refreshStats();
});
