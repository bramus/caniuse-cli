#!/usr/bin/env node

// TODO: parse markdown links in notes

const clc = require('cli-color');
const omelette = require('omelette');
const wordwrap = require('wordwrap');
const caniuse = require('caniuse-db/fulldata-json/data-2.0.json');
const bcd = require('@mdn/browser-compat-data');
const child_process = require('child_process')

const wrap = wordwrap(80);
const wrapNote = wordwrap.hard(4, 76);

const agents = ['chrome', 'edge', 'safari', 'firefox', 'ios_saf', 'and_chr'];
const agents_bcd = ['chrome', 'edge', 'safari', 'firefox', 'safari_ios', 'chrome_android'];
const defaultItemWidth = 10;

const bcdTitleMap = {
  'api.CSS': 'CSS API',
  'css.at-rules': 'CSS at-rule',
  'css.types': 'CSS Types',
  'css.properties': 'CSS Property',
  'css.selectors': 'CSS Selector',
}

/**
 * getCurrentAgentVersion() returns the current agent version
 */
const getCurrentAgentVersion = function getCurrentAgentVersion(agent) {
  try {
    return caniuse.agents[agent].current_version;
  } catch (error) {
    return undefined;
  }
};

/**
 * padCenter() returns fixed length string,
 * padding with padStr from both sides if necessary
 */
const padCenter = function padCenter(str, length = defaultItemWidth, padStr = ' ') {
  const padLen = ((length - str.length) / 2) + str.length;
  return str.padStart(Math.ceil(padLen), padStr).padEnd(length, padStr);
};

/**
 * printTableHeader() prints `caniuse` table header
 */
const printTableHeader = function printTableHeader(columnWidths) {
  agents.forEach((agent) => {
    const col = clc.black.bgWhite(padCenter(caniuse.agents[agent].browser, columnWidths[agent], ' '));
    process.stdout.write(col);
    process.stdout.write(' ');
  });

  process.stdout.write('\n');
};

/**
 * printTableRowItem prints `caniuse` table row column
 */
const printTableRowItem = function printTableRowItem(versionString, statArray, columnWidth) {
  const paddedVersionString = padCenter(versionString, columnWidth, ' ');

  // Support is indicated by the first entry in the statArray
  switch (statArray[0]) {
    case 'y': // (Y)es, supported by default
      process.stdout.write(clc.white.bgXterm(28)(paddedVersionString));
      return;
    case 'a': // (A)lmost supported (aka Partial support)
      process.stdout.write(clc.white.bgXterm(3)(paddedVersionString));
      return;
    case 'u': // Support (u)nknown
      process.stdout.write(clc.white.bgXterm(240)(paddedVersionString));
      return;
    case 'p': // No support, but has (P)olyfill
    case 'n': // (N)o support, or disabled by default
    case 'x': // Requires prefi(x) to work
    case 'd': // (D)isabled by default (need to enable flag or something)
    default:
      process.stdout.write(clc.white.bgXterm(124)(paddedVersionString));
  }
};

/**
 *  printTableRow prints `caniuse` trable row
 */
const printTableRow = function printTableRow(stats, index, columnWidths) {
  agents.forEach((agent, i) => {
    const dataItem = stats[agent][index];
    const columnWidth = columnWidths[agent];

    if (dataItem !== null) {
      printTableRowItem(dataItem.versionStringWithNotes, dataItem.statArray, columnWidth);
    } else {
      // Fill up cell with whitespace
      process.stdout.write(padCenter('', columnWidth, ' '));
    }

    // Space between the cells
    if (i < agents.length - 1) {
      if (dataItem && dataItem.currentVersion) {
        process.stdout.write(clc.bgBlackBright(' '));
      } else {
        process.stdout.write(' ');
      }
    }
  });

  process.stdout.write('\n');
};

