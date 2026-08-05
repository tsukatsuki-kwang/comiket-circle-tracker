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
    const priority = item.priority || 'P1 (High)';
    const building = item.building || item.hall || '';
    const block = item.block || '';
    const space = item.spaceNum || item.space || '';
    const circleName = item.circleName || 'Unknown Circle';
    const artist = item.artist || '';

    const imageFormula = item.imageUrl ? `=IMAGE("${item.imageUrl}")` : '';
    const tweetFormula = item.sourceUrl ? `=HYPERLINK("${item.sourceUrl}", "View Tweet")` : '';
    const shopFormula = item.shopUrl ? `=HYPERLINK("${item.shopUrl}", "Shop / Order")` : '';
    const description = item.description || '';
    const price = item.price ? Number(item.price) : '';
    const notes = item.notes || '';
    const timestamp = item.timestamp || new Date().toISOString();

    return {
      day,
      priority,
      building,
      block,
      space,
      circleName,
      artist,
      imageFormula,
      description,
      price,
      tweetFormula,
      shopFormula,
      notes,
      timestamp
    };
  }

  function buildCSV(circleItems) {
    const headers = [
      'Day',
      'Priority',
      'Building',
      'Block',
      'Space',
      'Circle Name',
      'Artist / Author',
      'Sample Image',
      'Item Description',
      'Price (JPY)',
      'Tweet Link',
      'Shop Link',
      'Notes',
      'Added At'
    ];

    const rows = [headers.map(escapeCSVCell).join(',')];

    circleItems.forEach((item) => {
      const r = formatRowData(item);
      const row = [
        escapeCSVCell(r.day),
        escapeCSVCell(r.priority),
        escapeCSVCell(r.building),
        escapeCSVCell(r.block),
        escapeCSVCell(r.space),
        escapeCSVCell(r.circleName),
        escapeCSVCell(r.artist),
        escapeCSVCell(r.imageFormula),
        escapeCSVCell(r.description),
        escapeCSVCell(r.price),
        escapeCSVCell(r.tweetFormula),
        escapeCSVCell(r.shopFormula),
        escapeCSVCell(r.notes),
        escapeCSVCell(r.timestamp)
      ];
      rows.push(row.join(','));
    });

    return '\uFEFF' + rows.join('\r\n');
  }

  function buildTSV(circleItems) {
    const headers = [
      'Day',
      'Priority',
      'Building',
      'Block',
      'Space',
      'Circle Name',
      'Artist / Author',
      'Sample Image',
      'Item Description',
      'Price (JPY)',
      'Tweet Link',
      'Shop Link',
      'Notes',
      'Added At'
    ];

    const rows = [headers.join('\t')];

    circleItems.forEach((item) => {
      const r = formatRowData(item);
      const row = [
        r.day,
        r.priority,
        r.building,
        r.block,
        r.space,
        r.circleName,
        r.artist,
        r.imageFormula,
        r.description,
        r.price,
        r.tweetFormula,
        r.shopFormula,
        r.notes,
        r.timestamp
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
