/**
 * Comiket Circle Tracker Sync - Content Script for X (Twitter)
 * Scans tweet cards, author display names, images, and post detail views.
 */

(function () {
  'use strict';

  if (window.__comiketTrackerInjected) return;
  window.__comiketTrackerInjected = true;

  console.log('[Comiket Tracker] Content script active with P2 (Medium) default priority.');

  function showToast(message, type = 'info') {
    const existing = document.querySelector('.comiket-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `comiket-toast ${type}`;
    toast.innerText = message;
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

    const settings = await extAPI.storage.get(['showImagePreview', 'includeDescription', 'defaultPriority']);
    const showImagePreview = settings.showImagePreview === true; // Default false
    const includeDescription = settings.includeDescription !== false; // Default true

    let selectedPriority = 'P2 (Medium)';
    if (settings.defaultPriority && (settings.defaultPriority.startsWith('P1') || settings.defaultPriority.startsWith('P3'))) {
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

    backdrop.innerHTML = `
      <div class="comiket-modal-card">
        <div class="comiket-modal-header">
          <div class="comiket-modal-title">
            <span style="color: #f59e0b;">⛩️</span> ${escapeHtml(extAPI.getBilingualText('Add to Comiket Master Sheet', 'コミケ作戦シートに追加'))}
          </div>
          <button class="comiket-modal-close" id="cmt-close-btn">&times;</button>
        </div>
        <div class="comiket-modal-body">
          ${imagePreviewHtml}

          <div class="comiket-field-row">
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Target Day', '配置日程'))}</label>
              <select class="comiket-select" id="cmt-day">
                <option value="Day 1" ${parsedData.day === 'Day 1' ? 'selected' : ''}>${escapeHtml(extAPI.getBilingualText('Day 1 (Aug 15)', '1日目 (8/15)'))}</option>
                <option value="Day 2" ${parsedData.day === 'Day 2' ? 'selected' : ''}>${escapeHtml(extAPI.getBilingualText('Day 2 (Aug 16)', '2日目 (8/16)'))}</option>
              </select>
            </div>
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Priority', '優先度'))}</label>
              <select class="comiket-select" id="cmt-priority">
                <option value="P1 (High)" ${selectedPriority.includes('P1') ? 'selected' : ''}>${escapeHtml(extAPI.getBilingualText('P1 (High / Wall Circle)', 'P1 (最優先 / 壁サークル)'))}</option>
                <option value="P2 (Medium)" ${selectedPriority.includes('P2') ? 'selected' : ''}>${escapeHtml(extAPI.getBilingualText('P2 (Medium / Island)', 'P2 (一般 / 島サークル)'))}</option>
                <option value="P3 (Low)" ${selectedPriority.includes('P3') ? 'selected' : ''}>${escapeHtml(extAPI.getBilingualText('P3 (Low / Backup)', 'P3 (予備 / 後回し)'))}</option>
              </select>
            </div>
          </div>

          <div class="comiket-field-row three-cols">
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Building', '館名'))}</label>
              <input type="text" class="comiket-input" id="cmt-building" value="${escapeHtml(parsedData.building || parsedData.hall || '')}" placeholder="東/西/南">
            </div>
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Block', 'ブロック'))}</label>
              <input type="text" class="comiket-input" id="cmt-block" value="${escapeHtml(parsedData.block || '')}" placeholder="ウ/A/め">
            </div>
            <div class="comiket-field-group">
              <label class="comiket-field-label">${escapeHtml(extAPI.getBilingualText('Space', 'スペース'))}</label>
              <input type="text" class="comiket-input" id="cmt-space-num" value="${escapeHtml(parsedData.spaceNum || parsedData.space || '')}" placeholder="11a">
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
          <button class="comiket-btn-primary" id="cmt-submit-btn">💾 ${escapeHtml(extAPI.getBilingualText('Save Circle', '作戦シートに保存'))}</button>
        </div>
      </div>
    `;

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
      submitBtn.innerText = 'Saving...';

      const building = backdrop.querySelector('#cmt-building').value;
      const block = backdrop.querySelector('#cmt-block').value;
      const spaceNum = backdrop.querySelector('#cmt-space-num').value;

      const payload = {
        day: backdrop.querySelector('#cmt-day').value,
        priority: backdrop.querySelector('#cmt-priority').value,
        building: building,
        hall: building,
        block: block,
        spaceNum: spaceNum,
        space: `${building} ${block}-${spaceNum}`.trim(),
        circleName: backdrop.querySelector('#cmt-circle').value,
        artist: backdrop.querySelector('#cmt-artist').value,
        price: backdrop.querySelector('#cmt-price').value,
        imageUrl: backdrop.querySelector('#cmt-img-url').value,
        sourceUrl: backdrop.querySelector('#cmt-source-url').value,
        fixupUrl: backdrop.querySelector('#cmt-fixup-url').value,
        description: backdrop.querySelector('#cmt-desc').value,
        shopUrl: parsedData.shopUrl || '',
        timestamp: new Date().toISOString()
      };

      try {
        const response = await extAPI.runtime.sendMessage({
          action: 'SAVE_CIRCLE',
          data: payload
        });

        if (response && response.success) {
          showToast(`✅ Saved ${payload.building} ${payload.block}-${payload.spaceNum} (${payload.circleName}) to Comiket Plan!`, 'success');
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

    const parsed = ComiketParser.parse(combinedText, { authorHandle, authorName, sourceUrl, imageUrl });

    if (parsed) {
      article.setAttribute('data-comiket-processed', 'true');

      const actionGroup = article.querySelector('div[role="group"]') || (textElement ? textElement.parentNode : article);

      const btn = document.createElement('button');
      btn.className = 'comiket-tracker-btn';
      btn.type = 'button';
      btn.innerHTML = `
        <span style="color: #f59e0b;">⛩️</span>
        <span>+ Track</span>
        <span class="badge-tag">${escapeHtml(parsed.day)}: ${escapeHtml(parsed.building || parsed.hall)} ${escapeHtml(parsed.block)}-${escapeHtml(parsed.spaceNum || parsed.space)}</span>
      `;

      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await openPreviewModal(parsed);
      });

      if (actionGroup && actionGroup.parentNode) {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'block';
        wrapper.style.width = '100%';
        wrapper.appendChild(btn);
        actionGroup.parentNode.insertBefore(wrapper, actionGroup);
      } else if (textElement) {
        textElement.appendChild(btn);
      } else {
        article.appendChild(btn);
      }
    }
  }

  function scanFeed() {
    if (!extAPI.isContextValid()) return;
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    articles.forEach(processTweet);
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
    if (shouldScan) scanFeed();
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

            const parsed = ComiketParser.parse(combined, { imageUrl: imgEl ? imgEl.src : '' });
            if (parsed && !activeItems.some(it => it.space === parsed.space)) {
              activeItems.push(parsed);
            }
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
