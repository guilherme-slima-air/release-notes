'use strict';

const MERGE_PR_REGEX = /Merge pull request #(\d+) from [^/]+\/(.+)/i;
const MESSAGE_PR_REGEXES = [
    /\(#(\d+)\)/gi,
    /\bPR\s*#\s*(\d+)\b/gi
];

const HEURISTIC_PRIORITY = {
    merge_commit: 1,
    commit_message: 2
};

function normalizeText(value) {
    return String(value == null ? '' : value).trim();
}

function normalizeBranchList(values) {
    const list = Array.isArray(values) ? values : [values];
    const normalized = list
        .map(function(item) { return normalizeText(item); })
        .filter(Boolean);
    return Array.from(new Set(normalized));
}

function parseOptionalDate(value) {
    const text = normalizeText(value);
    if (!text) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
    return text;
}

function validateDateRange(since, until) {
    if (!since || !until) {
        return { ok: true };
    }

    const sinceDate = Date.parse(since + 'T00:00:00.000Z');
    const untilDate = Date.parse(until + 'T23:59:59.999Z');
    if (Number.isNaN(sinceDate) || Number.isNaN(untilDate)) {
        return { ok: false, error: 'since/until invalidos' };
    }

    if (sinceDate > untilDate) {
        return { ok: false, error: 'since nao pode ser maior que until' };
    }

    return { ok: true };
}

function parseMergePullRequest(subject) {
    const text = normalizeText(subject);
    if (!text) return null;
    const match = text.match(MERGE_PR_REGEX);
    if (!match) return null;

    return {
        pr_number: match[1],
        source_branch: normalizeText(match[2])
    };
}

function parsePullRequestFromMessage(subject) {
    const text = normalizeText(subject);
    if (!text) return [];

    const numbers = new Set();
    MESSAGE_PR_REGEXES.forEach(function(regex) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const number = normalizeText(match[1]);
            if (number) numbers.add(number);
        }
    });

    return Array.from(numbers);
}

function sortEvidencesByPriority(evidences) {
    return (Array.isArray(evidences) ? evidences : []).slice().sort(function(a, b) {
        const pa = HEURISTIC_PRIORITY[a.heuristic] || 99;
        const pb = HEURISTIC_PRIORITY[b.heuristic] || 99;
        if (pa !== pb) return pa - pb;
        return String(a.commit_sha || '').localeCompare(String(b.commit_sha || ''));
    });
}

function dedupeEvidenceByPrAndMetadata(evidences) {
    const unique = new Map();

    (Array.isArray(evidences) ? evidences : []).forEach(function(item) {
        if (!item || !item.metadata_id || !item.pr_number) return;
        const key = String(item.metadata_id) + '::' + String(item.pr_number) + '::' + String(item.heuristic || '');
        if (unique.has(key)) return;
        unique.set(key, item);
    });

    return Array.from(unique.values());
}

function classifyMetadataDecision(metadata, evidences) {
    const metadataId = metadata && metadata.metadata_id;
    const sorted = sortEvidencesByPriority(dedupeEvidenceByPrAndMetadata(evidences));

    // Fallback logic in discovery pipeline is executed only if (evidences.length === 0).

    if (!sorted.length) {
        return {
            metadata_id: metadataId,
            metadata_name: metadata && metadata.metadata_name,
            status: 'no_match',
            heuristic_used: null,
            matched_pr: null,
            candidate_prs: [],
            reason: 'Nenhuma evidencia de PR encontrada'
        };
    }

    const topPriority = HEURISTIC_PRIORITY[sorted[0].heuristic] || 99;
    const top = sorted.filter(function(item) {
        return (HEURISTIC_PRIORITY[item.heuristic] || 99) === topPriority;
    });

    const uniqueTopPrs = Array.from(new Set(top.map(function(item) { return String(item.pr_number); })));

    if (uniqueTopPrs.length > 1) {
        return {
            metadata_id: metadataId,
            metadata_name: metadata && metadata.metadata_name,
            status: 'conflict',
            heuristic_used: top[0].heuristic || null,
            matched_pr: null,
            candidate_prs: top.map(function(item) {
                return {
                    pr_number: item.pr_number,
                    heuristic: item.heuristic,
                    source_branch: item.source_branch || '',
                    commit_sha: item.commit_sha || '',
                    pr_url: item.pr_url || null
                };
            }),
            reason: 'Multiplos PRs candidatos com mesma prioridade'
        };
    }

    const winner = top[0];
    return {
        metadata_id: metadataId,
        metadata_name: metadata && metadata.metadata_name,
        status: 'matched',
        heuristic_used: winner.heuristic,
        matched_pr: {
            pr_number: winner.pr_number,
            pr_url: winner.pr_url || null,
            source_branch: winner.source_branch || '',
            commit_sha: winner.commit_sha || ''
        },
        candidate_prs: top.map(function(item) {
            return {
                pr_number: item.pr_number,
                heuristic: item.heuristic,
                source_branch: item.source_branch || '',
                commit_sha: item.commit_sha || '',
                pr_url: item.pr_url || null
            };
        }),
        reason: null
    };
}

