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

function parseQuery() {
  const p = new URLSearchParams(window.location.search);
  return p.get('week');
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

function addDays(dateISO, n) {
  const d = parseISODate(dateISO);
  d.setDate(d.getDate() + n);
  return formatLocalDateISO(d);
}

function formatPeriod(weekStart) {
  return `${weekStart} a ${addDays(weekStart, 6)}`;
}

function previousWeek(weekStart) {
  return addDays(weekStart, -7);
}

function entriesByActivity(entries) {
  return entries.reduce((acc, e) => {
    if (!acc[e.activityId]) acc[e.activityId] = [];
    acc[e.activityId].push(e);
    return acc;
  }, {});
}

function computeProgress(activity, entries) {
  const byId = entriesByActivity(entries);
  const items = byId[activity.id] || [];
  const meta = toNumber(activity.meta);

  if (activity.tipo === 'max_daily_minutes') {
    const days = {};
    for (const e of items) days[e.date] = (days[e.date] || 0) + toNumber(e.value);
    const vals = Object.values(days);
    const ok = vals.filter((v) => v <= meta).length;
    const considered = vals.length;
    return {
      percent: considered === 0 ? 0 : (ok / considered) * 100,
      realizedLabel: considered === 0 ? 'Sem registros' : `${ok}/${considered} dias <= ${formatByUnit(meta, 'min')} min`,
      raw: vals,
      total: considered,
    };
  }

  const total = items.reduce((s, e) => s + toNumber(e.value), 0);
  return {
    percent: meta > 0 ? Math.min((total / meta) * 100, 100) : 0,
    realizedLabel: `${formatByUnit(total, activity.unidade, activity.id)} ${activity.unidade}`,
    raw: items,
    total,
  };
}

function scoreFromProgress(progressList) {
  if (!progressList.length) return 0;
  return progressList.reduce((s, p) => s + p.percent, 0) / progressList.length;
}

function scoreStatus(score) {
  if (score >= 85) return 'Meta atingida';
  if (score >= 70) return 'Zona de ajuste';
  return 'Condição de atenção';
}

function trend(current, prev) {
  const delta = current - prev;
  if (Math.abs(delta) < 0.1) return 'Estável';
  return delta > 0 ? `Subiu +${formatPercent(delta)}` : `Caiu ${formatPercent(delta)}`;
}

function itemStatus(percent) {
  if (percent >= 85) return 'OK';
  if (percent >= 70) return 'Ajuste';
  return 'Atenção';
}

async function loadState() {
  const res = await fetch('api/state');
  return res.json();
}

function weekData(state, weekStart) {
  return state.weeks[weekStart] || { exception: { ativa: false, motivo: '', reposicao: '' }, rewards: [], measures: [], entries: [] };
}

function renderCover(state, weekStart, currentProgress) {
  const box = document.getElementById('coverBox');
  const w = weekData(state, weekStart);
  const score = scoreFromProgress(currentProgress.map((x) => x.progress));
  const daysWithEntries = new Set((w.entries || []).map((e) => e.date)).size;
  const consistency = (daysWithEntries / 7) * 100;
  box.innerHTML = `
    <div><strong>Período:</strong> ${formatPeriod(weekStart)}</div>
    <div><strong>Cumprimento geral:</strong> ${formatPercent(score)}</div>
    <div><strong>Status:</strong> ${scoreStatus(score)}</div>
    <div><strong>Exceção:</strong> ${w.exception.ativa ? 'Ativa' : 'Inativa'}</div>
    <div><strong>Consistência semanal:</strong> ${formatPercent(consistency)}</div>
  `;
}

function renderActivityTable(state, weekStart, currentProgress, prevProgressMap) {
  const body = document.getElementById('activityTable');

  body.innerHTML = currentProgress
    .map(({ activity, progress }) => {
      const prev = prevProgressMap[activity.id] || 0;
      return `
      <tr>
        <td>${activity.nome}</td>
        <td>${formatByUnit(activity.meta, activity.unidade, activity.id)} ${activity.unidade}</td>
        <td>${progress.realizedLabel}</td>
        <td>${formatPercent(progress.percent)}</td>
        <td>${trend(progress.percent, prev)}</td>
        <td>${itemStatus(progress.percent)}</td>
      </tr>`;
    })
    .join('');
}

function renderRules(state, weekStart, currentProgress) {
  const box = document.getElementById('rulesBox');
  const w = weekData(state, weekStart);
  const score = scoreFromProgress(currentProgress.map((x) => x.progress));

  const lines = [];
  lines.push(`Cumprimento semanal: ${formatPercent(score)}`);
  lines.push(`Classificação: ${scoreStatus(score)}`);
  lines.push(`Benefícios marcados: ${w.rewards.length ? w.rewards.join(' | ') : 'Nenhum'}`);
  lines.push(`Medidas marcadas: ${w.measures.length ? w.measures.join(' | ') : 'Nenhuma'}`);
  if (w.exception.ativa) {
    lines.push(`Exceção ativa: ${w.exception.motivo || 'Sem motivo registrado'}`);
    lines.push(`Reposição: ${w.exception.reposicao || 'Sem plano de reposição'}`);
  }

  box.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
}

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function renderSpecial(state, weekStart, currentProgress) {
  const box = document.getElementById('specialBox');
  const byId = Object.fromEntries(currentProgress.map((x) => [x.activity.id, x.progress]));
  const activityById = Object.fromEntries(state.activities.map((activity) => [activity.id, activity]));

  const redes = byId.redes;
  const sono = byId.sono;
  const redesMeta = toNumber(activityById.redes?.meta);

  const redesVals = Array.isArray(redes?.raw) ? redes.raw : [];
  const diasAcima = redesVals.filter((v) => v > redesMeta).length;
  const mediaRedes = average(redesVals);

  const sonoItems = Array.isArray(sono?.raw) ? sono.raw : [];
  const sonoVals = sonoItems.map((x) => toNumber(x.value));
  const mediaSono = average(sonoVals);
  const diasSonoAbaixo8 = sonoVals.filter((v) => v < 8).length;

  const lines = [
    `Média de redes sociais: ${formatDecimal(mediaRedes)} min/dia`,
    `Dias acima de ${formatByUnit(redesMeta, 'min', 'redes')} min: ${diasAcima}`,
    `Média de sono: ${formatDecimal(mediaSono)} h/noite`,
    `Dias abaixo de 8h: ${diasSonoAbaixo8}`,
  ];

  box.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
}

function renderEvidence(state, weekStart) {
  const box = document.getElementById('evidenceBox');
  const w = weekData(state, weekStart);
  const entries = [...w.entries].sort((a, b) => a.date.localeCompare(b.date));

  const notes = entries.filter((e) => e.notes && e.notes.trim()).slice(-12);
  const byDay = entries.reduce((acc, e) => {
    acc[e.date] = (acc[e.date] || 0) + 1;
    return acc;
  }, {});

  const lines = [];
  lines.push(`Total de lançamentos: ${entries.length}`);
  lines.push(`Dias com registros: ${Object.keys(byDay).length}`);
  if (notes.length) {
    lines.push('Últimas observações:');
    notes.forEach((n) => lines.push(`${n.date} - ${n.notes}`));
  } else {
    lines.push('Sem observações textuais nesta semana.');
  }

  box.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
}

async function init() {
  let state = await loadState();
  const input = document.getElementById('reportWeek');
  const inputCompact = document.getElementById('reportWeekCompact');
  const printBtn = document.getElementById('printBtn');
  const AUTO_REFRESH_MS = 30_000;

  const requested = parseQuery();
  const weekStart = weekStartFor(requested || formatLocalDateISO(new Date()));
  input.value = weekStart;
  if (inputCompact) inputCompact.value = formatDateBr(weekStart);

  function draw(week) {
    const activities = [...state.activities].sort((a, b) => a.ordem - b.ordem);
    const currentEntries = weekData(state, week).entries;
    const prevEntries = weekData(state, previousWeek(week)).entries;

    const currentProgress = activities.map((activity) => ({
      activity,
      progress: computeProgress(activity, currentEntries),
    }));

    const prevProgressMap = Object.fromEntries(
      activities.map((activity) => [activity.id, computeProgress(activity, prevEntries).percent])
    );

    renderCover(state, week, currentProgress);
    renderActivityTable(state, week, currentProgress, prevProgressMap);
    renderRules(state, week, currentProgress);
    renderSpecial(state, week, currentProgress);
    renderEvidence(state, week);
    window.history.replaceState(null, '', `report.html?week=${week}`);
  }

  async function refreshState() {
    if (document.hidden) return;
    const res = await fetch('api/state');
    if (!res.ok) return;
    const incoming = await res.json();
    if (JSON.stringify(incoming) === JSON.stringify(state)) return;
    state = incoming;
    draw(input.value);
  }

  draw(weekStart);
  setInterval(() => {
    refreshState().catch(() => {});
  }, AUTO_REFRESH_MS);

  input.addEventListener('change', () => {
    const w = weekStartFor(input.value || weekStart);
    input.value = w;
    if (inputCompact) inputCompact.value = formatDateBr(w);
    draw(w);
  });

  printBtn.addEventListener('click', () => window.print());
}

init().catch((err) => {
  const box = document.getElementById('coverBox');
  box.innerHTML = `<div>Erro ao gerar relatório: ${err.message}</div>`;
});
