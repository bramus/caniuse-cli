import { caniuse } from '../data.js';

/**
 * getCurrentAgentVersion() returns the current agent version
 */
export const getCurrentAgentVersion = function getCurrentAgentVersion(agent) {
  return caniuse.agents[agent]?.current_version;
};

/**
 * parseVersion() parses a "major" or "major.minor" version string
 * into a numeric [major, minor] tuple.
 */
export const parseVersion = function parseVersion(versionStr) {
  const [major, minor = 0] = String(versionStr).split('.').map(Number);
  return [major, minor];
};

/**
 * compareVersions() compares two version strings numerically.
 */
export const compareVersions = function compareVersions(a, b) {
  const [aMajor, aMinor] = parseVersion(a);
  const [bMajor, bMinor] = parseVersion(b);
  if (aMajor !== bMajor) {
    return aMajor - bMajor;
  }
  return aMinor - bMinor;
};

/**
 * findVersionIndex() locates a BCD version within caniuse’s chronological version list.
 *
 * Handles several mismatches between BCD and caniuse-db:
 *  - BCD expresses “supported in this version or earlier” as a “≤”-prefixed
 *    range (e.g. "≤37"). We strip the prefix and treat it as that version.
 *  - BCD uses "preview" where caniuse uses "TP" (for Safari Technology Preview).
 *  - BCD stores bare major versions (e.g. "18") or specific minor versions (e.g. "14.5")
 *    where caniuse uses dotted versions ("18.0") or version ranges ("14.5-14.8").
 *  - BCD may list versions older than the first version tracked by caniuse-db
 *    (e.g. "1" when Chrome starts at "4", or "117" when Chrome for Android only tracks "154").
 *    Finding the first caniuse entry whose upper bound is >= the BCD version maps these to index 0,
 *    while still returning -1 for unreleased future versions.
 */
export const findVersionIndex = function findVersionIndex(versionSupport, bcdVersion) {
  // Normalise BCD “≤X” ranged versions (e.g. "≤37") down to the bare version.
  const normalizedVersion = String(bcdVersion).replace(/^≤/, '');

  if (normalizedVersion === 'preview') {
    return versionSupport.findIndex((e) => e.version === 'TP');
  }

  return versionSupport.findIndex((e) => {
    if (e.version === 'TP') {
      return false;
    }
    const entryMaxVersion = String(e.version).split('-').pop();
    return compareVersions(entryMaxVersion, normalizedVersion) >= 0;
  });
};
