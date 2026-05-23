// Latticework — view-router app (5 views + theme toggle)
// Views: wall | table | evidence | synergy | recommend

const state = {
  models: [],
  synergies: [],
  scenarioVocab: [],
  view: 'wall',
  discipline: 'all',
  scenario: 'all',
  query: '',
  sort: 'id',
  tableSort: { col: 'id', dir: 'asc' },
  recommendScenario: '',
  recommendText: '',
  theme: localStorage.getItem('lw-theme') || 'light',
};

const $body = document.body;
const $root = document.documentElement;
const $main = document.getElementById('main');
const $tabs = document.getElementById('tabs');
const $search = document.getElementById('search');
const $sort = document.getElementById('sort');
const $controls = document.getElementById('controls');
const $scenarioChips = document.getElementById('scenario-chips');
const $disciplineChips = document.querySelector('[data-facet="discipline"]');
const $themeToggle = document.getElementById('theme-toggle');
const $visibleCount = document.getElementById('visible-count');
const $coreCount = document.getElementById('core-count');
const $synergyCount = document.getElementById('synergy-count');
const $modal = document.getElementById('modal');
const $modalPanel = document.getElementById('modal-panel');
const $empty = document.getElementById('empty');

// ---------------------------------------------------------------
// Init
// ---------------------------------------------------------------

async function init() {
  applyTheme();
  try {
    const [models, synergies] = await Promise.all([
      fetch('./data/models.json', { cache: 'no-store' }).then(r => r.json()),
      fetch('./data/synergies.json', { cache: 'no-store' }).then(r => r.json()),
    ]);
    state.models = models.sort((a, b) => a.id - b.id);
    state.synergies = synergies;
  } catch (err) {
    console.error(err);
    $main.innerHTML = `<div class="empty"><p>資料載入失敗：${esc(err.message)}</p></div>`;
    return;
  }

  buildScenarioVocab();
  renderScenarioChips();
  updateHeaderStats();
  bindEvents();
  render();
}

function buildScenarioVocab() {
  const map = new Map();
  for (const m of state.models) {
    for (const s of (m.scenarios || [])) {
      map.set(s, (map.get(s) || 0) + 1);
    }
  }
  // sort by frequency desc, then by name
  state.scenarioVocab = [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'));
}

function renderScenarioChips() {
  const all = `<button class="chip small is-active" data-value="all">所有情境</button>`;
  const items = state.scenarioVocab.map(([s, n]) =>
    `<button class="chip small" data-value="${esc(s)}">${esc(s)} <span class="chip-count">${n}</span></button>`
  ).join('');
  $scenarioChips.innerHTML = all + items;
}

function updateHeaderStats() {
  const coreCount = state.models.filter(m => m.tier === 'core').length;
  $coreCount.textContent = coreCount;
  $synergyCount.textContent = state.synergies.length;
}

// ---------------------------------------------------------------
// Theme
// ---------------------------------------------------------------

function applyTheme() {
  $root.dataset.theme = state.theme;
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('lw-theme', state.theme);
  applyTheme();
}

// ---------------------------------------------------------------
// Render dispatch
// ---------------------------------------------------------------

function render() {
  $body.dataset.view = state.view;

  // update active tab
  $tabs.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('is-active', t.dataset.view === state.view);
  });

  // call view renderer
  switch (state.view) {
    case 'wall': renderWall(); break;
    case 'table': renderTable(); break;
    case 'evidence': renderEvidence(); break;
    case 'synergy': renderSynergy(); break;
    case 'recommend': renderRecommend(); break;
  }
}

// ---------------------------------------------------------------
// Filter / sort helpers
// ---------------------------------------------------------------

function filteredModels() {
  return state.models.filter(matchesModel);
}

