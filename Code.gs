/**
 * Comiket 108 Master Sheet - Google Apps Script Web App Backend
 * Receives circle tracking payloads and appends them to your Google Sheet with separate Building, Block, and Space columns.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Initialize headers if sheet is brand new
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
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
      ]);
      sheet.getRange(1, 1, 1, 14).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    }

    var imageFormula = data.imageUrl ? '=IMAGE("' + data.imageUrl + '")' : '';
    var tweetFormula = data.sourceUrl ? '=HYPERLINK("' + data.sourceUrl + '", "View Tweet")' : '';
    var shopFormula = data.shopUrl ? '=HYPERLINK("' + data.shopUrl + '", "Shop / Order")' : '';

    var building = data.building || data.hall || '';
    var block = data.block || '';
    var space = data.spaceNum || data.space || '';

    sheet.appendRow([
      data.day || 'Day 1',
      data.priority || 'P1 (High)',
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
