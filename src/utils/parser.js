/**
 * Comiket Circle Tracker Sync - Parser Utilities
 * Extracts Comiket circle metadata (Day, Hall, Block, Space, Price, Circle Name, Artist, Image URL, FixupX Link, etc.)
 */

(function (global) {
  // Primary Location Regex (With explicit building direction Kanji [東西南] or English [East|West|South|[EWS]])
  const COMIKET_LOCATION_REGEX = /(?:(?:\(?)(1日目|一日目|2日目|二日目|土曜日?|日曜日?|8\/15|8\/16|[土日㈯㈰]|Day\s*[12])(?:\)?)[^\w\s]*)?\s*(?:([東西南])\s*([1-8１-８])?|\b(East|West|South|[EWS])\b\s*([1-8])?)\s*(?:ホール|Hall)?\s*([1-8１-８])?\s*[-ー―‐/]?\s*["'「『]?\s*([ぁ-んァ-ヶa-zA-Z]{1,2})\s*["'」』]?\s*[-ー―‐]?\s*([0-9０-９]{1,2})\s*([abａｂ]{1,2})?/i;

  const GLOBAL_LOCATION_REGEX = /(?:(?:\(?)(1日目|一日目|2日目|二日目|土曜日?|日曜日?|8\/15|8\/16|[土日㈯㈰]|Day\s*[12])(?:\)?)[^\w\s]*)?\s*(?:([東西南])\s*([1-8１-８])?|\b(East|West|South|[EWS])\b\s*([1-8])?)\s*(?:ホール|Hall)?\s*([1-8１-８])?\s*[-ー―‐/]?\s*["'「『]?\s*([ぁ-んァ-ヶa-zA-Z]{1,2})\s*["'」』]?\s*[-ー―‐]?\s*([0-9０-９]{1,2})\s*([abａｂ]{1,2})?/gi;

  // Fallback Location Regex (Day + Block + Space Number without explicit building direction, e.g. 土曜日ス-20ab)
  const DAY_BLOCK_LOCATION_REGEX = /(?:(?:\(?)(1日目|一日目|2日目|二日目|土曜日?|日曜日?|8\/15|8\/16|[土日㈯㈰]|Day\s*[12])(?:\)?)[^\w\s]*)\s*[-ー―‐/]?\s*["'「『]?\s*([ぁ-んァ-ヶa-zA-Z]{1,2})\s*["'」』]?\s*[-ー―‐]?\s*([0-9０-９]{1,2})\s*([abａｂ]{1,2})?/i;

  const EXPLICIT_PRICE_REGEX = /(?:¥|￥|価格[:：]?\s*)([1-9][0-9]{2,4})|([1-9][0-9]{2,4})\s*(?:円|yen|Yen|YEN)/i;

  function normalizeFullWidth(str) {
    if (!str) return '';
    return str
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/[ａ-ｚ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/[Ａ-Ｚ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/[－―‐]/g, '-');
  }

  function formatBuildingGroup(building, hallNum) {
    let b = (building || '').trim();

    if (b === 'East' || b === 'E') b = '東';
    if (b === 'West' || b === 'W') b = '西';
    if (b === 'South' || b === 'S') b = '南';

    const num = parseInt(hallNum, 10);

    if (b === '東') {
      if (num >= 4 && num <= 6) return '東456';
      if (num === 7) return '東7';
      if (num === 8) return '東8';
      return '東123';
    }
    if (b === '西') {
      return '西12';
    }
    if (b === '南') {
      if (num >= 3 && num <= 4) return '南34';
      return '南12';
    }

    return b || '東123';
  }

  function formatDayCode(day) {
    if (!day) return 'D1';
    const str = String(day).toLowerCase();
    if (str.includes('2') || str.includes('二') || str.includes('日')) return 'D2';
    return 'D1';
  }

  function formatFullLocation(day, building, block, spaceNum, hallNum = '') {
    const dayCode = formatDayCode(day);
    const bg = formatBuildingGroup(building, hallNum);
    const pos = `${block || ''}-${spaceNum || ''}`.trim().replace(/^-/, '');
    return `${dayCode} ${bg} ${pos}`.trim();
  }

  function parseComiketText(text, options = {}) {
    const all = parseAllComiketText(text, options);
    return all.length > 0 ? all[0] : null;
  }

  function parseAllComiketText(text, options = {}) {
    if (!text || typeof text !== 'string') return [];

    const normalizedText = normalizeFullWidth(text);
    const matches = [...normalizedText.matchAll(GLOBAL_LOCATION_REGEX)];

    const results = [];
    const seenSpaces = new Set();

    if (matches.length > 0) {
      for (const match of matches) {
        const [matchStr, dayRaw, hallKanjiRaw, hallKanjiNumRaw, hallEngRaw, hallEngNumRaw, extraHallNumRaw, blockRaw, numRaw, posRaw] = match;
        if (!blockRaw || !numRaw) continue;

        const target = buildTargetObject(normalizedText, text, matchStr, dayRaw, hallKanjiRaw, hallKanjiNumRaw, hallEngRaw, hallEngNumRaw || extraHallNumRaw, blockRaw, numRaw, posRaw, options);
        if (target) {
          const uniqueKey = `${target.day}:${target.space}`;
          if (!seenSpaces.has(uniqueKey)) {
            seenSpaces.add(uniqueKey);
            results.push(target);
          }
        }
      }
    }

    if (results.length === 0) {
      const fallbackMatch = normalizedText.match(DAY_BLOCK_LOCATION_REGEX);
      if (fallbackMatch) {
        const [matchStr, dayRaw, blockRaw, numRaw, posRaw] = fallbackMatch;
        if (blockRaw && numRaw) {
          const target = buildTargetObject(normalizedText, text, matchStr, dayRaw, null, null, null, null, blockRaw, numRaw, posRaw, options);
          if (target) {
            results.push(target);
          }
        }
      }
    }

    // Unify multi-day targets into a single consolidated record if both Day 1 & Day 2 are present
    if (results.length >= 2) {
      const d1Item = results.find(r => r.dayCode === 'D1');
      const d2Item = results.find(r => r.dayCode === 'D2');
      if (d1Item && d2Item) {
        const unified = {
          ...d1Item,
          isMultiDay: true,
          day1Location: d1Item.fullLocation,
          day2Location: d2Item.fullLocation,
          fullLocation: `${d1Item.fullLocation} / ${d2Item.fullLocation}`,
          day2Building: d2Item.building,
          day2Block: d2Item.block,
          day2SpaceNum: d2Item.spaceNum
        };
        return [unified];
      }
    }

    return results;
  }

  function buildTargetObject(normalizedText, rawText, matchStr, dayRaw, hallKanjiRaw, hallKanjiNumRaw, hallEngRaw, hallEngNumRaw, blockRaw, numRaw, posRaw, options) {
    const hallDirRaw = hallKanjiRaw || hallEngRaw;
    const hallNumRaw = hallKanjiNumRaw || hallEngNumRaw;

    // 1. Determine Event Day
    let day = 'Day 1';
    if (dayRaw) {
      const lowerDay = dayRaw.toLowerCase();
      if (lowerDay.includes('2日目') || lowerDay.includes('二日目') || lowerDay.includes('日曜') || lowerDay.includes('日') || lowerDay.includes('㈰') || lowerDay.includes('8/16') || lowerDay.includes('day 2') || lowerDay.includes('day2')) {
        if (!lowerDay.includes('土') && !lowerDay.includes('一') && lowerDay !== '日') {
          day = 'Day 2';
        } else if (lowerDay.includes('日曜日') || lowerDay.includes('2日目') || lowerDay.includes('二日目') || lowerDay.includes('㈰')) {
          day = 'Day 2';
        }
      }
      if (lowerDay.includes('1日目') || lowerDay.includes('一日目') || lowerDay.includes('土曜') || lowerDay.includes('土') || lowerDay.includes('㈯') || lowerDay.includes('8/15') || lowerDay.includes('day 1') || lowerDay.includes('day1')) {
        day = 'Day 1';
      }
    }

    // 2. Map Hall Direction & Building Group
    const hallDirMap = {
      '東': 'East',
      '西': 'West',
      '南': 'South',
      'E': 'East',
      'W': 'West',
      'S': 'South',
      'EAST': 'East',
      'WEST': 'West',
      'SOUTH': 'South'
    };

    const dirKanjiMap = {
      'East': '東',
      'West': '西',
      'South': '南'
    };

    let dirEnglish = 'West';
    if (hallDirRaw) {
      dirEnglish = hallDirMap[hallDirRaw.toUpperCase()] || hallDirMap[hallDirRaw] || 'West';
    } else {
      dirEnglish = day === 'Day 2' ? 'East' : 'West';
    }

    const dirKanji = dirKanjiMap[dirEnglish] || (hallDirRaw ? hallDirRaw : '西');
    const hallNum = hallNumRaw ? hallNumRaw : '';

    const buildingGroup = formatBuildingGroup(dirKanji, hallNum);
    const dayCode = formatDayCode(day);

    const block = blockRaw;
    const spaceNum = `${numRaw}${posRaw ? posRaw.toLowerCase() : ''}`;
    const spaceFormatted = `${dirKanji}${hallNum ? hallNum + ' ' : ' '}${blockRaw}-${spaceNum}`.trim();
    const fullLocation = formatFullLocation(day, dirKanji, blockRaw, spaceNum, hallNum);

    // 3. Extract Price (JPY)
    let price = '';
    const priceMatch = normalizedText.match(EXPLICIT_PRICE_REGEX);
    if (priceMatch) {
      const priceStr = priceMatch[1] || priceMatch[2];
      if (priceStr) {
        const priceVal = parseInt(priceStr, 10);
        if (priceVal >= 100 && priceVal <= 50000) {
          price = priceVal;
        }
      }
    }

    // 4. Extract Artist Name & Handle cleanly
    let rawAuthor = options.authorName || '';
    let artistName = rawAuthor;

    if (artistName.includes('@')) {
      artistName = artistName.split('@')[0].trim();
    }
    if (artistName.includes('＠')) {
      artistName = artistName.split('＠')[0].trim();
    }

    let artistHandle = options.authorHandle || '';
    if (!artistHandle || artistHandle === '@C108') {
      const handleMatch = rawText.match(/(?:^|\s)@([A-Za-z0-9_]{4,15})\b/);
      if (handleMatch) {
        artistHandle = `@${handleMatch[1]}`;
      }
    }

    // 5. Extract Circle Name
    let circleName = '';
    const bracketMatch = rawText.match(/「([^」]{2,30})」|『([^』]{2,30})』/);
    if (bracketMatch) {
      const candidate = (bracketMatch[1] || bracketMatch[2]).trim();
      if (!candidate.match(/^[東西南EWS土日12]/i) && !candidate.match(/ブロック|ホール|地区/)) {
        circleName = candidate;
      }
    }

    if (!circleName) {
      const circleKeywordMatch = rawText.match(/サークル名?[:：]?\s*([^\s\n\r@#「」『』]{2,25})/);
      if (circleKeywordMatch && circleKeywordMatch[1]) {
        const candidate = circleKeywordMatch[1].trim();
        if (!candidate.match(/^(?:情報|配置|参加|一覧|マップ|スペース|チェック|Webカタログ|カタログ)/)) {
          circleName = candidate;
        }
      }
    }

    if (!circleName && rawText.includes('@')) {
      const atCircleMatch = rawText.match(/@([^\s\n\r@#「」『』/]+?)(?:1日目|一日目|2日目|二日目|土曜|日曜|8\/15|8\/16|[東西南]|C108|$)/i);
      if (atCircleMatch && atCircleMatch[1]) {
        const candidate = atCircleMatch[1].trim();
        if (candidate.length >= 2 && !candidate.match(/^[A-Za-z0-9_]{3,15}$/) && !candidate.match(/^(?:情報|配置|参加|1日目|2日目|一日目|二日目|土曜|日曜|C108)/i)) {
          circleName = candidate;
        }
      }
    }

    if (!circleName) {
      circleName = artistName || artistHandle.replace(/^@/, '') || 'Unknown Circle';
    }

    let description = rawText.trim();
    const melonMatch = rawText.match(/https?:\/\/(?:www\.)?melonbooks\.co\.jp\/(?:detail\/detail\.php\?product_id=\d+|circle\/index\.php\?circle_id=\d+)/i);
    const shopUrl = melonMatch ? melonMatch[0] : (options.shopUrl || '');

    // 6. Source URL & Generated Image URL
    let sourceUrl = options.sourceUrl || '';
    let fixupUrl = '';
    let cunnyUrl = '';
    let tweetId = '';

    if (sourceUrl && sourceUrl.includes('/status/')) {
      const idMatch = sourceUrl.match(/status\/(\d+)/);
      if (idMatch) tweetId = idMatch[1];
      fixupUrl = sourceUrl.replace(/https?:\/\/(?:x\.com|twitter\.com)/i, 'https://fixupx.com');
      cunnyUrl = sourceUrl.replace(/https?:\/\/(?:x\.com|twitter\.com)/i, 'https://cunnyx.com');
    }

    // 7. Direct Sample Image URL resolution
    let imageUrl = options.imageUrl || '';
    if (!imageUrl) {
      const twimgMatch = rawText.match(/https?:\/\/pbs\.twimg\.com\/media\/[A-Za-z0-9_-]+(?:\?[^"\s\n\r]+)?/i);
      if (twimgMatch) {
        imageUrl = twimgMatch[0];
      } else if (tweetId) {
        imageUrl = `https://vxtwitter.com/g/status/${tweetId}.png`;
      }
    }

    if (imageUrl) {
      if (imageUrl.includes('format=')) {
        imageUrl = imageUrl.replace(/name=[^&]+/, 'name=medium');
      } else if (imageUrl.includes('pbs.twimg.com/media/')) {
        imageUrl = imageUrl.replace(/\.(jpg|png|jpeg|webp)$/i, '?format=$1&name=medium');
      }
    }

    return {
      day: day,
      dayCode: dayCode,                           // "D1", "D2"
      priority: 'P2 (Medium)',
      hall: dirEnglish,
      building: buildingGroup,                     // "東123", "東456", "東7", "東8", "西12", "南12"
      buildingEng: dirEnglish,
      block: block,                               // "ア", "カ", "め"
      spaceNum: spaceNum,                         // "11a", "26ab", "58ab"
      space: spaceFormatted,                      // "東123 ア-11a"
      fullLocation: fullLocation,                 // "D1 東123 ア-11a"
      day1Location: dayCode === 'D1' ? fullLocation : '',
      day2Location: dayCode === 'D2' ? fullLocation : '',
      circleName: circleName,
      artist: artistName ? (artistHandle ? `${artistName} (${artistHandle})` : artistName) : artistHandle,
      description: description.length > 120 ? description.substring(0, 117) + '...' : description,
      fullText: rawText,
      price: price,
      imageUrl: imageUrl,
      fixupUrl: fixupUrl,
      cunnyUrl: cunnyUrl,
      shopUrl: shopUrl,
      sourceUrl: sourceUrl,
      timestamp: new Date().toISOString()
    };
  }

  const parserObj = {
    parse: parseComiketText,
    parseAll: parseAllComiketText,
    normalizeFullWidth: normalizeFullWidth,
    formatBuildingGroup: formatBuildingGroup,
    formatDayCode: formatDayCode,
    formatFullLocation: formatFullLocation,
    LOCATION_REGEX: COMIKET_LOCATION_REGEX
  };

  global.ComiketParser = parserObj;
  if (typeof exports !== 'undefined') {
    module.exports = parserObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
