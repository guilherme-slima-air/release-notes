'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('scan contract exposes multi-author author_emails input and 200 response', function() {
    const contract = read('specs/002-multi-author-commit-import/contracts/scan-commits-multi-author.openapi.yaml');

    assert.match(contract, /\/api\/scan-commits:/);
    assert.match(contract, /author_emails:/);
    assert.match(contract, /uniqueItems:\s*true/);
});

test('server scan route accepts multiple author inputs and preserves legacy fields', function() {
    const serverCode = read('server.js');

    assert.match(serverCode, /app\.post\('\/api\/scan-commits'/);
    assert.match(serverCode, /normalizeAuthorEmailList\(/);
    assert.match(serverCode, /author_emails obrigatorio/);
    assert.match(serverCode, /readCommitsForAuthors\(/);
});