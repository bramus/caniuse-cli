import { AGENTS, DEFAULT_ITEM_WIDTH } from './constants.js';
import { caniuse } from './data.js';
import {
  padCenter,
  wrap,
  wrapNote,
  color,
} from './utils/text.js';
import { getCurrentAgentVersion } from './utils/versions.js';

/**
 * printTableHeader() prints `caniuse` table header
 */
export const printTableHeader = function printTableHeader(columnWidths) {
  AGENTS.forEach((agent) => {
    const col = color.headerCell(padCenter(caniuse.agents[agent].browser, columnWidths[agent], ' '));
    process.stdout.write(col);
    process.stdout.write(' ');
  });

  process.stdout.write('\n');
};

/**
 * printTableRowItem() prints `caniuse` table row column
 */
export const printTableRowItem = function printTableRowItem(versionString, statArray, columnWidth) {
  const paddedVersionString = padCenter(versionString, columnWidth, ' ');

  switch (statArray[0]) {
    case 'y': // (Y)es, supported by default
      process.stdout.write(color.whiteOnXterm(28, paddedVersionString));
      return;
    case 'a': // (A)lmost supported (aka Partial support)
      process.stdout.write(color.whiteOnXterm(3, paddedVersionString));
      return;
    case 'u': // Support (u)nknown
      process.stdout.write(color.whiteOnXterm(240, paddedVersionString));
      return;
    case 'p': // No support, but has (P)olyfill
    case 'n': // (N)o support, or disabled by default
    case 'x': // Requires prefi(x) to work
    case 'd': // (D)isabled by default (need to enable flag or something)
    default:
      process.stdout.write(color.whiteOnXterm(124, paddedVersionString));
  }
};

/**
 * printTableRow() prints a single `caniuse` table row across all agents
 */
export const printTableRow = function printTableRow(stats, index, columnWidths) {
  AGENTS.forEach((agent, i) => {
    const dataItem = stats[agent][index];
    const columnWidth = columnWidths[agent];

    if (dataItem !== null) {
      printTableRowItem(dataItem.versionStringWithNotes, dataItem.statArray, columnWidth);
    } else {
      process.stdout.write(padCenter('', columnWidth, ' '));
    }

    if (i < AGENTS.length - 1) {
      if (dataItem && dataItem.currentVersion) {
        process.stdout.write(color.bgBlackBright(' '));
      } else {
        process.stdout.write(' ');
      }
    }
  });

  process.stdout.write('\n');
};

/**
 * prepStats() groups consecutive versions with identical support
 * and aligns rows around the current browser version
 */
export const prepStats = function prepStats(stats) {
  const newStats = {};
  const agentPositions = {};
  const columnWidths = {};
  const allMatchedNotes = new Set();

  AGENTS.forEach((agent) => {
    const agentStats = stats[agent];
    const currentVersion = getCurrentAgentVersion(agent);

    let numBeforeCurrent = 0;
    let numAfterCurrent = 0;
    let indexOfCurrent = null;

    const groupedStats = [];
    let prevStat = null;

    for (const { version } of caniuse.agents[agent].version_list) {
      const stat = agentStats[version];
      const isCurrentVersion = version === currentVersion;

      if (stat !== prevStat || isCurrentVersion) {
        const statArray = stat.split(' ');
        const matchedNotes = statArray
          .filter((s) => s.startsWith('#'))
          .map((s) => s.slice(1));

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

      prevStat = isCurrentVersion ? null : stat;
    }

    for (const entry of groupedStats) {
      const { versions } = entry;
      let versionString = '';

      if (versions.length === 1) {
        [versionString] = versions;
      } else {
        const firstVersion = versions[0].split('-')[0];
        const lastRaw = versions[versions.length - 1];
        const lastVersion = lastRaw.includes('-') ? lastRaw.split('-')[1] : lastRaw;
        versionString = `${firstVersion}-${lastVersion}`;
      }

      entry.versionString = versionString;
      entry.versionStringWithNotes = entry.matchedNotes.length
        ? `${versionString} [${entry.matchedNotes.join(',')}]`
        : versionString;
    }

    newStats[agent] = groupedStats;
    agentPositions[agent] = {
      numBeforeCurrent,
      numAfterCurrent,
    };
  });

  AGENTS.forEach((agent) => {
    const stringLengths = newStats[agent].map((a) => a.versionStringWithNotes.length);
    const maxStringLength = Math.max(
      ...stringLengths,
      caniuse.agents[agent].browser.length,
      DEFAULT_ITEM_WIDTH
    );
    columnWidths[agent] = maxStringLength + 2;
  });

  const maxNumBeforeCurrent = Math.max(
    ...Object.values(agentPositions).map((info) => info.numBeforeCurrent)
  );
  const maxNumAfterCurrent = Math.max(
    ...Object.values(agentPositions).map((info) => info.numAfterCurrent)
  );

  AGENTS.forEach((agent) => {
    const padBefore = maxNumBeforeCurrent - agentPositions[agent].numBeforeCurrent;
    for (let i = 0; i < padBefore; i++) {
      newStats[agent].unshift(null);
    }

    const padAfter = maxNumAfterCurrent - agentPositions[agent].numAfterCurrent;
    for (let i = 0; i < padAfter; i++) {
      newStats[agent].push(null);
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
 * formatBaselineStatus() formats a web-features status object with Baseline color coding:
 *  - green = widely available (high)
 *  - blue = newly available (low)
 *  - orange = limited availability (false)
 */
export const formatBaselineStatus = function formatBaselineStatus(status) {
  if (!status || status.baseline === undefined) {
    return null;
  }

  if (status.baseline === 'high') {
    const sinceDate = status.baseline_high_date || status.baseline_low_date;
    const sinceSuffix = sinceDate ? ` (since ${sinceDate})` : '';
    return color.green(`Baseline: Widely available across major browsers${sinceSuffix}`);
  }

  if (status.baseline === 'low') {
    const lowDate = status.baseline_low_date;
    const year = lowDate ? ` ${lowDate.replace(/^≤/, '').slice(0, 4)}` : '';
    const sinceSuffix = lowDate ? ` (since ${lowDate})` : '';
    return color.blue(`Baseline${year}: Newly available across major browsers${sinceSuffix}`);
  }

  return color.orange('Baseline: Limited availability across major browsers');
};

/**
 * printItem() prints `caniuse` results for a specified feature item
 */
export const printItem = function printItem(item) {
  const {
    stats,
    numRows,
    matchedNotes,
    columnWidths,
  } = prepStats(item.stats);

  const formattedTitle = (item.title ?? '(?)').replaceAll('<code>', '`').replaceAll('</code>', '`');
  console.log(color.bold(wrap(formattedTitle)));
  console.log(color.underline(`https://caniuse.com/#feat=${item.key}`));
  if (item.baseline) {
    const baselineLine = formatBaselineStatus(item.baseline);
    if (baselineLine) {
      console.log(baselineLine);
    }
  }
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
      console.log(wrapNote(`[${num}] ${note}`).trimStart());
    });
  }

  console.log();
};
