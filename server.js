'use strict';

const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');

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
    sprint_id        INTEGER NOT NULL REFERENCES sprints(id),
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
`);

db.exec(`
  UPDATE metadatas
  SET metadata_name = TRIM(metadata_name),
      description = TRIM(description),
      ticket = NULLIF(TRIM(COALESCE(ticket, '')), '');
`);

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

consolidateDuplicateMetadatas();

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_metadatas_unique_context
  ON metadatas (front_id, sprint_id, metadata_type_id, metadata_name COLLATE NOCASE);
`);

const DEFAULT_TYPES = [
    'ApexClass', 'ApexTrigger', 'Flow', 'Lightning Web Component',
    'CustomObject', 'ValidationRule', 'PermissionSet', 'Profile'
];
const stmtInsertType = db.prepare('INSERT OR IGNORE INTO metadata_types (name) VALUES (?)');
DEFAULT_TYPES.forEach(name => stmtInsertType.run(name));

const VALID_CHANGE_TYPES = new Set(['Criacao', 'Alteracao', 'Correcao', 'Remocao']);

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
    const cleanPath = String(filePath || '').replace(/\\/g, '/').trim();
    if (!cleanPath) return { name: '', type: 'Metadata' };

    const type = extractMetadataType(cleanPath);

    const objectField = cleanPath.match(/\/objects\/([^/]+)\/fields\/([^/]+)$/i);
    if (objectField) {
        return {
            name: stripKnownSuffixes(objectField[1]) + '/' + stripKnownSuffixes(objectField[2]),
            type: 'Custom Field'
        };
    }

    const objectValidationRule = cleanPath.match(/\/objects\/([^/]+)\/validationRules\/([^/]+)$/i);
    if (objectValidationRule) {
        return {
            name: stripKnownSuffixes(objectValidationRule[1]) + '/' + stripKnownSuffixes(objectValidationRule[2]),
            type: 'ValidationRule'
        };
    }

    const lwcMatch = cleanPath.match(/\/lwc\/([^/]+)\//i);
    if (lwcMatch) {
        return { name: stripKnownSuffixes(lwcMatch[1]), type: 'Lightning Web Component' };
    }

    const parts = cleanPath.split('/');
    const last = parts[parts.length - 1] || '';
    return {
        name: last,
        type: normalizeMetadataTypeName(type)
    };
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

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
        if (!/^[0-9a-f]{7,40}$/i.test(commitHash)) {
            return res.status(400).json({ error: 'commit_hash invalido' });
        }

        const { stdout } = await runGit(repoPath, ['show', '--pretty=format:', '--name-only', commitHash]);
        const files = String(stdout || '')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        const metadataItems = Array.from(new Map(
            files
                .map(extractMetadataName)
                .filter(item => item.name)
                .map(item => [String(item.type).toLowerCase() + '::' + String(item.name).toLowerCase(), item])
        ).values());

        res.json({
            commit_hash: commitHash,
            total_files: files.length,
            total_metadata: metadataItems.length,
            metadata_items: metadataItems
        });
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
    JOIN sprints s     ON s.id  = m.sprint_id
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

app.get('/api/metadatas', (req, res) => {
    const conditions = ['1=1'];
    const params = [];
    if (req.query.front_id)         { conditions.push('m.front_id = ?');         params.push(Number(req.query.front_id)); }
    if (req.query.sprint_id)        { conditions.push('m.sprint_id = ?');        params.push(Number(req.query.sprint_id)); }
    if (req.query.metadata_type_id) { conditions.push('m.metadata_type_id = ?'); params.push(Number(req.query.metadata_type_id)); }
    if (req.query.q) {
        conditions.push('(m.metadata_name LIKE ? OR m.ticket LIKE ? OR m.description LIKE ?)');
        const like = '%' + req.query.q.replace(/[%_\\]/g, c => '\\' + c) + '%';
        params.push(like, like, like);
    }
    const rows = db.prepare(METADATA_SELECT + ' WHERE ' + conditions.join(' AND ') + ' ORDER BY m.created_at DESC').all(...params);
    res.json(parsePrs(rows));
});

app.post('/api/metadatas', (req, res) => {
    const { front_id, sprint_id, metadata_name, metadata_type_id, change_type, ticket, description } = req.body ?? {};
    if (!front_id || !sprint_id || !metadata_name || !metadata_type_id || !change_type || !description) {
        return res.status(400).json({ error: 'campos obrigatorios ausentes' });
    }
    if (!VALID_CHANGE_TYPES.has(change_type)) {
        return res.status(400).json({ error: 'change_type invalido' });
    }
    const normalizedMetadataName = String(metadata_name).trim();
    const existingMetadata = selectMetadataByUniqueContext.get(
        Number(front_id),
        Number(sprint_id),
        Number(metadata_type_id),
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
        db.prepare(`
            INSERT INTO metadatas (id, front_id, sprint_id, metadata_name, metadata_type_id, change_type, ticket, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, Number(front_id), Number(sprint_id),
            normalizedMetadataName, Number(metadata_type_id),
            change_type, ticket ? String(ticket).trim() : null,
            String(description).trim(), created_at
        );
        const rows = db.prepare(METADATA_SELECT + ' WHERE m.id = ?').all(id);
        res.json(parsePrs(rows)[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/metadatas/:id', (req, res) => {
    const id = String(req.params.id);
    if (!/^meta-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
        return res.status(400).json({ error: 'id invalido' });
    }
    const { change_type, ticket, description } = req.body ?? {};
    if (!change_type || !description) {
        return res.status(400).json({ error: 'change_type e description sao obrigatorios' });
    }
    if (!VALID_CHANGE_TYPES.has(change_type)) {
        return res.status(400).json({ error: 'change_type invalido' });
    }
    try {
        db.prepare(`
            UPDATE metadatas
            SET change_type = ?, ticket = ?, description = ?
            WHERE id = ?
        `).run(
            change_type,
            ticket ? String(ticket).trim() : null,
            String(description).trim(),
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
    const label = String(req.body?.label ?? '').trim();
    const url   = String(req.body?.url   ?? '').trim();
    if (!label || !url) return res.status(400).json({ error: 'label e url obrigatorios' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'url invalida' }); }
    const created_at = new Date().toISOString();
    const result = db.prepare(
        'INSERT INTO pull_requests (metadata_id, label, url, created_at) VALUES (?, ?, ?, ?)'
    ).run(metadataId, label, url, created_at);
    res.json(db.prepare('SELECT * FROM pull_requests WHERE id = ?').get(result.lastInsertRowid));
});

app.delete('/api/prs/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'id invalido' });
    db.prepare('DELETE FROM pull_requests WHERE id = ?').run(id);
    res.json({ ok: true });
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`\n  Release Notes disponivel em http://localhost:${PORT}\n`);
});
