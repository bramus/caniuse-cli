#!/usr/bin/env node

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initCompletion } from './src/completion.js';
import {
  printItem,
  printHelp,
  printVersion,
  printVersions,
  prepStats,
  formatBaselineStatus,
} from './src/printer.js';
import { getCliVersion, getDatabaseVersions } from './src/data.js';
import { findResult, parseKeywords } from './src/search.js';
import {
  getCommandName,
  detectPackageManager,
  updateDatabases,
  checkDatabaseAge,
} from './src/updater.js';
import { padCenter, createWordWrap } from './src/utils/text.js';
import {
  getCurrentAgentVersion,
  parseVersion,
  compareVersions,
  findVersionIndex,
} from './src/utils/versions.js';
import {
  convertBCDSupportToCanIUseStat,
  convertBCDEntryToCanIUseEntry,
} from './src/bcd.js';

const isDirectRun = process.argv[1]
  && fs.existsSync(process.argv[1])
  && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isDirectRun) {
  initCompletion();

  const name = process.argv[2];
  if (name) {
    if (name === '--help' || name === '-h') {
      printHelp();
    } else if (name === '--version' || name === '-v') {
      printVersion();
    } else if (name === '--versions') {
      printVersions();
    } else if (name === '--update') {
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
    console.log(`Please pass in an argument, e.g. \`${getCommandName()} viewport-units\`, or pass \`--help\` to print out help.`);
  }
}

export {
  getCurrentAgentVersion,
  getCliVersion,
  getDatabaseVersions,
  padCenter,
  createWordWrap,
  prepStats,
  formatBaselineStatus,
  printHelp,
  printVersion,
  printVersions,
  parseKeywords,
  parseVersion,
  compareVersions,
  findVersionIndex,
  convertBCDSupportToCanIUseStat,
  convertBCDEntryToCanIUseEntry,
  findResult,
  getCommandName,
  detectPackageManager,
  checkDatabaseAge,
};
