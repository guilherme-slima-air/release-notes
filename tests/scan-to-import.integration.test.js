'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

test('selected commits are filtered and forwarded to import flow', function() {
    assert.match(appJs, /function useSelectedCommits\(\)/);
    assert.match(appJs, /const selected = state\.scanResults\.filter/);
    assert.match(appJs, /state\.scanSelectedCommits\.includes\(commit\.hash\)/);
    assert.match(appJs, /await importMetadataFromScanCommits\(selected\)/);
});

test('empty selected set shows guidance message before import', function() {
    assert.match(appJs, /Selecione ao menos um commit para importar\./);
});
