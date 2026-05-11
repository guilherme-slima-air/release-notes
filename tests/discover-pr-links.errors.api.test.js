'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('discover route surfaces explicit error for missing remote origin', function() {
    const serverCode = read('server.js');
    const helperCode = read('lib/pr-discovery.js');

    assert.match(serverCode, /Repositorio sem remote origin configurado/);
    assert.match(serverCode, /status:\s*'error'/);
    assert.match(helperCode, /Branch\(s\) inexistente\(s\):/);
});

test('decision helper marks conflict when multiple top-priority PRs exist', function() {
    const helperCode = read('lib/pr-discovery.js');

    assert.match(helperCode, /status:\s*'conflict'/);
    assert.match(helperCode, /Multiplos PRs candidatos com mesma prioridade/);
});

test('apply route persists only safe links and reports saved\/skipped', function() {
    const serverCode = read('server.js');

    assert.match(serverCode, /app\.post\('\/api\/repos\/:id\/apply-pr-links'/);
    assert.match(serverCode, /res\.json\(\{ saved, skipped \}\)/);
    assert.match(serverCode, /ambiguousMetadata/);
});
