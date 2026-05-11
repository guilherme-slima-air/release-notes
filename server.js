'use strict';

const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const {
    buildMetadataItemsFromFiles,
    mergeCommitMetadataEntries
} = require('./lib/commit-metadata');
const {
    normalizeBranchList,
    parseOptionalDate,
    validateDateRange,
    parseMergePullRequest,
    parsePullRequestFromMessage,
    classifyMetadataDecision,
    buildMetadataCandidateQuery,
    validateTargetBranches,
    extractOrgRepoFromRemote
} = require('./lib/pr-discovery');

const execFileAsync = promisify(execFile);

const app = express();
const PORT = 3030;

const db = new DatabaseSync(path.join(__dirname, 'release.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = OFF'); // OFF during schema migration

// ── Migração: items → metadatas ───────────────────────────────────────────────
const oldTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='items'").get();
if (oldTable) {
    db.exec('ALTER TABLE items RENAME TO metadatas');
    console.log('  [migrate] tabela items renomeada para metadatas');
}

db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS fronts (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL UNIQUE COLLATE NOCASE
  );
  CREATE TABLE IF NOT EXISTS sprints (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT    NOT NULL COLLATE NOCASE,
    front_id INTEGER NOT NULL REFERENCES fronts(id) ON DELETE CASCADE,
    UNIQUE(name, front_id)
  );
  CREATE TABLE IF NOT EXISTS metadata_types (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL UNIQUE COLLATE NOCASE
  );
  CREATE TABLE IF NOT EXISTS metadatas (
    id               TEXT    PRIMARY KEY,
    front_id         INTEGER NOT NULL REFERENCES fronts(id),
    sprint_id        INTEGER REFERENCES sprints(id),
    metadata_name    TEXT    NOT NULL,
    metadata_type_id INTEGER NOT NULL REFERENCES metadata_types(id),
    change_type      TEXT    NOT NULL,
    ticket           TEXT,
    description      TEXT    NOT NULL,
    created_at       TEXT    NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pull_requests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    metadata_id TEXT    NOT NULL REFERENCES metadatas(id) ON DELETE CASCADE,
    label       TEXT    NOT NULL,
    url         TEXT    NOT NULL,
    created_at  TEXT    NOT NULL
  );
    CREATE TABLE IF NOT EXISTS people (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        name              TEXT    NOT NULL,
        email             TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        default_repo_path TEXT,
        created_at        TEXT    NOT NULL,
        updated_at        TEXT    NOT NULL
    );
`);

db.exec(`
  UPDATE metadatas
  SET metadata_name = TRIM(metadata_name),
      description = TRIM(description),
      ticket = NULLIF(TRIM(COALESCE(ticket, '')), '');
`);

db.exec(`
    UPDATE people
    SET name = TRIM(name),
            email = LOWER(TRIM(email)),
            default_repo_path = NULLIF(TRIM(COALESCE(default_repo_path, '')), '');
`);

// Em migracoes antigas, pull_requests pode ter ficado apontando para metadatas_old.
(function repairPullRequestsForeignKey() {
    const fkRows = db.prepare('PRAGMA foreign_key_list(pull_requests)').all();
    const metadataFk = fkRows.find(function(row) { return row.from === 'metadata_id'; });
    if (metadataFk && metadataFk.table !== 'metadatas') {
        db.exec('PRAGMA foreign_keys = OFF');
        db.exec(`
            ALTER TABLE pull_requests RENAME TO pull_requests_old;
            CREATE TABLE pull_requests (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                metadata_id TEXT    NOT NULL REFERENCES metadatas(id) ON DELETE CASCADE,
                label       TEXT    NOT NULL,
                url         TEXT    NOT NULL,
                created_at  TEXT    NOT NULL
            );
            INSERT INTO pull_requests (id, metadata_id, label, url, created_at)
            SELECT id, metadata_id, label, url, created_at
            FROM pull_requests_old;
            DROP TABLE pull_requests_old;
        `);
        db.exec('PRAGMA foreign_keys = ON');
        console.log('  [migrate] foreign key de pull_requests reparada para metadatas');
    }
})();

const selectDuplicateMetadataGroups = db.prepare(`
    SELECT
        front_id,
        sprint_id,
        metadata_type_id,
        LOWER(TRIM(metadata_name)) AS normalized_metadata_name,
        COUNT(*) AS total
    FROM metadatas
    GROUP BY front_id, sprint_id, metadata_type_id, LOWER(TRIM(metadata_name))
    HAVING COUNT(*) > 1
`);

const selectDuplicateMetadatas = db.prepare(`
    SELECT id, created_at
    FROM metadatas
    WHERE front_id = ?
      AND sprint_id = ?
      AND metadata_type_id = ?
      AND LOWER(TRIM(metadata_name)) = ?
    ORDER BY datetime(created_at) DESC, id DESC
`);

const moveMetadataPullRequests = db.prepare(`
    UPDATE pull_requests
    SET metadata_id = ?
    WHERE metadata_id = ?
`);

const deleteMetadataById = db.prepare('DELETE FROM metadatas WHERE id = ?');
const updateMetadataNameById = db.prepare('UPDATE metadatas SET metadata_name = ? WHERE id = ?');
const selectAllMetadatasForMigration = db.prepare(`
    SELECT m.id, m.front_id, m.sprint_id, m.metadata_type_id, m.metadata_name, m.created_at, mt.name AS metadata_type_name
    FROM metadatas m
    JOIN metadata_types mt ON mt.id = m.metadata_type_id
`);

const selectDuplicatePullRequestGroups = db.prepare(`
    SELECT
        metadata_id,
        LOWER(TRIM(url)) AS normalized_url,
        COUNT(*) AS total
    FROM pull_requests
    GROUP BY metadata_id, LOWER(TRIM(url))
    HAVING COUNT(*) > 1
`);

const selectDuplicatePullRequests = db.prepare(`
    SELECT id
    FROM pull_requests
    WHERE metadata_id = ?
      AND LOWER(TRIM(url)) = ?
    ORDER BY datetime(created_at) DESC, id DESC
`);

const deletePullRequestById = db.prepare('DELETE FROM pull_requests WHERE id = ?');

function consolidateDuplicateMetadatas() {
    const duplicateGroups = selectDuplicateMetadataGroups.all();
    let removedCount = 0;

    duplicateGroups.forEach(group => {
        const rows = selectDuplicateMetadatas.all(
            group.front_id,
            group.sprint_id,
            group.metadata_type_id,
            group.normalized_metadata_name
        );

        if (rows.length < 2) {
            return;
        }

        const canonical = rows[0];
        rows.slice(1).forEach(duplicate => {
            moveMetadataPullRequests.run(canonical.id, duplicate.id);
            deleteMetadataById.run(duplicate.id);
            removedCount += 1;
        });
    });

    if (removedCount > 0) {
        console.log(`  [migrate] ${removedCount} metadata(s) duplicado(s) consolidado(s)`);
    }
}

function consolidateDuplicatePullRequests() {
    const duplicateGroups = selectDuplicatePullRequestGroups.all();
    let removedCount = 0;

    duplicateGroups.forEach(group => {
        const rows = selectDuplicatePullRequests.all(group.metadata_id, group.normalized_url);
        if (rows.length < 2) {
            return;
        }

        rows.slice(1).forEach(duplicate => {
            deletePullRequestById.run(duplicate.id);
            removedCount += 1;
        });
    });

    if (removedCount > 0) {
        console.log(`  [migrate] ${removedCount} PR(s) duplicado(s) consolidado(s)`);
    }
}

function migrateLegacyMetadataNames() {
    const rows = selectAllMetadatasForMigration.all();
    if (!rows.length) {
        return;
    }

    const grouped = new Map();

    rows.forEach(row => {
        const normalizedName = normalizeMetadataNameByType(row.metadata_name, row.metadata_type_name);
        if (!normalizedName) {
            return;
        }

        const key = [
            Number(row.front_id),
            row.sprint_id == null ? 'NULL' : Number(row.sprint_id),
            Number(row.metadata_type_id),
            normalizedName.toLowerCase()
        ].join('|');

        if (!grouped.has(key)) {
            grouped.set(key, []);
        }

        grouped.get(key).push({
            id: row.id,
            metadata_name: String(row.metadata_name || ''),
            normalized_name: normalizedName,
            created_at: String(row.created_at || '')
        });
    });

    let updatedCount = 0;
    let mergedCount = 0;

    grouped.forEach(groupRows => {
        if (!groupRows.length) {
            return;
        }

        groupRows.sort((a, b) => {
            const timeA = Date.parse(a.created_at || '');
            const timeB = Date.parse(b.created_at || '');

            if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeB !== timeA) {
                return timeB - timeA;
            }
            return String(b.id).localeCompare(String(a.id), 'pt-BR');
        });

        const canonical = groupRows[0];

        if (canonical.metadata_name !== canonical.normalized_name) {
            updateMetadataNameById.run(canonical.normalized_name, canonical.id);
            updatedCount += 1;
        }

        groupRows.slice(1).forEach(duplicate => {
            moveMetadataPullRequests.run(canonical.id, duplicate.id);
            deleteMetadataById.run(duplicate.id);
            mergedCount += 1;
        });
    });

    if (updatedCount > 0) {
        console.log(`  [migrate] ${updatedCount} metadata(s) atualizado(s) para caminho relativo padronizado`);
    }
    if (mergedCount > 0) {
        console.log(`  [migrate] ${mergedCount} metadata(s) legado(s) consolidado(s) apos padronizacao`);
    }
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_metadatas_unique_context
  ON metadatas (front_id, sprint_id, metadata_type_id, metadata_name COLLATE NOCASE);
`);

db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pull_requests_unique_metadata_url
    ON pull_requests (metadata_id, url COLLATE NOCASE);
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS repos (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        repo_path  TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        created_at TEXT    NOT NULL
    );
