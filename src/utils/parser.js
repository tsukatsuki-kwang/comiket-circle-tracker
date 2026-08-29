/**
 * Comiket Circle Tracker Sync - Parser & Seasonal Timeline Utilities
 * Extracts Comiket circle metadata (Day, Hall, Block, Space, Price, Circle Name, Artist, Image URL, FixupX Link, etc.)
 * Calculates dynamic seasonal timeline & edition numbers (Summer/Winter Comiket with 3-Day support).
 */

(function (global) {
  // Primary Location Regex (Supports Day 1, Day 2, Day 3, dates 8/14, 8/15, 8/16, 12/29, 12/30, 12/31)
  const COMIKET_LOCATION_REGEX = /(?:(?:\(?)(1日目|一日目|2日目|二日目|3日目|三日目|金曜日?|土曜日?|日曜日?|8\/14|8\/15|8\/16|12\/29|12\/30|12\/31|[金土日㈮㈯㈰]|Day\s*[123])(?:\)?)[^\w\s]*)?\s*(?:([東西南])\s*([1-8１-８])?|\b(East|West|South|[EWS])\b\s*([1-8])?)\s*(?:ホール|Hall)?\s*([1-8１-８])?\s*[-ー―‐/]?\s*["'「『]?\s*([ぁ-んァ-ヶa-zA-Z]{1,2})\s*["'」』]?\s*[-ー―‐]?\s*([0-9０-９]{1,2})\s*([abａｂ]{1,2})?/i;

  const GLOBAL_LOCATION_REGEX = /(?:(?:\(?)(1日目|一日目|2日目|二日目|3日目|三日目|金曜日?|土曜日?|日曜日?|8\/14|8\/15|8\/16|12\/29|12\/30|12\/31|[金土日㈮㈯㈰]|Day\s*[123])(?:\)?)[^\w\s]*)?\s*(?:([東西南])\s*([1-8１-８])?|\b(East|West|South|[EWS])\b\s*([1-8])?)\s*(?:ホール|Hall)?\s*([1-8１-８])?\s*[-ー―‐/]?\s*["'「『]?\s*([ぁ-んァ-ヶa-zA-Z]{1,2})\s*["'」』]?\s*[-ー―‐]?\s*([0-9０-９]{1,2})\s*([abａｂ]{1,2})?/gi;

  // Fallback Location Regex
  const DAY_BLOCK_LOCATION_REGEX = /(?:(?:\(?)(1日目|一日目|2日目|二日目|3日目|三日目|金曜日?|土曜日?|日曜日?|8\/14|8\/15|8\/16|12\/29|12\/30|12\/31|[金土日㈮㈯㈰]|Day\s*[123])(?:\)?)[^\w\s]*)\s*[-ー―‐/]?\s*["'「『]?\s*([ぁ-んァ-ヶa-zA-Z]{1,2})\s*["'」』]?\s*[-ー―‐]?\s*([0-9０-９]{1,2})\s*([abａｂ]{1,2})?/i;

  const EXPLICIT_PRICE_REGEX = /(?:¥|￥|価格[:：]?\s*)([1-9][0-9]{2,4})|([1-9][0-9]{2,4})\s*(?:円|yen|Yen|YEN)/i;

  /**
   * Returns current Comiket edition, season, and 3-day dates based on timeline rules:
   * - Jan 1 to Aug 20: Summer Comiket (Aug 14, Aug 15, Aug 16)
   * - Aug 21 to Dec 31: Winter Comiket (Dec 29, Dec 30, Dec 31)
   */
  function getCurrentComiketInfo(refDate = new Date()) {
    const year = refDate.getFullYear();
    const month = refDate.getMonth() + 1;
    const day = refDate.getDate();

    const isSummer = (month < 8) || (month === 8 && day <= 20);

    let editionNum;
    let season;
    let day1Label;
    let day2Label;
    let day3Label;

    if (isSummer) {
      season = 'Summer';
      editionNum = 108 + (year - 2026) * 2;
      day1Label = 'Day 1 (Aug 14)';
      day2Label = 'Day 2 (Aug 15)';
      day3Label = 'Day 3 (Aug 16)';
    } else {
      season = 'Winter';
      editionNum = 109 + (year - 2026) * 2;
      day1Label = 'Day 1 (Dec 29)';
      day2Label = 'Day 2 (Dec 30)';
      day3Label = 'Day 3 (Dec 31)';
    }

    const edition = `C${editionNum}`;

    return {
      edition: edition,
      editionNum: editionNum,
      season: season,
      year: year,
      title: `${edition} Plan`,
      day1Label: day1Label,
      day2Label: day2Label,
      day3Label: day3Label
    };
  }

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
    if (str.includes('3') || str.includes('三') || str.includes('12/31') || str.includes('8/16') || str.includes('day 3') || str.includes('day3')) {
      return 'D3';
    }
    if (str.includes('2') || str.includes('二') || str.includes('12/30') || str.includes('8/15') || str.includes('day 2') || str.includes('day2')) {
      return 'D2';
    }
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
          const target = buildTargetObject(normalizedText, text, matchStr, dayRaw, '東', '1', null, null, blockRaw, numRaw, posRaw, options);
          if (target) results.push(target);
        }
      }
    }

    return results;
  }

  function buildTargetObject(normalizedText, originalText, matchStr, dayRaw, hallKanjiRaw, hallKanjiNumRaw, hallEngRaw, hallEngNumRaw, blockRaw, numRaw, posRaw, options) {
    const building = hallKanjiRaw || hallEngRaw || '東';
    const hallNum = hallKanjiNumRaw || hallEngNumRaw || '1';
    const buildingGroup = formatBuildingGroup(building, hallNum);

    const block = (blockRaw || '').toUpperCase();
    const spaceNum = numRaw || '';
    const posSuffix = (posRaw || 'a').toLowerCase();
    const fullSpace = `${spaceNum}${posSuffix}`;

    const dayCode = formatDayCode(dayRaw);
    const day = dayCode === 'D3' ? 'Day 3' : (dayCode === 'D2' ? 'Day 2' : 'Day 1');
    const fullLocation = `${dayCode} ${buildingGroup} ${block}-${fullSpace}`;

    let price = '';
    const priceMatch = normalizedText.match(EXPLICIT_PRICE_REGEX);
    if (priceMatch) {
      price = Number(priceMatch[1] || priceMatch[2]);
    }

    const authorMatch = originalText.match(/([^\s@＠]+)\s*[@＠]/);
    const circleName = authorMatch ? authorMatch[1].trim() : 'Unknown Circle';
    const artist = authorMatch ? authorMatch[1].trim() : '';

    let fixupUrl = '';
    let cunnyUrl = '';
    const fixupMatch = originalText.match(/https?:\/\/(?:www\.)?(?:fixupx\.com|cunnyx\.com|vxtwitter\.com|fxtwitter\.com)\/[^\s]+/i);
    if (fixupMatch) {
      fixupUrl = fixupMatch[0];
      cunnyUrl = fixupMatch[0];
    } else {
      const statusMatch = originalText.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([^\/]+)\/status\/([0-9]+)/i);
      if (statusMatch) {
        fixupUrl = `https://fixupx.com/${statusMatch[1]}/status/${statusMatch[2]}`;
        cunnyUrl = `https://cunnyx.com/${statusMatch[1]}/status/${statusMatch[2]}`;
      }
    }

    let description = '';
    const cleanLines = originalText.split(/\r?\n/).filter((l) => {
      const trimmed = l.trim();
      return trimmed && !trimmed.startsWith('http') && !trimmed.includes(matchStr);
    });
    if (cleanLines.length > 0) {
      description = cleanLines.slice(0, 3).join(' ').trim();
    }

    return {
      circleName,
      artist,
      day,
      dayCode,
      building: buildingGroup,
      hall: buildingGroup,
      block,
      spaceNum: fullSpace,
      space: `${block}-${fullSpace}`,
      fullLocation,
      day1Location: dayCode === 'D1' ? fullLocation : '',
      day2Location: dayCode === 'D2' ? fullLocation : '',
      day3Location: dayCode === 'D3' ? fullLocation : '',
      price,
      imageUrl: options.imageUrl || '',
      sourceUrl: options.sourceUrl || '',
      fixupUrl,
      cunnyUrl,
      description,
      fullText: originalText,
      timestamp: new Date().toISOString()
    };
  }

  const parserObj = {
    parse: parseComiketText,
    parseAll: parseAllComiketText,
    getCurrentComiketInfo: getCurrentComiketInfo,
    formatBuildingGroup: formatBuildingGroup,
    formatDayCode: formatDayCode,
    formatFullLocation: formatFullLocation
  };

  global.ComiketParser = parserObj;
  if (typeof exports !== 'undefined') {
    module.exports = parserObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
