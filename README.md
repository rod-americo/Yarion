# Yarion

Aplicativo web de acompanhamento semanal com frontend em JavaScript puro e backend Node.js sem framework, com persistência local em JSON.

## Nome do projeto

**Yarion** vem de **Yara** (minha filha) + **ion** (movimento): a ideia de evolução contínua, semana após semana.

## Funcionalidades

- Autosave em `data/tracker.json`.
- Resumo semanal em cards (2 colunas no desktop).
- Card extra de **Consistência** em tempo real.
- Relatório semanal com exportação para PDF.
- PWA com manifest e ícones.
- API simples para leitura e escrita do estado (`/api/state`).

## Regras de exibição atuais

- Decimal com vírgula (`56,5`).
- Percentual sem casas (`98%`).
- `Academia` sem casas decimais.
- Formato razão sem espaço (`4/4 sessão`).
- Mobile: seletor de semana em `DD/MM/AAAA` com input nativo por trás.
- Relatório: `Semana | seletor | Voltar` na primeira linha e `Exportar PDF` abaixo.

## Stack

- Node.js (HTTP nativo)
- HTML + CSS + JavaScript (vanilla)
- Persistência em arquivo JSON local

## Como executar

### 1) Instalar dependências

```bash
npm install
```

### 2) Iniciar servidor

```bash
npm start
```

### 3) Acessar

- Local: `http://localhost:3080`
- Rede local: `http://<ip-da-maquina>:3080`

## Estrutura do projeto

```text
.
├── data/
│   ├── tracker.example.json
│   └── tracker.json              # ignorado no Git
├── public/
│   ├── icons/
│   ├── app.js
│   ├── index.html
│   ├── report.js
│   ├── report.html
│   ├── site.webmanifest
│   └── styles.css
├── server.js
└── package.json
```

## API

### `GET /api/state`

Retorna o estado completo do acompanhamento.

### `POST /api/state`

Salva o estado completo enviado no body (JSON).

Validação mínima:

- body deve ser objeto
- deve conter `activities` e `weeks`

## Dados e versionamento

- `data/tracker.json`: dados reais locais (não versionado).
- `data/tracker.example.json`: exemplo limpo versionado no repositório.

## Licença

Uso privado.
