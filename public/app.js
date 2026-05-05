(function releaseNotesApp() {
    'use strict';

    // ── API helpers ──────────────────────────────────────────────────────────
    async function parseApiResponse(res) {
        if (res.ok) {
            if (res.status === 204) {
                return null;
            }
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                return res.json();
            }
            return res.text();
        }

        let message = 'Erro inesperado';
        let payload = null;
        const contentType = res.headers.get('content-type');
        try {
            if (contentType && contentType.includes('application/json')) {
                payload = await res.json();
                message = payload.error || message;
            } else {
                message = await res.text() || message;
            }
        } catch (e) {
            message = 'Erro ao processar resposta: ' + e.message;
        }

        const error = new Error(message);
        error.status = res.status;
        error.payload = payload;
        throw error;
    }

    const api = {
        async get(path) {
            const res = await fetch(path);
            return parseApiResponse(res);
        },
        async post(path, body) {
            const res = await fetch(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            return parseApiResponse(res);
        },
        async put(path, body) {
            const res = await fetch(path, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            return parseApiResponse(res);
        },
        async del(path) {
            const res = await fetch(path, { method: 'DELETE' });
            return parseApiResponse(res);
        }
    };

    // ── State ────────────────────────────────────────────────────────────────
    const state = {
        items: [],
        metadataTypes: [],
        repos: [],
        people: [],
        filterFrontId: '',
        filterSprintId: '',
        filterTypeId: '',
        filterSearch: '',
        latestReleaseText: '',
        highlightedMetadataId: '',
        activeTab: 'metadata',
        scanResults: [],
        lastScanRepoPath: '',
        authorScanResults: [],
        lastAuthorScanRepoPath: ''
    };

    // ── DOM refs ─────────────────────────────────────────────────────────────
    const el = {
        tabBtnMetadata: document.getElementById('tab-btn-metadata'),
        tabBtnRelease: document.getElementById('tab-btn-release'),
        tabBtnCommits: document.getElementById('tab-btn-commits'),
        tabBtnAuthors: document.getElementById('tab-btn-authors'),
        tabPaneMetadata: document.getElementById('tab-pane-metadata'),
        tabPaneRelease: document.getElementById('tab-pane-release'),
        tabPaneCommits: document.getElementById('tab-pane-commits'),
        tabPaneAuthors: document.getElementById('tab-pane-authors'),
        // Repos
        repoForm: document.getElementById('repo-form'),
        repoName: document.getElementById('f-repo-name'),
        repoPathSave: document.getElementById('f-repo-path-save'),
        repoFormError: document.getElementById('repo-form-error'),
        reposList: document.getElementById('repos-list'),
        fRepoSelect: document.getElementById('f-repo-select'),
        scanRepoSelect: document.getElementById('scan-repo-select'),
        // People
        peopleForm: document.getElementById('people-form'),
        personId: document.getElementById('person-id'),
        personName: document.getElementById('person-name'),
        personEmail: document.getElementById('person-email'),
        personDefaultRepo: document.getElementById('person-default-repo'),
        peopleFormError: document.getElementById('people-form-error'),
        peopleFormInfo: document.getElementById('people-form-info'),
        btnCancelPersonEdit: document.getElementById('btn-cancel-person-edit'),
        btnSavePerson: document.getElementById('btn-save-person'),
        peopleList: document.getElementById('people-list'),
        scanPersonSelect: document.getElementById('scan-person-select'),
        // Scan form
        scanForm: document.getElementById('scan-form'),
        scanEmail: document.getElementById('scan-email'),
        scanRepoPath: document.getElementById('scan-repo-path'),
        scanSince: document.getElementById('scan-since'),
        scanUntil: document.getElementById('scan-until'),
        scanBranch: document.getElementById('scan-branch'),
        scanError: document.getElementById('scan-error'),
        scanInfo: document.getElementById('scan-info'),
        btnScan: document.getElementById('btn-scan'),
        scanResultsSection: document.getElementById('scan-results-section'),
        scanCountLabel: document.getElementById('scan-count-label'),
        scanResultsBody: document.getElementById('scan-results-body'),
        // Author scan form
        authorScanForm: document.getElementById('author-scan-form'),
        authorScanRepoPath: document.getElementById('author-scan-repo-path'),
        authorScanRepoSelect: document.getElementById('author-scan-repo-select'),
        authorScanSince: document.getElementById('author-scan-since'),
        authorScanUntil: document.getElementById('author-scan-until'),
        authorScanBranch: document.getElementById('author-scan-branch'),
        authorScanError: document.getElementById('author-scan-error'),
        authorScanInfo: document.getElementById('author-scan-info'),
        btnAuthorScan: document.getElementById('btn-author-scan'),
        authorResultsSection: document.getElementById('author-results-section'),
        authorCountLabel: document.getElementById('author-count-label'),
        authorResultsBody: document.getElementById('author-results-body'),
        form: document.getElementById('metadata-form'),
        formError: document.getElementById('form-error'),
        // Form lookups — frente
        frontSelect:    document.getElementById('f-front-select'),
        addFrontRow:    document.getElementById('add-front-row'),
        btnAddFront:    document.getElementById('btn-add-front'),
        fFrontNew:      document.getElementById('f-front-new'),
        btnSaveFront:   document.getElementById('btn-save-front'),
        btnCancelFront: document.getElementById('btn-cancel-front'),
        // Form lookups — sprint
        sprintSelect:    document.getElementById('f-sprint-select'),
        addSprintRow:    document.getElementById('add-sprint-row'),
        btnAddSprint:    document.getElementById('btn-add-sprint'),
        fSprintNew:      document.getElementById('f-sprint-new'),
        btnSaveSprint:   document.getElementById('btn-save-sprint'),
        btnCancelSprint: document.getElementById('btn-cancel-sprint'),
        // Form lookups — tipo
        typeSelect:    document.getElementById('f-type-select'),
        addTypeRow:    document.getElementById('add-type-row'),
        btnAddType:    document.getElementById('btn-add-type'),
        fTypeNew:      document.getElementById('f-type-new'),
        btnSaveType:   document.getElementById('btn-save-type'),
        btnCancelType: document.getElementById('btn-cancel-type'),
        // Form outros
        bulkMetadataRows: document.getElementById('bulk-metadata-rows'),
        bulkPrRows: document.getElementById('bulk-pr-rows'),
        btnBulkAddMetadata: document.getElementById('btn-bulk-add-metadata'),
        btnBulkAddPr: document.getElementById('btn-bulk-add-pr'),
        fRepoPath:     document.getElementById('f-repo-path'),
        fCommitHash:   document.getElementById('f-commit-hash'),
        btnLoadCommit: document.getElementById('btn-load-commit'),
        commitInfo:    document.getElementById('commit-info'),
        fTicket:       document.getElementById('f-ticket'),
        fDescription:  document.getElementById('f-description'),
        formInfo: document.getElementById('form-info'),
        btnClearForm:  document.getElementById('btn-clear-form'),
        // Filtros
        filterFront:      document.getElementById('filter-front'),
        filterSprint:     document.getElementById('filter-sprint'),
        filterType:       document.getElementById('filter-type'),
        filterSearch:     document.getElementById('filter-search'),
        btnResetFilters:  document.getElementById('btn-reset-filters'),
        // Filtros de metadados
        metadataFilterFront:    document.getElementById('metadata-filter-front'),
        metadataFilterSprint:   document.getElementById('metadata-filter-sprint'),
        metadataFilterType:     document.getElementById('metadata-filter-type'),
        metadataFilterSearch:   document.getElementById('metadata-filter-search'),
        btnResetMetadataFilters: document.getElementById('btn-reset-metadata-filters'),
        // Modal de edição
        editModal:       document.getElementById('edit-modal'),
        editForm:        document.getElementById('edit-form'),
        editMetadataName: document.getElementById('edit-metadata-name'),
        editMetadataType: document.getElementById('edit-metadata-type'),
        editChangeType:  document.getElementById('edit-change-type'),
        editTicket:      document.getElementById('edit-ticket'),
        editDescription: document.getElementById('edit-description'),
        editFormError:   document.getElementById('edit-form-error'),
        btnCloseEditModal: document.getElementById('btn-close-edit-modal'),
        btnCancelEdit:   document.getElementById('btn-cancel-edit'),
        // Saida
        btnGenerate:    document.getElementById('btn-generate'),
        btnCopyRelease: document.getElementById('btn-copy-release'),
        btnExportJson:  document.getElementById('btn-export-json'),
        btnExportCsv:   document.getElementById('btn-export-csv'),
        btnExportMd:    document.getElementById('btn-export-md'),
        releaseMeta:    document.getElementById('release-meta'),
        releaseOutput:  document.getElementById('release-output'),
        countLabel:     document.getElementById('count-label'),
        itemsList:      document.getElementById('items-list')
    };

    // ── State (extended) ──────────────────────────────────────────────────────
    const metadataFilterState = {
        frontId: '',
        sprintId: '',
        typeId: '',
        search: ''
    };

    let editingMetadataId = null;

    // ── Utilitarios ──────────────────────────────────────────────────────────
    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDateTime(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function normalizeCompare(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function showError(msg, focusEl) {
        el.formError.hidden = false;
        el.formError.textContent = msg;
        if (focusEl) focusEl.focus();
    }

    function hideError() {
        el.formError.hidden = true;
        el.formError.textContent = '';
    }

    function showInfo(message) {
        el.formInfo.hidden = false;
        el.formInfo.textContent = message;
    }

    function hideInfo() {
        el.formInfo.hidden = true;
        el.formInfo.textContent = '';
    }

    function showCommitInfo(message, isError) {
        el.commitInfo.hidden = false;
        el.commitInfo.textContent = message;
        el.commitInfo.classList.toggle('form-error', Boolean(isError));
        el.commitInfo.classList.toggle('form-info', !isError);
    }

    function hideCommitInfo() {
        el.commitInfo.hidden = true;
        el.commitInfo.textContent = '';
        el.commitInfo.classList.remove('form-error');
        el.commitInfo.classList.add('form-info');
    }

    function hidePeopleFeedback() {
        if (!el.peopleFormError || !el.peopleFormInfo) return;
        el.peopleFormError.hidden = true;
        el.peopleFormError.textContent = '';
        el.peopleFormInfo.hidden = true;
        el.peopleFormInfo.textContent = '';
    }

    function showPeopleError(message) {
        if (!el.peopleFormError || !el.peopleFormInfo) return;
        el.peopleFormInfo.hidden = true;
        el.peopleFormInfo.textContent = '';
        el.peopleFormError.hidden = false;
        el.peopleFormError.textContent = message;
    }

    function showPeopleInfo(message) {
        if (!el.peopleFormError || !el.peopleFormInfo) return;
        el.peopleFormError.hidden = true;
        el.peopleFormError.textContent = '';
        el.peopleFormInfo.hidden = false;
        el.peopleFormInfo.textContent = message;
    }

    function setActiveTab(tabName) {
        state.activeTab = tabName;

        el.tabPaneMetadata.hidden = tabName !== 'metadata';
        el.tabPaneRelease.hidden = tabName !== 'release';
        el.tabPaneCommits.hidden = tabName !== 'commits';
        el.tabPaneAuthors.hidden = tabName !== 'authors';

        el.tabBtnMetadata.classList.toggle('is-active', tabName === 'metadata');
        el.tabBtnRelease.classList.toggle('is-active', tabName === 'release');
        el.tabBtnCommits.classList.toggle('is-active', tabName === 'commits');
        el.tabBtnAuthors.classList.toggle('is-active', tabName === 'authors');

        el.tabBtnMetadata.setAttribute('aria-selected', tabName === 'metadata' ? 'true' : 'false');
        el.tabBtnRelease.setAttribute('aria-selected', tabName === 'release' ? 'true' : 'false');
        el.tabBtnCommits.setAttribute('aria-selected', tabName === 'commits' ? 'true' : 'false');
        el.tabBtnAuthors.setAttribute('aria-selected', tabName === 'authors' ? 'true' : 'false');

        if (tabName === 'release') {
            generateRelease();
        }
    }

    function buildMetadataTypeOptions(selectedTypeId) {
        const selected = String(selectedTypeId || '');
        const options = ['<option value="">Tipo do metadata</option>'];
        state.metadataTypes.forEach(function(type) {
            const typeId = String(type.id);
            options.push(
                '<option value="' + escapeHtml(typeId) + '"' + (selected === typeId ? ' selected' : '') + '>' + escapeHtml(type.name) + '</option>'
            );
        });
        return options.join('');
    }

    function buildChangeTypeOptions(selectedChangeType) {
        const selected = String(selectedChangeType || '');
        const values = ['', 'Criacao', 'Alteracao', 'Correcao', 'Remocao'];
        return values.map(function(value) {
            const label = value || 'Tipo de mudanca';
            return '<option value="' + escapeHtml(value) + '"' + (selected === value ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
        }).join('');
    }

    function createBulkMetadataRow(config) {
        const rowData = config || {};
        const row = document.createElement('div');
        row.className = 'bulk-row bulk-metadata-row';
        row.innerHTML = [
            '<input type="text" class="bulk-metadata-input" placeholder="Nome do metadata" value="' + escapeHtml(rowData.name || '') + '">',
            '<select class="bulk-metadata-type-select">' + buildMetadataTypeOptions(rowData.typeId) + '</select>',
            '<select class="bulk-change-type-select">' + buildChangeTypeOptions(rowData.changeType) + '</select>',
            '<button type="button" class="btn-icon-danger bulk-remove-btn" title="Remover linha">\u00d7</button>'
        ].join('');

        row.querySelector('.bulk-remove-btn').addEventListener('click', function() {
            const rows = el.bulkMetadataRows.querySelectorAll('.bulk-row');
            if (rows.length <= 1) {
                row.querySelector('.bulk-metadata-input').value = '';
                return;
            }
            row.remove();
        });

        return row;
    }

    function createBulkPrRow(label, url) {
        const row = document.createElement('div');
        row.className = 'bulk-row bulk-pr-row';
        row.innerHTML = [
            '<input type="text" class="bulk-pr-label-input" placeholder="Label do PR" value="' + escapeHtml(label || '') + '">',
            '<input type="url" class="bulk-pr-url-input" placeholder="https://github.com/..." value="' + escapeHtml(url || '') + '">',
            '<button type="button" class="btn-icon-danger bulk-remove-btn" title="Remover linha">\u00d7</button>'
        ].join('');

        row.querySelector('.bulk-remove-btn').addEventListener('click', function() {
            const rows = el.bulkPrRows.querySelectorAll('.bulk-row');
            if (rows.length <= 1) {
                row.querySelector('.bulk-pr-label-input').value = '';
                row.querySelector('.bulk-pr-url-input').value = '';
                return;
            }
            row.remove();
        });

        return row;
    }

    function ensureBulkRows() {
        if (!el.bulkMetadataRows.querySelector('.bulk-row')) {
            el.bulkMetadataRows.appendChild(createBulkMetadataRow({}));
        }
        if (!el.bulkPrRows.querySelector('.bulk-row')) {
            el.bulkPrRows.appendChild(createBulkPrRow('', ''));
        }
    }

    function resetBulkRows() {
        el.bulkMetadataRows.innerHTML = '';
        el.bulkPrRows.innerHTML = '';
        ensureBulkRows();
    }

    function syncBulkMetadataTypeOptions() {
        el.bulkMetadataRows.querySelectorAll('.bulk-metadata-type-select').forEach(function(selectEl) {
            const currentValue = selectEl.value;
            selectEl.innerHTML = buildMetadataTypeOptions(currentValue);
            if (currentValue) {
                selectEl.value = currentValue;
            }
        });
    }

    // ── Lookup helpers ───────────────────────────────────────────────────────
    function fillSelect(selectEl, items, emptyLabel, keepValueId) {
        const prev = keepValueId !== undefined ? String(keepValueId) : selectEl.value;
        selectEl.innerHTML = '';
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = emptyLabel;
        selectEl.appendChild(empty);
        items.forEach(function(item) {
            const opt = document.createElement('option');
            opt.value = String(item.id);
            opt.textContent = item.name;
            selectEl.appendChild(opt);
        });
        if (prev) selectEl.value = prev;
    }

    function openAddRow(row) {
        row.hidden = false;
        const input = row.querySelector('input[type="text"]');
        if (input) { input.value = ''; input.focus(); }
    }

    function closeAddRow(row) {
        row.hidden = true;
    }

    // Registra os tres botoes de um bloco lookup (add / save / cancel)
    function bindLookup(btnAdd, addRow, btnSave, btnCancel, newInput, onSave) {
        btnAdd.addEventListener('click', function() { openAddRow(addRow); });
        btnCancel.addEventListener('click', function() { closeAddRow(addRow); });
        btnSave.addEventListener('click', function() { onSave(newInput.value.trim()); });
        newInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); onSave(newInput.value.trim()); }
            if (e.key === 'Escape') closeAddRow(addRow);
        });
    }

    // ── Carregamento de dados ─────────────────────────────────────────────────
    async function loadRepos() {
        try {
            state.repos = await api.get('/api/repos');
        } catch (err) {
            // Permite usar o app mesmo com backend antigo sem /api/repos.
            if (err && err.status === 404) {
                state.repos = [];
                syncRepoSelects();
                if (el.reposList) {
                    el.reposList.innerHTML = '<p class="empty-state" style="margin-top:10px">Servidor sem suporte ao banco de repositorios. Reinicie o backend atualizado.</p>';
                }
                return;
            }
            throw err;
        }
        renderRepos();
        syncRepoSelects();
    }

    async function loadPeople() {
        if (!el.peopleList || !el.scanPersonSelect) {
            return;
        }

        let payload;
        try {
            payload = await api.get('/api/people');
        } catch (err) {
            if (err && err.status === 404) {
                state.people = [];
                renderPeople();
                syncPeopleSelect();
                return;
            }
            throw err;
        }

        state.people = Array.isArray(payload?.items) ? payload.items : [];
        renderPeople();
        syncPeopleSelect();
    }

    function resetPersonForm() {
        if (!el.peopleForm) return;
        el.peopleForm.reset();
        if (el.personId) {
            el.personId.value = '';
        }
        if (el.btnSavePerson) {
            el.btnSavePerson.textContent = 'Salvar pessoa';
        }
        if (el.btnCancelPersonEdit) {
            el.btnCancelPersonEdit.hidden = true;
        }
    }

    function beginPersonEdit(person) {
        if (!el.personId) return;
        el.personId.value = String(person.id);
        el.personName.value = person.name || '';
        el.personEmail.value = person.email || '';
        el.personDefaultRepo.value = person.default_repo_path || '';
        if (el.btnSavePerson) {
            el.btnSavePerson.textContent = 'Salvar alteracoes';
        }
        if (el.btnCancelPersonEdit) {
            el.btnCancelPersonEdit.hidden = false;
        }
        el.personName.focus();
    }

    function renderPeople() {
        if (!el.peopleList) return;

        if (state.people.length === 0) {
            el.peopleList.innerHTML = '<p class="empty-state" style="margin-top:10px">Nenhuma pessoa cadastrada.</p>';
            return;
        }

        el.peopleList.innerHTML = state.people.map(function(person) {
            const repoText = person.default_repo_path
                ? '<span>' + escapeHtml(person.default_repo_path) + '</span>'
                : '<span class="muted-inline">Sem repositorio padrao</span>';
            return [
                '<div class="person-card">',
                '  <div class="person-card-info">',
                '    <strong>' + escapeHtml(person.name) + '</strong>',
                '    <span>' + escapeHtml(person.email) + '</span>',
                '    ' + repoText,
                '  </div>',
                '  <div class="person-card-actions">',
                '    <button type="button" class="btn-secondary btn-sm" data-edit-person="' + person.id + '">Editar</button>',
                '    <button type="button" class="btn-danger btn-sm" data-delete-person="' + person.id + '">Remover</button>',
                '  </div>',
                '</div>'
            ].join('');
        }).join('');

        el.peopleList.querySelectorAll('[data-edit-person]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const personId = Number(btn.dataset.editPerson);
                const person = state.people.find(function(item) { return Number(item.id) === personId; });
                if (!person) return;
                hidePeopleFeedback();
                beginPersonEdit(person);
            });
        });

        el.peopleList.querySelectorAll('[data-delete-person]').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                const personId = Number(btn.dataset.deletePerson);
                try {
                    await api.del('/api/people/' + personId);
                    showPeopleInfo('Pessoa removida com sucesso.');
                    if (String(el.personId.value) === String(personId)) {
                        resetPersonForm();
                    }
                    await loadPeople();
                } catch (err) {
                    showPeopleError(err.message);
                }
            });
        });
    }

    function syncPeopleSelect() {
        if (!el.scanPersonSelect) return;
        const opts = ['<option value="">Selecionar pessoa...</option>'];
        state.people.forEach(function(person) {
            const label = person.name + ' - ' + person.email;
            opts.push('<option value="' + escapeHtml(String(person.id)) + '">' + escapeHtml(label) + '</option>');
        });
        el.scanPersonSelect.innerHTML = opts.join('');
    }

    function renderRepos() {
        if (!el.reposList) return;
        if (state.repos.length === 0) {
            el.reposList.innerHTML = '<p class="empty-state" style="margin-top:10px">Nenhum repositorio salvo.</p>';
            return;
        }
        el.reposList.innerHTML = state.repos.map(function(repo) {
            return [
                '<div class="repo-card">',
                '  <div class="repo-card-info">',
                '    <strong>' + escapeHtml(repo.name) + '</strong>',
                '    <span>' + escapeHtml(repo.repo_path) + '</span>',
                '  </div>',
                '  <button type="button" class="btn-danger btn-sm" data-delete-repo="' + repo.id + '">Remover</button>',
                '</div>'
            ].join('');
        }).join('');
        el.reposList.querySelectorAll('[data-delete-repo]').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                await api.del('/api/repos/' + btn.dataset.deleteRepo);
                await loadRepos();
            });
        });
    }

    function syncRepoSelects() {
        const opts = ['<option value="">Repo salvo...</option>'];
        state.repos.forEach(function(repo) {
            opts.push('<option value="' + escapeHtml(repo.repo_path) + '">' + escapeHtml(repo.name) + '</option>');
        });
        const html = opts.join('');
        if (el.fRepoSelect) el.fRepoSelect.innerHTML = html;
        if (el.scanRepoSelect) el.scanRepoSelect.innerHTML = html;
        if (el.authorScanRepoSelect) el.authorScanRepoSelect.innerHTML = html;
    }

    function isEmailInPeople(email) {
        const target = normalizeCompare(email);
        return state.people.some(function(person) {
            return normalizeCompare(person.email) === target;
        });
    }

    async function addAuthorToPeople(author) {
        const email = String(author?.email || '').trim();
        if (!email) return;

        const displayName = String(author?.name || '').trim() || email.split('@')[0];
        const repoPath = (state.lastAuthorScanRepoPath || el.authorScanRepoPath.value || '').trim();

        try {
            await api.post('/api/people', {
                name: displayName,
                email: email,
                default_repo_path: repoPath || null
            });
            el.authorScanInfo.hidden = false;
            el.authorScanInfo.textContent = 'Pessoa adicionada ao cadastro: ' + email;
            await loadPeople();
            renderAuthorScanResults();
        } catch (err) {
            if (err && err.status === 409) {
                el.authorScanInfo.hidden = false;
                el.authorScanInfo.textContent = 'Este email ja esta cadastrado: ' + email;
                return;
            }
            el.authorScanError.hidden = false;
            el.authorScanError.textContent = 'Erro ao adicionar pessoa: ' + err.message;
        }
    }

    async function scanCommitAuthors() {
        el.authorScanError.hidden = true;
        el.authorScanError.textContent = '';
        el.authorScanInfo.hidden = true;
        el.authorScanInfo.textContent = '';

        const repoPath = el.authorScanRepoPath.value.trim();
        const since = el.authorScanSince.value ? el.authorScanSince.value + 'T00:00:00' : '';
        const until = el.authorScanUntil.value ? el.authorScanUntil.value + 'T23:59:59' : '';
        const branch = el.authorScanBranch.value.trim();

        if (!repoPath) {
            el.authorScanError.hidden = false;
            el.authorScanError.textContent = 'Informe o caminho do repositorio.';
            el.authorScanRepoPath.focus();
            return;
        }

        el.btnAuthorScan.disabled = true;
        const prevText = el.btnAuthorScan.textContent;
        el.btnAuthorScan.textContent = 'Listando...';
        el.authorScanInfo.hidden = false;
        el.authorScanInfo.textContent = 'Consultando autores...';

        try {
            const payload = await api.post('/api/scan-commit-authors', {
                repo_path: repoPath,
                since: since || undefined,
                until: until || undefined,
                branch: branch || undefined
            });

            state.authorScanResults = Array.isArray(payload.authors) ? payload.authors : [];
            state.lastAuthorScanRepoPath = repoPath;
            localStorage.setItem('release_notes_author_scan_repo_path', repoPath);

            if (state.authorScanResults.length === 0) {
                el.authorScanInfo.textContent = 'Nenhum autor encontrado para os filtros informados.';
            } else {
                el.authorScanInfo.textContent = state.authorScanResults.length + ' autor(es) encontrado(s).';
            }

            renderAuthorScanResults();
        } catch (e) {
            el.authorScanError.hidden = false;
            el.authorScanError.textContent = 'Erro ao listar autores: ' + e.message;
            el.authorScanInfo.hidden = true;
        } finally {
            el.btnAuthorScan.disabled = false;
            el.btnAuthorScan.textContent = prevText;
        }
    }

    function renderAuthorScanResults() {
        el.authorResultsSection.hidden = state.authorScanResults.length === 0;
        el.authorCountLabel.textContent = state.authorScanResults.length + ' autor' + (state.authorScanResults.length === 1 ? '' : 'es');

        if (state.authorScanResults.length === 0) {
            el.authorResultsBody.innerHTML = '';
            return;
        }

        el.authorResultsBody.innerHTML = state.authorScanResults.map(function(author, index) {
            const alreadyRegistered = isEmailInPeople(author.email);
            const actionLabel = alreadyRegistered ? 'Ja cadastrado' : 'Adicionar';
            const disabledAttr = alreadyRegistered ? ' disabled' : '';

            return [
                '<tr>',
                '  <td>' + escapeHtml(author.name || '-') + '</td>',
                '  <td><small class="scan-email-cell">' + escapeHtml(author.email || '-') + '</small></td>',
                '  <td>' + escapeHtml(String(author.commit_count || 0)) + '</td>',
                '  <td class="scan-date">' + escapeHtml(formatDateTime(author.last_commit_at)) + '</td>',
                '  <td><button type="button" class="btn-secondary btn-sm" data-add-author="' + index + '"' + disabledAttr + '>' + actionLabel + '</button></td>',
                '</tr>'
            ].join('');
        }).join('');

        el.authorResultsBody.querySelectorAll('[data-add-author]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const idx = Number(btn.dataset.addAuthor);
                const author = state.authorScanResults[idx];
                addAuthorToPeople(author);
            });
        });
    }

    async function loadFronts() {
        const fronts = await api.get('/api/fronts');
        fillSelect(el.frontSelect, fronts, 'Selecione uma frente');
        fillSelect(el.filterFront, fronts, 'Todas as frentes', state.filterFrontId);
    }

    async function loadFormSprints(frontId) {
        if (!frontId) {
            fillSelect(el.sprintSelect, [], 'Selecione uma frente primeiro');
            el.sprintSelect.disabled = true;
            el.btnAddSprint.disabled = true;
            return;
        }
        const sprints = await api.get('/api/sprints?front_id=' + frontId);
        fillSelect(el.sprintSelect, sprints, 'Selecione uma sprint');
        el.sprintSelect.disabled = false;
        el.btnAddSprint.disabled = false;
    }

    async function loadFilterSprints(frontId) {
        const url = frontId ? '/api/sprints?front_id=' + frontId : '/api/sprints';
        const sprints = await api.get(url);
        fillSelect(el.filterSprint, sprints, 'Todas as sprints', state.filterSprintId);
    }

    async function loadMetadataTypes() {
        const types = await api.get('/api/metadata-types');
        state.metadataTypes = Array.isArray(types) ? types : [];
        fillSelect(el.typeSelect, types, 'Selecione o tipo');
        fillSelect(el.filterType, types, 'Todos os tipos', state.filterTypeId);
        syncBulkMetadataTypeOptions();
    }

    async function loadItems() {
        const params = new URLSearchParams();
        if (state.filterFrontId)  params.set('front_id', state.filterFrontId);
        if (state.filterSprintId) params.set('sprint_id', state.filterSprintId);
        if (state.filterTypeId)   params.set('metadata_type_id', state.filterTypeId);
        if (state.filterSearch.trim()) params.set('q', state.filterSearch.trim());
        state.items = await api.get('/api/metadatas?' + params.toString());
        renderItems();
        generateRelease();
    }

    // ── Renderizacao ─────────────────────────────────────────────────────────
    function renderPrList(prs) {
        if (!prs || prs.length === 0) return '';
        return prs.map(function(pr) {
            return [
                '<div class="pr-item">',
                '  <span class="pr-label">' + escapeHtml(pr.label) + '</span>',
                '  <a class="pr-link" href="' + escapeHtml(pr.url) + '" target="_blank" rel="noreferrer noopener">' + escapeHtml(pr.url) + '</a>',
                '  <button type="button" class="btn-icon-danger" data-delete-pr="' + escapeHtml(String(pr.id)) + '" title="Remover PR">\u00d7</button>',
                '</div>'
            ].join('');
        }).join('');
    }

    function renderItems() {
        applyMetadataFilters();
    }

    function buildReleaseNote(items, scopeText) {
        if (items.length === 0) return 'Sem itens para o filtro selecionado.';

        // Organizar: Frente → Sprint → Tipo de Metadata → Items
        const byFront = new Map();
        items.forEach(function(item) {
            if (!byFront.has(item.front)) byFront.set(item.front, new Map());
            const bySprint = byFront.get(item.front);
            if (!bySprint.has(item.sprint)) bySprint.set(item.sprint, new Map());
            const byType = bySprint.get(item.sprint);
            if (!byType.has(item.metadata_type)) byType.set(item.metadata_type, []);
            byType.get(item.metadata_type).push(item);
        });

        const lines = ['# Release Notes', '', 'Gerado em: ' + formatDateTime(new Date().toISOString())];
        if (scopeText) {
            lines.push('Escopo: ' + scopeText);
        }
        lines.push('');

        // Iterar por Frente → Sprint → Tipo
        Array.from(byFront.keys()).sort(function(a, b) { return a.localeCompare(b, 'pt-BR'); })
        .forEach(function(front) {
            lines.push('## Frente: ' + front, '');
            const bySprint = byFront.get(front);
            Array.from(bySprint.keys()).sort(function(a, b) { return a.localeCompare(b, 'pt-BR'); })
            .forEach(function(sprint) {
                lines.push('### Sprint: ' + sprint, '');
                const byType = bySprint.get(sprint);

                // Ordena tipos de metadata alfabeticamente
                Array.from(byType.keys()).sort(function(a, b) { return a.localeCompare(b, 'pt-BR'); })
                .forEach(function(metadataType) {
                    lines.push('#### ' + metadataType);
                    lines.push('');
                    lines.push('| Metadata | Ticket | Descrição | Tipo de Mudança | PRs |');
                    lines.push('|----------|--------|-----------|-----------------|-----|');

                    const itemsOfType = byType.get(metadataType)
                        .sort(function(a, b) { return a.metadata_name.localeCompare(b.metadata_name, 'pt-BR'); });

                    itemsOfType.forEach(function(item) {
                        const ticket = item.ticket || '-';
                        const description = (item.description || '').substring(0, 60) + ((item.description || '').length > 60 ? '...' : '');
                        const changeType = item.change_type;
                        const prLinks = item.prs && item.prs.length > 0
                            ? item.prs.map(function(pr) { return '[' + pr.label + '](' + pr.url + ')'; }).join(', ')
                            : '-';

                        lines.push('| ' + item.metadata_name + ' | ' + ticket + ' | ' + description + ' | ' + changeType + ' | ' + prLinks + ' |');
                    });
                    lines.push('');
                });
                lines.push('');
            });
        });

        return lines.join('\n').trim();
    }

    function generateRelease() {
        const scopeParts = [];
        const selectedFrontText = el.filterFront.value ? el.filterFront.options[el.filterFront.selectedIndex].text : '';
        const selectedSprintText = el.filterSprint.value ? el.filterSprint.options[el.filterSprint.selectedIndex].text : '';
        const selectedTypeText = el.filterType.value ? el.filterType.options[el.filterType.selectedIndex].text : '';
        if (selectedFrontText) scopeParts.push('Frente ' + selectedFrontText);
        if (selectedSprintText) scopeParts.push('Sprint ' + selectedSprintText);
        if (selectedTypeText) scopeParts.push('Tipo ' + selectedTypeText);
        const scopeText = scopeParts.length > 0 ? scopeParts.join(' | ') : 'Todas as frentes e sprints';

        const text = buildReleaseNote(state.items, scopeText);
        state.latestReleaseText = text;
        el.releaseOutput.value = text;

        if (state.items.length === 0) {
            el.releaseMeta.textContent = 'Sem dados para gerar release note.';
        } else {
            const fronts  = new Set(state.items.map(function(i) { return i.front;  })).size;
            const sprints = new Set(state.items.map(function(i) { return i.sprint; })).size;
            el.releaseMeta.textContent = 'Escopo atual: ' + scopeText + ' • ' + state.items.length + ' itens em ' + fronts + ' frente(s) e ' + sprints + ' sprint(s).';
        }
    }

    function buildExportQuery(format) {
        const params = new URLSearchParams();
        params.set('format', format);
        if (state.filterFrontId) params.set('front_id', state.filterFrontId);
        if (state.filterSprintId) params.set('sprint_id', state.filterSprintId);
        if (state.filterTypeId) params.set('metadata_type_id', state.filterTypeId);
        if (state.filterSearch.trim()) params.set('q', state.filterSearch.trim());
        return params.toString();
    }

    function triggerExport(format) {
        const btnMap = { json: el.btnExportJson, csv: el.btnExportCsv, md: el.btnExportMd };
        const btn = btnMap[format];
        const originalText = btn ? btn.textContent : '';

        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Exportando...';
        }

        const href = '/api/exports?' + buildExportQuery(format);

        fetch(href)
            .then(function(res) {
                if (!res.ok) {
                    return res.json().then(function(body) {
                        throw new Error(body.error || ('Erro ' + res.status));
                    });
                }
                const disposition = res.headers.get('Content-Disposition') || '';
                const match = disposition.match(/filename=([^\s;]+)/);
                const filename = match ? match[1] : ('release_export.' + format);
                return res.blob().then(function(blob) {
                    return { blob: blob, filename: filename };
                });
            })
            .then(function(result) {
                const url = URL.createObjectURL(result.blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = result.filename;
                anchor.style.display = 'none';
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                setTimeout(function() { URL.revokeObjectURL(url); }, 5000);

                if (btn) {
                    btn.textContent = 'Exportado!';
                    setTimeout(function() {
                        btn.textContent = originalText;
                        btn.disabled = false;
                    }, 1800);
                }
            })
            .catch(function(err) {
                if (btn) {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
                el.releaseMeta.textContent = '\u26a0\ufe0f Erro ao exportar ' + format.toUpperCase() + ': ' + err.message;
            });
    }

    function parseBulkMetadataRows() {
        const unique = new Map();

        el.bulkMetadataRows.querySelectorAll('.bulk-metadata-row').forEach(function(row, index) {
            const nameInput = row.querySelector('.bulk-metadata-input');
            const typeSelect = row.querySelector('.bulk-metadata-type-select');
            const changeTypeSelect = row.querySelector('.bulk-change-type-select');

            const name = (nameInput ? nameInput.value : '').trim();
            const typeId = Number(typeSelect ? typeSelect.value : '');
            const changeType = (changeTypeSelect ? changeTypeSelect.value : '').trim();

            if (!name && !typeId && !changeType) return;
            if (!name) {
                throw new Error('Informe o nome do metadata na linha ' + (index + 1));
            }
            if (!typeId) {
                throw new Error('Selecione o tipo do metadata na linha ' + (index + 1));
            }
            if (!changeType) {
                throw new Error('Selecione o tipo de mudanca na linha ' + (index + 1));
            }

            const key = normalizeCompare(name) + '|' + String(typeId) + '|' + normalizeCompare(changeType);
            if (unique.has(key)) return;

            unique.set(key, {
                name: name,
                typeId: typeId,
                changeType: changeType
            });
        });

        return Array.from(unique.values());
    }

    function parseBulkPrs() {
        const prs = [];
        const seen = new Set();

        el.bulkPrRows.querySelectorAll('.bulk-row').forEach(function(row, index) {
            const labelInput = row.querySelector('.bulk-pr-label-input');
            const urlInput = row.querySelector('.bulk-pr-url-input');
            const label = (labelInput ? labelInput.value : '').trim();
            const url = (urlInput ? urlInput.value : '').trim();

            if (!label && !url) return;
            if (!label || !url) {
                throw new Error('Preencha label e URL em todos os PRs do lote (linha: ' + (index + 1) + ')');
            }

            let parsedUrl;
            try {
                parsedUrl = new URL(url);
            } catch {
                throw new Error('URL de PR invalida na linha ' + (index + 1));
            }

            const normalizedUrl = parsedUrl.toString();
            const key = normalizeCompare(label) + '|' + normalizeCompare(normalizedUrl);
            if (seen.has(key)) return;

            seen.add(key);
            prs.push({ label: label, url: normalizedUrl });
        });

        return prs;
    }

    function normalizeTypeName(value) {
        return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function findMetadataTypeIdByName(typeName) {
        const normalizedTarget = normalizeTypeName(typeName);
        const match = state.metadataTypes.find(function(type) {
            return normalizeTypeName(type.name) === normalizedTarget;
        });
        return match ? Number(match.id) : 0;
    }

    async function ensureMetadataTypeExists(typeName) {
        if (!typeName) return;
        if (findMetadataTypeIdByName(typeName)) return;
        await api.post('/api/metadata-types', { name: typeName });
    }

    function hasOnlyEmptyBulkMetadataRow() {
        const rows = el.bulkMetadataRows.querySelectorAll('.bulk-metadata-row');
        if (rows.length !== 1) return false;
        const onlyRow = rows[0];
        const name = (onlyRow.querySelector('.bulk-metadata-input')?.value || '').trim();
        const typeId = (onlyRow.querySelector('.bulk-metadata-type-select')?.value || '').trim();
        const changeType = (onlyRow.querySelector('.bulk-change-type-select')?.value || '').trim();
        return !name && !typeId && !changeType;
    }

    async function loadMetadataFromCommit() {
        hideCommitInfo();
        const repoPath = el.fRepoPath.value.trim();
        const commitHash = el.fCommitHash.value.trim();

        if (!repoPath) {
            showCommitInfo('Informe o caminho local do repositorio.', true);
            el.fRepoPath.focus();
            return;
        }
        if (!commitHash) {
            showCommitInfo('Informe o hash do commit.', true);
            el.fCommitHash.focus();
            return;
        }

        el.btnLoadCommit.disabled = true;
        const previousButtonText = el.btnLoadCommit.textContent;
        el.btnLoadCommit.textContent = 'Buscando...';

        try {
            const payload = await api.post('/api/metadata-from-commit', {
                repo_path: repoPath,
                commit_hash: commitHash
            });

            const metadataItems = Array.isArray(payload.metadata_items) ? payload.metadata_items : [];
            if (metadataItems.length === 0) {
                showCommitInfo('Nenhum metadata identificado nesse commit.', true);
                return;
            }

            for (const item of metadataItems) {
                await ensureMetadataTypeExists(item.type);
            }
            await loadMetadataTypes();

            if (hasOnlyEmptyBulkMetadataRow()) {
                el.bulkMetadataRows.innerHTML = '';
            }

            let addedRows = 0;
            metadataItems.forEach(function(item) {
                const typeId = findMetadataTypeIdByName(item.type);
                const row = createBulkMetadataRow({
                    name: item.name,
                    typeId: typeId,
                    changeType: 'Alteracao'
                });
                el.bulkMetadataRows.appendChild(row);
                addedRows += 1;
            });

            localStorage.setItem('release_notes_repo_path', repoPath);
            showCommitInfo(
                'Commit lido com sucesso: ' + payload.commit_hash + '. ' +
                String(payload.total_files || 0) + ' arquivo(s), ' + String(addedRows) + ' metadata(s) adicionado(s).',
                false
            );
        } catch (e) {
            showCommitInfo('Erro ao buscar commit: ' + e.message, true);
        } finally {
            el.btnLoadCommit.disabled = false;
            el.btnLoadCommit.textContent = previousButtonText;
        }
    }

    async function submitBulkForm(commonFields) {
        let metadataRows;
        try {
            metadataRows = parseBulkMetadataRows();
        } catch (e) {
            showError(e.message, el.bulkMetadataRows);
            return;
        }

        if (metadataRows.length === 0) {
            showError('Informe ao menos um metadata no lote.', el.bulkMetadataRows);
            return;
        }

        let prDefs;
        try {
            prDefs = parseBulkPrs();
        } catch (e) {
            showError(e.message, el.bulkPrRows);
            return;
        }

        const payload = await api.post('/api/metadatas/bulk', {
            front_id: commonFields.frontId,
            sprint_id: commonFields.sprintId,
            ticket: commonFields.ticket || null,
            description: commonFields.description,
            metadata_items: metadataRows.map(function(row) {
                return {
                    metadata_name: row.name,
                    metadata_type_id: row.typeId,
                    change_type: row.changeType
                };
            }),
            prs: prDefs
        });

        hideError();
        showInfo(
            'Lote processado: ' + String(payload.total_metadata || metadataRows.length) +
            ' metadata(s), ' + String(payload.created_count || 0) +
            ' novo(s), ' + String(payload.reused_count || 0) +
            ' reaproveitado(s), ' + String(payload.pr_created_count || 0) +
            ' vinculacao(oes) de PR criada(s).'
        );
        resetBulkRows();
        await loadItems();
    }

    // ── Scan commits ──────────────────────────────────────────────────────────
    async function scanCommits() {
        el.scanError.hidden = true;
        el.scanError.textContent = '';
        el.scanInfo.hidden = true;
        el.scanInfo.textContent = '';

        const email = el.scanEmail.value.trim();
        const repoPath = el.scanRepoPath.value.trim();
        const since = el.scanSince.value ? el.scanSince.value + 'T00:00:00' : '';
        const until = el.scanUntil.value ? el.scanUntil.value + 'T23:59:59' : '';
        const branch = el.scanBranch.value.trim();

        if (!email) {
            el.scanError.hidden = false;
            el.scanError.textContent = 'Informe o email do autor.';
            el.scanEmail.focus();
            return;
        }
        if (!repoPath) {
            el.scanError.hidden = false;
            el.scanError.textContent = 'Informe o caminho do repositorio.';
            el.scanRepoPath.focus();
            return;
        }

        el.btnScan.disabled = true;
        const prevText = el.btnScan.textContent;
        el.btnScan.textContent = 'Buscando...';
        el.scanInfo.hidden = false;
        el.scanInfo.textContent = 'Consultando commits...';

        try {
            const payload = await api.post('/api/scan-commits', {
                email,
                repo_path: repoPath,
                since: since || undefined,
                until: until || undefined,
                branch: branch || undefined
            });

            state.scanResults = payload.commits || [];
            state.lastScanRepoPath = repoPath;
            localStorage.setItem('release_notes_scan_repo_path', repoPath);

            if (state.scanResults.length === 0) {
                el.scanInfo.textContent = 'Nenhum commit com metadados identificaveis encontrado para este email.';
            } else {
                el.scanInfo.textContent = state.scanResults.length + ' commit(s) encontrado(s) com metadados Salesforce.';
            }

            renderScanResults();
        } catch (e) {
            el.scanError.hidden = false;
            el.scanError.textContent = 'Erro ao buscar commits: ' + e.message;
            el.scanInfo.hidden = true;
        } finally {
            el.btnScan.disabled = false;
            el.btnScan.textContent = prevText;
        }
    }

    function renderScanResults() {
        el.scanResultsSection.hidden = state.scanResults.length === 0;
        el.scanCountLabel.textContent = state.scanResults.length + ' commit' + (state.scanResults.length === 1 ? '' : 's');

        if (state.scanResults.length === 0) {
            el.scanResultsBody.innerHTML = '';
            return;
        }

        el.scanResultsBody.innerHTML = state.scanResults.map(function(commit, index) {
            const pills = commit.metadata_items.slice(0, 4).map(function(m) {
                return '<span class="badge">' + escapeHtml(m.name) + '</span>';
            }).join(' ');
            const extra = commit.metadata_items.length > 4
                ? ' <span class="badge badge-more">+' + (commit.metadata_items.length - 4) + '</span>'
                : '';

            return [
                '<tr>',
                '  <td><code class="scan-hash" title="' + escapeHtml(commit.hash) + '">' + escapeHtml(commit.hash.slice(0, 12)) + '</code></td>',
                '  <td class="scan-date">' + escapeHtml(formatDateTime(commit.authored_at)) + '</td>',
                '  <td>' + escapeHtml(commit.author_name) + '<br><small class="scan-email-cell">' + escapeHtml(commit.author_email) + '</small></td>',
                '  <td class="scan-pills">' + pills + extra + '</td>',
                '  <td><button type="button" class="btn-use-commit btn-secondary btn-sm" data-use-commit="' + index + '">Usar commit</button></td>',
                '</tr>'
            ].join('');
        }).join('');

        el.scanResultsBody.querySelectorAll('[data-use-commit]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                useCommit(state.scanResults[Number(btn.dataset.useCommit)]);
            });
        });
    }

    function useCommit(commit) {
        el.fRepoPath.value = state.lastScanRepoPath;
        el.fCommitHash.value = commit.hash;
        if (state.lastScanRepoPath) {
            localStorage.setItem('release_notes_repo_path', state.lastScanRepoPath);
        }
        setActiveTab('metadata');
        loadMetadataFromCommit();
    }

    // ── Acoes ─────────────────────────────────────────────────────────────────
    async function deleteItem(id) {
        await api.del('/api/metadatas/' + id);
        await loadItems();
    }

    function openEditModal(item) {
        editingMetadataId = item.id;
        el.editMetadataName.value = item.metadata_name;
        el.editMetadataType.innerHTML = buildMetadataTypeOptions(item.metadata_type_id);
        el.editMetadataType.value = String(item.metadata_type_id);
        el.editChangeType.innerHTML = buildChangeTypeOptions(item.change_type);
        el.editChangeType.value = item.change_type;
        el.editTicket.value = item.ticket || '';
        el.editDescription.value = item.description || '';
        el.editFormError.hidden = true;
        el.editFormError.textContent = '';
        el.editModal.hidden = false;
        el.editChangeType.focus();
    }

    function closeEditModal() {
        el.editModal.hidden = true;
        editingMetadataId = null;
        el.editForm.reset();
    }

    async function submitEditForm() {
        const changeType = el.editChangeType.value;
        const ticket = el.editTicket.value.trim();
        const description = el.editDescription.value.trim();

        if (!changeType) {
            el.editFormError.hidden = false;
            el.editFormError.textContent = 'Selecione o tipo de mudança.';
            el.editChangeType.focus();
            return;
        }

        if (!description) {
            el.editFormError.hidden = false;
            el.editFormError.textContent = 'Descreva a alteração.';
            el.editDescription.focus();
            return;
        }

        try {
            await api.put('/api/metadatas/' + editingMetadataId, {
                change_type: changeType,
                ticket: ticket || null,
                description: description
            });
            closeEditModal();
            await loadItems();
        } catch (e) {
            el.editFormError.hidden = false;
            el.editFormError.textContent = 'Erro ao atualizar: ' + e.message;
        }
    }

    async function addNewPr(metadataId, label, url) {
        try {
            await api.post('/api/metadatas/' + metadataId + '/prs', { label, url });
            await loadItems();
        } catch (e) {
            alert('Erro ao adicionar PR: ' + e.message);
        }
    }

    async function deletePr(prId) {
        await api.del('/api/prs/' + prId);
        await loadItems();
    }

    async function submitForm() {
        hideError();
        hideInfo();
        const frontId      = Number(el.frontSelect.value);
        const sprintId     = Number(el.sprintSelect.value);
        const ticket       = el.fTicket.value.trim();
        const description  = el.fDescription.value.trim();

        if (!frontId)      { showError('Selecione ou cadastre uma frente.', el.frontSelect); return; }
        if (!description)  { showError('Descreva a alteracao.', el.fDescription); return; }

        try {
            await submitBulkForm({
                frontId: frontId,
                sprintId: sprintId || null,
                ticket: ticket,
                description: description
            });
        } catch (e) {
            showError('Erro ao processar lote: ' + e.message);
        }
    }

    // ── Eventos ───────────────────────────────────────────────────────────────
    function bindEvents() {
        el.tabBtnMetadata.addEventListener('click', function() { setActiveTab('metadata'); });
        el.tabBtnRelease.addEventListener('click', function() { setActiveTab('release'); });
        el.tabBtnCommits.addEventListener('click', function() { setActiveTab('commits'); });
        el.tabBtnAuthors.addEventListener('click', function() { setActiveTab('authors'); });

        el.scanForm.addEventListener('submit', function(e) {
            e.preventDefault();
            scanCommits();
        });

        // Repo form
        el.repoForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            el.repoFormError.hidden = true;
            const name = el.repoName.value.trim();
            const repoPath = el.repoPathSave.value.trim();
            if (!name || !repoPath) {
                el.repoFormError.hidden = false;
                el.repoFormError.textContent = 'Preencha nome e caminho.';
                return;
            }
            try {
                await api.post('/api/repos', { name, repo_path: repoPath });
                el.repoForm.reset();
                await loadRepos();
            } catch (err) {
                el.repoFormError.hidden = false;
                el.repoFormError.textContent = err.message;
            }
        });

        // Repo selects -> fill path inputs
        if (el.fRepoSelect) {
            el.fRepoSelect.addEventListener('change', function() {
                if (el.fRepoSelect.value) {
                    el.fRepoPath.value = el.fRepoSelect.value;
                    localStorage.setItem('release_notes_repo_path', el.fRepoSelect.value);
                    el.fRepoSelect.value = '';
                }
            });
        }
        if (el.scanRepoSelect) {
            el.scanRepoSelect.addEventListener('change', function() {
                if (el.scanRepoSelect.value) {
                    el.scanRepoPath.value = el.scanRepoSelect.value;
                    localStorage.setItem('release_notes_scan_repo_path', el.scanRepoSelect.value);
                    el.scanRepoSelect.value = '';
                }
            });
        }
        if (el.authorScanRepoSelect) {
            el.authorScanRepoSelect.addEventListener('change', function() {
                if (el.authorScanRepoSelect.value) {
                    el.authorScanRepoPath.value = el.authorScanRepoSelect.value;
                    localStorage.setItem('release_notes_author_scan_repo_path', el.authorScanRepoSelect.value);
                    el.authorScanRepoSelect.value = '';
                }
            });
        }

        if (el.authorScanForm) {
            el.authorScanForm.addEventListener('submit', function(e) {
                e.preventDefault();
                scanCommitAuthors();
            });
        }

        if (el.peopleForm) {
            el.peopleForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                hidePeopleFeedback();

                const id = Number(el.personId.value || 0);
                const name = el.personName.value.trim();
                const email = el.personEmail.value.trim();
                const defaultRepoPath = el.personDefaultRepo.value.trim();

                if (!name || !email) {
                    showPeopleError('Preencha nome e email.');
                    return;
                }

                const payload = {
                    name: name,
                    email: email,
                    default_repo_path: defaultRepoPath || null
                };

                try {
                    if (id > 0) {
                        await api.put('/api/people/' + id, payload);
                        showPeopleInfo('Pessoa atualizada com sucesso.');
                    } else {
                        await api.post('/api/people', payload);
                        showPeopleInfo('Pessoa cadastrada com sucesso.');
                    }
                    resetPersonForm();
                    await loadPeople();
                } catch (err) {
                    showPeopleError(err.message);
                }
            });
        }

        if (el.btnCancelPersonEdit) {
            el.btnCancelPersonEdit.addEventListener('click', function() {
                hidePeopleFeedback();
                resetPersonForm();
            });
        }

        if (el.scanPersonSelect) {
            el.scanPersonSelect.addEventListener('change', function() {
                const personId = Number(el.scanPersonSelect.value || 0);
                if (!personId) return;

                const person = state.people.find(function(item) {
                    return Number(item.id) === personId;
                });

                if (!person) {
                    return;
                }

                el.scanEmail.value = person.email || '';
                if (person.default_repo_path) {
                    el.scanRepoPath.value = person.default_repo_path;
                    localStorage.setItem('release_notes_scan_repo_path', person.default_repo_path);
                }
                el.scanPersonSelect.value = '';
            });
        }

        el.form.addEventListener('submit', function(e) {
            e.preventDefault();
            submitForm();
        });

        el.btnBulkAddMetadata.addEventListener('click', function() {
            const row = createBulkMetadataRow({});
            el.bulkMetadataRows.appendChild(row);
            const input = row.querySelector('.bulk-metadata-input');
            if (input) input.focus();
        });

        el.btnBulkAddPr.addEventListener('click', function() {
            const row = createBulkPrRow('', '');
            el.bulkPrRows.appendChild(row);
            const input = row.querySelector('.bulk-pr-label-input');
            if (input) input.focus();
        });

        el.btnLoadCommit.addEventListener('click', function() {
            loadMetadataFromCommit();
        });

        el.fCommitHash.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                loadMetadataFromCommit();
            }
        });

        el.fRepoPath.addEventListener('blur', function() {
            const repoPath = el.fRepoPath.value.trim();
            if (repoPath) {
                localStorage.setItem('release_notes_repo_path', repoPath);
            }
        });

        el.btnClearForm.addEventListener('click', function() {
            el.form.reset();
            el.sprintSelect.disabled = true;
            el.btnAddSprint.disabled = true;
            fillSelect(el.sprintSelect, [], 'Selecione uma frente primeiro');
            resetBulkRows();
            hideError();
            hideInfo();
        });

        // Lookup — frente
        el.frontSelect.addEventListener('change', async function() {
            await loadFormSprints(el.frontSelect.value);
        });

        bindLookup(el.btnAddFront, el.addFrontRow, el.btnSaveFront, el.btnCancelFront, el.fFrontNew,
            async function(name) {
                if (!name) return;
                try {
                    const front = await api.post('/api/fronts', { name });
                    closeAddRow(el.addFrontRow);
                    await loadFronts();
                    el.frontSelect.value = String(front.id);
                    await loadFormSprints(front.id);
                } catch (e) { showError('Erro ao salvar frente: ' + e.message); }
            }
        );

        // Lookup — sprint
        bindLookup(el.btnAddSprint, el.addSprintRow, el.btnSaveSprint, el.btnCancelSprint, el.fSprintNew,
            async function(name) {
                if (!name) return;
                const frontId = Number(el.frontSelect.value);
                if (!frontId) { showError('Selecione uma frente antes de adicionar uma sprint.', el.frontSelect); return; }
                try {
                    const sprint = await api.post('/api/sprints', { name, front_id: frontId });
                    closeAddRow(el.addSprintRow);
                    await loadFormSprints(frontId);
                    el.sprintSelect.value = String(sprint.id);
                } catch (e) { showError('Erro ao salvar sprint: ' + e.message); }
            }
        );

        // Lookup — tipo de metadata
        bindLookup(el.btnAddType, el.addTypeRow, el.btnSaveType, el.btnCancelType, el.fTypeNew,
            async function(name) {
                if (!name) return;
                try {
                    const type = await api.post('/api/metadata-types', { name });
                    closeAddRow(el.addTypeRow);
                    await loadMetadataTypes();
                    el.typeSelect.value = String(type.id);
                } catch (e) { showError('Erro ao salvar tipo: ' + e.message); }
            }
        );

        // Filtros
        el.filterFront.addEventListener('change', async function() {
            state.filterFrontId  = el.filterFront.value;
            state.filterSprintId = '';
            await loadFilterSprints(state.filterFrontId);
            el.filterSprint.value = '';
            await loadItems();
        });
        el.filterSprint.addEventListener('change', async function() {
            state.filterSprintId = el.filterSprint.value;
            await loadItems();
        });
        el.filterType.addEventListener('change', async function() {
            state.filterTypeId = el.filterType.value;
            await loadItems();
        });
        el.filterSearch.addEventListener('input', async function() {
            state.filterSearch = el.filterSearch.value;
            await loadItems();
        });
        el.btnResetFilters.addEventListener('click', async function() {
            state.filterFrontId = state.filterSprintId = state.filterTypeId = state.filterSearch = '';
            el.filterFront.value = el.filterSprint.value = el.filterType.value = el.filterSearch.value = '';
            await loadFilterSprints('');
            await loadItems();
        });

        // Filtros de metadados
        el.metadataFilterFront.addEventListener('change', async function() {
            metadataFilterState.frontId = el.metadataFilterFront.value;
            metadataFilterState.sprintId = '';
            el.metadataFilterSprint.value = '';
            if (metadataFilterState.frontId) {
                const sprints = await api.get('/api/sprints?front_id=' + metadataFilterState.frontId);
                fillSelect(el.metadataFilterSprint, sprints, 'Todas as sprints', '');
            } else {
                const sprints = await api.get('/api/sprints');
                fillSelect(el.metadataFilterSprint, sprints, 'Todas as sprints', '');
            }
            applyMetadataFilters();
        });
        el.metadataFilterSprint.addEventListener('change', async function() {
            metadataFilterState.sprintId = el.metadataFilterSprint.value;
            applyMetadataFilters();
        });
        el.metadataFilterType.addEventListener('change', async function() {
            metadataFilterState.typeId = el.metadataFilterType.value;
            applyMetadataFilters();
        });
        el.metadataFilterSearch.addEventListener('input', async function() {
            metadataFilterState.search = el.metadataFilterSearch.value;
            applyMetadataFilters();
        });
        el.btnResetMetadataFilters.addEventListener('click', async function() {
            metadataFilterState.frontId = metadataFilterState.sprintId = metadataFilterState.typeId = metadataFilterState.search = '';
            el.metadataFilterFront.value = el.metadataFilterSprint.value = el.metadataFilterType.value = el.metadataFilterSearch.value = '';
            const sprints = await api.get('/api/sprints');
            fillSelect(el.metadataFilterSprint, sprints, 'Todas as sprints', '');
            applyMetadataFilters();
        });

        // Modal de edição
        el.btnCloseEditModal.addEventListener('click', closeEditModal);
        el.btnCancelEdit.addEventListener('click', closeEditModal);
        el.editForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitEditForm();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !el.editModal.hidden) {
                closeEditModal();
            }
        });

        el.btnGenerate.addEventListener('click', generateRelease);
        el.btnCopyRelease.addEventListener('click', function() {
            if (!state.latestReleaseText) return;
            navigator.clipboard.writeText(state.latestReleaseText).then(function() {
                el.btnCopyRelease.textContent = 'Copiado';
                setTimeout(function() { el.btnCopyRelease.textContent = 'Copiar release'; }, 2000);
            });
        });

        el.btnExportJson.addEventListener('click', function() { triggerExport('json'); });
        el.btnExportCsv.addEventListener('click', function() { triggerExport('csv'); });
        el.btnExportMd.addEventListener('click', function() { triggerExport('md'); });
    }

    function applyMetadataFilters() {
        const filtered = state.items.filter(function(item) {
            if (metadataFilterState.frontId && String(item.front_id) !== metadataFilterState.frontId) return false;
            if (metadataFilterState.sprintId && String(item.sprint_id) !== metadataFilterState.sprintId) return false;
            if (metadataFilterState.typeId && String(item.metadata_type_id) !== metadataFilterState.typeId) return false;
            if (metadataFilterState.search) {
                const searchNorm = normalizeCompare(metadataFilterState.search);
                const nameMatches = normalizeCompare(item.metadata_name).includes(searchNorm);
                const ticketMatches = normalizeCompare(item.ticket || '').includes(searchNorm);
                const descMatches = normalizeCompare(item.description || '').includes(searchNorm);
                if (!nameMatches && !ticketMatches && !descMatches) return false;
            }
            return true;
        });

        el.itemsList.innerHTML = '';
        el.countLabel.textContent = filtered.length + ' item' + (filtered.length === 1 ? '' : 's');

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'Nenhum item cadastrado com os filtros atuais.';
            el.itemsList.appendChild(empty);
            return;
        }

        filtered.forEach(function(item) {
            const card = document.createElement('article');
            card.className = 'item-card' + (state.highlightedMetadataId === item.id ? ' is-highlight' : '');
            card.setAttribute('data-metadata-id', item.id);
            card.innerHTML = [
                '<div class="item-top">',
                '  <div>',
                '    <h3 class="item-title">' + escapeHtml(item.metadata_name) + '</h3>',
                '    <div class="item-meta"><span>' + escapeHtml(item.front) + '</span><span>•</span><span>' + escapeHtml(item.sprint) + '</span></div>',
                '  </div>',
                '  <div class="badges">',
                '    <span class="badge">' + escapeHtml(item.metadata_type) + '</span>',
                '    <span class="badge">' + escapeHtml(item.change_type) + '</span>',
                '  </div>',
                '</div>',
                '<p class="item-description">' + escapeHtml(item.description) + '</p>',
                '<div class="item-meta">',
                '  <span>Ticket: ' + escapeHtml(item.ticket || '-') + '</span><span>•</span>',
                '  <span>' + escapeHtml(formatDateTime(item.created_at)) + '</span>',
                '</div>',
                // PRs
                '<div class="pr-section">',
                '  <div class="pr-section-head">',
                '    <span class="pr-section-title">Pull Requests</span>',
                '    <button type="button" class="btn-pr-add" data-metadata-id="' + escapeHtml(item.id) + '">+ Adicionar PR</button>',
                '  </div>',
                '  <div class="pr-list">' + renderPrList(item.prs) + '</div>',
                '  <div class="pr-add-form" hidden>',
                '    <input type="text" class="pr-label-input" placeholder="Label (ex: PR main)">',
                '    <input type="url" class="pr-url-input" placeholder="https://github.com/...">',
                '    <button type="button" class="btn-secondary btn-sm pr-save">Salvar</button>',
                '    <button type="button" class="btn-secondary btn-sm pr-cancel">Cancelar</button>',
                '  </div>',
                '</div>',
                '<div class="item-actions">',
                '  <button type="button" class="btn-primary btn-sm" data-edit-id="' + escapeHtml(item.id) + '">Editar</button>',
                '  <button type="button" class="btn-danger" data-delete-id="' + escapeHtml(item.id) + '">Excluir metadata</button>',
                '</div>'
            ].join('\n');

            // Editar metadata
            card.querySelector('[data-edit-id]').addEventListener('click', function() {
                openEditModal(item);
            });

            // Excluir metadata
            card.querySelector('[data-delete-id]').addEventListener('click', function() {
                deleteItem(item.id);
            });

            // Excluir PR
            card.querySelectorAll('[data-delete-pr]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    deletePr(Number(btn.dataset.deletePr));
                });
            });

            // Toggle add PR form
            const addPrBtn  = card.querySelector('.btn-pr-add');
            const addPrForm = card.querySelector('.pr-add-form');
            const labelInput = card.querySelector('.pr-label-input');
            const urlInput   = card.querySelector('.pr-url-input');
            const saveBtn    = card.querySelector('.pr-save');
            const cancelBtn  = card.querySelector('.pr-cancel');

            addPrBtn.addEventListener('click', function() {
                addPrForm.hidden = false;
                labelInput.focus();
            });
            cancelBtn.addEventListener('click', function() {
                addPrForm.hidden = true;
            });
            function savePr() {
                const label = labelInput.value.trim();
                const url   = urlInput.value.trim();
                if (!label || !url) return;
                addNewPr(item.id, label, url);
            }
            saveBtn.addEventListener('click', savePr);
            urlInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); savePr(); }
                if (e.key === 'Escape') { addPrForm.hidden = true; }
            });

            el.itemsList.appendChild(card);
        });
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    async function init() {
        ensureBulkRows();
        setActiveTab('metadata');
        resetPersonForm();

        const savedRepoPath = localStorage.getItem('release_notes_repo_path');
        if (savedRepoPath) {
            el.fRepoPath.value = savedRepoPath;
        }

        const savedScanRepoPath = localStorage.getItem('release_notes_scan_repo_path');
        if (savedScanRepoPath) {
            el.scanRepoPath.value = savedScanRepoPath;
        }

        const savedAuthorScanRepoPath = localStorage.getItem('release_notes_author_scan_repo_path');
        if (savedAuthorScanRepoPath && el.authorScanRepoPath) {
            el.authorScanRepoPath.value = savedAuthorScanRepoPath;
        }

        await Promise.all([loadFronts(), loadMetadataTypes(), loadRepos(), loadPeople()]);
        await loadFormSprints(null);
        await loadFilterSprints('');
        
        // Carregar dados dos filtros de metadados
        const fronts = await api.get('/api/fronts');
        fillSelect(el.metadataFilterFront, fronts, 'Todas as frentes', '');
        fillSelect(el.metadataFilterType, state.metadataTypes, 'Todos os tipos', '');
        const sprints = await api.get('/api/sprints');
        fillSelect(el.metadataFilterSprint, sprints, 'Todas as sprints', '');
        
        bindEvents();
        await loadItems();
    }

    init().catch(function(err) {
        console.error('Erro ao inicializar:', err);
        document.getElementById('form-error').hidden = false;
        document.getElementById('form-error').textContent = 'Nao foi possivel conectar ao servidor. Certifique-se de que o servidor esta rodando (node server.js).';
    });
})();
