const state = { data: null, weekStart: null };

const weekInput = document.getElementById('weekStart');
const weekInputCompact = document.getElementById('weekStartCompact');
const reportLink = document.getElementById('reportLink');
const summaryList = document.getElementById('summaryList');
const statusCard = document.getElementById('statusCard');
const entryForm = document.getElementById('entryForm');
const exceptionForm = document.getElementById('exceptionForm');
const entriesTable = document.getElementById('entriesTable');
const actionsBox = document.getElementById('actionsBox');

const entryDate = document.getElementById('entryDate');
const entryActivity = document.getElementById('entryActivity');
const entryValue = document.getElementById('entryValue');
const entryNotes = document.getElementById('entryNotes');

const exceptionActive = document.getElementById('exceptionActive');
const exceptionReason = document.getElementById('exceptionReason');
const exceptionRecovery = document.getElementById('exceptionRecovery');
let autosaveTimer = null;
let refreshTimer = null;
let saveInFlight = false;
let saveQueued = false;
const AUTO_REFRESH_MS = 30_000;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatLocalDateISO(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseISODate(dateStr) {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function today() {
  return formatLocalDateISO(new Date());
}

function weekStartFor(dateStr) {
  const d = parseISODate(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatLocalDateISO(d);
}

function formatDateBr(isoDate) {
  if (!isoDate || !isoDate.includes('-')) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function syncWeekDisplay() {
  if (!weekInputCompact) return;
  weekInputCompact.value = formatDateBr(weekInput.value);
}

async function loadState() {
  const res = await fetch('api/state');
  state.data = await res.json();
  state.weekStart = weekStartFor(today());
  weekInput.value = state.weekStart;
  syncWeekDisplay();
  entryDate.value = today();
  ensureWeek(state.weekStart);
  updateReportLink();
  fillActivityOptions();
  render();
}

function hasActiveFormInteraction() {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
}

async function refreshStateFromServer() {
  if (saveInFlight || saveQueued || hasActiveFormInteraction()) return;

  const res = await fetch('api/state');
  if (!res.ok) return;

  const incoming = await res.json();
  const currentSerialized = JSON.stringify(state.data);
  const incomingSerialized = JSON.stringify(incoming);
  if (currentSerialized === incomingSerialized) return;

  const currentWeek = state.weekStart;
  if (!currentWeek) return;
  state.data = incoming;
  ensureWeek(currentWeek);
  render();
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    refreshStateFromServer().catch(() => {});
  }, AUTO_REFRESH_MS);
}

function updateReportLink() {
  reportLink.href = `report.html?week=${encodeURIComponent(state.weekStart)}`;
}

async function persistState(showAlert = false) {
  if (saveInFlight) {
    saveQueued = true;
    return;
  }

  saveInFlight = true;

  try {
    const res = await fetch('api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.data),
    });

    if (!res.ok) throw new Error('Falha ao salvar JSON.');
    if (showAlert) alert('Dados salvos em data/tracker.json');
  } catch (err) {
    if (showAlert) alert(err.message);
  } finally {
    saveInFlight = false;
    if (saveQueued) {
      saveQueued = false;
      persistState(false);
    }
  }
}

function scheduleAutoSave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => persistState(false), 700);
}

function ensureWeek(weekStart) {
  if (!state.data.weeks[weekStart]) {
    state.data.weeks[weekStart] = {
      exception: { ativa: false, motivo: '', reposicao: '' },
      rewards: [],
      measures: [],
      entries: [],
    };
  }
}

function fillActivityOptions() {
  const previousSelection = entryActivity.value;
  const activities = [...state.data.activities].sort((a, b) => a.ordem - b.ordem);
  entryActivity.innerHTML = activities
    .map((a) => `<option value="${a.id}">${a.nome} (${formatByUnit(a.meta, a.unidade, a.id)} ${a.unidade})</option>`)
    .join('');
  entryActivity.value = previousSelection;
  if (!entryActivity.value && activities[0]) {
    entryActivity.value = activities[0].id;
  }
}

function weekData() {
  ensureWeek(state.weekStart);
  return state.data.weeks[state.weekStart];
}

function sortEntriesWithSourceIndexes(entries) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.date.localeCompare(b.entry.date) || a.index - b.index);
}

function entriesByActivity(entries) {
  return entries.reduce((acc, e) => {
    if (!acc[e.activityId]) acc[e.activityId] = [];
    acc[e.activityId].push(e);
    return acc;
  }, {});
}

