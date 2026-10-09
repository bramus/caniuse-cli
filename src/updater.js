import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_DB_AGE_DAYS } from './constants.js';
import { caniuse, bcd, require } from './data.js';
import { color } from './utils/text.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * getCommandName() returns the CLI command name based on how the script was invoked
 */
export const getCommandName = function getCommandName() {
  if (process.env.npm_lifecycle_event === 'npx' || process.env.npm_command === 'exec') {
    return 'npx @bramus/caniuse-cli';
  }
  return 'caniuse';
};

/**
 * detectPackageManager() detects which package manager installed caniuse-cli
 */
export const detectPackageManager = function detectPackageManager() {
  const userAgent = process.env.npm_config_user_agent || '';
  if (userAgent.startsWith('pnpm') || /[\\/]\.?pnpm[\\/]/.test(rootDir)) {
    return 'pnpm';
  }
  if (userAgent.startsWith('bun') || /[\\/]\.?bun[\\/]/.test(rootDir)) {
    return 'bun';
  }
  if (userAgent.startsWith('yarn') || /[\\/]\.?yarn[\\/]/.test(rootDir)) {
    return 'yarn';
  }
  return 'npm';
};

/**
 * fetchLatestVersion() queries the npm registry directly for a package's latest version
 */
export const fetchLatestVersion = async function fetchLatestVersion(pkgName) {
  const res = await fetch(`https://registry.npmjs.org/${pkgName}/latest`);
  if (!res.ok) {
    throw new Error(`Failed to fetch latest version for ${pkgName} (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.version;
};

/**
 * updateDatabases() checks if caniuse-db, @mdn/browser-compat-data, or web-features
 * are outdated and updates them in rootDir
 */
export const updateDatabases = async function updateDatabases() {
  console.log('Checking for database updates …');

  const caniuseVersionLocal = require('caniuse-db/package.json').version;
  const bcdVersionLocal = bcd.__meta.version;
  const webFeaturesPkgUrl = new URL('./package.json', import.meta.resolve('web-features'));
  const webFeaturesVersionLocal = JSON.parse(fs.readFileSync(webFeaturesPkgUrl, 'utf8')).version;

  let caniuseVersionRemote;
  let bcdVersionRemote;
  let webFeaturesVersionRemote;
  try {
    [caniuseVersionRemote, bcdVersionRemote, webFeaturesVersionRemote] = await Promise.all([
      fetchLatestVersion('caniuse-db'),
      fetchLatestVersion('@mdn/browser-compat-data'),
      fetchLatestVersion('web-features'),
    ]);
  } catch (error) {
    console.error(color.red(`Could not check for updates: ${error.message}`));
    process.exitCode = 1;
    return;
  }

  const caniuseOutdated = caniuseVersionLocal !== caniuseVersionRemote;
  const bcdOutdated = bcdVersionLocal !== bcdVersionRemote;
  const webFeaturesOutdated = webFeaturesVersionLocal !== webFeaturesVersionRemote;

  if (!caniuseOutdated && !bcdOutdated && !webFeaturesOutdated) {
    console.log(color.green('Databases are already up to date!'));
    return;
  }

  const packagesToUpdate = [];
  if (caniuseOutdated) {
    console.log(`- caniuse-db: ${caniuseVersionLocal} → ${color.green(caniuseVersionRemote)}`);
    packagesToUpdate.push('caniuse-db@latest');
  }
  if (bcdOutdated) {
    console.log(`- @mdn/browser-compat-data: ${bcdVersionLocal} → ${color.green(bcdVersionRemote)}`);
    packagesToUpdate.push('@mdn/browser-compat-data@latest');
  }
  if (webFeaturesOutdated) {
    console.log(`- web-features: ${webFeaturesVersionLocal} → ${color.green(webFeaturesVersionRemote)}`);
    packagesToUpdate.push('web-features@latest');
  }

  const pm = detectPackageManager();
  let installSubcommand = 'add';
  if (pm === 'npm') {
    installSubcommand = 'install --no-save';
  } else if (pm === 'bun') {
    installSubcommand = 'add --no-save';
  }
  const cmd = `${pm} ${installSubcommand} ${packagesToUpdate.join(' ')}`;

  console.log(`\nUpdating databases using ${pm} …`);
  try {
    execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
    console.log(color.green('\nDatabases updated successfully!'));
  } catch (error) {
    console.error(color.red(`\nFailed to update databases (${error.message}).`));
    if (process.platform !== 'win32') {
      console.error(color.yellow(`If installed globally in a system directory, try running \`sudo ${getCommandName()} --update\`.`));
    }
    process.exitCode = 1;
  }
};

/**
 * checkDatabaseAge() checks the built-in timestamps of caniuse-db and BCD
 * and prints a reminder if either database is older than MAX_DB_AGE_DAYS.
 */
export const checkDatabaseAge = function checkDatabaseAge() {
  const caniuseUpdatedMs = caniuse.updated * 1000;
  const bcdUpdatedMs = new Date(bcd.__meta.timestamp).getTime();
  const oldestUpdatedMs = Math.min(caniuseUpdatedMs, bcdUpdatedMs);
  const ageInDays = Math.floor((Date.now() - oldestUpdatedMs) / (1000 * 60 * 60 * 24));

  if (ageInDays >= MAX_DB_AGE_DAYS) {
    console.log(color.yellow(`💡 Your local browser compatibility data is ${ageInDays} days old. Run \`${getCommandName()} --update\` to update it.`));
    console.log();
  }
};
