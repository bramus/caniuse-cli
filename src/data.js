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

export {
  caniuse,
  bcd,
  webFeatures,
  caniuseBaselineMap,
  bcdBaselineMap,
  require,
};