function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;

  const raw = String(v ?? '').trim();
  if (!raw) return 0;

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');

  let normalized = raw;
  if (lastComma > lastDot) {
    const intPart = raw.slice(0, lastComma).replace(/[.,\s]/g, '');
    const fracPart = raw.slice(lastComma + 1).replace(/[^\d]/g, '');
    normalized = `${intPart}.${fracPart}`;
  } else if (lastDot > lastComma) {
    const intPart = raw.slice(0, lastDot).replace(/[,\s]/g, '');
    const fracPart = raw.slice(lastDot + 1).replace(/[^\d]/g, '');
    normalized = `${intPart}.${fracPart}`;
  }

  const parsed = Number.parseFloat(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDecimal(value, decimals = 1) {
  return toNumber(value).toFixed(decimals).replace('.', ',');
}

function formatPercent(value) {
  return `${Math.round(Number(value) || 0)}%`;
}

function formatByUnit(value, unit, activityId = '') {
  const decimals = activityId === 'ortodontia' || unit === 'sessão' || unit === 'dia' ? 0 : 1;
  return formatDecimal(value, decimals);
}

function normalizeDecimalInput(raw) {
  const clean = String(raw ?? '').replace(/[^\d,.-]/g, '').replace(/\./g, ',');
  const firstComma = clean.indexOf(',');
  if (firstComma < 0) return clean;
  return `${clean.slice(0, firstComma + 1)}${clean.slice(firstComma + 1).replace(/,/g, '')}`;
}

function computeActivityProgress(activity, entries) {
  const byId = entriesByActivity(entries);
  const items = byId[activity.id] || [];
  const meta = toNumber(activity.meta);
  const total = items.reduce((sum, e) => sum + toNumber(e.value), 0);

  if (activity.tipo === 'max_daily_minutes') {
    const days = {};
    for (const e of items) {
      days[e.date] = (days[e.date] || 0) + toNumber(e.value);
    }
    const dayValues = Object.values(days);
    const compliant = dayValues.filter((v) => v <= meta).length;
    const considered = dayValues.length || 0;
    const percent = considered === 0 ? 0 : Math.min((compliant / considered) * 100, 100);
    return {
      total: considered ? `${compliant}/${considered} dias <= ${formatByUnit(meta, 'min')} min` : 'Sem registros na semana',
      percent,
    };
  }

  const percent = meta > 0 ? Math.min((total / meta) * 100, 100) : 0;
  return {
    total: `${formatByUnit(total, activity.unidade, activity.id)}/${formatByUnit(meta, activity.unidade, activity.id)} ${activity.unidade}`,
    percent,
  };
}

function weekScore(progressItems) {
  if (!progressItems.length) return 0;
  return progressItems.reduce((sum, p) => sum + p.percent, 0) / progressItems.length;
}

function computeConsistency(entries) {
  const daysWithEntries = new Set((entries || []).map((e) => e.date)).size;
  const percent = Math.min((daysWithEntries / 7) * 100, 100);
  return {
    percent,
    total: `${daysWithEntries}/7 dias com registros`,
  };
}

function statusFor(score) {
  if (score >= 85) return { cls: 'ok', text: `Cumprimento semanal: ${formatPercent(score)} (Meta atingida)` };
  if (score >= 70) return { cls: 'warn', text: `Cumprimento semanal: ${formatPercent(score)} (Zona de ajuste)` };
  return { cls: 'bad', text: `Cumprimento semanal: ${formatPercent(score)} (Condição de atenção)` };
}

function renderSummary(entries) {
  const activities = [...state.data.activities].sort((a, b) => a.ordem - b.ordem);
  const progressItems = activities.map((a) => ({ a, progress: computeActivityProgress(a, entries) }));
  const consistency = computeConsistency(entries);
  const score = weekScore(progressItems.map((x) => x.progress));
  const s = statusFor(score);

  statusCard.className = `status-card ${s.cls}`;
  statusCard.textContent = s.text;

  summaryList.innerHTML = progressItems
    .map(({ a, progress }) => {
      const width = Math.max(0, Math.min(progress.percent, 100));
      return `
      <div class="summary-item">
        <div class="row"><strong>${a.nome}</strong><span>${formatPercent(progress.percent)}</span></div>
        <div class="row"><small>${progress.total}</small></div>
        <div class="progress"><span style="width:${width}%"></span></div>
      </div>`;
    })
    .join('') +
    `
      <div class="summary-item">
        <div class="row"><strong>Consistência</strong><span>${formatPercent(consistency.percent)}</span></div>
        <div class="row"><small>${consistency.total}</small></div>
        <div class="progress"><span style="width:${consistency.percent}%"></span></div>
      </div>
    `;
}

function renderEntries(entryRows) {
  if (!entryRows.length) {
    entriesTable.innerHTML = '<tr><td colspan="5">Sem entradas nesta semana.</td></tr>';
    return;
  }

  const activityById = Object.fromEntries(state.data.activities.map((a) => [a.id, a]));
  entriesTable.innerHTML = entryRows
    .map(
      ({ entry, index }) => `
      <tr>
        <td>${entry.date}</td>
        <td>${activityById[entry.activityId]?.nome || entry.activityId}</td>
        <td>${formatByUnit(entry.value, activityById[entry.activityId]?.unidade || '', entry.activityId)}</td>
        <td>${entry.notes || ''}</td>
        <td><button class="remove-btn" data-remove="${index}">Remover</button></td>
      </tr>`
    )
    .join('');

  document.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.getAttribute('data-remove'));
      weekData().entries.splice(i, 1);
      render();
      scheduleAutoSave();
    });
  });
}

