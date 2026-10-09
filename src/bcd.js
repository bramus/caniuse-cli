import { AGENTS, AGENTS_BCD, BCD_TITLE_MAP } from './constants.js';
import { caniuse } from './data.js';
import { findVersionIndex } from './utils/versions.js';

/**
 * convertBCDSupportToCanIUseStat() converts a BCD browser support entry into CanIUse version stats
 */
export const convertBCDSupportToCanIUseStat = function convertBCDSupportToCanIUseStat(
  agent,
  bcdSupport
) {
  const versionSupport = caniuse.agents[agent].version_list.map((agentVersionEntry) => ({
    support: 'x',
    version: agentVersionEntry.version,
  }));

  function processEntry(entry) {
    if (!entry || entry.version_added === false) {
      return;
    }

    // When there are multiple updates, BCD stores it as an array (most recent / primary first).
    // Process in reverse so newer/full support entries take precedence over older partial ones.
    if (Array.isArray(entry)) {
      [...entry].reverse().forEach((subEntry) => processEntry(subEntry));
      return;
    }

    let startIndex = 0;
    let endIndex = versionSupport.length - 1;

    if (entry.version_added) {
      // Fix for https://github.com/bramus/caniuse-cli/issues/2
      // When the version is not found in the list of released versions, color nothing
      const matchedIndex = findVersionIndex(versionSupport, entry.version_added);
      if (matchedIndex > -1) {
        startIndex = Math.max(startIndex, matchedIndex);
      } else {
        startIndex = versionSupport.length;
      }
    }

    if (entry.version_removed) {
      const removedIndex = findVersionIndex(versionSupport, entry.version_removed);
      if (removedIndex > -1) {
        endIndex = Math.min(endIndex, removedIndex - 1);
      }
    }

    const supportChar = entry.partial_implementation === true ? 'a' : 'y';
    for (let i = startIndex; i <= endIndex; i++) {
      versionSupport[i].support = supportChar;
    }

    // @TODO: Process prefix, stored in entry.prefix
    // @TODO: Process notes stored in entry.notes
  }

  processEntry(bcdSupport);

  return Object.fromEntries(
    versionSupport.map((entry) => [entry.version, entry.support])
  );
};

/**
 * convertBCDEntryToCanIUseEntry() converts a matched BCD feature
 * into a CanIUse-shaped feature object
 */
export const convertBCDEntryToCanIUseEntry = function convertBCDEntryToCanIUseEntry(bcdResult) {
  const {
    key,
    origKey,
    data,
    prefix,
  } = bcdResult;

  const stats = {};
  AGENTS_BCD.forEach((agentBcd, i) => {
    const agentCanIUse = AGENTS[i];
    stats[agentCanIUse] = convertBCDSupportToCanIUseStat(agentCanIUse, data.support[agentBcd]);
  });

  return {
    key,
    title: `${BCD_TITLE_MAP[prefix] ?? prefix}: ${data.description ?? origKey}`,
    description: '',
    spec: data.spec_url,
    notes: '',
    notes_by_num: [],
    stats,
  };
};
