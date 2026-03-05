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
let saveInFlight = false;
let saveQueued = false;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function weekStartFor(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
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
  const res = await fetch('/api/state');
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

function updateReportLink() {
  reportLink.href = `/report.html?week=${encodeURIComponent(state.weekStart)}`;
}

async function persistState(showAlert = false) {
  if (saveInFlight) {
    saveQueued = true;
    return;
  }

  saveInFlight = true;

  try {
    const res = await fetch('/api/state', {
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
  const activities = [...state.data.activities].sort((a, b) => a.ordem - b.ordem);
  entryActivity.innerHTML = activities
    .map((a) => `<option value="${a.id}">${a.nome} (${a.meta} ${a.unidade})</option>`)
    .join('');
}

function weekData() {
  ensureWeek(state.weekStart);
  return state.data.weeks[state.weekStart];
}

function entriesByActivity(entries) {
  return entries.reduce((acc, e) => {
    if (!acc[e.activityId]) acc[e.activityId] = [];
    acc[e.activityId].push(e);
    return acc;
  }, {});
}

function toNumber(v) {
  return Number.parseFloat(v) || 0;
}

function formatDecimal(value, decimals = 1) {
  return Number(value).toFixed(decimals).replace('.', ',');
}

function formatPercent(value) {
  return `${Math.round(Number(value) || 0)}%`;
}

function formatByUnit(value, unit) {
  const decimals = unit === 'sessão' || unit === 'dia' ? 0 : 1;
  return formatDecimal(value, decimals);
}

function computeActivityProgress(activity, entries) {
  const byId = entriesByActivity(entries);
  const items = byId[activity.id] || [];
  const total = items.reduce((sum, e) => sum + toNumber(e.value), 0);

  if (activity.tipo === 'max_daily_minutes') {
    const days = {};
    for (const e of items) {
      days[e.date] = (days[e.date] || 0) + toNumber(e.value);
    }
    const dayValues = Object.values(days);
    const compliant = dayValues.filter((v) => v <= activity.meta).length;
    const considered = dayValues.length || 0;
    const percent = considered === 0 ? 0 : Math.min((compliant / considered) * 100, 100);
    return {
      total: considered ? `${compliant}/${considered} dias <= ${activity.meta} min` : 'Sem registros na semana',
      percent,
    };
  }

  const percent = activity.meta > 0 ? Math.min((total / activity.meta) * 100, 100) : 0;
  return {
    total: `${formatByUnit(total, activity.unidade)}/${formatByUnit(activity.meta, activity.unidade)} ${activity.unidade}`,
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

function renderEntries(entries) {
  if (!entries.length) {
    entriesTable.innerHTML = '<tr><td colspan="5">Sem entradas nesta semana.</td></tr>';
    return;
  }

  const activityName = Object.fromEntries(state.data.activities.map((a) => [a.id, a.nome]));
  entriesTable.innerHTML = entries
    .map(
      (e, idx) => `
      <tr>
        <td>${e.date}</td>
        <td>${activityName[e.activityId] || e.activityId}</td>
        <td>${e.value}</td>
        <td>${e.notes || ''}</td>
        <td><button class="remove-btn" data-remove="${idx}">Remover</button></td>
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
  const entries = [...w.entries].sort((a, b) => a.date.localeCompare(b.date));
  renderSummary(entries);
  renderEntries(entries);
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

entryForm.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const w = weekData();
  w.entries.push({
    date: entryDate.value,
    activityId: entryActivity.value,
    value: toNumber(entryValue.value),
    notes: entryNotes.value.trim(),
  });
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
