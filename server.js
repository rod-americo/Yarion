const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3080;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tracker.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

function getWeekStartISO(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function createDefaultState() {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = getWeekStartISO(today);

  return {
    contract: {
      owner: 'Yara',
      createdAt: today,
      schoolChoice: 'Escola tradicional no Brasil (Único)',
      socialLimitMinutes: 50,
    },
    activities: [
      { id: 'programacao', nome: 'Programação', tipo: 'min_weekly', unidade: 'h', meta: 6, ordem: 1 },
      { id: 'ingles', nome: 'Inglês', tipo: 'min_weekly', unidade: 'h', meta: 3, ordem: 2 },
      { id: 'frances', nome: 'Francês', tipo: 'min_weekly', unidade: 'h', meta: 5.5, ordem: 3 },
      { id: 'sono', nome: 'Sono', tipo: 'min_weekly', unidade: 'h', meta: 56, ordem: 4 },
      { id: 'academia', nome: 'Academia', tipo: 'min_weekly', unidade: 'sessão', meta: 4, ordem: 5 },
      { id: 'ortodontia', nome: 'Invisalign', tipo: 'min_weekly', unidade: 'h', meta: 140, ordem: 6 },
      { id: 'medicina', nome: 'Estudo', tipo: 'min_weekly', unidade: 'h', meta: 20, ordem: 7 },
      { id: 'redes', nome: 'Redes Sociais', tipo: 'max_daily_minutes', unidade: 'min', meta: 50, ordem: 8 },
      { id: 'casa', nome: 'Casa e Gatos', tipo: 'min_weekly', unidade: 'dia', meta: 7, ordem: 9 },
    ],
    weeks: {
      [weekStart]: {
        exception: { ativa: false, motivo: '', reposicao: '' },
        rewards: [],
        measures: [],
        entries: [],
      },
    },
    predefined: {
      rewards: [
        'Atividade social extra no fim de semana',
        'Flexibilização pontual de horário de lazer no sábado',
        'Escolha de atividade em família',
      ],
      measures: [
        'Redução de 15 minutos no teto diário de redes por 7 dias',
        'Suspensão de 1 atividade de lazer digital por 7 dias',
        'Reorganização obrigatória da agenda com prioridade de estudos',
      ],
    },
  };
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(createDefaultState(), null, 2), 'utf-8');
  }
}

function readState() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeState(state) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  res.end(type.includes('application/json') ? JSON.stringify(data) : data);
}

function serveStatic(req, res) {
  let pathname = req.url.split('?')[0];
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(PUBLIC_DIR, pathname);
  const resolved = path.resolve(filePath);

  if (!resolved.startsWith(path.resolve(PUBLIC_DIR))) {
    send(res, 403, { error: 'Acesso negado.' });
    return;
  }

  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    send(res, 404, { error: 'Arquivo não encontrado.' });
    return;
  }

  const ext = path.extname(resolved).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const fileContent = fs.readFileSync(resolved);
  res.writeHead(200, { 'Content-Type': mime });
  res.end(fileContent);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf-8');
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('Payload muito grande.'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url.startsWith('/api/state')) {
      send(res, 200, readState());
      return;
    }

    if (req.method === 'POST' && req.url.startsWith('/api/state')) {
      const payload = await parseJsonBody(req);
      if (!payload || typeof payload !== 'object' || !payload.activities || !payload.weeks) {
        send(res, 400, { error: 'Estrutura de dados inválida.' });
        return;
      }
      writeState(payload);
      send(res, 200, { ok: true });
      return;
    }

    serveStatic(req, res);
  } catch (err) {
    send(res, 500, { error: err.message || 'Erro interno.' });
  }
});

ensureDataFile();
server.listen(PORT, HOST, () => {
  const nets = os.networkInterfaces();
  const localIps = Object.values(nets)
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
  const sampleIp = localIps[0] || 'localhost';
  console.log(`App de acompanhamento rodando em http://localhost:${PORT}`);
  console.log(`Acesso na rede local: http://${sampleIp}:${PORT}`);
});