function buildMetadataCandidateQuery(includeAlreadyLinked) {
    if (includeAlreadyLinked) {
        return `
            SELECT
                m.id AS metadata_id,
                m.metadata_name,
                mt.name AS metadata_type,
                m.front_id,
                CASE WHEN EXISTS(
                    SELECT 1 FROM pull_requests pr WHERE pr.metadata_id = m.id
                ) THEN 1 ELSE 0 END AS has_pr_link
            FROM metadatas m
            JOIN metadata_types mt ON mt.id = m.metadata_type_id
            WHERE m.front_id = ?
            ORDER BY m.metadata_name COLLATE NOCASE
        `;
    }

    return `
        SELECT
            m.id AS metadata_id,
            m.metadata_name,
            mt.name AS metadata_type,
            m.front_id,
            0 AS has_pr_link
        FROM metadatas m
        JOIN metadata_types mt ON mt.id = m.metadata_type_id
        WHERE m.front_id = ?
          AND NOT EXISTS(
              SELECT 1 FROM pull_requests pr WHERE pr.metadata_id = m.id
          )
        ORDER BY m.metadata_name COLLATE NOCASE
    `;
}

async function validateTargetBranches(runGit, repoPath, targetBranches) {
    const expected = normalizeBranchList(targetBranches);
    if (expected.length === 0) {
        return { ok: false, error: 'target_branches obrigatorio' };
    }

    const { stdout } = await runGit(repoPath, [
        'for-each-ref',
        '--format=%(refname:short)',
        'refs/heads',
        'refs/remotes'
    ]);

    const available = new Set(
        String(stdout || '')
            .split(/\r?\n/)
            .map(function(line) { return normalizeText(line); })
            .filter(Boolean)
    );

    const missing = expected.filter(function(branch) {
        if (available.has(branch)) return false;
        // Accept remote variants like origin/main for selected main
        for (const item of available.values()) {
            if (item.endsWith('/' + branch)) return false;
        }
        return true;
    });

    if (missing.length) {
        return { ok: false, error: 'Branch(s) inexistente(s): ' + missing.join(', '), missing_branches: missing };
    }

    return { ok: true, branches: expected };
}

function extractOrgRepoFromRemote(remoteUrl) {
    const remote = normalizeText(remoteUrl);
    if (!remote) return null;

    const httpsMatch = remote.match(/https?:\/\/[^/]+\/([^/]+\/[^/]+?)(?:\.git)?$/);
    const sshMatch = remote.match(/git@[^:]+:([^/]+\/[^/]+?)(?:\.git)?$/);
    return (httpsMatch && httpsMatch[1]) || (sshMatch && sshMatch[1]) || null;
}

module.exports = {
    MERGE_PR_REGEX,
    HEURISTIC_PRIORITY,
    normalizeBranchList,
    parseOptionalDate,
    validateDateRange,
    parseMergePullRequest,
    parsePullRequestFromMessage,
    dedupeEvidenceByPrAndMetadata,
    classifyMetadataDecision,
    buildMetadataCandidateQuery,
    validateTargetBranches,
    extractOrgRepoFromRemote
};