`);

// Migra sprint_id de NOT NULL para NULL se necessario
(function migrateSprintNullable() {
        const cols = db.prepare('PRAGMA table_info(metadatas)').all();
        const sprintCol = cols.find(c => c.name === 'sprint_id');
        if (sprintCol && sprintCol.notnull === 1) {
        db.exec('PRAGMA foreign_keys = OFF');
                db.exec(`
                        ALTER TABLE metadatas RENAME TO metadatas_old;
                        CREATE TABLE metadatas (
                                id               TEXT    PRIMARY KEY,
                                front_id         INTEGER NOT NULL REFERENCES fronts(id),
                                sprint_id        INTEGER REFERENCES sprints(id),
                                metadata_name    TEXT    NOT NULL,
                                metadata_type_id INTEGER NOT NULL REFERENCES metadata_types(id),
                                change_type      TEXT    NOT NULL,
                                ticket           TEXT,
                                description      TEXT    NOT NULL,
                                created_at       TEXT    NOT NULL
                        );
                        INSERT INTO metadatas SELECT * FROM metadatas_old;
            ALTER TABLE pull_requests RENAME TO pull_requests_old;
            CREATE TABLE pull_requests (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                metadata_id TEXT    NOT NULL REFERENCES metadatas(id) ON DELETE CASCADE,
                label       TEXT    NOT NULL,
                url         TEXT    NOT NULL,
                created_at  TEXT    NOT NULL
            );
            INSERT INTO pull_requests (id, metadata_id, label, url, created_at)
            SELECT id, metadata_id, label, url, created_at FROM pull_requests_old;
            DROP TABLE pull_requests_old;
                        DROP TABLE metadatas_old;
                `);
        db.exec('PRAGMA foreign_keys = ON');
                console.log('  [migrate] sprint_id agora e opcional em metadatas');
        }
})();

const DEFAULT_TYPES = [
    'ApexClass', 'ApexTrigger', 'Flow', 'Lightning Web Component',
    'CustomObject', 'ValidationRule', 'PermissionSet', 'Profile'
];
const stmtInsertType = db.prepare('INSERT OR IGNORE INTO metadata_types (name) VALUES (?)');
DEFAULT_TYPES.forEach(name => stmtInsertType.run(name));

const VALID_CHANGE_TYPES = new Set(['Criacao', 'Alteracao', 'Correcao', 'Remocao']);

const selectFrontById = db.prepare('SELECT id FROM fronts WHERE id = ?');
const selectSprintById = db.prepare('SELECT id FROM sprints WHERE id = ?');
const selectSprintByIdAndFront = db.prepare('SELECT id FROM sprints WHERE id = ? AND front_id = ?');
const selectMetadataTypeById = db.prepare('SELECT id FROM metadata_types WHERE id = ?');
const selectMetadataTypeRecordById = db.prepare('SELECT id, name FROM metadata_types WHERE id = ?');
const selectMetadataById = db.prepare('SELECT id FROM metadatas WHERE id = ?');

const METADATA_TYPE_ALIAS = {
    apexclass: 'ApexClass',
    apextrigger: 'ApexTrigger',
    flow: 'Flow',
    lightningwebcomponent: 'Lightning Web Component',
    customobject: 'CustomObject',
    customfield: 'Custom Field',
    validationrule: 'ValidationRule',
    permissionset: 'PermissionSet',
    permissionsetgroup: 'Permission Set Group',
    profile: 'Profile',
    layout: 'Layout',
    recordtype: 'Record Type',
    flexipage: 'FlexiPage',
    queue: 'Queue',
    quickaction: 'Quick Action',
    pathassistant: 'Path Assistant',
    milestonetype: 'Milestone Type',
    globalvalueset: 'Global Value Set',
    compactlayout: 'Compact Layout',
    standardvalueset: 'Standard Value Set',
    application: 'Application',
    configgit: 'Config Git'
};

function runGit(repoPath, args) {
    return execFileAsync('git', ['-C', repoPath, ...args], {
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024
    });
}

function assertValidRepoPath(repoPath) {
    const trimmed = String(repoPath || '').trim();
    if (!trimmed) {
        const err = new Error('repo_path obrigatorio');
        err.status = 400;
        throw err;
    }

    if (!fs.existsSync(trimmed) || !fs.statSync(trimmed).isDirectory()) {
        const err = new Error('repo_path invalido ou inexistente');
        err.status = 400;
        throw err;
    }

    const gitDir = path.join(trimmed, '.git');
    if (!fs.existsSync(gitDir)) {
        const err = new Error('A pasta informada nao contem um repositorio git (.git)');
        err.status = 400;
        throw err;
    }

    return trimmed;
}

function normalizeMetadataTypeName(typeName) {
    const normalized = String(typeName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return METADATA_TYPE_ALIAS[normalized] || typeName || 'Metadata';
}

function stripKnownSuffixes(filename) {
    return String(filename || '')
        .replace(/-meta\.xml$/i, '')
        .replace(/\.(cls|trigger|page|component|app|evt|cmp|resource|object|flow|permissionset|profile|xml|js|ts|html|css)$/i, '');
}

function parsePositiveInt(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return parsed;
}

function normalizeText(value) {
    return String(value ?? '').trim();
}

function normalizeMetadataName(value) {
    const normalized = normalizeText(value)
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/')
        .replace(/^\.\//, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');

    if (!normalized) return '';

    const forceAppIndex = normalized.toLowerCase().indexOf('force-app/');
    if (forceAppIndex >= 0) {
        return normalized.slice(forceAppIndex);
    }

    return normalized;
}

function appendMetadataSuffix(filename, suffix) {
    const normalized = normalizeMetadataName(filename);
    if (!normalized) return '';
    if (normalized.toLowerCase().endsWith(String(suffix || '').toLowerCase())) {
        return normalized;
    }
    return normalized + suffix;
}

function joinMetadataPath(relativePath) {
    const normalized = normalizeMetadataName(relativePath);
    if (!normalized || normalized === '.forceignore') {
        return normalized;
    }
    if (normalized.toLowerCase().startsWith('force-app/')) {
        return normalized;
    }
    return 'force-app/main/default/' + normalized;
}

function normalizeMetadataNameByType(value, typeName) {
    const normalized = normalizeMetadataName(value);
    if (!normalized) return '';

    const lower = normalized.toLowerCase();
    if (normalized === '.forceignore' || lower.startsWith('force-app/')) {
        return normalized;
    }

    if (/^(classes|triggers|flows|lwc|permissionsetgroups|permissionsets|profiles|objects|layouts|flexipages|queues|quickactions|pathassistants|milestonetypes|globalvaluesets|compactlayouts|standardvaluesets|applications|settings|skills|custommetadata|entitlementprocesses|omnisupervisorconfigs)\//i.test(normalized)) {
        return joinMetadataPath(normalized);
    }

    const canonicalType = normalizeMetadataTypeName(typeName);

    if (canonicalType === 'Custom Field' && normalized.includes('/')) {
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length >= 2) {
            const objectName = parts[0];
            const fieldName = appendMetadataSuffix(parts.slice(1).join('/'), '.field-meta.xml');
            return joinMetadataPath(`objects/${objectName}/fields/${fieldName}`);
        }
    }

    if (canonicalType === 'ValidationRule' && normalized.includes('/')) {
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length >= 2) {
            const objectName = parts[0];
            const ruleName = appendMetadataSuffix(parts.slice(1).join('/'), '.validationRule-meta.xml');
            return joinMetadataPath(`objects/${objectName}/validationRules/${ruleName}`);
        }
    }

    if (canonicalType === 'Record Type') {
        if (normalized.includes('/')) {
            const parts = normalized.split('/').filter(Boolean);
            if (parts.length >= 2) {
                const objectName = parts[0];
                const recordTypeName = appendMetadataSuffix(parts.slice(1).join('/'), '.recordType-meta.xml');
                return joinMetadataPath(`objects/${objectName}/recordTypes/${recordTypeName}`);
            }
        }
        return joinMetadataPath(`recordTypes/${appendMetadataSuffix(normalized, '.recordType-meta.xml')}`);
    }

    if (canonicalType === 'Quick Action') {
        if (normalized.includes('/')) {
            const parts = normalized.split('/').filter(Boolean);
            if (parts.length >= 2) {
                const objectName = parts[0];
                const quickActionName = appendMetadataSuffix(parts.slice(1).join('/'), '.quickAction-meta.xml');
                return joinMetadataPath(`objects/${objectName}/quickActions/${quickActionName}`);
            }
        }

        const quickActionMatch = normalized.match(/^([^/.]+)\.(.+)$/);
        if (quickActionMatch) {
            const objectName = quickActionMatch[1];
            const quickActionName = appendMetadataSuffix(quickActionMatch[2], '.quickAction-meta.xml');
            return joinMetadataPath(`objects/${objectName}/quickActions/${quickActionName}`);
        }

        return joinMetadataPath(`quickActions/${appendMetadataSuffix(normalized, '.quickAction-meta.xml')}`);
    }

    if (canonicalType === 'Compact Layout') {
        if (normalized.includes('/')) {
            const parts = normalized.split('/').filter(Boolean);
            if (parts.length >= 2) {
                const objectName = parts[0];
                const layoutName = appendMetadataSuffix(parts.slice(1).join('/'), '.compactLayout-meta.xml');
                return joinMetadataPath(`objects/${objectName}/compactLayouts/${layoutName}`);
            }
        }

        const compactLayoutMatch = normalized.match(/^([^/.]+)\.(.+)$/);
        if (compactLayoutMatch) {
            const objectName = compactLayoutMatch[1];
            const layoutName = appendMetadataSuffix(compactLayoutMatch[2], '.compactLayout-meta.xml');
            return joinMetadataPath(`objects/${objectName}/compactLayouts/${layoutName}`);
        }
    }

    if (canonicalType === 'CustomObject') {
        const fileName = appendMetadataSuffix(normalized, '.object-meta.xml');
        const objectName = fileName.replace(/\.object-meta\.xml$/i, '');
        return joinMetadataPath(`objects/${objectName}/${fileName}`);
    }

    if (canonicalType === 'Lightning Web Component') {
        return joinMetadataPath(`lwc/${normalized}`);
    }

    if (canonicalType === 'Metadata' && lower.endsWith('.md-meta.xml')) {
        return joinMetadataPath(`customMetadata/${normalized}`);
    }

    const folderByType = {
        ApexClass: 'classes',
        ApexTrigger: 'triggers',
        Flow: 'flows',
        'Permission Set Group': 'permissionsetgroups',
        PermissionSet: 'permissionsets',
        Profile: 'profiles',
        Layout: 'layouts',
        FlexiPage: 'flexipages',
        Queue: 'queues',
        'Path Assistant': 'pathAssistants',
        'Milestone Type': 'milestoneTypes',
        'Global Value Set': 'globalValueSets',
        'Standard Value Set': 'standardValueSets',
        Application: 'applications',
        'Custom Metadata': 'customMetadata',
        Settings: 'settings',
        'Entitlement Process': 'entitlementProcesses',
        Supervisor: 'omniSupervisorConfigs',
        Skill: 'skills',
        Group: 'groups',
        'Queue Routing Config': 'queueRoutingConfigs'
    };

    const folder = folderByType[canonicalType];
    if (folder) {
        return joinMetadataPath(`${folder}/${normalized}`);
    }

    return normalized;
}

function parseOptionalBoolean(value) {
    if (value == null || value === '') return null;
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    return undefined;
}

function normalizeRepoPath(value) {
    const trimmed = normalizeText(value);
    if (!trimmed) return null;
    return trimmed.replace(/[\\/]+$/, '');
}

function normalizeEmail(value) {
    return normalizeText(value).toLowerCase();
}

function isValidEmail(email) {
    // Validation intentionally simple: enough to reject malformed values without being over-restrictive.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildExportFileName(extension) {
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    return (
        'release_export_' +
        String(now.getFullYear()) +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        '_' +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds()) +
        '.' + extension
    );
}

function escapeCsvCell(value) {
    if (value == null) return '';
    const normalized = String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (/[",\n]/.test(normalized)) {
        return '"' + normalized.replace(/"/g, '""') + '"';
    }
    return normalized;
}

function sanitizeMarkdownCell(value) {
    return String(value ?? '')
        .replace(/\r\n|\r|\n/g, ' ')
        .replace(/\|/g, '\\|')
        .trim();
}

function truncateText(value, maxLength) {
    const text = String(value ?? '');
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}

function formatExportScope(filters) {
    const parts = [];
    if (filters.front_id) parts.push('front_id=' + String(filters.front_id));
    if (filters.sprint_id) parts.push('sprint_id=' + String(filters.sprint_id));
    if (filters.metadata_type_id) parts.push('metadata_type_id=' + String(filters.metadata_type_id));
    if (filters.change_type) parts.push('change_type=' + String(filters.change_type));
    if (filters.has_pr === true) parts.push('has_pr=true');
    if (filters.has_pr === false) parts.push('has_pr=false');
    if (filters.q) parts.push('q=' + String(filters.q));
    return parts.length > 0 ? parts.join(' | ') : 'sem filtros';
}

function buildMarkdownExport(items, payload, includePrDetails) {
    const lines = [];
    lines.push('# Release Notes');
    lines.push('');
    lines.push('Gerado em: ' + payload.exported_at);
    lines.push('Escopo: ' + formatExportScope(payload.filters));
    lines.push('Total de itens: ' + String(payload.total_items));
    lines.push('');

    if (!items.length) {
        lines.push('Sem itens para os filtros selecionados.');
        return lines.join('\n');
    }

    let currentFront = null;
    let currentSprint = null;
    let currentType = null;

    items.forEach(item => {
        const front = String(item.front || 'Sem frente');
        const sprint = String(item.sprint || 'Sem sprint');
        const metadataType = String(item.metadata_type || 'Sem tipo');

        if (front !== currentFront) {
            currentFront = front;
            currentSprint = null;
            currentType = null;
            lines.push('## Frente: ' + sanitizeMarkdownCell(front));
            lines.push('');
        }

        if (sprint !== currentSprint) {
            currentSprint = sprint;
            currentType = null;
            lines.push('### Sprint: ' + sanitizeMarkdownCell(sprint));
            lines.push('');
        }

        if (metadataType !== currentType) {
            currentType = metadataType;
            lines.push('#### ' + sanitizeMarkdownCell(metadataType));
            lines.push('');
            lines.push('| Metadata | Ticket | Descricao | Tipo de Mudanca | PRs |');
            lines.push('|----------|--------|-----------|-----------------|-----|');
        }

        const prs = Array.isArray(item.prs) ? item.prs : [];
        let prsCell = '-';
        if (prs.length > 0) {
            if (includePrDetails) {
                prsCell = prs.map(pr => {
                    const rawLabel = String(pr?.label || 'PR');
                    const safeLabel = sanitizeMarkdownCell(rawLabel)
                        .replace(/\[/g, '\\[')
                        .replace(/\]/g, '\\]');
                    const url = String(pr?.url || '').trim();
                    if (url) return '[' + safeLabel + '](' + url + ')';
                    return safeLabel;
                }).join(', ');
            } else {
                prsCell = String(prs.length) + ' PR(s)';
            }
        }

        const metadataName = sanitizeMarkdownCell(item.metadata_name || '');
        const ticket = sanitizeMarkdownCell(item.ticket || '-');
        const description = sanitizeMarkdownCell(truncateText(item.description || '', 120) || '-');
        const changeType = sanitizeMarkdownCell(item.change_type || '-');

        lines.push('| ' + metadataName + ' | ' + ticket + ' | ' + description + ' | ' + changeType + ' | ' + prsCell + ' |');
    });

    lines.push('');
    return lines.join('\n');
}

function extractMetadataType(filePath) {
    const cleanPath = String(filePath || '').replace(/\\/g, '/').toLowerCase();
    if (!cleanPath) return 'Metadata';

    if (cleanPath.endsWith('.forceignore')) return 'Config Git';
    if (cleanPath.includes('/classes/')) return 'ApexClass';
    if (cleanPath.includes('/triggers/')) return 'ApexTrigger';
    if (cleanPath.includes('/flows/')) return 'Flow';
    if (cleanPath.includes('/lwc/')) return 'Lightning Web Component';
    if (cleanPath.includes('/permissionsetgroups/')) return 'Permission Set Group';
    if (cleanPath.includes('/permissionsets/')) return 'PermissionSet';
    if (cleanPath.includes('/profiles/')) return 'Profile';
    if (cleanPath.includes('/objects/') && cleanPath.includes('/fields/')) return 'Custom Field';
    if (cleanPath.includes('/objects/') && cleanPath.includes('/validationrules/')) return 'ValidationRule';
    if (cleanPath.includes('/objects/')) return 'CustomObject';
    if (cleanPath.includes('/layouts/')) return 'Layout';
    if (cleanPath.includes('/recordtypes/')) return 'Record Type';
    if (cleanPath.includes('/flexipages/')) return 'FlexiPage';
    if (cleanPath.includes('/queues/')) return 'Queue';
    if (cleanPath.includes('/quickactions/')) return 'Quick Action';
    if (cleanPath.includes('/pathassistants/')) return 'Path Assistant';
    if (cleanPath.includes('/milestonetypes/')) return 'Milestone Type';
    if (cleanPath.includes('/globalvaluesets/')) return 'Global Value Set';
    if (cleanPath.includes('/compactlayouts/')) return 'Compact Layout';
    if (cleanPath.includes('/standardvaluesets/')) return 'Standard Value Set';
    if (cleanPath.endsWith('.app-meta.xml')) return 'Application';
    return 'Metadata';
}

function extractMetadataName(filePath) {
    const cleanPath = normalizeMetadataName(filePath);
    if (!cleanPath) return { name: '', type: 'Metadata' };

    const type = extractMetadataType(cleanPath);

    return {
        name: cleanPath,
        type: normalizeMetadataTypeName(type)
    };
}

function normalizeAuthorEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeAuthorEmailList(values) {
    const items = [];
    const source = Array.isArray(values) ? values : [values];

    source.forEach(function(value) {
        String(value || '')
            .split(/[\s,;]+/)
            .map(function(part) { return normalizeAuthorEmail(part); })
            .filter(Boolean)
            .forEach(function(email) {
                items.push(email);
            });
    });

    return Array.from(new Set(items));
}

function parseTargetBranchesInput(value) {
    if (Array.isArray(value)) {
        return normalizeBranchList(value);
    }

    const raw = String(value || '');
    return normalizeBranchList(raw.split(/[\s,;\n\r]+/));
}

function buildMetadataLogArgs(branch, metadataName, options) {
    const args = [
        'log',
        branch,
        '--format=%H\t%s\t%an\t%ae\t%aI',
        '--',
        metadataName
    ];

    if (options && options.mergesOnly) {
        args.splice(2, 0, '--merges');
    }

    if (options && options.since) {
        args.push('--since=' + options.since);
    }
    if (options && options.until) {
        args.push('--until=' + options.until);
    }

    return args;
}

function parseMetadataLogLine(line) {
    const parts = String(line || '').split('\t');
    if (parts.length < 2) return null;

    return {
        commit_sha: String(parts[0] || '').trim(),
        subject: String(parts[1] || '').trim(),
        author_name: String(parts[2] || '').trim(),
        author_email: String(parts[3] || '').trim(),
        authored_at: String(parts[4] || '').trim()
    };
}

function buildScanCommitArgs(authorEmail, since, until, branch) {
    const args = [
        'log', '--all', '--name-only',
        `--author=${authorEmail}`,
        '--pretty=format:__COMMIT__%H%x09%aI%x09%an%x09%ae'
    ];

    if (since) args.push(`--since=${since}`);
    if (until) args.push(`--until=${until}`);
    if (branch) args.push(branch);

    return args;
}

function parseScanCommitRows(stdout) {
    const rows = String(stdout || '').split('\n');
    const commits = [];
    let current = null;

    for (const line of rows) {
        if (line.startsWith('__COMMIT__')) {
            if (current) commits.push(current);
            const parts = line.slice(10).split('\t');
            current = {
                hash: parts[0] || '',
                authored_at: parts[1] || '',
                author_name: parts[2] || '',
                author_email: parts[3] || '',
                files: []
            };
            continue;
        }
        if (current && line.trim()) {
            current.files.push(line.trim());
        }
    }

    if (current) commits.push(current);
    return commits;
}

async function readCommitsForAuthor(repoPath, authorEmail, filters) {
    const safeEmail = normalizeAuthorEmail(authorEmail);
    if (!safeEmail) return [];

    const since = String(filters?.since || '').trim();
    const until = String(filters?.until || '').trim();
    const branch = String(filters?.branch || '').trim();

    if (branch) {
        if (branch.startsWith('-') || !/^[a-zA-Z0-9/_.\-@]+$/.test(branch)) {
            const error = new Error('branch invalido');
            error.status = 400;
            throw error;
        }
    }

    const { stdout } = await runGit(repoPath, buildScanCommitArgs(safeEmail, since, until, branch));
    const commits = parseScanCommitRows(stdout);

    return commits
        .filter(function(commit) {
            return normalizeAuthorEmail(commit.author_email) === safeEmail;
        })
        .map(function(commit) {
            return {
                hash: commit.hash,
                authored_at: commit.authored_at,
                author_name: commit.author_name,
                author_email: commit.author_email,
                metadata_items: buildMetadataItemsFromFiles(commit.files, extractMetadataName)
            };
        })
        .filter(function(commit) {
            return commit.metadata_items.length > 0;
        });
}

function mergeScanCommitResults(commitGroups) {
    const merged = new Map();

    (Array.isArray(commitGroups) ? commitGroups : []).forEach(function(commit) {
        if (!commit || !commit.hash) return;

        const existing = merged.get(commit.hash);
        if (!existing) {
            merged.set(commit.hash, {
                hash: commit.hash,
                authored_at: commit.authored_at || '',
                author_name: commit.author_name || '',
                author_email: commit.author_email || '',
                metadata_items: Array.isArray(commit.metadata_items) ? commit.metadata_items.slice() : []
            });
            return;
        }

        const mergedMetadata = mergeCommitMetadataEntries([
            { metadata_items: existing.metadata_items },
            { metadata_items: commit.metadata_items }
        ]);
        existing.metadata_items = mergedMetadata.metadata_items;
        if (!existing.authored_at && commit.authored_at) existing.authored_at = commit.authored_at;
        if (!existing.author_name && commit.author_name) existing.author_name = commit.author_name;
        if (!existing.author_email && commit.author_email) existing.author_email = commit.author_email;
    });

    return Array.from(merged.values()).sort(function(a, b) {
        const dateCompare = String(b.authored_at || '').localeCompare(String(a.authored_at || ''));
        if (dateCompare !== 0) return dateCompare;
        return String(a.hash || '').localeCompare(String(b.hash || ''));
    });
}

async function readCommitsForAuthors(repoPath, authorEmails, filters) {
    const safeEmails = normalizeAuthorEmailList(authorEmails);
    const groups = await Promise.all(safeEmails.map(function(email) {
        return readCommitsForAuthor(repoPath, email, filters);
    }));

    const commits = mergeScanCommitResults(groups.flat());
    return {
        author_emails: safeEmails,
        authors_read: safeEmails.length,
        commits: commits,
        total: commits.length
    };
}

function validateCommitHash(value) {
    return /^[0-9a-f]{7,40}$/i.test(String(value || '').trim());
}

async function readCommitMetadata(repoPath, commitHash) {
    const safeHash = String(commitHash || '').trim();
    const { stdout } = await runGit(repoPath, ['show', '--pretty=format:', '--name-only', safeHash]);
    const files = String(stdout || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    const metadataItems = buildMetadataItemsFromFiles(files, extractMetadataName);

    return {
        commit_hash: safeHash,
        total_files: files.length,
        total_metadata: metadataItems.length,
        metadata_items: metadataItems
    };
}

async function readMultipleCommitMetadata(repoPath, commitHashes) {
    const reads = await Promise.all(commitHashes.map(function(hash) {
        return readCommitMetadata(repoPath, hash);
    }));

    const merged = mergeCommitMetadataEntries(reads);
    const totalFiles = reads.reduce(function(sum, item) {
        return sum + Number(item.total_files || 0);
    }, 0);

    return {
        commit_hashes: commitHashes,
        commits_read: reads.length,
        total_files: totalFiles,
        total_metadata: merged.metadata_items.length,
        duplicate_metadata: merged.duplicate_count,
        metadata_items: merged.metadata_items,
        commits: reads.map(function(item) {
            return {
                commit_hash: item.commit_hash,
                total_files: item.total_files,
                total_metadata: item.total_metadata
            };
        })
    };
}

migrateLegacyMetadataNames();
consolidateDuplicateMetadatas();
consolidateDuplicatePullRequests();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── People ───────────────────────────────────────────────────────────────────
app.get('/api/people', (req, res) => {
    const search = normalizeText(req.query.q);
    let rows;
    if (search) {
        const like = '%' + search.replace(/[%_\\]/g, c => '\\' + c) + '%';
        rows = db.prepare(`
            SELECT *
            FROM people
            WHERE name LIKE ? ESCAPE '\\'
               OR email LIKE ? ESCAPE '\\'
            ORDER BY name COLLATE NOCASE ASC, id ASC
        `).all(like, like);
    } else {
        rows = db.prepare('SELECT * FROM people ORDER BY name COLLATE NOCASE ASC, id ASC').all();
    }
    return res.json({ items: rows, total: rows.length });
});

app.post('/api/people', (req, res) => {
    const name = normalizeText(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const defaultRepoPath = normalizeRepoPath(req.body?.default_repo_path);

    if (!name || !email) {
        return res.status(400).json({ error: 'name e email obrigatorios' });
    }
    if (name.length > 120) {
        return res.status(400).json({ error: 'name excede 120 caracteres' });
    }
    if (email.length > 254) {
        return res.status(400).json({ error: 'email excede 254 caracteres' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'email invalido' });
    }
    if (defaultRepoPath && defaultRepoPath.length > 500) {
        return res.status(400).json({ error: 'default_repo_path excede 500 caracteres' });
    }

    const now = new Date().toISOString();
    try {
        const result = db.prepare(
            'INSERT INTO people (name, email, default_repo_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).run(name, email, defaultRepoPath, now, now);

        const created = db.prepare('SELECT * FROM people WHERE id = ?').get(Number(result.lastInsertRowid));
        return res.status(201).json(created);
    } catch (e) {
        const message = String(e?.message || '');
        if (message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'email ja cadastrado' });
        }
        return res.status(500).json({ error: e.message });
    }
});

app.put('/api/people/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: 'id invalido' });
    }

    const existing = db.prepare('SELECT id FROM people WHERE id = ?').get(id);
    if (!existing) {
        return res.status(404).json({ error: 'pessoa nao encontrada' });
    }

    const name = normalizeText(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const defaultRepoPath = normalizeRepoPath(req.body?.default_repo_path);

    if (!name || !email) {
        return res.status(400).json({ error: 'name e email obrigatorios' });
    }
    if (name.length > 120) {
        return res.status(400).json({ error: 'name excede 120 caracteres' });
    }
    if (email.length > 254) {
        return res.status(400).json({ error: 'email excede 254 caracteres' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'email invalido' });
    }
    if (defaultRepoPath && defaultRepoPath.length > 500) {
        return res.status(400).json({ error: 'default_repo_path excede 500 caracteres' });
    }

    const now = new Date().toISOString();
    try {
        db.prepare(
            'UPDATE people SET name = ?, email = ?, default_repo_path = ?, updated_at = ? WHERE id = ?'
        ).run(name, email, defaultRepoPath, now, id);

        const updated = db.prepare('SELECT * FROM people WHERE id = ?').get(id);
        return res.json(updated);
    } catch (e) {
        const message = String(e?.message || '');
        if (message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'email ja cadastrado' });
        }
        return res.status(500).json({ error: e.message });
    }
});

app.delete('/api/people/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: 'id invalido' });
    }

    const existing = db.prepare('SELECT id FROM people WHERE id = ?').get(id);
    if (!existing) {
        return res.status(404).json({ error: 'pessoa nao encontrada' });
    }

    db.prepare('DELETE FROM people WHERE id = ?').run(id);
    return res.status(204).send();
});

// ── Repos ─────────────────────────────────────────────────────────────────────
app.get('/api/repos', (_req, res) => {
    res.json(db.prepare('SELECT * FROM repos ORDER BY name COLLATE NOCASE').all());
});

app.post('/api/repos', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const repoPath = String(req.body?.repo_path ?? '').trim().replace(/[\/\\]+$/, '');
    if (!name || !repoPath) return res.status(400).json({ error: 'name e repo_path obrigatorios' });
    if (!fs.existsSync(repoPath) || !fs.existsSync(path.join(repoPath, '.git'))) {
        return res.status(400).json({ error: 'Caminho invalido ou nao contem repositorio git (.git)' });
    }
    const created_at = new Date().toISOString();
    try {
        db.prepare('INSERT INTO repos (name, repo_path, created_at) VALUES (?, ?, ?)').run(name, repoPath, created_at);
    } catch (e) {
        if (String(e.message).includes('UNIQUE')) {
            return res.status(409).json({ error: 'Repositorio ja cadastrado (nome ou caminho duplicado)' });
        }
        return res.status(500).json({ error: e.message });
    }
    res.json(db.prepare('SELECT * FROM repos WHERE name = ? COLLATE NOCASE').get(name));
});

app.delete('/api/repos/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'id invalido' });
    db.prepare('DELETE FROM repos WHERE id = ?').run(id);
    res.json({ ok: true });
});

// ── Fronts ───────────────────────────────────────────────────────────────────
app.get('/api/fronts', (_req, res) => {
    res.json(db.prepare('SELECT * FROM fronts ORDER BY name').all());
});

app.post('/api/fronts', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'name obrigatorio' });
    db.prepare('INSERT OR IGNORE INTO fronts (name) VALUES (?)').run(name);
    res.json(db.prepare('SELECT * FROM fronts WHERE name = ? COLLATE NOCASE').get(name));
});

// ── Sprints ───────────────────────────────────────────────────────────────────
app.get('/api/sprints', (req, res) => {
    if (req.query.front_id) {
        res.json(db.prepare('SELECT * FROM sprints WHERE front_id = ? ORDER BY name').all(Number(req.query.front_id)));
    } else {
        res.json(db.prepare('SELECT * FROM sprints ORDER BY name').all());
    }
});

app.post('/api/sprints', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const frontId = Number(req.body?.front_id);
    if (!name || !frontId) return res.status(400).json({ error: 'name e front_id obrigatorios' });
    db.prepare('INSERT OR IGNORE INTO sprints (name, front_id) VALUES (?, ?)').run(name, frontId);
    res.json(db.prepare('SELECT * FROM sprints WHERE name = ? AND front_id = ?').get(name, frontId));
});

// ── Metadata types ────────────────────────────────────────────────────────────
app.get('/api/metadata-types', (_req, res) => {
    res.json(db.prepare('SELECT * FROM metadata_types ORDER BY name').all());
});

app.post('/api/metadata-types', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'name obrigatorio' });
    db.prepare('INSERT OR IGNORE INTO metadata_types (name) VALUES (?)').run(name);
    res.json(db.prepare('SELECT * FROM metadata_types WHERE name = ? COLLATE NOCASE').get(name));
});

app.post('/api/metadata-from-commit', async (req, res) => {
    try {
        const repoPath = assertValidRepoPath(req.body?.repo_path);
        const commitHash = String(req.body?.commit_hash || '').trim();
        if (!validateCommitHash(commitHash)) {
            return res.status(400).json({ error: 'commit_hash invalido' });
        }

        const payload = await readCommitMetadata(repoPath, commitHash);
        res.json(payload);
    } catch (error) {
        if (error && Number.isInteger(error.status)) {
            return res.status(error.status).json({ error: error.message });
        }
        if (error && error.code === 'ENOENT') {
            return res.status(500).json({ error: 'git nao encontrado no sistema' });
        }

        const stderr = String(error?.stderr || '').trim();
        if (stderr) {
            return res.status(500).json({ error: stderr });
        }

        res.status(500).json({ error: error?.message || 'Erro ao ler commit' });
    }
});

app.post('/api/metadata-from-commits', async (req, res) => {
    try {
        const repoPath = assertValidRepoPath(req.body?.repo_path);
        const commitHashesRaw = Array.isArray(req.body?.commit_hashes) ? req.body.commit_hashes : [];
        const normalized = commitHashesRaw
            .map(function(hash) { return String(hash || '').trim(); })
            .filter(Boolean);
        const commitHashes = Array.from(new Set(normalized));

        if (commitHashes.length === 0) {
            return res.status(400).json({ error: 'commit_hashes obrigatorio' });
        }
        if (commitHashes.length > 50) {
            return res.status(400).json({ error: 'Maximo de 50 commits por requisicao' });
        }

        const invalidHash = commitHashes.find(function(hash) {
            return !validateCommitHash(hash);
        });
        if (invalidHash) {
            return res.status(400).json({ error: 'commit_hash invalido: ' + invalidHash });
        }

        const payload = await readMultipleCommitMetadata(repoPath, commitHashes);
        res.json(payload);
    } catch (error) {
        if (error && Number.isInteger(error.status)) {
            return res.status(error.status).json({ error: error.message });
        }
        if (error && error.code === 'ENOENT') {
            return res.status(500).json({ error: 'git nao encontrado no sistema' });
        }

        const stderr = String(error?.stderr || '').trim();
        if (stderr) {
            return res.status(500).json({ error: stderr });
        }

        res.status(500).json({ error: error?.message || 'Erro ao ler commits' });
    }
});

// ── Metadatas ─────────────────────────────────────────────────────────────────
const METADATA_SELECT = `
    SELECT m.*, f.name AS front, s.name AS sprint, mt.name AS metadata_type,
           COALESCE(
               (SELECT json_group_array(json_object(
                   'id', p.id, 'label', p.label, 'url', p.url, 'created_at', p.created_at
               )) FROM pull_requests p WHERE p.metadata_id = m.id),
               '[]'
           ) AS prs_json
    FROM metadatas m
    JOIN fronts f      ON f.id  = m.front_id
    LEFT JOIN sprints s     ON s.id  = m.sprint_id
    JOIN metadata_types mt ON mt.id = m.metadata_type_id
