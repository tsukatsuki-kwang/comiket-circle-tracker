/**
 * Comiket Circle Tracker Sync - Content Script for X (Twitter)
 * Scans tweet cards, author display names, images, and post detail views with real-time duplication tracking & multi-day consolidation.
 */

(function () {
  'use strict';

  if (window.__comiketTrackerInjected) return;
  window.__comiketTrackerInjected = true;

  console.log('[Comiket Tracker] Content script active with multi-day target consolidation.');

  let savedItemsMap = new Map();

  async function refreshSavedItems() {
    try {
      const res = await extAPI.storage.get(['circleItems']);
      const items = res?.circleItems || [];
      savedItemsMap.clear();
      items.forEach(it => {
        const dayCode = it.dayCode || (it.day && it.day.includes('2') ? 'D2' : 'D1');
        const space = (it.spaceNum || it.space || '').toLowerCase().trim();
        const artist = (it.artist || it.circleName || '').toLowerCase().trim();
        if (dayCode && space) {
          savedItemsMap.set(`${dayCode}:${space}`, it);
          if (artist) {
            savedItemsMap.set(`${dayCode}:${space}:${artist}`, it);
          }
        }
        if (it.day1Location) savedItemsMap.set(it.day1Location.toLowerCase().trim(), it);
        if (it.day2Location) savedItemsMap.set(it.day2Location.toLowerCase().trim(), it);
      });
      updateExistingButtonsInDOM();
    } catch (e) {
      console.warn('[Comiket Tracker] Failed to refresh saved items:', e);
    }
  }

  function updateExistingButtonsInDOM() {
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
      if (changes.circleItems) {
        refreshSavedItems();
      }
    });
  }

  function isItemTracked(parsed) {
    if (!parsed) return false;
    if (parsed.day1Location && savedItemsMap.has(parsed.day1Location.toLowerCase().trim())) return true;
    if (parsed.day2Location && savedItemsMap.has(parsed.day2Location.toLowerCase().trim())) return true;

    const dayCode = parsed.dayCode || (parsed.day && parsed.day.includes('2') ? 'D2' : 'D1');
    const space = (parsed.spaceNum || parsed.space || '').toLowerCase().trim();
    const artist = (parsed.artist || parsed.circleName || '').toLowerCase().trim();

    if (savedItemsMap.has(`${dayCode}:${space}:${artist}`)) return true;
    if (savedItemsMap.has(`${dayCode}:${space}`)) return true;
    return false;
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

  async function openPreviewModal(parsedData) {
    if (!extAPI.isContextValid()) {
      showToast('⚠️ Extension updated. Please refresh page (F5).', 'error');
      return;
    }

    const existingModal = document.querySelector('.comiket-modal-backdrop');
    if (existingModal) existingModal.remove();

    const isTracked = isItemTracked(parsedData);

    const settings = await extAPI.storage.get(['showImagePreview', 'includeDescription', 'defaultPriority']);
    const showImagePreview = settings.showImagePreview === true;
    const includeDescription = settings.includeDescription !== false;

    let selectedPriority = parsedData.priority || 'P2 (Medium)';
    if (!parsedData.priority && settings.defaultPriority && (settings.defaultPriority.startsWith('P0') || settings.defaultPriority.startsWith('P1') || settings.defaultPriority.startsWith('P3'))) {
      selectedPriority = settings.defaultPriority;
    }

    const displayDescription = includeDescription ? (parsedData.description || '') : '';

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
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Priority', '優先度'))}</label>
              <select class="comiket-select" id="cmt-priority">
                <option value="P0 (Top)" ${selectedPriority.includes('P0') ? 'selected' : ''}>${escapeHtml(extAPI.getBilingualText('P0 (Top / Wall Circle)', 'P0 (壁超最優先 / 大壁)'))}</option>
                <option value="P1 (High)" ${selectedPriority.includes('P1') ? 'selected' : ''}>${escapeHtml(extAPI.getBilingualText('P1 (High / Wall Circle)', 'P1 (最優先 / 壁サークル)'))}</option>
                <option value="P2 (Medium)" ${selectedPriority.includes('P2') ? 'selected' : ''}>${escapeHtml(extAPI.getBilingualText('P2 (Medium / Island)', 'P2 (一般 / 島サークル)'))}</option>
                <option value="P3 (Low)" ${selectedPriority.includes('P3') ? 'selected' : ''}>${escapeHtml(extAPI.getBilingualText('P3 (Low / Backup)', 'P3 (予備 / 後回し)'))}</option>
              </select>
            </div>
          </div>

          <div class="comiket-field-row">
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Circle Name', 'サークル名'))}</label>
              <input type="text" class="comiket-input" id="cmt-circle" value="${escapeHtml(parsedData.circleName || '')}">
            </div>
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Artist / Handle', '作者名 / アカウント'))}</label>
              <input type="text" class="comiket-input" id="cmt-artist" value="${escapeHtml(parsedData.artist || '')}">
            </div>
          </div>

          <div class="comiket-field-row">
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Est. Price (JPY)', '頒布価格 (円)'))}</label>
              <input type="number" class="comiket-input" id="cmt-price" value="${parsedData.price || ''}">
            </div>
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Sample Image URL', 'サンプル画像 URL'))}</label>
              <input type="url" class="comiket-input" id="cmt-img-url" value="${escapeHtml(parsedData.imageUrl || '')}" placeholder="https://pbs.twimg.com/media/...">
            </div>
          </div>

          <div class="comiket-field-group">
            <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Tweet Link / Status URL', 'ツイート / ポスト URL'))}</label>
            <input type="url" class="comiket-input" id="cmt-source-url" value="${escapeHtml(parsedData.sourceUrl || window.location.href)}">
          </div>

          <div class="comiket-field-group">
            <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('FixupX / CunnyX Share Link', 'FixupX / CunnyX 共有リンク'))}</label>
            <input type="url" class="comiket-input" id="cmt-fixup-url" value="${escapeHtml(parsedData.cunnyUrl || parsedData.fixupUrl || '')}" placeholder="https://cunnyx.com/...">
          </div>

          <div class="comiket-field-group">
            <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Item Description & Post Text', 'お品書き・ポスト本文'))}</label>
            <textarea class="comiket-textarea" id="cmt-desc" placeholder="Post description (Optional)...">${escapeHtml(displayDescription)}</textarea>
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

    const closeModal = () => backdrop.remove();
    backdrop.querySelector('#cmt-close-btn').addEventListener('click', closeModal);
    backdrop.querySelector('#cmt-cancel-btn').addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    backdrop.querySelector('#cmt-submit-btn').addEventListener('click', async () => {
      const submitBtn = backdrop.querySelector('#cmt-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      const d1LocVal = backdrop.querySelector('#cmt-day1-loc').value.trim();
      const d2LocVal = backdrop.querySelector('#cmt-day2-loc').value.trim();

      const dayVal = d1LocVal ? 'Day 1' : 'Day 2';
      const dayCode = d1LocVal ? 'D1' : 'D2';
      const activeLoc = d1LocVal || d2LocVal || 'D1 東123 未定';

      const payload = {
        day: dayVal,
        dayCode: dayCode,
        priority: backdrop.querySelector('#cmt-priority').value,
        building: parsedData.building || '東123',
        hall: parsedData.building || '東123',
        block: parsedData.block || '',
        spaceNum: parsedData.spaceNum || '',
        space: parsedData.space || '',
        fullLocation: activeLoc,
        day1Location: d1LocVal,
        day2Location: d2LocVal,
        circleName: backdrop.querySelector('#cmt-circle').value,
        artist: backdrop.querySelector('#cmt-artist').value,
        price: backdrop.querySelector('#cmt-price').value,
        imageUrl: backdrop.querySelector('#cmt-img-url').value,
        sourceUrl: backdrop.querySelector('#cmt-source-url').value,
        fixupUrl: backdrop.querySelector('#cmt-fixup-url').value,
        description: backdrop.querySelector('#cmt-desc').value,
        shopUrl: parsedData.shopUrl || '',
        status: 'Pending',
        timestamp: new Date().toISOString()
      };

      try {
        const response = await extAPI.runtime.sendMessage({
          action: 'SAVE_CIRCLE',
          data: payload
        });

        if (response && response.success) {
          const actionWord = response.isUpdate ? 'Updated' : 'Saved';
          showToast(`✅ ${actionWord} ${payload.circleName} in Comiket Plan!`, 'success');
          await refreshSavedItems();
          closeModal();
        } else {
          showToast(`⚠️ ${response?.error || 'Failed to save.'}`, 'error');
          submitBtn.disabled = false;
        }
      } catch (err) {
        showToast(`❌ Error: ${err.message}`, 'error');
        submitBtn.disabled = false;
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function processTweet(article) {
    if (article.hasAttribute('data-comiket-processed')) return;

    let authorName = '';
    let authorHandle = '';
    const userNamesElem = article.querySelector('div[data-testid="User-Name"]');
    if (userNamesElem) {
      authorName = userNamesElem.innerText.replace(/\n/g, ' ').trim();
      const handleElem = userNamesElem.querySelector('a[href*="/"]');
      if (handleElem) {
        const hrefParts = handleElem.getAttribute('href').split('/');
        authorHandle = `@${hrefParts[1]}`;
      }
    }

    const textElement = article.querySelector('div[data-testid="tweetText"]');
    const tweetText = textElement ? textElement.innerText : '';

    let imageUrl = '';
    const imgElem = article.querySelector('div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]');
    if (imgElem) {
      imageUrl = imgElem.getAttribute('src');
    }

    let sourceUrl = window.location.href;
    const timeElem = article.querySelector('time');
    if (timeElem && timeElem.closest('a')) {
      const relHref = timeElem.closest('a').getAttribute('href');
      if (relHref) {
        sourceUrl = `https://x.com${relHref}`;
      }
    }

    const combinedText = `${authorName} ${tweetText}`;

    const parsedTargets = ComiketParser.parseAll(combinedText, { authorHandle, authorName, sourceUrl, imageUrl });

    if (parsedTargets.length > 0) {
      article.setAttribute('data-comiket-processed', 'true');

      const actionGroup = article.querySelector('div[role="group"]') || (textElement ? textElement.parentNode : article);

      const wrapper = document.createElement('div');
      wrapper.className = 'comiket-tracker-wrapper';
      wrapper.style.display = 'flex';
      wrapper.style.flexWrap = 'wrap';
      wrapper.style.gap = '6px';
      wrapper.style.width = '100%';
      wrapper.style.margin = '6px 0';

      parsedTargets.forEach((parsed) => {
        const isTracked = isItemTracked(parsed);

        const btn = document.createElement('button');
        btn.className = 'comiket-tracker-btn';
        btn.type = 'button';
        btn.__parsedData = parsed;

        if (isTracked) {
          btn.style.borderColor = '#10b981';
          btn.style.background = 'rgba(16, 185, 129, 0.12)';
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
      } else if (textElement) {
        textElement.appendChild(wrapper);
      } else {
        article.appendChild(wrapper);
      }
    }
  }

  function scanFeed() {
    if (!extAPI.isContextValid()) return;
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