const prepStats = function prepStats(stats) {
  const newStats = {};
  const agentPositions = {};
  const columnWidths = {};
  const allMatchedNotes = new Set();

  agents.forEach((agent) => {
    // Get original stats
    // @TODO: handle “all”
    const agentStats = stats[agent];

    // Get current agent version
    const currentVersion = getCurrentAgentVersion(agent);

    // Keep track of how many stats we added before the current version,
    // after the current version, and where the current version is in the reworked
    // set. We use these numbers to align the tables so that there is one row with
    // all the current versions
    let numBeforeCurrent = 0;
    let numAfterCurrent = 0;
    let indexOfCurrent = null;

    // Create groups of support
    // [
    //  { stat: 'n', versions: [1,2,3] },
    //  { stat: 'n #1', versions: [4,5,6] },
    //  { stat: 'a #2', versions: [7] },
    //  { stat: 'y', versions: [8,9,10,11,12] },
    //  { stat: 'y', versions: [13] }, <-- Current Version
    //  { stat: 'y', versions: [14,15,TP] }
    // ]
    const groupedStats = [];
    let prevStat = null;
    for (const version_list_entry of caniuse.agents[agent].version_list) {
      const { version } = version_list_entry;
      const stat = agentStats[version];

      const isCurrentVersion = (version === currentVersion);
      if (stat !== prevStat || isCurrentVersion) {
        const statArray = stat.split(' ');
        const matchedNotes = stat.split(' ').filter((s) => s.startsWith('#')).map((s) => s.substr(1));

        groupedStats.push({
          stat,
          statArray,
          matchedNotes,
          versions: [version],
          currentVersion: isCurrentVersion,
        });

        matchedNotes.forEach((n) => allMatchedNotes.add(n));

        if (isCurrentVersion) {
          indexOfCurrent = groupedStats.length - 1;
        } else if (indexOfCurrent === null) {
          numBeforeCurrent++;
        } else {
          numAfterCurrent++;
        }
      } else {
        groupedStats[groupedStats.length - 1].versions.push(version);
      }

      // Store prevStat. Set it to null when isCurrentVersion
      // to make sure the currentVersion has its own entry
      prevStat = isCurrentVersion ? null : stat;
    }

    // Flatten the versions
    // E.g.  [1,2,3] --> '1-3'
    for (const entry of groupedStats) {
      const { versions } = entry;
      let versionString = '';
      if (versions.length === 1) {
        versionString = versions[0]; // eslint-disable-line prefer-destructuring
      } else {
        const firstVersion = versions[0].split('-')[0];
        const lastVersion = versions[versions.length - 1].includes('-') ? versions[versions.length - 1].split('-')[1] : versions[versions.length - 1];
        versionString = `${firstVersion}-${lastVersion}`;
      }
      entry.versionString = versionString;

      if (!entry.matchedNotes.length) {
        entry.versionStringWithNotes = versionString;
      } else {
        entry.versionStringWithNotes = `${versionString} [${entry.matchedNotes.join(',')}]`;
      }
    }

    newStats[agent] = groupedStats;
    agentPositions[agent] = {
      numBeforeCurrent,
      numAfterCurrent,
    };
  });

  // Extract the columnWidth per agent.
  // This is derived from the entry with the largest amount of characters
  agents.forEach((agent) => {
    const stringLengths = newStats[agent].map((a) => a.versionStringWithNotes.length);
    const maxStringLength = Math.max(
      ...stringLengths,
      caniuse.agents[agent].browser.length,
      defaultItemWidth
    );
    columnWidths[agent] = maxStringLength + 2;
  });

  // Pad the data per agent, so that each agent
  // has the same amount of entries before and after the current.
  // It’ll result in the current version for each agent being on the same line in the table.
  const maxNumBeforeCurrent = Math.max(
    ...Object.values(agentPositions)
      .map((agentPositionInfo) => agentPositionInfo.numBeforeCurrent)
  );
  const maxNumAfterCurrent = Math.max(
    ...Object.values(agentPositions)
      .map((agentPositionInfo) => agentPositionInfo.numAfterCurrent)
  );
  agents.forEach((agent) => {
    if (agentPositions[agent].numBeforeCurrent < maxNumBeforeCurrent) {
      for (let i = 0; i < maxNumBeforeCurrent - agentPositions[agent].numBeforeCurrent; i++) {
        newStats[agent].unshift(null);
      }
    }
    if (agentPositions[agent].numAfterCurrent < maxNumAfterCurrent) {
      for (let i = 0; i < maxNumAfterCurrent - agentPositions[agent].numAfterCurrent; i++) {
        newStats[agent].push(null);
      }
    }
  });

  return {
    stats: newStats,
    numRows: maxNumBeforeCurrent + maxNumAfterCurrent,
    matchedNotes: Array.from(allMatchedNotes).sort((a, b) => a - b),
    columnWidths,
  };
};

/**
 * printItem() prints `caniuse` results for specified item
 */
