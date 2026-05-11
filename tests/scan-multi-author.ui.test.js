'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('scan form renders multi-select people control and batch actions', function() {
    const html = read('public/index.html');

    assert.match(html, /id="scan-person-select" multiple size="4"/);
    assert.match(html, /id="btn-use-all-commits"/);
    assert.match(html, /id="btn-use-selected-commits"/);
    assert.match(html, /id="btn-scan-select-all"/);
    assert.match(html, /id="btn-scan-clear-selection"/);
});

test('scan app parses selected people and manual emails into batch author list', function() {
    const appJs = read('public/app.js');

    assert.match(appJs, /function parseAuthorEmails\(value\)/);
    assert.match(appJs, /function getSelectedAuthorEmails\(\)/);
    assert.match(appJs, /author_emails:\s*authorEmails/);
    assert.match(appJs, /function useAllCommits\(\)/);
});

test('scan-pr UI includes front, target branches and date window controls', function() {
    const html = read('public/index.html');

    assert.match(html, /id="scan-prs-front-select"/);
    assert.match(html, /id="scan-prs-target-branches"/);
    assert.match(html, /id="scan-prs-since-date"/);
    assert.match(html, /id="scan-prs-until-date"/);
    assert.match(html, /id="scan-prs-person-select"/);
    assert.match(html, /id="scan-prs-email"/);
    assert.match(html, /id="scan-prs-include-linked"/);
});

test('scan-pr app posts discover payload and applies selected links', function() {
    const appJs = read('public/app.js');

    assert.match(appJs, /\/discover-pr-links/);
    assert.match(appJs, /target_branches:\s*targetBranches/);
    assert.match(appJs, /function getScanPrSelectedAuthorEmails\(\)/);
    assert.match(appJs, /author_emails\s*=\s*authorEmails/);
    assert.match(appJs, /include_already_linked:\s*includeAlreadyLinked/);
    assert.match(appJs, /\/apply-pr-links/);
    assert.match(appJs, /renderScanPrStatus/);
    assert.match(appJs, /matched:/);
    assert.match(appJs, /no_match:/);
});