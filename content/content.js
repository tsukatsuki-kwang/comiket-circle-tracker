/**
 * Comiket Circle Tracker Sync - Content Script for X (Twitter)
 * Scans tweet cards, author display names, images, and post detail views with real-time duplication tracking & 3-Day Comiket multi-day consolidation.
 * Supports Master Extension Enable/Disable toggle control.
 */

(function () {
  'use strict';

  if (window.__comiketTrackerInjected) return;
  window.__comiketTrackerInjected = true;

  console.log('[Comiket Tracker] Content script active with 3-Day multi-day target consolidation.');

  let savedItemsList = [];
  let extensionEnabled = true;

  async function refreshSavedItems() {
    try {
      const res = await extAPI.storage.get(['circleItems', 'extensionEnabled']);
      savedItemsList = res?.circleItems || [];
      extensionEnabled = res?.extensionEnabled !== false;

      if (!extensionEnabled) {
        clearButtonsFromDOM();
      } else {
        updateExistingButtonsInDOM();
      }
    } catch (e) {
      console.warn('[Comiket Tracker] Failed to refresh saved items:', e);
    }
  }

  function clearButtonsFromDOM() {
    document.querySelectorAll('.comiket-tracker-wrapper').forEach((w) => w.remove());
    document.querySelectorAll('article[data-comiket-processed="true"]').forEach((art) => art.removeAttribute('data-comiket-processed'));
  }

  function updateExistingButtonsInDOM() {
    if (!extensionEnabled) {
      clearButtonsFromDOM();
      return;
    }

    document.querySelectorAll('.comiket-tracker-btn').forEach((btn) => {
      const parsedData = btn.__parsedData;
      if (!parsedData) return;

      const isTracked = isItemTracked(parsedData);
      if (isTracked) {
        btn.style.borderColor = '#10b981';
        btn.style.background = 'rgba(16, 185, 129, 0.12)';
      } else {
        btn.style.borderColor = '#f59e0b';
        btn.style.background = 'rgba(245, 158, 11, 0.12)';
      }

      const iconSpan = btn.querySelector('.cmt-icon');
      if (iconSpan) {
        iconSpan.style.color = isTracked ? '#10b981' : '#f59e0b';
        iconSpan.textContent = isTracked ? '✅' : '⛩️';
      }

      const labelSpan = btn.querySelector('.cmt-label');
      if (labelSpan) {
        labelSpan.textContent = isTracked ? 'Tracked' : '+ Track';
      }
    });
  }

  refreshSavedItems().then(() => {
    scanFeed();
  });

  if (extAPI.raw.storage && extAPI.raw.storage.onChanged) {
    extAPI.raw.storage.onChanged.addListener((changes) => {
      if (changes.extensionEnabled !== undefined) {
        extensionEnabled = changes.extensionEnabled.newValue !== false;
        if (!extensionEnabled) {
          clearButtonsFromDOM();
        } else {
          scanFeed();
        }
      }
      if (changes.circleItems) {
        refreshSavedItems();
      }
    });
  }

  function normalizeStr(str) {
    return (str || '').toLowerCase().trim().replace(/[\s\(\)\@＠]/g, '');
  }

  function getSavedItem(targetItem) {
    if (!targetItem || savedItemsList.length === 0) return null;

    const targetArtist = normalizeStr(targetItem.artist || targetItem.circleName);
    const targetD1 = normalizeStr(targetItem.day1Location);
    const targetD2 = normalizeStr(targetItem.day2Location);
    const targetD3 = normalizeStr(targetItem.day3Location);

    const targetDay = targetItem.dayCode || (targetItem.day && targetItem.day.includes('3') ? 'D3' : (targetItem.day && targetItem.day.includes('2') ? 'D2' : 'D1'));
    const targetLoc = normalizeStr(targetItem.fullLocation || targetItem.space);

    for (const savedItem of savedItemsList) {
      const savedArtist = normalizeStr(savedItem.artist || savedItem.circleName);
      if (!savedArtist || !targetArtist) continue;

      const artistMatches = savedArtist === targetArtist || savedArtist.includes(targetArtist) || targetArtist.includes(savedArtist);
      if (!artistMatches) continue;

      const savedD1 = normalizeStr(savedItem.day1Location);
      const savedD2 = normalizeStr(savedItem.day2Location);
      const savedD3 = normalizeStr(savedItem.day3Location);

      if (targetD1 && targetD2 && targetD3 && savedD1 && savedD2 && savedD3) {
        if (savedD1 === targetD1 && savedD2 === targetD2 && savedD3 === targetD3) {
          return savedItem;
        }
      } else {
        const savedDay = savedItem.dayCode || (savedItem.day && savedItem.day.includes('3') ? 'D3' : (savedItem.day && savedItem.day.includes('2') ? 'D2' : 'D1'));
        const savedLoc = normalizeStr(savedItem.fullLocation || savedItem.space);

        if (savedDay === targetDay && savedLoc === targetLoc) {
          return savedItem;
        }
      }
    }

    return null;
  }

  function isItemTracked(parsed) {
    return getSavedItem(parsed) !== null;
  }

  function setSafeHTML(element, htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    element.replaceChildren(...doc.body.childNodes);
  }

  function showToast(message, type = 'info') {
    const existing = document.querySelector('.comiket-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `comiket-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3500);
  }

  async function openPreviewModal(rawParsedData) {
    if (!extAPI.isContextValid()) {
      showToast('⚠️ Extension updated. Please refresh page (F5).', 'error');
      return;
    }

    const existingModal = document.querySelector('.comiket-modal-backdrop');
    if (existingModal) existingModal.remove();

    const trackedItem = getSavedItem(rawParsedData);
    const isTracked = trackedItem !== null;
    const parsedData = isTracked ? { ...rawParsedData, ...trackedItem } : rawParsedData;

    const settings = await extAPI.storage.get(['showImagePreview', 'defaultPriority']);
    const showImagePreview = settings.showImagePreview === true;

    let selectedPriority = parsedData.priority || 'P2 (Medium)';
    if (!parsedData.priority && settings.defaultPriority && (settings.defaultPriority.startsWith('P0') || settings.defaultPriority.startsWith('P1') || settings.defaultPriority.startsWith('P3'))) {
      selectedPriority = settings.defaultPriority;
    }

    let displayDescription = '';
    if (trackedItem && trackedItem.description && trackedItem.description.trim()) {
      displayDescription = trackedItem.description;
    } else {
      displayDescription = rawParsedData.description || rawParsedData.fullText || parsedData.description || '';
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'comiket-modal-backdrop';

    const imagePreviewHtml = (showImagePreview && parsedData.imageUrl) ? `
      <div class="comiket-image-container" id="cmt-img-container">
        <img src="${escapeHtml(parsedData.imageUrl)}" 
             referrerpolicy="no-referrer" 
             crossorigin="anonymous"
             class="comiket-image-preview" 
             alt="Sample Artwork Preview" 
             onerror="this.parentNode.style.display='none';" />
      </div>
    ` : '';

    const modalTitleText = isTracked 
      ? extAPI.getBilingualText('Update Comiket Circle Target', 'コミケ作戦シートの配置を更新')
      : extAPI.getBilingualText('Add to Comiket Master Sheet', 'コミケ作戦シートに追加');

    const submitBtnText = isTracked 
      ? `💾 ${escapeHtml(extAPI.getBilingualText('Update Circle', '作戦シートを更新'))}`
      : `💾 ${escapeHtml(extAPI.getBilingualText('Save Circle', '作戦シートに保存'))}`;

    const modalHtml = `
      <div class="comiket-modal-card">
        <div class="comiket-modal-header">
          <div class="comiket-modal-title">
            <span style="color: ${isTracked ? '#10b981' : '#f59e0b'};">${isTracked ? '✅' : '⛩️'}</span> ${escapeHtml(modalTitleText)}
          </div>
          <button class="comiket-modal-close" id="cmt-close-btn">&times;</button>
        </div>
        <div class="comiket-modal-body">
          ${imagePreviewHtml}

          <div class="comiket-field-row">
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Day 1 Position', '1日目 配置'))}</label>
              <input type="text" class="comiket-input" id="cmt-day1-loc" value="${escapeHtml(parsedData.day1Location || (parsedData.dayCode === 'D1' ? parsedData.fullLocation : ''))}" placeholder="D1 東123 カ-11a">
            </div>
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Day 2 Position', '2日目 配置'))}</label>
              <input type="text" class="comiket-input" id="cmt-day2-loc" value="${escapeHtml(parsedData.day2Location || (parsedData.dayCode === 'D2' ? parsedData.fullLocation : ''))}" placeholder="D2 西12 あ-45ab (Optional)">
            </div>
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Day 3 Position', '3日目 配置'))}</label>
              <input type="text" class="comiket-input" id="cmt-day3-loc" value="${escapeHtml(parsedData.day3Location || (parsedData.dayCode === 'D3' ? parsedData.fullLocation : ''))}" placeholder="D3 南12 さ-99b (Optional)">
            </div>
          </div>

          <div class="comiket-field-row">
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Priority', '優先度'))}</label>
              <select class="comiket-select" id="cmt-priority">
                <option value="P0 (Top)" ${selectedPriority.includes('P0') ? 'selected' : ''}>${escapeHtml(extAPI.getBilingualText('P0 (Top / Wall Circle)', 'P0 (壁超最優先 / 大壁)'))}</option>
                <option value="P1 (High)" ${selectedPriority.includes('P1') ? 'selected' : ''}>${escapeHtml(extAPI.getBilingualText('P1 (High / Wall Circle)', 'P1 (最優先 / 壁サークル)'))}</option>
                <option value="P2 (Medium)" ${selectedPriority.includes('P2') ? 'selected' : ''}>${escapeHtml(extAPI.getBilingualText('P2 (Medium / Island)', 'P2 (一般 / 島サークル)'))}</option>
                <option value="P3 (Low)" ${selectedPriority.includes('P3') ? 'selected' : ''}>${escapeHtml(extAPI.getBilingualText('P3 (Low / Backup)', 'P3 (予備 / 後回し)'))}</option>
              </select>
            </div>
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Circle Name', 'サークル名'))}</label>
              <input type="text" class="comiket-input" id="cmt-circle" value="${escapeHtml(parsedData.circleName || '')}">
            </div>
          </div>

          <div class="comiket-field-row">
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Artist / Handle', '作者名 / アカウント'))}</label>
              <input type="text" class="comiket-input" id="cmt-artist" value="${escapeHtml(parsedData.artist || '')}">
            </div>
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Est. Price (JPY)', '頒布価格 (円)'))}</label>
              <input type="number" class="comiket-input" id="cmt-price" value="${parsedData.price || ''}">
            </div>
          </div>

          <div class="comiket-field-row">
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Sample Image URL', 'サンプル画像 URL'))}</label>
              <input type="url" class="comiket-input" id="cmt-img-url" value="${escapeHtml(parsedData.imageUrl || '')}" placeholder="https://pbs.twimg.com/media/...">
            </div>
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Tweet Link / Status URL', 'ツイート / ポスト URL'))}</label>
              <input type="url" class="comiket-input" id="cmt-source-url" value="${escapeHtml(parsedData.sourceUrl || window.location.href)}">
            </div>
          </div>

          <div class="comiket-field-group">
            <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('FixupX / CunnyX Share Link', 'FixupX / CunnyX 共有リンク'))}</label>
            <input type="url" class="comiket-input" id="cmt-fixup-url" value="${escapeHtml(parsedData.cunnyUrl || parsedData.fixupUrl || '')}" placeholder="https://cunnyx.com/...">
          </div>

          <div class="comiket-field-group">
            <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Item Description & Post Text', 'お品書き・ポスト本文'))}</label>
            <textarea class="comiket-textarea" id="cmt-desc" placeholder="Post description (Optional)..."></textarea>
          </div>
        </div>
        <div class="comiket-modal-footer">
          <button class="comiket-btn-secondary" id="cmt-cancel-btn">${escapeHtml(extAPI.getBilingualText('Cancel', 'キャンセル'))}</button>
          <button class="comiket-btn-primary" id="cmt-submit-btn">${submitBtnText}</button>
        </div>
      </div>
    `;

    setSafeHTML(backdrop, modalHtml);
    document.body.appendChild(backdrop);

    const descElem = backdrop.querySelector('#cmt-desc');
    if (descElem) {
      descElem.value = displayDescription;
    }

    const closeBtn = backdrop.querySelector('#cmt-close-btn');
    const cancelBtn = backdrop.querySelector('#cmt-cancel-btn');
    const submitBtn = backdrop.querySelector('#cmt-submit-btn');

    const closeModal = () => backdrop.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    submitBtn.addEventListener('click', async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = '💾 Saving...';

      const d1Val = backdrop.querySelector('#cmt-day1-loc').value.trim();
      const d2Val = backdrop.querySelector('#cmt-day2-loc').value.trim();
      const d3Val = backdrop.querySelector('#cmt-day3-loc').value.trim();
      const priorityVal = backdrop.querySelector('#cmt-priority').value;
      const circleVal = backdrop.querySelector('#cmt-circle').value.trim();
      const artistVal = backdrop.querySelector('#cmt-artist').value.trim();
      const priceVal = backdrop.querySelector('#cmt-price').value.trim();
      const imgVal = backdrop.querySelector('#cmt-img-url').value.trim();
      const sourceVal = backdrop.querySelector('#cmt-source-url').value.trim();
      const fixupVal = backdrop.querySelector('#cmt-fixup-url').value.trim();
      const descVal = backdrop.querySelector('#cmt-desc').value.trim();

      const locs = [d1Val, d2Val, d3Val].filter(Boolean);

      const updatedPayload = {
        ...parsedData,
        day1Location: d1Val,
        day2Location: d2Val,
        day3Location: d3Val,
        fullLocation: locs.length > 0 ? locs.join(' / ') : parsedData.fullLocation,
        priority: priorityVal,
        circleName: circleVal || parsedData.circleName,
        artist: artistVal || parsedData.artist,
        price: priceVal ? Number(priceVal) : '',
        imageUrl: imgVal || parsedData.imageUrl,
        sourceUrl: sourceVal || parsedData.sourceUrl,
        fixupUrl: fixupVal || parsedData.fixupUrl,
        cunnyUrl: fixupVal || parsedData.cunnyUrl,
        description: descVal
      };

      try {
        const response = await extAPI.runtime.sendMessage({
          action: 'SAVE_CIRCLE',
          data: updatedPayload
        });

        if (response && response.success) {
          showToast(`✅ ${response.syncNote || 'Saved to Comiket Master Sheet!'}`, 'success');
          closeModal();
          refreshSavedItems();
        } else {
          showToast(`⚠️ Save Failed: ${response?.error || 'Unknown error'}`, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtnText;
        }
      } catch (err) {
        showToast(`⚠️ Extension Error: ${err.message}`, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtnText;
      }
    });
  }

  function processTweet(article) {
    if (!extensionEnabled) {
      const oldWrapper = article.querySelector('.comiket-tracker-wrapper');
      if (oldWrapper) oldWrapper.remove();
      article.removeAttribute('data-comiket-processed');
      return;
    }

    if (article.getAttribute('data-comiket-processed') === 'true') return;

    const userNamesElem = article.querySelector('div[data-testid="User-Name"]');
    const textElem = article.querySelector('div[data-testid="tweetText"]');

    const combinedText = `${userNamesElem ? userNamesElem.innerText : ''} ${textElem ? textElem.innerText : ''}`;
    if (!combinedText.trim()) return;

    const imgEl = article.querySelector('div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]');
    const parsedTargets = ComiketParser.parseAll(combinedText, { imageUrl: imgEl ? imgEl.src : '' });

    if (parsedTargets && parsedTargets.length > 0) {
      article.setAttribute('data-comiket-processed', 'true');

      const wrapper = document.createElement('div');
      wrapper.className = 'comiket-tracker-wrapper';

      const actionGroup = article.querySelector('div[role="group"]');

      parsedTargets.forEach((parsed) => {
        const isTracked = isItemTracked(parsed);

        const btn = document.createElement('button');
        btn.className = 'comiket-tracker-btn';
        btn.__parsedData = parsed;
        btn.setAttribute('type', 'button');
        btn.setAttribute('aria-label', `Track ${parsed.circleName} (${parsed.fullLocation})`);

        if (isTracked) {
          btn.style.borderColor = '#10b981';
          btn.style.background = 'rgba(16, 185, 129, 0.12)';
        } else {
          btn.style.borderColor = '#f59e0b';
          btn.style.background = 'rgba(245, 158, 11, 0.12)';
        }

        const iconSpan = document.createElement('span');
        iconSpan.className = 'cmt-icon';
        iconSpan.style.color = isTracked ? '#10b981' : '#f59e0b';
        iconSpan.textContent = isTracked ? '✅' : '⛩️';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'cmt-label';
        labelSpan.textContent = isTracked ? 'Tracked' : '+ Track';

        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'badge-tag';
        badgeSpan.textContent = parsed.fullLocation;

        btn.replaceChildren(iconSpan, labelSpan, badgeSpan);

        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await openPreviewModal(parsed);
        });

        wrapper.appendChild(btn);
      });

      if (actionGroup && actionGroup.parentNode) {
        actionGroup.parentNode.insertBefore(wrapper, actionGroup);
      } else if (textElem) {
        textElem.appendChild(wrapper);
      } else {
        article.appendChild(wrapper);
      }
    }
  }

  function scanFeed() {
    if (!extAPI.isContextValid()) return;
    if (!extensionEnabled) {
      clearButtonsFromDOM();
      return;
    }
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    articles.forEach(processTweet);
  }

  let scanScheduled = false;
  function scanFeedDebounced() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanFeed();
      scanScheduled = false;
    });
  }

  scanFeed();

  const observer = new MutationObserver((mutations) => {
    if (!extAPI.isContextValid()) {
      observer.disconnect();
      return;
    }
    if (!extensionEnabled) return;

    let shouldScan = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) scanFeedDebounced();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  if (extAPI.raw.runtime && extAPI.raw.runtime.onMessage) {
    try {
      extAPI.raw.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'PARSE_ACTIVE_PAGE') {
          const activeItems = [];

          document.querySelectorAll('article[data-testid="tweet"]').forEach((art) => {
            const userNamesElem = art.querySelector('div[data-testid="User-Name"]');
            const textElem = art.querySelector('div[data-testid="tweetText"]');
            const imgEl = art.querySelector('div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]');
            const combined = `${userNamesElem ? userNamesElem.innerText : ''} ${textElem ? textElem.innerText : ''}`;

            const targets = ComiketParser.parseAll(combined, { imageUrl: imgEl ? imgEl.src : '' });
            targets.forEach((parsed) => {
              const uniqueKey = `${parsed.day}:${parsed.space}`;
              if (!activeItems.some(it => `${it.day}:${it.space}` === uniqueKey)) {
                activeItems.push(parsed);
              }
            });
          });

          sendResponse({ count: activeItems.length, items: activeItems });
        }
        return true;
      });
    } catch (e) {
      console.warn('[Comiket Tracker] Listener error:', e);
    }
  }
})();
