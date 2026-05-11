'use strict';

function buildMetadataDedupKey(item) {
    const type = String(item?.type || '').trim().toLowerCase();
    const name = String(item?.name || '').trim().toLowerCase();
    return type + '::' + name;
}

function buildMetadataItemsFromFiles(files, extractMetadataName) {
    const unique = new Map();

    (Array.isArray(files) ? files : []).forEach(function(filePath) {
        const item = extractMetadataName(filePath);
        if (!item || !item.name) return;
        unique.set(buildMetadataDedupKey(item), item);
    });

    return Array.from(unique.values());
}

function mergeCommitMetadataEntries(commitEntries) {
    const unique = new Map();
    let duplicateCount = 0;

    (Array.isArray(commitEntries) ? commitEntries : []).forEach(function(entry) {
        const items = Array.isArray(entry?.metadata_items) ? entry.metadata_items : [];
        items.forEach(function(item) {
            const key = buildMetadataDedupKey(item);
            if (unique.has(key)) {
                duplicateCount += 1;
                return;
            }
            unique.set(key, item);
        });
    });

    return {
        metadata_items: Array.from(unique.values()),
        duplicate_count: duplicateCount
    };
}

module.exports = {
    buildMetadataItemsFromFiles,
    mergeCommitMetadataEntries
};
