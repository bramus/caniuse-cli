import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const caniuse = require('caniuse-db/fulldata-json/data-2.0.json');
const bcd = require('@mdn/browser-compat-data');

// Inject key for each item in data object
Object.keys(caniuse.data).forEach((key) => {
  caniuse.data[key].key = key;
});

export { caniuse, bcd, require };
