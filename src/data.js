import fs from 'node:fs';
import { createRequire } from 'node:module';
import { features as webFeatures } from 'web-features';

const require = createRequire(import.meta.url);
const caniuse = require('caniuse-db/fulldata-json/data-2.0.json');
const bcd = require('@mdn/browser-compat-data');

const caniuseBaselineMap = new Map();
const bcdBaselineMap = new Map();

Object.values(webFeatures).forEach((feature) => {
  if (feature.kind !== 'feature' || !feature.status) {
    return;
  }

  (feature.caniuse || []).forEach((caniuseKey) => {
    caniuseBaselineMap.set(caniuseKey, feature.status);
  });

  (feature.compat_features || []).forEach((compatKey) => {
    bcdBaselineMap.set(compatKey, feature.status.by_compat_key?.[compatKey] ?? feature.status);
  });
});

// Inject key and baseline status for each item in data object
Object.keys(caniuse.data).forEach((key) => {
  caniuse.data[key].key = key;
  const baseline = caniuseBaselineMap.get(key);
  if (baseline) {
    caniuse.data[key].baseline = baseline;
  }
});

/**
 * getCliVersion() returns the version of the installed CLI binary
 */
const getCliVersion = function getCliVersion() {
  return require('../package.json').version;
};

/**
 * getDatabaseVersions() returns the installed versions of BCD, caniuse-db, and web-features
 */
const getDatabaseVersions = function getDatabaseVersions() {
  const webFeaturesPkgUrl = new URL('./package.json', import.meta.resolve('web-features'));
  return {
    bcd: bcd.__meta.version,
    caniuse: require('caniuse-db/package.json').version,
    webFeatures: JSON.parse(fs.readFileSync(webFeaturesPkgUrl, 'utf8')).version,
  };
};

export {
  caniuse,
  bcd,
  webFeatures,
  caniuseBaselineMap,
  bcdBaselineMap,
  getCliVersion,
  getDatabaseVersions,
  require,
};
