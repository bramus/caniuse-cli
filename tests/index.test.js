const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const caniuse = require('caniuse-db/fulldata-json/data-2.0.json');
const bcd = require('@mdn/browser-compat-data');

const {
  padCenter,
  prepStats,
  parseKeywords,
  parseVersion,
  compareVersions,
  findVersionIndex,
  convertBCDSupportToCanIUseStat,
  findResult,
  getCommandName,
  detectPackageManager,
  checkDatabaseAge,
} = require('../index.js');

const cliPath = path.join(__dirname, '..', 'index.js');

describe('String & keyword helpers', () => {
  it('padCenter() pads strings evenly on both sides', () => {
    assert.equal(padCenter('Chrome', 10, ' '), '  Chrome  ');
    assert.equal(padCenter('Edge', 10, ' '), '   Edge   ');
    assert.equal(padCenter('Safari', 6, ' '), 'Safari');
  });

  it('parseKeywords() splits comma-separated keywords and hyphenates spaces', () => {
    assert.deepEqual(
      parseKeywords('css, viewport units,  grid layout , '),
      ['css', 'viewport-units', 'grid-layout']
    );
  });
});

describe('Version parsing & matching (findVersionIndex)', () => {
  const mockSafariVersions = [
    { version: '3.1' },
    { version: '14.0-14.4' },
    { version: '14.5-14.8' },
    { version: '15' },
    { version: '15.1' },
    { version: '15.2-15.3' },
    { version: '18.0' },
    { version: '18.5-18.7' },
    { version: '27.2' },
    { version: 'TP' },
  ];

  it('parseVersion() parses major and minor version numbers', () => {
    assert.deepEqual(parseVersion('18'), [18, 0]);
    assert.deepEqual(parseVersion('18.5'), [18, 5]);
  });

  it('compareVersions() compares versions numerically (not lexicographically)', () => {
    assert.ok(compareVersions('18.10', '18.2') > 0);
    assert.equal(compareVersions('18', '18.0'), 0);
    assert.ok(compareVersions('14.4', '14.5') < 0);
  });

  it('matches exact version strings', () => {
    assert.equal(findVersionIndex(mockSafariVersions, '15.1'), 4);
  });

  it('strips "≤" prefix from BCD ranged versions', () => {
    assert.equal(findVersionIndex(mockSafariVersions, '≤15.1'), 4);
  });

  it('matches bare major versions against ".0" CanIUse entries', () => {
    assert.equal(findVersionIndex(mockSafariVersions, '18'), 6);
  });

  it('matches dotted minor versions into the correct CanIUse version range', () => {
    assert.equal(findVersionIndex(mockSafariVersions, '14.5'), 2); // 14.5-14.8, not 14.0-14.4
    assert.equal(findVersionIndex(mockSafariVersions, '15.2'), 5); // 15.2-15.3, not 15
    assert.equal(findVersionIndex(mockSafariVersions, '18.6'), 7); // 18.5-18.7, not 18.0
  });

  it('maps versions older than the first tracked CanIUse version to index 0', () => {
    assert.equal(findVersionIndex(mockSafariVersions, '1'), 0);
    assert.equal(findVersionIndex([{ version: '154' }], '117'), 0);
  });

  it('maps BCD "preview" to CanIUse "TP" when present, or -1 otherwise', () => {
    assert.equal(findVersionIndex(mockSafariVersions, 'preview'), 9);
    assert.equal(findVersionIndex([{ version: '154' }], 'preview'), -1);
  });

  it('returns -1 for unreleased future versions', () => {
    assert.equal(findVersionIndex(mockSafariVersions, '27.3'), -1);
    assert.equal(findVersionIndex(mockSafariVersions, '99'), -1);
  });
});

describe('convertBCDSupportToCanIUseStat()', () => {
  it('marks versions older than first tracked version as supported (e.g. Chrome 1 or Android Chrome)', () => {
    const chromeStats = convertBCDSupportToCanIUseStat('chrome', { version_added: '1' });
    assert.equal(chromeStats['4'], 'y');

    const andChrStats = convertBCDSupportToCanIUseStat('and_chr', { version_added: '117' });
    const currentAndChr = caniuse.agents.and_chr.current_version;
    assert.equal(andChrStats[currentAndChr], 'y');
  });

  it('marks nothing as supported when version_added is false or an unreleased future version', () => {
    const falseStats = convertBCDSupportToCanIUseStat('chrome', { version_added: false });
    assert.ok(Object.values(falseStats).every((v) => v === 'x'));

    const futureStats = convertBCDSupportToCanIUseStat('chrome', { version_added: '9999' });
    assert.ok(Object.values(futureStats).every((v) => v === 'x'));
  });

  it('does not wipe out support when version_removed is an unmatched "preview"', () => {
    const ffStats = convertBCDSupportToCanIUseStat('firefox', {
      version_added: '4',
      version_removed: 'preview',
    });
    assert.equal(ffStats['4'], 'y');
  });

  it('gives newer full support precedence over older partial support in BCD arrays', () => {
    const stats = convertBCDSupportToCanIUseStat('chrome', [
      { version_added: '48' },
      { version_added: '9', partial_implementation: true },
    ]);
    assert.equal(stats['8'], 'x');
    assert.equal(stats['9'], 'a');
    assert.equal(stats['47'], 'a');
    assert.equal(stats['48'], 'y');
  });
});

