import { caniuse, bcd } from './data.js';
import { convertBCDEntryToCanIUseEntry } from './bcd.js';

/**
 * parseKeywords() parses comma-separated keywords into a normalized hyphenated array
 */
export const parseKeywords = function parseKeywords(keywords) {
  return keywords
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => item.replaceAll(' ', '-'));
};

/**
 * findCanIUseResults() searches caniuse-db by key, firefox_id, keywords, or title
 */
export const findCanIUseResults = function findCanIUseResults(name) {
  const hyphenatedName = name.replaceAll(' ', '-');

  if (caniuse.data[hyphenatedName] !== undefined) {
    return [caniuse.data[hyphenatedName]];
  }

  return Object.keys(caniuse.data)
    .filter((key) => {
      const item = caniuse.data[key];
      const keywords = parseKeywords(item.keywords);

      return (
        item.firefox_id === name
        || keywords.includes(hyphenatedName)
        || key.includes(hyphenatedName)
        || item.title.replaceAll(' ', '-').includes(hyphenatedName)
        || keywords.join(',').includes(hyphenatedName)
      );
    })
    .map((key) => caniuse.data[key]);
};

/**
 * findBCDResults() searches MDN Browser Compat Data and converts matches to CanIUse format
 */
export const findBCDResults = function findBCDResults(name) {
  const bcdResults = [];
  const sections = Object.keys(bcd).filter((k) => !k.startsWith('__') && k !== 'browsers');

  for (const section of sections) {
    for (const [subsectionKey, subsection] of Object.entries(bcd[section])) {
      for (const [entryKey, entry] of Object.entries(subsection)) {
        for (const [subEntryKey, subEntry] of Object.entries(entry)) {
          if (subEntryKey === '__compat') {
            if (entryKey === name || entry.__compat.description?.includes(name)) {
              bcdResults.push({
                key: `mdn-${section}_${subsectionKey}_${entryKey}`,
                compatKey: `${section}.${subsectionKey}.${entryKey}`,
                origKey: entryKey,
                data: subEntry,
                prefix: `${section}.${subsectionKey}`,
              });
            }
          } else if (subEntry?.__compat) {
            if (subEntryKey === name || subEntry.__compat?.description?.includes(name)) {
              bcdResults.push({
                key: `mdn-${section}_${subsectionKey}_${entryKey}_${subEntryKey}`,
                compatKey: `${section}.${subsectionKey}.${entryKey}.${subEntryKey}`,
                origKey: subEntryKey,
                data: subEntry.__compat,
                prefix: `${section}.${subsectionKey}`,
              });
            }
          }
        }
      }
    }
  }

  return bcdResults.map((bcdResult) => convertBCDEntryToCanIUseEntry(bcdResult));
};

/**
 * findResult() returns combined BCD and CanIUse items matching a given feature name
 */
export const findResult = function findResult(name) {
  const caniuseResults = findCanIUseResults(name);
  const bcdResults = findBCDResults(name);

  if (caniuseResults.length > 0 || bcdResults.length > 0) {
    return [...bcdResults, ...caniuseResults];
  }

  return undefined;
};
