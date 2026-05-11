'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

test('manual single hash import path uses legacy endpoint', function() {
    assert.match(appJs, /if \(commitHashes\.length === 1\)/);
    assert.match(appJs, /api\.post\('\/api\/metadata-from-commit'/);
});

test('manual multiple hash import path uses batch endpoint', function() {
    assert.match(appJs, /api\.post\('\/api\/metadata-from-commits'/);
});
