# Yarion

Aplicativo web de acompanhamento semanal com frontend em JavaScript puro e backend Python sem framework. A persistência local do app é feita em SQLite.

## Nome do projeto

**Yarion** vem de **Yara** (minha filha) + **ion** (movimento): a ideia de evolução contínua, semana após semana.

## Funcionalidades

- Autosave em `data/tracker.db`.
- Atualização automática dos dados a cada 30 segundos no painel e no relatório.
- Resumo semanal em cards (2 colunas no desktop).
- Card extra de **Consistência** em tempo real.
- Relatório semanal com exportação para PDF.
- Múltiplas entradas por atividade no mesmo dia e na mesma semana.
- PWA com manifest e ícones.
- API simples para leitura e escrita do estado em `/api/state`.

## Regras de exibição atuais

- Decimal com vírgula (`56,5`).
- Percentual sem casas (`98%`).
- `Academia` sem casas decimais.
- Formato razão sem espaço (`4/4 sessão`).
- Mobile: seletor de semana em `DD/MM/AAAA` com input nativo por trás.
- Relatório: `Semana | seletor | Voltar` na primeira linha e `Exportar PDF` abaixo.

## Stack

- Python 3 (HTTP nativo)
- SQLite3
- HTML + CSS + JavaScript (vanilla)
- Persistência local em SQLite

## Como executar

### 1) Iniciar servidor

```bash
python3 app.py
```

Por padrão, o servidor sobe em `0.0.0.0:3080`.

### 2) Acessar

- Local: `http://localhost:3080`
- Rede local: `http://<ip-da-maquina>:3080`

## Persistência

- O banco principal do app é `data/tracker.db`.
- Toda leitura e escrita do estado da aplicação passa pelo backend Python e é persistida no SQLite.
- Os arquivos `data/tracker.db-shm` e `data/tracker.db-wal` podem aparecer localmente como artefatos normais do SQLite.

## Estrutura principal

```text
.
├── app.py
├── data/
│   ├── tracker.db                # ignorado no Git
│   └── tracker.example.json
├── public/
│   ├── icons/
│   ├── app.js
│   ├── index.html
│   ├── report.js
│   ├── report.html
│   ├── site.webmanifest
│   └── styles.css
├── LICENSE
└── README.md
```

## API

### `GET /api/state`

Retorna o estado completo do acompanhamento.

### `POST /api/state`

Recebe o estado completo da aplicação e persiste esse estado no SQLite.

Validação mínima:

- body deve ser objeto
- deve conter `activities` e `weeks`

## Licença

Este projeto está licenciado sob a Licença MIT. Consulte o arquivo [LICENSE](./LICENSE) para mais detalhes.