const printItem = function printItem(item) {
  const {
    stats, numRows, matchedNotes, columnWidths,
  } = prepStats(item.stats);
  console.log(clc.bold(wrap(`${(item.title ?? '(?)').replaceAll('<code>', '`').replaceAll('</code>', '`')}`))); // @TODO: More HTML to strip?
  console.log(clc.underline(`https://caniuse.com/#feat=${item.key}`));
  console.log();
  if (item.description) {
    console.log(wrap(item.description));
    console.log();
  }
  printTableHeader(columnWidths);
  for (let i = 0; i <= numRows; i++) {
    printTableRow(stats, i, columnWidths);
  }

  if (item.notes) {
    console.log();
    console.log(wrap(`Notes: ${item.notes}`));
  }

  if (matchedNotes && matchedNotes.length) {
    console.log();
    console.log('Notes by number:');
    console.log();
    matchedNotes.forEach((num) => {
      const note = item.notes_by_num[num];
      console.log(wrapNote(`[${num}] ${note}`).trimLeft());
    });
  }
  console.log();
};

/**
 * parseKeywords() parses keywords from string
 * returns parsed array of keywords
 */
const parseKeywords = function parseKeywords(keywords) {
  const parsedKeywords = [];

  keywords.split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .forEach((item) => {
      parsedKeywords.push(item.replaceAll(' ', '-'));
    });

  return parsedKeywords;
};

/**
 * parseVersion() parses a "major" or "major.minor" version string into a numeric [major, minor] tuple.
 */
const parseVersion = function parseVersion(versionStr) {
  const [major, minor = 0] = String(versionStr).split('.').map(Number);
  return [major, minor];
};

/**
 * compareVersions() compares two version strings numerically.
 */
