'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

test('scan selection state is tracked in app state', function() {
    assert.match(appJs, /scanSelectedCommits:\s*\[\]/);
    assert.match(appJs, /state\.scanSelectedCommits = Array\.from\(selected\)/);
});

test('scan selection helpers include select all and clear selection flows', function() {
    assert.match(appJs, /function selectAllScannedCommits\(\)/);
    assert.match(appJs, /state\.scanSelectedCommits = state\.scanResults\.map/);
    assert.match(appJs, /function clearScannedCommitSelection\(\)/);
    assert.match(appJs, /state\.scanSelectedCommits = \[\]/);
});
