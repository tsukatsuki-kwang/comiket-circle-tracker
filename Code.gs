/**
 * Comiket 108 Master Sheet - Google Apps Script Web App Backend
 * Receives circle tracking payloads and appends them to your Google Sheet with Day 1 & Day 2 Location columns.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Initialize headers if sheet is brand new
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Day 1 Location',
        'Day 2 Location',
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
      ]);
      sheet.getRange(1, 1, 1, 15).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    }

    var imageFormula = data.imageUrl ? '=IMAGE("' + data.imageUrl + '")' : '';
    var tweetFormula = data.sourceUrl ? '=HYPERLINK("' + data.sourceUrl + '", "View Tweet")' : '';
    var shopFormula = data.shopUrl ? '=HYPERLINK("' + data.shopUrl + '", "Shop / Order")' : '';

    var dayCode = data.dayCode || (data.day && data.day.includes('2') ? 'D2' : 'D1');
    var building = data.building || data.hall || '東123';
    var block = data.block || '';
    var space = data.spaceNum || data.space || '';
    var fullLoc = data.fullLocation || (dayCode + ' ' + building + ' ' + (block ? block + '-' : '') + space).trim();

    var day1Loc = data.day1Location || (dayCode === 'D1' ? fullLoc : '');
    var day2Loc = data.day2Location || (dayCode === 'D2' ? fullLoc : '');

    sheet.appendRow([
      day1Loc,
      day2Loc,
      data.priority || 'P2 (Medium)',
      building,
      block,
      space,
      data.circleName || '',
      data.artist || '',
      imageFormula,
      data.description || '',
      data.price ? Number(data.price) : '',
      tweetFormula || data.sourceUrl || '',
      shopFormula || data.shopUrl || '',
      data.notes || 'Imported via Extension',
      new Date().toISOString()
    ]);

    return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
