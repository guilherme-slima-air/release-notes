'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

// Validation note: full regression command `node --test tests/*.test.js` passed on 2026-05-10.

test('contract declares discover and apply PR link endpoints', function() {
    const contract = read('specs/003-link-prs-metadata/contracts/discover-pr-links.openapi.yaml');

    assert.match(contract, /\/api\/repos\/\{id\}\/discover-pr-links:/);
    assert.match(contract, /target_branches:/);
    assert.match(contract, /status:\s*\n\s*type:\s*string\s*\n\s*enum:\s*\[matched, no_match, conflict, error\]/m);
    assert.match(contract, /\/api\/repos\/\{id\}\/apply-pr-links:/);
});

test('server exposes discover route and summary payload fields', function() {
    const serverCode = read('server.js');

    assert.match(serverCode, /app\.post\('\/api\/repos\/:id\/discover-pr-links'/);
    assert.match(serverCode, /total_candidates/);
    assert.match(serverCode, /total_matched/);
    assert.match(serverCode, /total_conflict/);
    assert.match(serverCode, /classifyMetadataDecision/);
});

test('heuristic order keeps merge commit before commit message fallback', function() {
    const helperCode = read('lib/pr-discovery.js');

    assert.match(helperCode, /const HEURISTIC_PRIORITY = \{[\s\S]*merge_commit:\s*1,[\s\S]*commit_message:\s*2[\s\S]*\}/m);
    assert.match(helperCode, /if \(evidences\.length === 0\)/);
    assert.match(helperCode, /parsePullRequestFromMessage/);
});
