/**
 * Comiket Circle Tracker Sync - Exporter & Importer Utilities
 * Generates CSV, TSV (for Google Sheets Ctrl+V copy), JSON exports, and parses Google Sheet table imports.
 */

(function (global) {
  function escapeCSVCell(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  function formatRowData(item) {
    const day = item.day || 'Day 1';
    const dayCode = item.dayCode || (day.includes('2') ? 'D2' : 'D1');
    const building = item.building || item.hall || '東123';
    const block = item.block || '';
    const space = item.spaceNum || item.space || '';
    const fullLoc = item.fullLocation || `${dayCode} ${building} ${block ? block + '-' : ''}${space}`.trim();

    const day1Loc = item.day1Location || (dayCode === 'D1' ? fullLoc : '');
    const day2Loc = item.day2Location || (dayCode === 'D2' ? fullLoc : '');

    const priority = item.priority || 'P2 (Medium)';
    const circleName = item.circleName || 'Unknown Circle';
    const product = item.description || item.product || '';
    const artist = item.artist || '';

    const imageFormula = item.imageUrl ? `=IMAGE("${item.imageUrl}")` : '';
    const tweetFormula = item.sourceUrl ? `=HYPERLINK("${item.sourceUrl}", "View Tweet")` : '';
    const shopFormula = item.shopUrl ? `=HYPERLINK("${item.shopUrl}", "Shop / Order")` : '';
    const price = item.price ? Number(item.price) : '';
    const status = item.status || 'Pending';
    const notes = item.notes || '';
    const timestamp = item.timestamp || new Date().toISOString();

    return {
      circleName,
      product,
      day1Loc,
      day2Loc,
      priority,
      price,
      imageFormula,
      tweetFormula,
      shopFormula,
      status,
      notes,
      artist,
      timestamp
    };
  }

  function buildCSV(circleItems) {
    const headers = [
      'Circle',
      'Product',
      'Day 1 Position',
      'Day 2 Position',
      'Priority',
      'Price (¥)',
      'Sample Image',
      'Tweet Link',
      'Web Purchase',
      'Status',
      'Note'
    ];

    const rows = [headers.map(escapeCSVCell).join(',')];

    circleItems.forEach((item) => {
      const r = formatRowData(item);
      const row = [
        escapeCSVCell(r.circleName),
        escapeCSVCell(r.product),
        escapeCSVCell(r.day1Loc),
        escapeCSVCell(r.day2Loc),
        escapeCSVCell(r.priority),
        escapeCSVCell(r.price),
        escapeCSVCell(r.imageFormula),
        escapeCSVCell(r.tweetFormula),
        escapeCSVCell(r.shopFormula),
        escapeCSVCell(r.status),
        escapeCSVCell(r.notes)
      ];
      rows.push(row.join(','));
    });

    return '\uFEFF' + rows.join('\r\n');
  }

  function buildTSV(circleItems) {
    const headers = [
      'Circle',
      'Product',
      'Day 1 Position',
      'Day 2 Position',
      'Priority',
      'Price (¥)',
      'Sample Image',
      'Tweet Link',
      'Web Purchase',
      'Status',
      'Note'
    ];

    const rows = [headers.join('\t')];

    circleItems.forEach((item) => {
      const r = formatRowData(item);
      const row = [
        r.circleName,
        r.product,
        r.day1Loc,
        r.day2Loc,
        r.priority,
        r.price,
        r.imageFormula,
        r.tweetFormula,
        r.shopFormula,
        r.status,
        r.notes
      ];
      rows.push(row.join('\t'));
    });

    return rows.join('\n');
  }

  function parseTableData(text) {
    if (!text || typeof text !== 'string') return [];

    const lines = text.trim().split(/\r?\n/);
    if (lines.length === 0) return [];

    const isCSV = lines[0].includes(',') && !lines[0].includes('\t');
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('circle') || firstLine.includes('サークル') || firstLine.includes('day 1') || firstLine.includes('1日目') || firstLine.includes('product') || firstLine.includes('priority');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const importedItems = [];

    for (const line of dataLines) {
      if (!line.trim()) continue;

      let cols = [];
      if (isCSV) {
        cols = line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(c => c.trim().replace(/^"(.*)"$/, '$1'));
      } else {
        cols = line.split('\t').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
      }

      const circleName = cols[0] || 'Unknown Circle';
      const description = cols[1] || '';
      const day1Loc = cols[2] || '';
      const day2Loc = cols[3] || '';
      const priority = cols[4] || 'P2 (Medium)';
      const priceStr = cols[5] || '';
      const imageUrlRaw = cols[6] || '';
      const sourceUrlRaw = cols[7] || '';
      const shopUrlRaw = cols[8] || '';
      const status = cols[9] || 'Pending';
      const notes = cols[10] || '';

      const dayVal = day1Loc ? 'Day 1' : (day2Loc ? 'Day 2' : 'Day 1');
      const dayCode = day1Loc ? 'D1' : (day2Loc ? 'D2' : 'D1');
      const fullLoc = (day1Loc && day2Loc) ? `${day1Loc} / ${day2Loc}` : (day1Loc || day2Loc || 'D1 東123 未定');

      const price = priceStr.replace(/[^0-9]/g, '');

      let imageUrl = imageUrlRaw;
      if (imageUrl.includes('IMAGE("')) {
        const m = imageUrl.match(/IMAGE\("([^"]+)"\)/i);
        if (m) imageUrl = m[1];
      }

      let sourceUrl = sourceUrlRaw;
      if (sourceUrl.includes('HYPERLINK("')) {
        const m = sourceUrl.match(/HYPERLINK\("([^"]+)"/i);
        if (m) sourceUrl = m[1];
      }

      let shopUrl = shopUrlRaw;
      if (shopUrl.includes('HYPERLINK("')) {
        const m = shopUrl.match(/HYPERLINK\("([^"]+)"/i);
        if (m) shopUrl = m[1];
      }

      importedItems.push({
        circleName: circleName,
        artist: circleName,
        description: description,
        day: dayVal,
        dayCode: dayCode,
        day1Location: day1Loc,
        day2Location: day2Loc,
        fullLocation: fullLoc,
        priority: priority,
        price: price ? Number(price) : '',
        imageUrl: imageUrl,
        sourceUrl: sourceUrl,
        shopUrl: shopUrl,
        status: status,
        notes: notes,
        timestamp: new Date().toISOString()
      });
    }

    return importedItems;
  }

  const exporterObj = {
    buildCSV: buildCSV,
    buildTSV: buildTSV,
    parseTableData: parseTableData,
    formatRowData: formatRowData
  };

  global.ComiketExporter = exporterObj;
  if (typeof exports !== 'undefined') {
    module.exports = exporterObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
