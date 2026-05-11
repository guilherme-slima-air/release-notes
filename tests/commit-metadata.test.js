'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildMetadataItemsFromFiles,
    mergeCommitMetadataEntries
} = require('../lib/commit-metadata');

test('buildMetadataItemsFromFiles removes duplicates by type and name', function() {
    const files = ['a', 'b', 'a'];
    const extractMetadataName = function(file) {
        if (file === 'a') return { name: 'force-app/main/default/classes/MyClass.cls', type: 'ApexClass' };
        return { name: 'force-app/main/default/flows/FlowA.flow-meta.xml', type: 'Flow' };
    };

    const result = buildMetadataItemsFromFiles(files, extractMetadataName);

    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { name: 'force-app/main/default/classes/MyClass.cls', type: 'ApexClass' });
    assert.deepEqual(result[1], { name: 'force-app/main/default/flows/FlowA.flow-meta.xml', type: 'Flow' });
});

test('mergeCommitMetadataEntries deduplicates repeated metadata across commits', function() {
    const merged = mergeCommitMetadataEntries([
        {
            commit_hash: 'abc1234',
            metadata_items: [
                { name: 'force-app/main/default/classes/MyClass.cls', type: 'ApexClass' },
                { name: 'force-app/main/default/flows/FlowA.flow-meta.xml', type: 'Flow' }
            ]
        },
        {
            commit_hash: 'def5678',
            metadata_items: [
                { name: 'force-app/main/default/classes/MyClass.cls', type: 'ApexClass' },
                { name: 'force-app/main/default/objects/Case/Case.object-meta.xml', type: 'CustomObject' }
            ]
        }
    ]);

    assert.equal(merged.metadata_items.length, 3);
    assert.equal(merged.duplicate_count, 1);
});
