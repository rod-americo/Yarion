# Yarion

Aplicativo web (JavaScript + Node sem framework) para acompanhamento semanal, com persistência local em JSON.

## Stack

- Backend: Node.js HTTP nativo (`server.js`)
- Frontend: HTML/CSS/JS puro (`public/`)
- Persistência: `data/tracker.json`
- PWA: `public/site.webmanifest` + `public/icons/*`

## Executar localmente

```bash
cd /Users/rodrigo/Yaron
npm start
```

Acesso local:

- `http://localhost:3080`

Acesso na rede local:

- `http://<ip-da-maquina>:3080`

## Estrutura

- `server.js`: servidor HTTP, API e arquivos estáticos.
- `public/index.html`: tela principal.
- `public/app.js`: regras da tela principal (autosave, resumo semanal, consistência, lançamentos).
- `public/report.html`: tela de relatório.
- `public/report.js`: geração de relatório semanal.
- `public/styles.css`: estilos desktop/mobile/print.
- `public/site.webmanifest`: configuração PWA.
- `data/tracker.json`: estado local real (ignorado pelo Git).
- `data/tracker.example.json`: exemplo limpo versionado.

## API

- `GET /api/state`: retorna o JSON completo do estado.
- `POST /api/state`: salva o estado enviado.

Validação mínima no `POST`:

- payload deve ser objeto
- payload deve conter `activities` e `weeks`

## Comportamento atual validado

- Autosave em JSON local.
- Resumo semanal com cards em 2 colunas.
- Card extra `Consistência` em tempo real.
- Formatação numérica:
  - vírgula decimal (`56,5`)
  - percentual sem casas (`98%`)
  - `Academia` sem casas decimais
  - razão no formato `Número/Número` sem espaço (ex.: `4/4 sessão`)
- Mobile:
  - seletor de semana com exibição compacta `DD/MM/AAAA`
  - calendário nativo mantido por trás
- Relatório:
  - topo com `Semana | seletor | Voltar` na primeira linha
  - `Exportar PDF` abaixo
- Servidor em `0.0.0.0:3080`.

## Git

Este repositório não deve versionar dados reais de acompanhamento.

- versionar: `data/tracker.example.json`
- ignorar: `data/tracker.json`
