/**
 * Comiket Circle Tracker Sync - Extension Options Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const comiketInfo = typeof ComiketParser !== 'undefined' ? ComiketParser.getCurrentComiketInfo() : { day1Label: 'Day 1 (Aug 15)', day2Label: 'Day 2 (Aug 16)' };

  const enableExtInput = document.getElementById('opt-enable-ext');
  const urlInput = document.getElementById('opt-url');
  const sheetUrlInput = document.getElementById('opt-sheet-url');
  const priorityInput = document.getElementById('opt-priority');
  const dayInput = document.getElementById('opt-day');
  const showImgInput = document.getElementById('opt-show-img');
  const includeDescInput = document.getElementById('opt-include-desc');

  if (dayInput && dayInput.options.length >= 2) {
    dayInput.options[0].text = comiketInfo.day1Label;
    dayInput.options[1].text = comiketInfo.day2Label;
  }

  const btnSave = document.getElementById('btn-save');
  const btnOpenSheet = document.getElementById('btn-open-sheet');
  const statusMsg = document.getElementById('status-msg');

  // Load existing options
  const savedData = await extAPI.storage.get([
    'extensionEnabled',
    'webAppUrl',
    'dedicatedSheetUrl',
    'defaultPriority',
    'defaultDay',
    'showImagePreview',
    'includeDescription'
  ]);

  enableExtInput.checked = savedData.extensionEnabled !== false; // Default true
  if (savedData.webAppUrl) urlInput.value = savedData.webAppUrl;
  if (savedData.dedicatedSheetUrl) sheetUrlInput.value = savedData.dedicatedSheetUrl;

  if (savedData.defaultPriority) priorityInput.value = savedData.defaultPriority;
  if (savedData.defaultDay) dayInput.value = savedData.defaultDay;
  showImgInput.checked = savedData.showImagePreview === true; // Default false
  includeDescInput.checked = savedData.includeDescription !== false; // Default true

  function showStatus(msg, type = 'success') {
    statusMsg.className = `status-msg ${type}`;
    statusMsg.innerText = msg;
    setTimeout(() => {
      statusMsg.className = 'status-msg';
    }, 4000);
  }

  // Save display & content preferences
  btnSave.addEventListener('click', async () => {
    const extensionEnabled = enableExtInput.checked;
    const webAppUrl = urlInput.value.trim();
    const dedicatedSheetUrl = sheetUrlInput.value.trim();
    const defaultPriority = priorityInput.value;
    const defaultDay = dayInput.value;
    const showImagePreview = showImgInput.checked;
    const includeDescription = includeDescInput.checked;

    await extAPI.storage.set({
      extensionEnabled,
      webAppUrl,
      dedicatedSheetUrl,
      defaultPriority,
      defaultDay,
      showImagePreview,
      includeDescription
    });

    showStatus('Settings saved successfully!', 'success');
  });

  // Open Sheet link
  btnOpenSheet.addEventListener('click', () => {
    const url = sheetUrlInput.value.trim();
    if (url) {
      extAPI.tabs.create({ url: url });
    } else {
      showStatus('Please paste your Google Sheet URL first.', 'error');
    }
  });
});