function matchesModel(m) {
  if (state.discipline !== 'all' && m.discipline !== state.discipline) return false;
  if (state.scenario !== 'all' && !(m.scenarios || []).includes(state.scenario)) return false;
  if (state.query) {
    const q = state.query.toLowerCase();
    const hay = [
      m.name_zh, m.name_en, m.case_anchor, m.summary || '',
      (m.tags || []).join(' '), (m.scenarios || []).join(' '),
      m.body_text || '',
    ].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function sortModels(arr) {
  const sorted = [...arr];
  switch (state.sort) {
    case 'name':
      sorted.sort((a, b) => a.name_zh.localeCompare(b.name_zh, 'zh-Hant'));
      break;
    case 'discipline':
      const disciplineOrder = ['經濟學', '心理學', '物理學與系統', '生物學與演化', '統計學', '工程學', '哲學與邏輯'];
      sorted.sort((a, b) =>
        disciplineOrder.indexOf(a.discipline) - disciplineOrder.indexOf(b.discipline) || a.id - b.id);
      break;
    case 'tier':
      sorted.sort((a, b) => {
        const ta = a.tier === 'core' ? 0 : 1;
        const tb = b.tier === 'core' ? 0 : 1;
        return ta - tb || a.id - b.id;
      });
      break;
    default:
      sorted.sort((a, b) => a.id - b.id);
  }
  return sorted;
}

// ---------------------------------------------------------------
// View: Wall (card grid)
// ---------------------------------------------------------------

function renderWall() {
  const visible = sortModels(filteredModels());
  $visibleCount.textContent = visible.length;

  if (visible.length === 0) {
    $main.innerHTML = '';
    $empty.hidden = false;
    return;
  }
  $empty.hidden = true;
  $main.innerHTML = '<div class="grid">' + visible.map(cardHTML).join('') + '</div>';
  $main.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => openModal(Number(el.dataset.id)));
  });
}

function cardHTML(m) {
  const tierLabel = m.tier === 'core' ? '常駐' : '字典';
  const scenarios = (m.scenarios || []).slice(0, 3)
    .map(s => `<span class="scenario-tag">${esc(s)}</span>`).join('');
  return `
    <article class="card" data-id="${m.id}" data-discipline="${esc(m.discipline)}">
      <div class="card-meta">
        <div class="card-meta-left">
          <span class="disc-badge">${esc(m.discipline)}</span>
          <span class="tier-badge ${m.tier}">${tierLabel}</span>
        </div>
        <span class="card-id">#${pad(m.id)}</span>
      </div>
      <h2 class="card-title">${esc(m.name_zh)}</h2>
      <p class="card-title-en">${esc(m.name_en)}</p>
      <p class="card-summary">${esc(m.summary || '')}</p>
      ${scenarios ? `<div class="card-scenarios">${scenarios}</div>` : ''}
      <div class="card-foot">
        <span class="case-pill">${esc(m.case_anchor)}</span>
        <span class="read-more">READ →</span>
      </div>
    </article>
  `;
}

// ---------------------------------------------------------------
// View: Table
// ---------------------------------------------------------------