function renderException(w) {
  exceptionActive.checked = !!w.exception?.ativa;
  exceptionReason.value = w.exception?.motivo || '';
  exceptionRecovery.value = w.exception?.reposicao || '';
}

function renderActions(w) {
  const rewards = state.data.predefined.rewards || [];
  const measures = state.data.predefined.measures || [];

  actionsBox.innerHTML = `
    <div class="actions-grid">
      <div class="action-list">
        <h3>Benefícios pré-definidos</h3>
        ${rewards
          .map(
            (r, i) =>
              `<label><input type="checkbox" data-kind="reward" data-value="${i}" ${
                w.rewards.includes(r) ? 'checked' : ''
              } />${r}</label>`
          )
          .join('')}
      </div>
      <div class="action-list">
        <h3>Medidas temporárias</h3>
        ${measures
          .map(
            (m, i) =>
              `<label><input type="checkbox" data-kind="measure" data-value="${i}" ${
                w.measures.includes(m) ? 'checked' : ''
              } />${m}</label>`
          )
          .join('')}
      </div>
    </div>`;

  document.querySelectorAll('[data-kind]').forEach((el) => {
    el.addEventListener('change', () => {
      const kind = el.getAttribute('data-kind');
      const idx = Number(el.getAttribute('data-value'));
      const value = kind === 'reward' ? rewards[idx] : measures[idx];
      const arr = kind === 'reward' ? w.rewards : w.measures;
      if (el.checked && !arr.includes(value)) arr.push(value);
      if (!el.checked) {
        const i = arr.indexOf(value);
        if (i >= 0) arr.splice(i, 1);
      }
      scheduleAutoSave();
    });
  });
}

function render() {
  const w = weekData();
  const entryRows = sortEntriesWithSourceIndexes(w.entries);
  const entries = entryRows.map(({ entry }) => entry);
  fillActivityOptions();
  renderSummary(entries);
  renderEntries(entryRows);
  renderException(w);
  renderActions(w);
}

weekInput.addEventListener('change', () => {
  const normalizedWeekStart = weekStartFor(weekInput.value || today());
  weekInput.value = normalizedWeekStart;
  syncWeekDisplay();
  state.weekStart = normalizedWeekStart;
  ensureWeek(state.weekStart);
  updateReportLink();
  render();
  scheduleAutoSave();
});

entryValue.addEventListener('input', () => {
  const normalized = normalizeDecimalInput(entryValue.value);
  if (normalized !== entryValue.value) entryValue.value = normalized;
});

entryForm.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const parsedValue = toNumber(entryValue.value);
  const w = weekData();
  w.entries.push({
    date: entryDate.value,
    activityId: entryActivity.value,
    value: parsedValue,
    notes: entryNotes.value.trim(),
  });

  entryDate.value = today();
  entryValue.value = '';
  entryNotes.value = '';
  render();
  scheduleAutoSave();
});

exceptionForm.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const w = weekData();
  w.exception = {
    ativa: exceptionActive.checked,
    motivo: exceptionReason.value.trim(),
    reposicao: exceptionRecovery.value.trim(),
  };
  render();
  scheduleAutoSave();
});

loadState().catch((err) => {
  statusCard.className = 'status-card bad';
  statusCard.textContent = `Erro ao carregar: ${err.message}`;
});
startAutoRefresh();
