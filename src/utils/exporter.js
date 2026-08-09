/**
 * Comiket Circle Tracker Sync - Exporter Utilities
 * Generates CSV, TSV (for Google Sheets Ctrl+V copy), and JSON exports.
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

  const exporterObj = {
    buildCSV: buildCSV,
    buildTSV: buildTSV,
    formatRowData: formatRowData
  };

  global.ComiketExporter = exporterObj;
  if (typeof exports !== 'undefined') {
    module.exports = exporterObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