const compareVersions = function compareVersions(a, b) {
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
const findVersionIndex = function findVersionIndex(versionSupport, bcdVersion) {
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

const convertBCDSupportToCanIUseStat = function convertBCDSupportToCanIUseStat(agent, bcdSupport) {
  let versionSupport = [];

  // Prefill all versions with no support
  const allAgentVersions = caniuse.agents[agent].version_list;
  for (const agentVersionEntry of allAgentVersions) {
    versionSupport.push({
      support: 'x',
      version: agentVersionEntry.version,
    });
  }

  function process(bcdSupport, versionSupport) {
    // There is no BCD available for the agent
    if (!bcdSupport) return;

    // This feature was never released if version_added is false
    if (bcdSupport.version_added === false) {
      return;
    }

    // When there are multiple updates, BCD stores it as an array (most recent / primary first).
    // Process in reverse so newer/full support entries take precedence over older partial ones.
    if (Array.isArray(bcdSupport)) {
      [...bcdSupport].reverse().forEach(subEntry => process(subEntry, versionSupport));
      return;
    }
  
    // This feature was released, now determine the start and end offsets in the versions array
    let startIndex = 0;
    let endIndex = versionSupport.length - 1;

    if (bcdSupport.version_added) {
      // Fix for https://github.com/bramus/caniuse-cli/issues/2
      // When the version is not found in the list of released versions, color nothing
      const matchedIndex = findVersionIndex(versionSupport, bcdSupport.version_added);
      if (matchedIndex > -1) {
        startIndex = Math.max(startIndex, matchedIndex);
      } else {
        startIndex = versionSupport.length;
      }
    }
    if (bcdSupport.version_removed) {
      const removedIndex = findVersionIndex(versionSupport, bcdSupport.version_removed);
      if (removedIndex > -1) {
        endIndex = Math.min(endIndex, removedIndex - 1);
      }
    }

    const supportChar = (bcdSupport.partial_implementation === true) ? 'a' : 'y';
    for (let i = startIndex; i <= endIndex; i++) {
      versionSupport[i].support = supportChar;
    }

    // @TODO: Process prefix, stored in bcdSupport.prefix
    // @TODO: Process notes stored in bcdSupport.notes

    return versionSupport;
  }

  process(bcdSupport, versionSupport);

  // Return as object
  return versionSupport.reduce((toReturn, entry) => {
    toReturn[entry.version] = entry.support;
    return toReturn;
  }, {});
}

const convertBCDEntryToCanIUseEntry = function convertBCDEntryToCanIUseEntry(bcdResult) {
  const {
    key,
    origKey,
    data,
    prefix,
  } = bcdResult;

  const toReturn = {
    key,
    title: `${bcdTitleMap[prefix] ?? `${prefix}`}: ${data.description ?? origKey}`,
    description: '',
    spec: data.spec_url,
    notes: '',
    notes_by_num: [],
    stats: {}, // To be filled on the next few lines …
  };

  agents_bcd.forEach((agent_bcd, i) => {
    // Map BCD agent to CIU agent
    const agent_caniuse = agents[i];
    toReturn.stats[agent_caniuse] = convertBCDSupportToCanIUseStat(agent_caniuse, data.support[agent_bcd]);
  });

  return toReturn;
};

/**
 * findResult() returns `caniuse` item matching given name
 */
const findResult = function findResult(name) {
  // Check CanIUse
  let caniuseResults = [];
  if (caniuse.data[name.replaceAll(' ', '-')] !== undefined) {
    caniuseResults = [caniuse.data[name.replaceAll(' ', '-')]];
  } else {
    // find caniuse items matching by keyword or firefox_id
    caniuseResults = Object.keys(caniuse.data).filter((key) => {
      const keywords = parseKeywords(caniuse.data[key].keywords);
  
      return caniuse.data[key].firefox_id === name
        || keywords.includes(name.replaceAll(' ', '-'))
        || key.includes(name.replaceAll(' ', '-'))
        || caniuse.data[key].title.replaceAll(' ','-').includes(name.replaceAll(' ', '-'))
        || keywords.join(',').includes(name.replaceAll(' ', '-'));
    })
    .reduce((list, key) => list.concat(caniuse.data[key]), []);
  }

  // Check BCD
  let bcdResults = [];
  for (const section of Object.keys(bcd).filter(k => !k.startsWith('__') && k !== 'browsers')) { // css, js, html, …
    for (const [subsectionKey, subsection] of Object.entries(bcd[section])) { // css: at-rules, properties, …
      for (const [entryKey, entry] of Object.entries(subsection)) { // properties: writing_mode, word-wrap, …
        for (const [subEntryKey, subEntry] of Object.entries(entry)) { // writing-mode: __compat, horizontal-tb, lr, lr-tb, …
          if (subEntryKey == '__compat') {
            if (entryKey === name || entry['__compat'].description?.includes(name)) {
              bcdResults.push({
                key: `mdn-${section}_${subsectionKey}_${entryKey}`,
                origKey: entryKey,
                data: subEntry,
                prefix: `${section}.${subsectionKey}`,
              });
            }
          } else if (subEntry?.__compat) {
            if (subEntryKey === name || subEntry['__compat']?.description?.includes(name)) {
              bcdResults.push({
                key: `mdn-${section}_${subsectionKey}_${entryKey}_${subEntryKey}`,
                origKey: subEntryKey,
                data: subEntry['__compat'],
                prefix: `${section}.${subsectionKey}`,
              });
            }
          }
        }
      }
    }
  }
  bcdResults = bcdResults.map(bcdResult => convertBCDEntryToCanIUseEntry(bcdResult));

  // return array of matches
  if (caniuseResults.length > 0 || bcdResults.length > 0) {
    return [...bcdResults, ...caniuseResults];
  }

  return undefined;
};

/**
 * omelette tab completion results for first argument
 */
const firstArgument = ({ reply }) => {
  // add all keys
  const dataKeys = Object.keys(caniuse.data);

  // add keywords and firefox_id's
  const otherKeys = Object.keys(caniuse.data).reduce((keys, item) => {
    let newKeys = [];
    const { firefox_id, keywords } = caniuse.data[item];

    if (firefox_id && firefox_id.length > 0) {
      newKeys.push(firefox_id);
    }

    newKeys = newKeys.concat(parseKeywords(keywords));

    return [].concat(keys, newKeys);
  });

  reply([].concat(dataKeys, otherKeys));
};

// initialize omelette tab completion
omelette`caniuse ${firstArgument}`.init();

// inject key for each item in data object
Object.keys(caniuse.data).forEach((key) => {
  caniuse.data[key].key = key;
});

/**
 * getCommandName() returns the CLI command name based on how the script was invoked
 */
const getCommandName = function getCommandName() {
  if (process.env.npm_lifecycle_event === 'npx' || process.env.npm_command === 'exec') {
    return 'npx caniuse';
  }
  return 'caniuse';
};

/**
 * detectPackageManager() detects which package manager installed caniuse-cli
 */
const detectPackageManager = function detectPackageManager() {
  const userAgent = process.env.npm_config_user_agent || '';
  if (userAgent.startsWith('pnpm') || /[\\/]\.?pnpm[\\/]/.test(__dirname)) {
    return 'pnpm';
  }
  if (userAgent.startsWith('bun') || /[\\/]\.?bun[\\/]/.test(__dirname)) {
    return 'bun';
  }
  if (userAgent.startsWith('yarn') || /[\\/]\.?yarn[\\/]/.test(__dirname)) {
    return 'yarn';
  }
  return 'npm';
};

/**
 * fetchLatestVersion() queries the npm registry directly for a package's latest version
 */
const fetchLatestVersion = async function fetchLatestVersion(pkgName) {
  const res = await fetch(`https://registry.npmjs.org/${pkgName}/latest`);
  if (!res.ok) {
    throw new Error(`Failed to fetch latest version for ${pkgName} (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.version;
};

/**
 * updateDatabases() checks if caniuse-db or @mdn/browser-compat-data are outdated and updates them in __dirname
 */
const updateDatabases = async function updateDatabases() {
  console.log('Checking for database updates …');

  const caniuseVersionLocal = require('caniuse-db/package.json').version;
  const bcdVersionLocal = bcd.__meta.version;

  let caniuseVersionRemote;
  let bcdVersionRemote;
  try {
    [caniuseVersionRemote, bcdVersionRemote] = await Promise.all([
      fetchLatestVersion('caniuse-db'),
      fetchLatestVersion('@mdn/browser-compat-data'),
    ]);
  } catch (error) {
    console.error(clc.red(`Could not check for updates: ${error.message}`));
    process.exitCode = 1;
    return;
  }

  const caniuseOutdated = caniuseVersionLocal !== caniuseVersionRemote;
  const bcdOutdated = bcdVersionLocal !== bcdVersionRemote;

  if (!caniuseOutdated && !bcdOutdated) {
    console.log(clc.green('Databases are already up to date!'));
    return;
  }

  const packagesToUpdate = [];
  if (caniuseOutdated) {
    console.log(`- caniuse-db: ${caniuseVersionLocal} → ${clc.green(caniuseVersionRemote)}`);
    packagesToUpdate.push('caniuse-db@latest');
  }
  if (bcdOutdated) {
    console.log(`- @mdn/browser-compat-data: ${bcdVersionLocal} → ${clc.green(bcdVersionRemote)}`);
    packagesToUpdate.push('@mdn/browser-compat-data@latest');
  }

  const pm = detectPackageManager();
  const installSubcommand = pm === 'npm' ? 'install --no-save' : (pm === 'bun' ? 'add --no-save' : 'add');
  const cmd = `${pm} ${installSubcommand} ${packagesToUpdate.join(' ')}`;

  console.log(`\nUpdating databases using ${pm} …`);
  try {
    child_process.execSync(cmd, { cwd: __dirname, stdio: 'inherit' });
    console.log(clc.green('\nDatabases updated successfully!'));
  } catch (error) {
    console.error(clc.red(`\nFailed to update databases (${error.message}).`));
    if (process.platform !== 'win32') {
      console.error(clc.yellow(`If installed globally in a system directory, try running \`sudo ${getCommandName()} --update\`.`));
    }
    process.exitCode = 1;
  }
};