describe('prepStats() & findResult()', () => {
  it('aligns current browser versions onto the same row in prepStats()', () => {
    const item = caniuse.data['viewport-units'];
    const { stats } = prepStats(item.stats);

    const currentRowIndices = Object.values(stats).map(
      (agentRows) => agentRows.findIndex((row) => row && row.currentVersion)
    );
    assert.equal(new Set(currentRowIndices).size, 1);
  });

  it('finds CanIUse and BCD results without crashing on metadata keys like "status"', () => {
    const viewportRes = findResult('viewport-units');
    assert.ok(Array.isArray(viewportRes) && viewportRes.length > 0);

    const allowDiscreteRes = findResult('allow-discrete');
    assert.ok(Array.isArray(allowDiscreteRes) && allowDiscreteRes.length > 0);

    assert.doesNotThrow(() => findResult('status'));
  });
});

describe('Environment & self-update helpers', () => {
  it('getCommandName() returns "npx caniuse" when invoked via npx and "caniuse" otherwise', () => {
    const origLifecycle = process.env.npm_lifecycle_event;
    const origCommand = process.env.npm_command;

    try {
      delete process.env.npm_lifecycle_event;
      delete process.env.npm_command;
      assert.equal(getCommandName(), 'caniuse');

      process.env.npm_lifecycle_event = 'npx';
      assert.equal(getCommandName(), 'npx caniuse');

      delete process.env.npm_lifecycle_event;
      process.env.npm_command = 'exec';
      assert.equal(getCommandName(), 'npx caniuse');
    } finally {
      if (origLifecycle === undefined) delete process.env.npm_lifecycle_event;
      else process.env.npm_lifecycle_event = origLifecycle;

      if (origCommand === undefined) delete process.env.npm_command;
      else process.env.npm_command = origCommand;
    }
  });

  it('detectPackageManager() detects pnpm, bun, yarn, and npm from user agent', () => {
    const origUA = process.env.npm_config_user_agent;
    try {
      process.env.npm_config_user_agent = 'pnpm/9.0.0 node/v22.0.0';
      assert.equal(detectPackageManager(), 'pnpm');

      process.env.npm_config_user_agent = 'bun/1.1.0';
      assert.equal(detectPackageManager(), 'bun');

      process.env.npm_config_user_agent = 'yarn/1.22.0';
      assert.equal(detectPackageManager(), 'yarn');

      process.env.npm_config_user_agent = 'npm/10.0.0';
      assert.equal(detectPackageManager(), 'npm');
    } finally {
      if (origUA === undefined) delete process.env.npm_config_user_agent;
      else process.env.npm_config_user_agent = origUA;
    }
  });

  it('checkDatabaseAge() warns when data is >= 30 days old and stays silent when fresh', () => {
    const origCaniuseUpdated = caniuse.updated;
    const origBcdTimestamp = bcd.__meta.timestamp;
    const origLog = console.log;
    const logs = [];
    console.log = (...args) => logs.push(args.join(' '));

    try {
      // Fresh timestamps (now)
      caniuse.updated = Math.floor(Date.now() / 1000);
      bcd.__meta.timestamp = new Date().toISOString();
      checkDatabaseAge();
      assert.equal(logs.length, 0);

      // 45 days old
      caniuse.updated = Math.floor((Date.now() - 45 * 86400 * 1000) / 1000);
      checkDatabaseAge();
      assert.ok(logs.some((line) => line.includes('45 days old')));
    } finally {
      caniuse.updated = origCaniuseUpdated;
      bcd.__meta.timestamp = origBcdTimestamp;
      console.log = origLog;
    }
  });
});

describe('CLI integration', () => {
  it('prints usage instructions when invoked with no arguments', () => {
    const out = execFileSync(process.execPath, [cliPath], { encoding: 'utf8' });
    assert.match(out, /Please pass in an argument/);
  });

  it('prints "Nothing was found" for nonexistent features', () => {
    const out = execFileSync(process.execPath, [cliPath, 'nonexistent-feature-xyz-123'], {
      encoding: 'utf8',
    });
    assert.match(out, /Nothing was found/);
  });

  it('prints feature support table for a valid query', () => {
    const out = execFileSync(process.execPath, [cliPath, 'viewport-units'], {
      encoding: 'utf8',
    });
    assert.match(out, /Viewport units: vw, vh, vmin, vmax/);
    assert.match(out, /https:\/\/caniuse\.com\/#feat=viewport-units/);
    assert.match(out, /Chrome/);
  });
});