function renderTable() {
  let visible = filteredModels();
  $visibleCount.textContent = visible.length;

  // table-specific sort (overrides global sort)
  const { col, dir } = state.tableSort;
  visible = [...visible].sort((a, b) => {
    let av, bv;
    switch (col) {
      case 'id': av = a.id; bv = b.id; break;
      case 'name': av = a.name_zh; bv = b.name_zh; break;
      case 'discipline': av = a.discipline; bv = b.discipline; break;
      case 'tier': av = a.tier === 'core' ? 0 : 1; bv = b.tier === 'core' ? 0 : 1; break;
      case 'case': av = a.case_anchor; bv = b.case_anchor; break;
      default: av = a.id; bv = b.id;
    }
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'zh-Hant');
    return dir === 'desc' ? -cmp : cmp;
  });

  if (visible.length === 0) {
    $main.innerHTML = '';
    $empty.hidden = false;
    return;
  }
  $empty.hidden = true;

  const cols = [
    { key: 'id', label: '#', cls: 'col-id' },
    { key: 'name', label: '模型', cls: 'col-name' },
    { key: 'discipline', label: '學科', cls: 'col-disc' },
    { key: 'tier', label: '分級', cls: 'col-tier' },
    { key: 'case', label: '主個案', cls: 'col-case' },
    { key: null, label: '情境', cls: 'col-scenarios' },
  ];
  const headHTML = cols.map(c => {
    const sorted = c.key === state.tableSort.col ? 'sorted' : '';
    const dir = sorted && state.tableSort.dir === 'desc' ? 'desc' : '';
    return `<th class="${c.cls} ${sorted} ${dir}" data-col="${c.key || ''}">${esc(c.label)}</th>`;
  }).join('');

  const rowsHTML = visible.map(m => {
    const tierLabel = m.tier === 'core'
      ? `<span class="tier-badge core">常駐</span>`
      : `<span class="tier-badge reference">字典</span>`;
    const scenarios = (m.scenarios || []).map(s =>
      `<span class="scenario-tag">${esc(s)}</span>`).join(' ');
    return `
      <tr data-id="${m.id}">
        <td class="col-id">#${pad(m.id)}</td>
        <td class="col-name">${esc(m.name_zh)}<br><span class="col-name-en">${esc(m.name_en)}</span></td>
        <td class="col-disc" data-discipline="${esc(m.discipline)}" style="--card-accent: var(--d-${disciplineShortCode(m.discipline)});"><span class="disc-badge">${esc(m.discipline)}</span></td>
        <td class="col-tier">${tierLabel}</td>
        <td class="col-case">${esc(m.case_anchor)}</td>
        <td class="col-scenarios">${scenarios}</td>
      </tr>
    `;
  }).join('');

  $main.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr>${headHTML}</tr></thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>
  `;

  $main.querySelectorAll('thead th[data-col]').forEach(th => {
    if (!th.dataset.col) return;
    th.addEventListener('click', () => {
      const key = th.dataset.col;
      if (state.tableSort.col === key) {
        state.tableSort.dir = state.tableSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.tableSort = { col: key, dir: 'asc' };
      }
      renderTable();
    });
  });
  $main.querySelectorAll('tbody tr').forEach(tr => {
    tr.addEventListener('click', () => openModal(Number(tr.dataset.id)));
  });
}

function disciplineShortCode(d) {
  const map = {
    '經濟學': 'econ', '心理學': 'psych', '物理學與系統': 'systems',
    '生物學與演化': 'bio', '統計學': 'stats', '工程學': 'eng', '哲學與邏輯': 'phil',
  };
  return map[d] || 'econ';
}

// ---------------------------------------------------------------
// View: Evidence (group by case anchor / actor)
// ---------------------------------------------------------------

function renderEvidence() {
  // group cards by extracted actor
  const groups = new Map();
  for (const m of state.models) {
    const actor = extractActor(m.case_anchor);
    if (!groups.has(actor)) groups.set(actor, []);
    groups.get(actor).push(m);
  }

  // sort groups by count desc, then alphabetical
  let entries = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'zh-Hant'));

  // optional discipline filter via state
  if (state.discipline !== 'all') {
    entries = entries
      .map(([actor, list]) => [actor, list.filter(m => m.discipline === state.discipline)])
      .filter(([_, list]) => list.length > 0);
  }
  if (state.query) {
    const q = state.query.toLowerCase();
    entries = entries
      .map(([actor, list]) => [actor, list.filter(m =>
        actor.toLowerCase().includes(q) || matchesModel(m))])
      .filter(([_, list]) => list.length > 0);
  }

  const totalCards = entries.reduce((sum, [_, list]) => sum + list.length, 0);
  $visibleCount.textContent = totalCards;

  if (entries.length === 0) {
    $main.innerHTML = '';
    $empty.hidden = false;
    return;
  }
  $empty.hidden = true;

  const html = entries.map(([actor, list]) => {
    const itemsHTML = list.map(m => `
      <li class="evidence-item" data-id="${m.id}" data-discipline="${esc(m.discipline)}" style="--card-accent: var(--d-${disciplineShortCode(m.discipline)});">
        <span class="disc-badge">${esc(m.discipline)}</span>
        <span class="ev-id">#${pad(m.id)}</span>
        <span class="ev-name">${esc(m.name_zh)}</span>
        <span class="ev-anchor">${esc(m.case_anchor)}</span>
      </li>
    `).join('');
    return `
      <article class="evidence-card">
        <h3 class="evidence-actor">${esc(actor)}</h3>
        <p class="evidence-actor-meta">透過 ${list.length} 個模型解讀</p>
        <ul class="evidence-list">${itemsHTML}</ul>
      </article>
    `;
  }).join('');

  $main.innerHTML = `<div class="evidence-grid">${html}</div>`;
  $main.querySelectorAll('.evidence-item').forEach(el => {
    el.addEventListener('click', () => openModal(Number(el.dataset.id)));
  });
}

function extractActor(caseAnchor) {
  if (!caseAnchor) return '（未指定）';
  // strategies for canonicalization
  const s = caseAnchor.trim();
  // common patterns: "X vs Y" → X; "X 的 Y" → X; "X 與 Y" → X; "X / Y" → X
  const splitters = [' vs ', ' Vs ', ' 與 ', ' 的 ', ' / ', '／'];
  for (const sp of splitters) {
    if (s.includes(sp)) return s.split(sp)[0].trim();
  }
  // strip Chinese suffix words like "的", "策略", "計畫" — keep leading proper noun
  // simple heuristic: take chars until first CJK space-equivalent
  const m = s.match(/^([A-Za-z][A-Za-z0-9 .&'-]*[A-Za-z0-9])/);
  if (m) return m[1].trim();
  // fall back to first word before space
  return s.split(/[\s ]/)[0];
}

// ---------------------------------------------------------------
// View: Synergy
// ---------------------------------------------------------------

function renderSynergy() {
  $visibleCount.textContent = state.synergies.length;
  $empty.hidden = true;

  const html = state.synergies.map(s => {
    const modelChips = s.model_ids.map(id => {
      const m = state.models.find(x => x.id === id);
      if (!m) return '';
      return `
        <span class="synergy-model-chip" data-id="${m.id}" data-discipline="${esc(m.discipline)}">
          <span class="smc-dot"></span>
          <span class="smc-id">#${pad(m.id)}</span>
          <span class="smc-name">${esc(m.name_zh)}</span>
        </span>
      `;
    }).join('');
    return `
      <article class="synergy-card">
        <div class="synergy-head">
          <h2 class="synergy-name">${esc(s.name)}</h2>
          <span class="synergy-theme">${esc(s.theme)}</span>
        </div>
        <p class="synergy-subtitle">${esc(s.subtitle)}</p>
        <div class="synergy-models">${modelChips}</div>
        <p class="synergy-why">${esc(s.why)}</p>
        <p class="synergy-case">${esc(s.case)}</p>
      </article>
    `;
  }).join('');

  $main.innerHTML = `<div class="synergy-grid">${html}</div>`;
  $main.querySelectorAll('.synergy-model-chip').forEach(el => {
    el.addEventListener('click', () => openModal(Number(el.dataset.id)));
  });
}

// ---------------------------------------------------------------
// View: Recommend
// ---------------------------------------------------------------

function renderRecommend() {
  $empty.hidden = true;

  const scenarioChipsHTML = state.scenarioVocab.map(([s, n]) =>
    `<button class="chip ${state.recommendScenario === s ? 'is-active' : ''}" data-rs="${esc(s)}">${esc(s)}</button>`
  ).join('');

  const recommendations = computeRecommendations();
  $visibleCount.textContent = recommendations.length;

  const resultsHTML = recommendations.length === 0
    ? `<div class="recommend-empty">選一個情境或輸入關鍵字，下方會列出最相關的模型。</div>`
    : `<div class="recommend-list">${recommendations.map((m, i) => recommendItemHTML(m, i + 1)).join('')}</div>`;

  $main.innerHTML = `
    <div class="recommend-wrap">
      <section class="recommend-prompt">
        <h2>智慧推薦</h2>
        <p>挑一個情境，或輸入你正在面對的決策（如「正在評估一筆併購」「員工激勵設計」），系統會比對 65 個模型的情境標籤與內文，回傳最相關的 8 個。</p>
        <div class="recommend-scenario-chips" id="rec-scenarios">${scenarioChipsHTML}</div>
        <div class="recommend-input-row">
          <input id="rec-input" type="text" placeholder="例如：員工流失嚴重、想做新產品 pricing、評估競爭對手…" value="${esc(state.recommendText)}" />
          <button id="rec-clear">清除</button>
        </div>
      </section>
      <section class="recommend-results">
        <h3>建議參考的模型<span class="count">${recommendations.length} 個</span></h3>
        ${resultsHTML}
      </section>
    </div>
  `;

  document.querySelectorAll('#rec-scenarios .chip').forEach(el => {
    el.addEventListener('click', () => {
      const v = el.dataset.rs;
      state.recommendScenario = state.recommendScenario === v ? '' : v;
      renderRecommend();
    });
  });
  const $recInput = document.getElementById('rec-input');
  let recDebounce;
  $recInput.addEventListener('input', e => {
    clearTimeout(recDebounce);
    recDebounce = setTimeout(() => {
      state.recommendText = e.target.value.trim();
      renderRecommend();
      document.getElementById('rec-input').focus();
    }, 220);
  });
  document.getElementById('rec-clear').addEventListener('click', () => {
    state.recommendScenario = '';
    state.recommendText = '';
    renderRecommend();
  });
  document.querySelectorAll('.recommend-item').forEach(el => {
    el.addEventListener('click', () => openModal(Number(el.dataset.id)));
  });
}

function computeRecommendations() {
  if (!state.recommendScenario && !state.recommendText) return [];
  const q = state.recommendText.toLowerCase();
  const scored = state.models.map(m => {
    let score = 0;
    if (state.recommendScenario && (m.scenarios || []).includes(state.recommendScenario)) score += 5;
    if (m.tier === 'core') score += 1;
    if (q) {
      const hay = [
        m.name_zh, m.name_en, m.case_anchor, m.summary || '',
        (m.tags || []).join(' '), (m.scenarios || []).join(' '),
        m.body_text || '',
      ].join(' ').toLowerCase();
      // each word in q adds to score if found
      const words = q.split(/\s+/).filter(w => w.length > 0);
      for (const w of words) {
        if (hay.includes(w)) score += 2;
        if (m.name_zh.includes(w) || m.name_en.toLowerCase().includes(w)) score += 2;
      }
    }
    return { m, score };
  });
  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.m.id - b.m.id)
    .slice(0, 8)
    .map(x => x.m);
}

function recommendItemHTML(m, rank) {
  const scenarios = (m.scenarios || []).slice(0, 3)
    .map(s => `<span class="scenario-tag">${esc(s)}</span>`).join('');
  return `
    <article class="recommend-item" data-id="${m.id}">
      <div class="ri-rank">${rank}</div>
      <div class="ri-body">
        <h4 class="ri-title">${esc(m.name_zh)} <span class="ri-name-en">${esc(m.name_en)}</span></h4>
        <div class="ri-meta">
          <span class="disc-badge" style="--card-accent: var(--d-${disciplineShortCode(m.discipline)});">${esc(m.discipline)}</span>
          <span class="tier-badge ${m.tier}">${m.tier === 'core' ? '常駐' : '字典'}</span>
          <span>▸ ${esc(m.case_anchor)}</span>
          ${scenarios}
        </div>
        <p class="ri-summary">${esc(m.summary || '')}</p>
      </div>
    </article>
  `;
}

// ---------------------------------------------------------------
// Modal
// ---------------------------------------------------------------

function openModal(id) {
  const m = state.models.find(x => x.id === id);
  if (!m) return;
  $modalPanel.style.setProperty('--card-accent', `var(--d-${disciplineShortCode(m.discipline)})`);
  const tierLabel = m.tier === 'core'
    ? `<span class="tier-badge core">常駐</span>`
    : `<span class="tier-badge reference">字典</span>`;
  const scenarios = (m.scenarios || []).map(s =>
    `<span class="scenario-tag">${esc(s)}</span>`).join(' ');
  $modalPanel.innerHTML = `
    <button class="modal-close" aria-label="關閉" data-close="1">×</button>
    <div class="modal-meta">
      <span class="disc-badge">${esc(m.discipline)}</span>
      ${tierLabel}
      <span class="dot">·</span>
      <span>#${pad(m.id)} · ${esc(m.name_en)}</span>
    </div>
    <h1 class="modal-title">${esc(m.name_zh)}</h1>
    <p class="modal-title-en">${esc(m.name_en)}</p>
    <div class="modal-anchor">${esc(m.case_anchor)}</div>
    ${scenarios ? `<div class="modal-scenarios">${scenarios}</div>` : ''}
    <div class="modal-body">${m.body_html || '<p>內容尚未產生。</p>'}</div>
    ${renderRelated(m)}
  `;
  $modal.hidden = false;
  $body.style.overflow = 'hidden';
  $modalPanel.scrollTop = 0;
  $modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModal));
  $modalPanel.querySelectorAll('.related-link').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const rid = Number(el.dataset.id);
      if (!Number.isNaN(rid)) openModal(rid);
    });
  });
}

function closeModal() {
  $modal.hidden = true;
  $body.style.overflow = '';
}

function renderRelated(m) {
  if (!m.related || m.related.length === 0) return '';
  const items = m.related.map(r => {
    const target = state.models.find(x => x.id === r.id);
    if (!target) return '';
    return `<a href="#" class="related-link" data-id="${target.id}">
      <span class="rl-id">#${pad(target.id)}</span>${esc(target.name_zh)}
    </a>`;
  }).filter(Boolean).join('');
  if (!items) return '';
  return `<h2 style="font-family:var(--serif);font-weight:600;font-size:19px;margin:32px 0 10px;border-left:3px solid var(--card-accent,var(--accent));padding-left:12px;">相關模型</h2>
    <div class="related-grid">${items}</div>`;
}

// ---------------------------------------------------------------
// Events
// ---------------------------------------------------------------

function bindEvents() {
  // tab nav
  $tabs.addEventListener('click', e => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    state.view = btn.dataset.view;
    render();
  });

  // discipline chips
  $disciplineChips.addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    $disciplineChips.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.discipline = btn.dataset.value;
    render();
  });

  // scenario chips
  $scenarioChips.addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    $scenarioChips.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.scenario = btn.dataset.value;
    render();
  });

  // search
  let debounce;
  $search.addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.query = e.target.value.trim();
      render();
    }, 130);
  });

  // sort
  $sort.addEventListener('change', e => {
    state.sort = e.target.value;
    render();
  });

  // theme toggle
  $themeToggle.addEventListener('click', toggleTheme);

  // keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      $search.focus();
      $search.select();
    }
    if (e.key === 'Escape' && !$modal.hidden) closeModal();
  });
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function pad(n) { return String(n).padStart(2, '0'); }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

init();
