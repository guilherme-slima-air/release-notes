'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('batch endpoint contract exposes commit_hashes with maxItems 50', function() {
    const contract = read('specs/001-multi-commit-import/contracts/metadata-from-commits.openapi.yaml');

    assert.match(contract, /\/api\/metadata-from-commits:/);
    assert.match(contract, /commit_hashes:/);
    assert.match(contract, /maxItems:\s*50/);
    assert.match(contract, /pattern:\s*"\^\[0-9a-fA-F\]\{7,40\}\$"/);
});

test('server validates required payload and max 50 commits for batch import', function() {
    const serverCode = read('server.js');

    assert.match(serverCode, /app\.post\('\/api\/metadata-from-commits'/);
    assert.match(serverCode, /commitHashes\.length === 0/);
    assert.match(serverCode, /commitHashes\.length > 50/);
    assert.match(serverCode, /commit_hash invalido:/);
});
