'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('discover request requires front and target branches in contract', function() {
    const contract = read('specs/003-link-prs-metadata/contracts/discover-pr-links.openapi.yaml');

    assert.match(contract, /required:\s*\[front_id, target_branches\]/);
    assert.match(contract, /author_emails:/);
    assert.match(contract, /include_already_linked:/);
    assert.match(contract, /since:/);
    assert.match(contract, /until:/);
});

test('server validates branch list and date window before discovery execution', function() {
    const serverCode = read('server.js');

    assert.match(serverCode, /parseTargetBranchesInput/);
    assert.match(serverCode, /normalizeAuthorEmailList\(\[/);
    assert.match(serverCode, /validateTargetBranches\(/);
    assert.match(serverCode, /validateDateRange\(/);
    assert.match(serverCode, /front_id obrigatorio/);
});
