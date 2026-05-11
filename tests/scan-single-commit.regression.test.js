'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

test('single commit shortcut still delegates to shared import pipeline', function() {
    assert.match(appJs, /function useCommit\(commit\)\s*\{\s*importMetadataFromScanCommits\(\[commit\]\);\s*\}/);
});