const MAX_DB_AGE_DAYS = 30;

/**
 * checkDatabaseAge() checks the built-in timestamps of caniuse-db and BCD
 * and prints a reminder if either database is older than MAX_DB_AGE_DAYS.
 */
const checkDatabaseAge = function checkDatabaseAge() {
  const caniuseUpdatedMs = caniuse.updated * 1000;
  const bcdUpdatedMs = new Date(bcd.__meta.timestamp).getTime();
  const oldestUpdatedMs = Math.min(caniuseUpdatedMs, bcdUpdatedMs);
  const ageInDays = Math.floor((Date.now() - oldestUpdatedMs) / (1000 * 60 * 60 * 24));

  if (ageInDays >= MAX_DB_AGE_DAYS) {
    console.log(clc.yellow(`💡 Your local browser compatibility data is ${ageInDays} days old. Run \`${getCommandName()} --update\` to update it.`));
    console.log();
  }
};

// find and display result
const name = process.argv[2];
if (name) {
  if (name === '--update') {
    updateDatabases();
  } else {
    const res = findResult(name.toLowerCase());

    if (res !== undefined) {
      res.forEach((item) => printItem(item));
    } else {
      console.log('Nothing was found');
    }

    checkDatabaseAge();
  }
} else {
  console.log(`Please pass in an argument, e.g. \`${getCommandName()} viewport-units\``)
}