`;

function parsePrs(rows) {
    return rows.map(row => {
        const { prs_json, ...rest } = row;
        return { ...rest, prs: JSON.parse(prs_json || '[]') };
    });
}

const selectMetadataByUniqueContext = db.prepare(`
    SELECT id
    FROM metadatas
    WHERE front_id = ?
      AND sprint_id = ?
      AND metadata_type_id = ?
      AND metadata_name = ? COLLATE NOCASE
`);

const selectMetadataByContextNullableSprint = db.prepare(`
    SELECT id
    FROM metadatas
    WHERE front_id = ?
      AND (sprint_id IS ? OR (sprint_id IS NULL AND ? IS NULL))
      AND metadata_type_id = ?
      AND metadata_name = ? COLLATE NOCASE
`);

const insertMetadata = db.prepare(`
    INSERT INTO metadatas (id, front_id, sprint_id, metadata_name, metadata_type_id, change_type, ticket, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const selectPullRequestByMetadataAndUrl = db.prepare(`
    SELECT id
    FROM pull_requests
    WHERE metadata_id = ?
      AND url = ? COLLATE NOCASE
`);

const insertPullRequest = db.prepare(
    'INSERT INTO pull_requests (metadata_id, label, url, created_at) VALUES (?, ?, ?, ?)'
);

function parseAndValidatePrUrl(rawUrl) {
    let parsedUrl;
    try {
        parsedUrl = new URL(normalizeText(rawUrl));
    } catch {
        return { error: 'url invalida' };
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { error: 'url deve usar http ou https' };
    }
    return { value: parsedUrl.toString() };
}

app.get('/api/metadatas', (req, res) => {
    const conditions = ['1=1'];
    const params = [];
    if (req.query.front_id)         { conditions.push('m.front_id = ?');         params.push(Number(req.query.front_id)); }
    if (req.query.sprint_id)        { conditions.push('m.sprint_id = ?');        params.push(Number(req.query.sprint_id)); }
    if (req.query.metadata_type_id) { conditions.push('m.metadata_type_id = ?'); params.push(Number(req.query.metadata_type_id)); }
    if (req.query.q) {
        conditions.push('(m.metadata_name LIKE ? ESCAPE \'\\\' OR m.ticket LIKE ? ESCAPE \'\\\' OR m.description LIKE ? ESCAPE \'\\\')');
        const like = '%' + req.query.q.replace(/[%_\\]/g, c => '\\' + c) + '%';
        params.push(like, like, like);
    }
    const rows = db.prepare(METADATA_SELECT + ' WHERE ' + conditions.join(' AND ') + ' ORDER BY m.created_at DESC').all(...params);
    res.json(parsePrs(rows));
});

app.get('/api/exports', (req, res) => {
    const format = normalizeText(req.query.format).toLowerCase();
    if (!format) {
        return res.status(400).json({ error: 'format obrigatorio (json, csv ou md)' });
    }
    if (!['json', 'csv', 'md'].includes(format)) {
        return res.status(400).json({ error: 'Formato invalido. Use format=json, format=csv ou format=md' });
    }

    const rawFrontId = req.query.front_id;
    const rawSprintId = req.query.sprint_id;
    const rawMetadataTypeId = req.query.metadata_type_id;
    const rawChangeType = normalizeText(req.query.change_type);
    const rawSearch = normalizeText(req.query.q);

    const hasFrontFilter = rawFrontId != null && rawFrontId !== '';
    const hasSprintFilter = rawSprintId != null && rawSprintId !== '';
    const hasMetadataTypeFilter = rawMetadataTypeId != null && rawMetadataTypeId !== '';

    const frontId = hasFrontFilter ? parsePositiveInt(rawFrontId) : null;
    const sprintId = hasSprintFilter ? parsePositiveInt(rawSprintId) : null;
    const metadataTypeId = hasMetadataTypeFilter ? parsePositiveInt(rawMetadataTypeId) : null;

    if (hasFrontFilter && !frontId) {
        return res.status(400).json({ error: 'front_id invalido' });
    }
    if (hasSprintFilter && !sprintId) {
        return res.status(400).json({ error: 'sprint_id invalido' });
    }
    if (hasMetadataTypeFilter && !metadataTypeId) {
        return res.status(400).json({ error: 'metadata_type_id invalido' });
    }

    if (frontId && !selectFrontById.get(frontId)) {
        return res.status(400).json({ error: 'front_id invalido' });
    }
    if (sprintId && !selectSprintById.get(sprintId)) {
        return res.status(400).json({ error: 'sprint_id invalido' });
    }
    if (metadataTypeId && !selectMetadataTypeById.get(metadataTypeId)) {
        return res.status(400).json({ error: 'metadata_type_id invalido' });
    }
    if (frontId && sprintId && !selectSprintByIdAndFront.get(sprintId, frontId)) {
        return res.status(400).json({ error: 'sprint_id invalido para a frente informada' });
    }

    if (rawChangeType && !VALID_CHANGE_TYPES.has(rawChangeType)) {
        return res.status(400).json({ error: 'change_type invalido' });
    }

    const hasPr = parseOptionalBoolean(req.query.has_pr);
    if (hasPr === undefined) {
        return res.status(400).json({ error: 'has_pr invalido (use true ou false)' });
    }

    const includePrDetails = parseOptionalBoolean(req.query.include_pr_details);
    if (includePrDetails === undefined) {
        return res.status(400).json({ error: 'include_pr_details invalido (use true ou false)' });
    }

    const conditions = ['1=1'];
    const params = [];

    if (frontId) {
        conditions.push('m.front_id = ?');
        params.push(frontId);
    }
    if (sprintId) {
        conditions.push('m.sprint_id = ?');
        params.push(sprintId);
    }
    if (metadataTypeId) {
        conditions.push('m.metadata_type_id = ?');
        params.push(metadataTypeId);
    }
    if (rawChangeType) {
        conditions.push('m.change_type = ?');
        params.push(rawChangeType);
    }
    if (rawSearch) {
        conditions.push('(m.metadata_name LIKE ? ESCAPE \'\\\' OR m.ticket LIKE ? ESCAPE \'\\\' OR m.description LIKE ? ESCAPE \'\\\')');
        const like = '%' + rawSearch.replace(/[%_\\]/g, c => '\\' + c) + '%';
        params.push(like, like, like);
    }
    if (hasPr === true) {
        conditions.push('EXISTS (SELECT 1 FROM pull_requests p2 WHERE p2.metadata_id = m.id)');
    } else if (hasPr === false) {
        conditions.push('NOT EXISTS (SELECT 1 FROM pull_requests p2 WHERE p2.metadata_id = m.id)');
    }

    const rows = db.prepare(
        METADATA_SELECT +
        ' WHERE ' + conditions.join(' AND ') +
        ' ORDER BY f.name COLLATE NOCASE ASC, ' +
        'CASE WHEN s.name IS NULL THEN 1 ELSE 0 END ASC, ' +
        's.name COLLATE NOCASE ASC, ' +
        'mt.name COLLATE NOCASE ASC, ' +
        'm.metadata_name COLLATE NOCASE ASC, ' +
        'm.created_at DESC'
    ).all(...params);

    const parsedItems = parsePrs(rows);
    const shouldIncludePrDetails = includePrDetails !== false;
    const items = shouldIncludePrDetails
        ? parsedItems
        : parsedItems.map(item => {
            const prCount = Array.isArray(item.prs) ? item.prs.length : 0;
            const { prs, ...rest } = item;
            return { ...rest, pr_count: prCount };
        });

    const payload = {
        exported_at: new Date().toISOString(),
        filters: {
            format,
            front_id: frontId,
            sprint_id: sprintId,
            metadata_type_id: metadataTypeId,
            q: rawSearch || null,
            change_type: rawChangeType || null,
            has_pr: hasPr,
            include_pr_details: shouldIncludePrDetails
        },
        total_items: items.length,
        items
    };

    if (format === 'json') {
        const fileName = buildExportFileName('json');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
        return res.status(200).json(payload);
    }

    const csvHeaders = [
        'front',
        'sprint',
        'metadata_type',
        'metadata_name',
        'change_type',
        'ticket',
        'description',
        'pr_count',
        'pr_labels',
        'pr_urls',
        'created_at'
    ];

    const csvLines = [csvHeaders.join(',')];
    const includePrCols = includePrDetails !== false;
    parsedItems.forEach(item => {
        const prs = Array.isArray(item.prs) ? item.prs : [];
        const prCount = prs.length;
        const prLabels = includePrCols ? prs.map(pr => normalizeText(pr.label)).filter(Boolean).join(' | ') : '';
        const prUrls = includePrCols ? prs.map(pr => normalizeText(pr.url)).filter(Boolean).join(' | ') : '';

        const row = [
            item.front || '',
            item.sprint || '',
            item.metadata_type || '',
            item.metadata_name || '',
            item.change_type || '',
            item.ticket || '',
            item.description || '',
            String(prCount),
            prLabels,
            prUrls,
            item.created_at || ''
        ].map(escapeCsvCell);

        csvLines.push(row.join(','));
    });

    const csvContent = csvLines.join('\n');
    if (format === 'csv') {
        const fileName = buildExportFileName('csv');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
        return res.status(200).send(csvContent);
    }

    const markdownContent = buildMarkdownExport(parsedItems, payload, includePrDetails !== false);
    const fileName = buildExportFileName('md');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
    return res.status(200).send(markdownContent);
});

app.post('/api/metadatas', (req, res) => {
    const { front_id, sprint_id, metadata_name, metadata_type_id, change_type, ticket, description } = req.body ?? {};
    const frontId = parsePositiveInt(front_id);
    const sprintIdValue = sprint_id == null || sprint_id === '' ? null : parsePositiveInt(sprint_id);
    const metadataTypeId = parsePositiveInt(metadata_type_id);
    const metadataType = metadataTypeId ? selectMetadataTypeRecordById.get(metadataTypeId) : null;
    const normalizedMetadataName = normalizeMetadataNameByType(metadata_name, metadataType?.name);
    const normalizedDescription = normalizeText(description);
    const normalizedTicket = normalizeText(ticket) || null;

    if (!frontId || !normalizedMetadataName || !metadataTypeId || !change_type || !normalizedDescription) {
        return res.status(400).json({ error: 'campos obrigatorios ausentes' });
    }
    if (normalizedMetadataName.length > 255) {
        return res.status(400).json({ error: 'metadata_name excede 255 caracteres' });
    }
    if (normalizedDescription.length > 4000) {
        return res.status(400).json({ error: 'description excede 4000 caracteres' });
    }
    if (normalizedTicket && normalizedTicket.length > 255) {
        return res.status(400).json({ error: 'ticket excede 255 caracteres' });
    }
    if (!VALID_CHANGE_TYPES.has(change_type)) {
        return res.status(400).json({ error: 'change_type invalido' });
    }
    if (!selectFrontById.get(frontId)) {
        return res.status(400).json({ error: 'front_id invalido' });
    }
    if (!metadataType) {
        return res.status(400).json({ error: 'metadata_type_id invalido' });
    }
    if (sprintIdValue && !selectSprintByIdAndFront.get(sprintIdValue, frontId)) {
        return res.status(400).json({ error: 'sprint_id invalido para a frente informada' });
    }
    const existingMetadata = selectMetadataByContextNullableSprint.get(
        frontId,
        sprintIdValue,
        sprintIdValue,
        metadataTypeId,
        normalizedMetadataName
    );
    if (existingMetadata) {
        return res.status(409).json({
            error: 'Este metadata ja esta cadastrado para a mesma frente e sprint. Use o registro existente para adicionar PRs.',
            existing_id: existingMetadata.id
        });
    }
    const id = 'meta-' + crypto.randomUUID();
    const created_at = new Date().toISOString();
    try {
        insertMetadata.run(
            id, frontId, sprintIdValue,
            normalizedMetadataName, metadataTypeId,
            change_type, normalizedTicket,
            normalizedDescription, created_at
        );
        const rows = db.prepare(METADATA_SELECT + ' WHERE m.id = ?').all(id);
        res.json(parsePrs(rows)[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/metadatas/bulk', (req, res) => {
    const { front_id, sprint_id, ticket, description, metadata_items, prs } = req.body ?? {};

    const frontId = parsePositiveInt(front_id);
    const sprintIdValue = sprint_id == null || sprint_id === '' ? null : parsePositiveInt(sprint_id);
    const normalizedDescription = normalizeText(description);
    const normalizedTicket = normalizeText(ticket) || null;
    const metadataItems = Array.isArray(metadata_items) ? metadata_items : [];
    const prItems = Array.isArray(prs) ? prs : [];

    if (!frontId || !normalizedDescription || metadataItems.length === 0) {
        return res.status(400).json({ error: 'front_id, description e metadata_items sao obrigatorios' });
    }
    if (normalizedDescription.length > 4000) {
        return res.status(400).json({ error: 'description excede 4000 caracteres' });
    }
    if (normalizedTicket && normalizedTicket.length > 255) {
        return res.status(400).json({ error: 'ticket excede 255 caracteres' });
    }
    if (!selectFrontById.get(frontId)) {
        return res.status(400).json({ error: 'front_id invalido' });
    }
    if (sprintIdValue && !selectSprintByIdAndFront.get(sprintIdValue, frontId)) {
        return res.status(400).json({ error: 'sprint_id invalido para a frente informada' });
    }

    const uniqueMetadata = new Map();
    for (let index = 0; index < metadataItems.length; index += 1) {
        const row = metadataItems[index] || {};
        const metadataTypeId = parsePositiveInt(row.metadata_type_id);
        const metadataType = metadataTypeId ? selectMetadataTypeRecordById.get(metadataTypeId) : null;
        const metadataName = normalizeMetadataNameByType(row.metadata_name, metadataType?.name);
        const changeType = normalizeText(row.change_type);

        if (!metadataName || !metadataTypeId || !changeType) {
            return res.status(400).json({ error: `metadata_items[${index}] invalido` });
        }
        if (metadataName.length > 255) {
            return res.status(400).json({ error: `metadata_items[${index}].metadata_name excede 255 caracteres` });
        }
        if (!VALID_CHANGE_TYPES.has(changeType)) {
            return res.status(400).json({ error: `metadata_items[${index}].change_type invalido` });
        }
        if (!metadataType) {
            return res.status(400).json({ error: `metadata_items[${index}].metadata_type_id invalido` });
        }

        const key = `${metadataTypeId}|${metadataName.toLowerCase()}`;
        if (!uniqueMetadata.has(key)) {
            uniqueMetadata.set(key, {
                metadata_name: metadataName,
                metadata_type_id: metadataTypeId,
                change_type: changeType
            });
        }
    }

    const uniquePrs = new Map();
    for (let index = 0; index < prItems.length; index += 1) {
        const row = prItems[index] || {};
        const label = normalizeText(row.label);
        const rawUrl = normalizeText(row.url);

        if (!label && !rawUrl) {
            continue;
        }
        if (!label || !rawUrl) {
            return res.status(400).json({ error: `prs[${index}] deve conter label e url` });
        }
        if (label.length > 255) {
            return res.status(400).json({ error: `prs[${index}].label excede 255 caracteres` });
        }

        const parsedUrl = parseAndValidatePrUrl(rawUrl);
        if (parsedUrl.error) {
            return res.status(400).json({ error: `prs[${index}].${parsedUrl.error}` });
        }

        const prKey = `${label.toLowerCase()}|${parsedUrl.value.toLowerCase()}`;
        if (!uniquePrs.has(prKey)) {
            uniquePrs.set(prKey, { label, url: parsedUrl.value });
        }
    }

    let createdCount = 0;
    let reusedCount = 0;
    let prCreatedCount = 0;
    const totalMetadata = uniqueMetadata.size;

    db.exec('BEGIN IMMEDIATE');
    try {
        for (const metadataRow of uniqueMetadata.values()) {
            let metadata = selectMetadataByContextNullableSprint.get(
                frontId,
                sprintIdValue,
                sprintIdValue,
                metadataRow.metadata_type_id,
                metadataRow.metadata_name
            );

            if (!metadata) {
                const metadataId = 'meta-' + crypto.randomUUID();
                insertMetadata.run(
                    metadataId,
                    frontId,
                    sprintIdValue,
                    metadataRow.metadata_name,
                    metadataRow.metadata_type_id,
                    metadataRow.change_type,
                    normalizedTicket,
                    normalizedDescription,
                    new Date().toISOString()
                );
                metadata = { id: metadataId };
                createdCount += 1;
            } else {
                reusedCount += 1;
            }

            for (const prDef of uniquePrs.values()) {
                const existingPr = selectPullRequestByMetadataAndUrl.get(metadata.id, prDef.url);
                if (existingPr) {
                    continue;
                }
                insertPullRequest.run(metadata.id, prDef.label, prDef.url, new Date().toISOString());
                prCreatedCount += 1;
            }
        }

        db.exec('COMMIT');
        return res.json({
            ok: true,
            total_metadata: totalMetadata,
            created_count: createdCount,
            reused_count: reusedCount,
            pr_created_count: prCreatedCount
        });
    } catch (e) {
        db.exec('ROLLBACK');
        const msg = String(e?.message || '');
        if (msg.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Conflito de unicidade ao processar lote. Revise metadados ou PRs duplicados.' });
        }
        return res.status(500).json({ error: e?.message || 'Erro ao processar lote transacional' });
    }
});

app.put('/api/metadatas/:id', (req, res) => {
    const id = String(req.params.id);
    if (!/^meta-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
        return res.status(400).json({ error: 'id invalido' });
    }
    const { change_type, ticket, description } = req.body ?? {};
    const normalizedDescription = normalizeText(description);
    const normalizedTicket = normalizeText(ticket) || null;
    if (!change_type || !normalizedDescription) {
        return res.status(400).json({ error: 'change_type e description sao obrigatorios' });
    }
    if (normalizedDescription.length > 4000) {
        return res.status(400).json({ error: 'description excede 4000 caracteres' });
    }
    if (normalizedTicket && normalizedTicket.length > 255) {
        return res.status(400).json({ error: 'ticket excede 255 caracteres' });
    }
    if (!VALID_CHANGE_TYPES.has(change_type)) {
        return res.status(400).json({ error: 'change_type invalido' });
    }
    if (!selectMetadataById.get(id)) {
        return res.status(404).json({ error: 'metadata nao encontrado' });
    }
    try {
        db.prepare(`
            UPDATE metadatas
            SET change_type = ?, ticket = ?, description = ?
            WHERE id = ?
        `).run(
            change_type,
            normalizedTicket,
            normalizedDescription,
            id
        );
        const rows = db.prepare(METADATA_SELECT + ' WHERE m.id = ?').all(id);
        res.json(parsePrs(rows)[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/metadatas/:id', (req, res) => {
    const id = String(req.params.id);
    if (!/^meta-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
        return res.status(400).json({ error: 'id invalido' });
    }
    db.prepare('DELETE FROM metadatas WHERE id = ?').run(id);
    res.json({ ok: true });
});

// ── Pull Requests ─────────────────────────────────────────────────────────────
app.post('/api/metadatas/:id/prs', (req, res) => {
    const metadataId = String(req.params.id);
    const label = normalizeText(req.body?.label);
    const url = normalizeText(req.body?.url);
    if (!/^meta-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(metadataId)) {
        return res.status(400).json({ error: 'metadata_id invalido' });
    }
    if (!selectMetadataById.get(metadataId)) {
        return res.status(404).json({ error: 'metadata nao encontrado' });
    }
    if (!label || !url) return res.status(400).json({ error: 'label e url obrigatorios' });
    if (label.length > 255) return res.status(400).json({ error: 'label excede 255 caracteres' });
    const parsedUrl = parseAndValidatePrUrl(url);
    if (parsedUrl.error) {
        return res.status(400).json({ error: parsedUrl.error });
    }
    const normalizedUrl = parsedUrl.value;
    const created_at = new Date().toISOString();
    try {
        const result = db.prepare(
            'INSERT INTO pull_requests (metadata_id, label, url, created_at) VALUES (?, ?, ?, ?)'
        ).run(metadataId, label, normalizedUrl, created_at);
        res.json(db.prepare('SELECT * FROM pull_requests WHERE id = ?').get(result.lastInsertRowid));
    } catch (e) {
        const msg = String(e?.message || '');
        if (msg.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Este PR ja esta vinculado ao metadata informado' });
        }
        return res.status(500).json({ error: e.message });
    }
});

app.delete('/api/prs/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'id invalido' });
    db.prepare('DELETE FROM pull_requests WHERE id = ?').run(id);
    res.json({ ok: true });
});

// ── Scan unique commit authors ───────────────────────────────────────────────
app.post('/api/scan-commit-authors', async (req, res) => {
    try {
        const repoPath = assertValidRepoPath(String(req.body?.repo_path || '').trim());

        const args = [
            'log', '--all',
            '--pretty=format:%aN%x09%aE%x09%aI'
        ];

        const since = String(req.body?.since || '').trim();
        const until = String(req.body?.until || '').trim();
        const branch = String(req.body?.branch || '').trim();

        if (since) args.push(`--since=${since}`);
        if (until) args.push(`--until=${until}`);
        if (branch) {
            if (branch.startsWith('-') || !/^[a-zA-Z0-9/_.\-@]+$/.test(branch)) {
                return res.status(400).json({ error: 'branch invalido' });
            }
            args.push(branch);
        }

        const { stdout } = await runGit(repoPath, args);
        const rows = String(stdout || '')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        const groupedByEmail = new Map();

        rows.forEach(line => {
            const parts = line.split('\t');
            const name = normalizeText(parts[0] || '');
            const email = normalizeText(parts[1] || '').toLowerCase();
            const authoredAt = normalizeText(parts[2] || '');

            if (!email) {
                return;
            }

            const current = groupedByEmail.get(email);
            if (!current) {
                groupedByEmail.set(email, {
                    name: name || email,
                    email,
                    commit_count: 1,
                    last_commit_at: authoredAt || null
                });
                return;
            }

            current.commit_count += 1;

            const currentTime = Date.parse(current.last_commit_at || '');
            const candidateTime = Date.parse(authoredAt || '');
            if (!Number.isNaN(candidateTime) && (Number.isNaN(currentTime) || candidateTime > currentTime)) {
                current.last_commit_at = authoredAt;
                if (name) {
                    current.name = name;
                }
            }
        });

        const authors = Array.from(groupedByEmail.values())
            .sort((a, b) => {
                if (b.commit_count !== a.commit_count) {
                    return b.commit_count - a.commit_count;
                }
                return a.email.localeCompare(b.email, 'pt-BR');
            });

        res.json({ authors, total: authors.length });
    } catch (error) {
        if (error && Number.isInteger(error.status)) {
            return res.status(error.status).json({ error: error.message });
        }
        if (error && error.code === 'ENOENT') {
            return res.status(500).json({ error: 'git nao encontrado no sistema' });
        }
        const stderr = String(error?.stderr || '').trim();
        if (stderr) {
            return res.status(500).json({ error: stderr });
        }
        res.status(500).json({ error: error?.message || 'Erro ao listar autores de commit' });
    }
});

// ── Scan commits by author email ──────────────────────────────────────────────
app.post('/api/scan-commits', async (req, res) => {
    try {
        const repoPath = assertValidRepoPath(String(req.body?.repo_path || '').trim());

        const requestedEmails = normalizeAuthorEmailList([
            req.body?.author_email,
            req.body?.email,
            req.body?.author_emails
        ]);

        if (requestedEmails.length === 0) {
            return res.status(400).json({ error: 'author_emails obrigatorio' });
        }

        const payload = await readCommitsForAuthors(repoPath, requestedEmails, {
            since: req.body?.since,
            until: req.body?.until,
            branch: req.body?.branch
        });

        res.json(payload);
    } catch (error) {
        if (error && Number.isInteger(error.status)) {
            return res.status(error.status).json({ error: error.message });
        }
        if (error && error.code === 'ENOENT') {
            return res.status(500).json({ error: 'git nao encontrado no sistema' });
        }
        const stderr = String(error?.stderr || '').trim();
        if (stderr) {
            return res.status(500).json({ error: stderr });
        }
        res.status(500).json({ error: error?.message || 'Erro ao ler commits' });
    }
});

app.post('/api/repos/:id/discover-pr-links', async (req, res) => {
    try {
        const repoId = Number(req.params.id);
        if (!Number.isInteger(repoId) || repoId < 1) {
            return res.status(400).json({ error: 'id invalido' });
        }

        const repo = db.prepare('SELECT * FROM repos WHERE id = ?').get(repoId);
        if (!repo) {
            return res.status(404).json({ error: 'Repositorio nao encontrado' });
        }

        const frontId = parsePositiveInt(req.body?.front_id);
        if (!frontId) {
            return res.status(400).json({ error: 'front_id obrigatorio' });
        }
        if (!selectFrontById.get(frontId)) {
            return res.status(404).json({ error: 'Frente nao encontrada' });
        }

        const targetBranches = parseTargetBranchesInput(req.body?.target_branches);
        if (targetBranches.length === 0) {
            return res.status(400).json({ error: 'target_branches obrigatorio' });
        }

        const since = parseOptionalDate(req.body?.since);
        const until = parseOptionalDate(req.body?.until);
        if (since === undefined || until === undefined) {
            return res.status(422).json({ error: 'since/until devem seguir o formato YYYY-MM-DD' });
        }

        const rangeCheck = validateDateRange(since, until);
        if (!rangeCheck.ok) {
            return res.status(422).json({ error: rangeCheck.error });
        }

        const requestedEmails = normalizeAuthorEmailList([
            req.body?.author_email,
            req.body?.author_emails
        ]);
        const authorFilterSet = requestedEmails.length ? new Set(requestedEmails) : null;

        const includeAlreadyLinked = parseOptionalBoolean(req.body?.include_already_linked) === true;
        const repoPath = assertValidRepoPath(repo.repo_path);

        let remote;
        try {
            const { stdout: remoteOut } = await runGit(repoPath, ['remote', 'get-url', 'origin']);
            remote = String(remoteOut || '').trim();
        } catch {
            return res.status(422).json({ error: 'Repositorio sem remote origin configurado' });
        }

        const branchValidation = await validateTargetBranches(runGit, repoPath, targetBranches);
        if (!branchValidation.ok) {
            return res.status(422).json({ error: branchValidation.error });
        }

        const orgRepo = extractOrgRepoFromRemote(remote);
        const prBaseUrl = orgRepo ? 'https://github.com/' + orgRepo + '/pull/' : null;

        const selectCandidates = db.prepare(buildMetadataCandidateQuery(includeAlreadyLinked));
        const metadataCandidates = selectCandidates.all(frontId);

        const startedAt = Date.now();
        const results = [];

        for (const metadata of metadataCandidates) {
            try {
                const evidences = [];

                for (const branch of branchValidation.branches) {
                    const { stdout } = await runGit(repoPath, buildMetadataLogArgs(branch, metadata.metadata_name, {
                        mergesOnly: true,
                        since,
                        until
                    }));

                    const lines = String(stdout || '').split(/\r?\n/).map(function(line) { return line.trim(); }).filter(Boolean);
                    lines.forEach(function(line) {
                        const parsedLine = parseMetadataLogLine(line);
                        if (!parsedLine || !parsedLine.commit_sha) return;
                        if (authorFilterSet && !authorFilterSet.has(normalizeAuthorEmail(parsedLine.author_email))) return;
                        const mergePr = parseMergePullRequest(parsedLine.subject);
                        if (!mergePr) return;

                        evidences.push({
                            metadata_id: metadata.metadata_id,
                            commit_sha: parsedLine.commit_sha,
                            pr_number: mergePr.pr_number,
                            source_branch: mergePr.source_branch || branch,
                            heuristic: 'merge_commit',
                            subject: parsedLine.subject,
                            author_name: parsedLine.author_name,
                            author_email: parsedLine.author_email,
                            pr_url: prBaseUrl ? prBaseUrl + mergePr.pr_number : null
                        });
                    });
                }

                if (evidences.length === 0) {
                    for (const branch of branchValidation.branches) {
                        const { stdout } = await runGit(repoPath, buildMetadataLogArgs(branch, metadata.metadata_name, {
                            since,
                            until
                        }));

                        const lines = String(stdout || '').split(/\r?\n/).map(function(line) { return line.trim(); }).filter(Boolean);
                        lines.forEach(function(line) {
                            const parsedLine = parseMetadataLogLine(line);
                            if (!parsedLine || !parsedLine.commit_sha) return;
                            if (authorFilterSet && !authorFilterSet.has(normalizeAuthorEmail(parsedLine.author_email))) return;

                            const prNumbers = parsePullRequestFromMessage(parsedLine.subject);
                            prNumbers.forEach(function(prNumber) {
                                evidences.push({
                                    metadata_id: metadata.metadata_id,
                                    commit_sha: parsedLine.commit_sha,
                                    pr_number: prNumber,
                                    source_branch: branch,
                                    heuristic: 'commit_message',
                                    subject: parsedLine.subject,
                                    author_name: parsedLine.author_name,
                                    author_email: parsedLine.author_email,
                                    pr_url: prBaseUrl ? prBaseUrl + prNumber : null
                                });
                            });
                        });
                    }
                }

                results.push(classifyMetadataDecision(metadata, evidences));
            } catch (error) {
                results.push({
                    metadata_id: metadata.metadata_id,
                    metadata_name: metadata.metadata_name,
                    status: 'error',
                    heuristic_used: null,
                    matched_pr: null,
                    candidate_prs: [],
                    reason: String(error?.message || 'Erro ao analisar metadata')
                });
            }
        }

        const summary = {
            total_candidates: metadataCandidates.length,
            total_matched: results.filter(function(item) { return item.status === 'matched'; }).length,
            total_no_match: results.filter(function(item) { return item.status === 'no_match'; }).length,
            total_conflict: results.filter(function(item) { return item.status === 'conflict'; }).length,
            total_error: results.filter(function(item) { return item.status === 'error'; }).length,
            duration_ms: Date.now() - startedAt,
            target_branches: branchValidation.branches,
            author_emails: requestedEmails,
            since_utc: since ? since + 'T00:00:00.000Z' : null,
            until_utc: until ? until + 'T23:59:59.999Z' : null
        };

        return res.json({ summary, results, pr_base_url: prBaseUrl });
    } catch (error) {
        if (error && Number.isInteger(error.status)) {
            return res.status(error.status).json({ error: error.message });
        }
        if (error && error.code === 'ENOENT') {
            return res.status(500).json({ error: 'git nao encontrado no sistema' });
        }
        const stderr = String(error?.stderr || '').trim();
        if (stderr) return res.status(500).json({ error: stderr });
        return res.status(500).json({ error: error?.message || 'Erro ao descobrir PRs' });
    }
});

app.post('/api/repos/:id/apply-pr-links', (req, res) => {
    const repoId = Number(req.params.id);
    if (!Number.isInteger(repoId) || repoId < 1) return res.status(400).json({ error: 'id invalido' });

    const repo = db.prepare('SELECT id FROM repos WHERE id = ?').get(repoId);
    if (!repo) return res.status(404).json({ error: 'Repositorio nao encontrado' });

    const links = Array.isArray(req.body?.links) ? req.body.links : [];
    if (links.length === 0) return res.status(400).json({ error: 'links obrigatorio' });

    const byMetadata = new Map();
    links.forEach(function(link) {
        const metadataId = String(link?.metadata_id || '').trim();
        const prNumber = String(link?.pr_number || '').trim();
        if (!metadataId || !prNumber) return;
        if (!byMetadata.has(metadataId)) byMetadata.set(metadataId, new Set());
        byMetadata.get(metadataId).add(prNumber);
    });

    const ambiguousMetadata = new Set();
    byMetadata.forEach(function(prNumbers, metadataId) {
        if (prNumbers.size > 1) ambiguousMetadata.add(metadataId);
    });

    let saved = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    const saveMany = db.transaction(() => {
        for (const item of links) {
            const metadataId = String(item?.metadata_id || '').trim();
            const prNumber = String(item?.pr_number || '').trim();
            const rawUrl = String(item?.pr_url || '').trim();

            if (!metadataId || !prNumber || !rawUrl) {
                skipped += 1;
                continue;
            }

            if (ambiguousMetadata.has(metadataId)) {
                skipped += 1;
                continue;
            }

            const metadata = selectMetadataById.get(metadataId);
            if (!metadata) {
                skipped += 1;
                continue;
            }

            let parsedUrl;
            try {
                parsedUrl = new URL(rawUrl);
                if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                    skipped += 1;
                    continue;
                }
            } catch {
                skipped += 1;
                continue;
            }

            const normalizedUrl = parsedUrl.toString();
            const existing = selectPullRequestByMetadataAndUrl.get(metadataId, normalizedUrl);
            if (existing) {
                skipped += 1;
                continue;
            }

            insertPullRequest.run(metadataId, 'PR #' + prNumber, normalizedUrl, now);
            saved += 1;
        }
    });

    saveMany();
    res.json({ saved, skipped });
});

// ── Varredura de PRs a partir de merge commits ────────────────────────────────
app.post('/api/repos/:id/scan-prs', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'id invalido' });

        const repo = db.prepare('SELECT * FROM repos WHERE id = ?').get(id);
        if (!repo) return res.status(404).json({ error: 'Repositorio nao encontrado' });

        const repoPath = assertValidRepoPath(repo.repo_path);
        const sinceDays = Math.min(Math.max(Number(req.body?.since_days) || 90, 1), 3650);
        const branchFilter = String(req.body?.branch_filter || '').trim().toLowerCase();
        const authorFilter = String(req.body?.author_filter || '').trim().toLowerCase();
        const sinceStart = new Date();
        sinceStart.setHours(0, 0, 0, 0);
        sinceStart.setDate(sinceStart.getDate() - sinceDays);
        const sinceIso = sinceStart.toISOString();

        // Tentar obter URL base das PRs a partir do remote origin
        let prBaseUrl = null;
        try {
            const { stdout: remoteOut } = await runGit(repoPath, ['remote', 'get-url', 'origin']);
            const remote = String(remoteOut || '').trim();
            const httpsMatch = remote.match(/https?:\/\/[^/]+\/([^/]+\/[^/]+?)(?:\.git)?$/);
            const sshMatch   = remote.match(/git@[^:]+:([^/]+\/[^/]+?)(?:\.git)?$/);
            const orgRepo = (httpsMatch && httpsMatch[1]) || (sshMatch && sshMatch[1]);
            if (orgRepo) prBaseUrl = 'https://github.com/' + orgRepo + '/pull/';
        } catch {
            // remote nao configurado — continuar sem URL
        }

        // Listar merge commits no periodo
        const { stdout: logOut } = await runGit(repoPath, [
            'log', '--all', '--merges',
            '--format=%H\t%s\t%an\t%ae',
            '--since=' + sinceIso
        ]);

        const PR_REGEX = /Merge pull request #(\d+) from [^/]+\/(.+)/;
        const mergeLines = String(logOut || '').split('\n').map(l => l.trim()).filter(Boolean);

        const prs = [];
        for (const line of mergeLines) {
            const parts = line.split('\t');
            if (parts.length < 2) continue;
            const sha = String(parts[0] || '').trim();
            const subject = String(parts[1] || '').trim();
            const authorName = String(parts[2] || '').trim();
            const authorEmail = String(parts[3] || '').trim();
            const match   = subject.match(PR_REGEX);
            if (!match) continue;

            const sourceBranch = String(match[2] || '').trim();
            if (branchFilter && !sourceBranch.toLowerCase().includes(branchFilter)) {
                continue;
            }
            if (authorFilter) {
                const authorText = (authorName + ' ' + authorEmail).toLowerCase();
                if (!authorText.includes(authorFilter)) {
                    continue;
                }
            }

            prs.push({
                sha,
                prNumber: match[1],
                sourceBranch,
                authorName,
                authorEmail
            });
        }

        if (prs.length === 0) {
            return res.json({ total_prs: 0, total_matches: 0, matches: [], pr_base_url: prBaseUrl });
        }

        // Para cada PR, obter arquivos alterados e cruzar com metadados cadastrados
        const allMatches = [];
        const metadataCache = new Map();

        for (const pr of prs) {
            let files;
            try {
                const { stdout: diffOut } = await runGit(repoPath, [
                    'diff-tree', '--no-commit-id', '--name-only', '-r', '-m', pr.sha
                ]);
                files = Array.from(new Set(
                    String(diffOut || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
                ));
            } catch {
                continue;
            }

            for (const file of files) {
                const normalized = normalizeMetadataName(file);
                if (!normalized) continue;

                let metadataRow;
                if (metadataCache.has(normalized)) {
                    metadataRow = metadataCache.get(normalized);
                } else {
                    metadataRow = db.prepare(
                        'SELECT id, metadata_name FROM metadatas WHERE metadata_name = ? COLLATE NOCASE'
                    ).get(normalized) || null;
                    metadataCache.set(normalized, metadataRow);
                }

                if (!metadataRow) continue;

                // Evitar duplicatas para mesmo pr_number + metadata_id
                const dedupKey = pr.prNumber + '::' + metadataRow.id;
                if (allMatches.some(m => m._dedupKey === dedupKey)) continue;

                allMatches.push({
                    _dedupKey: dedupKey,
                    pr_number: pr.prNumber,
                    source_branch: pr.sourceBranch,
                    pr_author_name: pr.authorName,
                    pr_author_email: pr.authorEmail,
                    commit_sha: pr.sha,
                    metadata_id: metadataRow.id,
                    metadata_name: metadataRow.metadata_name,
                    pr_url: prBaseUrl ? prBaseUrl + pr.prNumber : null
                });
            }
        }

        // Remover campo interno antes de retornar
        const matches = allMatches.map(({ _dedupKey, ...m }) => m);

        res.json({
            total_prs: prs.length,
            total_matches: matches.length,
            matches,
            pr_base_url: prBaseUrl,
            since_utc: sinceIso,
            filters: {
                branch_filter: branchFilter,
                author_filter: authorFilter
            }
        });
    } catch (error) {
        if (error && Number.isInteger(error.status)) {
            return res.status(error.status).json({ error: error.message });
        }
        if (error && error.code === 'ENOENT') {
            return res.status(500).json({ error: 'git nao encontrado no sistema' });
        }
        const stderr = String(error?.stderr || '').trim();
        if (stderr) return res.status(500).json({ error: stderr });
        res.status(500).json({ error: error?.message || 'Erro ao varrer PRs' });
    }
});

app.post('/api/repos/:id/save-scanned-prs', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'id invalido' });

    const repo = db.prepare('SELECT id FROM repos WHERE id = ?').get(id);
    if (!repo) return res.status(404).json({ error: 'Repositorio nao encontrado' });

    const matches = Array.isArray(req.body?.matches) ? req.body.matches : [];
    if (matches.length === 0) return res.status(400).json({ error: 'Nenhum match informado' });

    const now = new Date().toISOString();
    let saved = 0;
    let skipped = 0;

    const saveMany = db.transaction(() => {
        for (const m of matches) {
            const prNumber   = String(m.pr_number   || '').trim();
            const metadataId = Number(m.metadata_id);
            const rawUrl     = String(m.pr_url      || '').trim();

            if (!prNumber || !metadataId || !rawUrl) { skipped++; continue; }

            let parsedUrl;
            try {
                parsedUrl = new URL(rawUrl);
                if (!['http:', 'https:'].includes(parsedUrl.protocol)) { skipped++; continue; }
            } catch { skipped++; continue; }

            const meta = db.prepare('SELECT id FROM metadatas WHERE id = ?').get(metadataId);
            if (!meta) { skipped++; continue; }

            const existing = selectPullRequestByMetadataAndUrl.get(metadataId, parsedUrl.toString());
            if (existing) { skipped++; continue; }

            insertPullRequest.run(metadataId, 'PR #' + prNumber, parsedUrl.toString(), now);
            saved++;
        }
    });

    saveMany();
    res.json({ saved, skipped });
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`\n  Release Notes disponivel em http://localhost:${PORT}\n`);
});
