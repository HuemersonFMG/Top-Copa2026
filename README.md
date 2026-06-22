# 🏆 Top Copa 2026

>Projeto Estácio - Aplicando conhecimentos do Curso - Api Copa 2026 densenvolvida para a emprsa Top Cestas de Alimentos - Cortesia.
> Sistema web desenvolvido em **Node.js** para acompanhamento da Copa do Mundo FIFA 2026, exibindo classificação dos grupos, jogos, placares em tempo real, próximos confrontos do Brasil e atualização automática através da API Football-Data.org.

---

# 📖 Visão Geral

O **Top Copa 2026** é uma aplicação Web responsiva desenvolvida para acompanhar toda a fase de grupos da Copa do Mundo FIFA 2026.

O sistema apresenta:

* Classificação completa dos 12 grupos;
* Jogos de cada grupo;
* Próximo jogo da Seleção Brasileira;
* Placar em tempo real;
* Atualização automática dos resultados;
* Interface moderna e responsiva.

Todo o processamento ocorre no servidor Node.js, enquanto o navegador apenas consome a API interna do projeto.

---

# ⚽ Funcionalidades

## 📊 Classificação dos grupos

* 12 grupos (A até L)
* Pontuação
* Jogos
* Vitórias
* Empates
* Derrotas
* Saldo de gols
* Ordenação automática

---

## 🏟 Jogos da Copa

Exibição de todos os jogos da fase de grupos.

Cada partida apresenta:

* Data
* Hora (Horário de Brasília)
* Seleções
* Bandeiras
* Placar
* Status

---

## 🇧🇷 Área exclusiva do Brasil

O sistema destaca automaticamente:

* Próximo jogo da Seleção Brasileira
* Contagem regressiva
* Placar
* Resultado
* GIF animado
* Barra de progresso da campanha

---

## 🔄 Atualização automática

A aplicação consulta periodicamente a API Football-Data.org.

Os dados atualizados são gravados em cache local, reduzindo o número de consultas externas e tornando a navegação muito mais rápida.

---

## 📱 Layout Responsivo

Compatível com:

* Desktop
* Notebook
* Tablet
* Smartphone

---

## ⚡ Cache Local

Os dados oficiais são armazenados em:

```
cache/copa.json
```

Assim o site continua rápido mesmo quando milhares de usuários acessam simultaneamente.

---

# 📸 Capturas de Tela

## Página Inicial

```
/docs/images/home.png
```

---

## Classificação dos Grupos

```
/docs/images/grupos.png
```

---

## Próximo Jogo do Brasil

```
/docs/images/brasil.png
```

---

## Responsivo

```
/docs/images/mobile.png
```

*(As imagens podem ser adicionadas futuramente na pasta `docs/images`.)*

---

# 🚀 Como instalar

## Clonar o projeto

```bash
git clone https://github.com/HuemersonFMG/Top-Copa2026.git
```

Entrar na pasta

```bash
cd Top-Copa2026
```

Instalar dependências

```bash
npm install
```

Criar arquivo `.env`

```env
PORT=5051

NODE_ENV=production

FOOTBALL_API_KEY=SUA_CHAVE

FOOTBALL_API_BASE=https://api.football-data.org/v4
```

Executar

```bash
npm start
```

O sistema ficará disponível em:

```
http://localhost:5051
```

---

# 🌐 Publicação em Produção

Servidor utilizado:

* Node.js
* Express
* PM2
* Cloudflare Tunnel
* Domínio personalizado

Inicialização:

```bash
pm2 start server.js --name Copa2026
```

Salvar configuração

```bash
pm2 save
```

Reiniciar

```bash
pm2 restart Copa2026
```

Logs

```bash
pm2 logs Copa2026
```

---

# 🔄 Atualização Automática da API

O projeto utiliza a API oficial:

https://www.football-data.org/

Fluxo:

```
Football-Data.org

↓

footballAPI.js

↓

Cache (copa.json)

↓

API Interna

↓

Front-End
```

A cada 5 minutos o servidor:

1. Consulta a API Football-Data;
2. Processa os jogos;
3. Calcula classificação;
4. Atualiza o cache;
5. O site passa a exibir os novos dados automaticamente.

Caso a API esteja indisponível, o sistema utiliza o último cache salvo.

---

# 🛠 Tecnologias Utilizadas

## Back-end

* Node.js
* Express
* Axios
* Dotenv
* CORS
* PM2

---

## Front-end

* HTML5
* CSS3
* JavaScript ES6

---

## Hospedagem

* Oracle Cloud
* Cloudflare Tunnel

---

## API Externa

Football-Data.org

---

## Versionamento

Git

GitHub

---

# 📁 Estrutura das Pastas

```
Top-Copa2026
│
├── cache
│
├── config
│
├── logs
│
├── public
│   ├── css
│   ├── img
│   ├── js
│   └── Copa2026.html
│
├── routes
│   └── copa.js
│
├── services
│   └── footballAPI.js
│
├── package.json
├── package-lock.json
├── server.js
└── .env
```

---

# 📜 Histórico de Versões

## Versão 1.0

* Estrutura inicial
* API própria
* Classificação dos grupos
* Próximo jogo do Brasil
* Cache local

---

## Versão 1.1

* Integração Football-Data.org
* Atualização automática
* Horário dos jogos
* Layout responsivo

---

## Versão 1.2

* Cloudflare Tunnel
* Domínio próprio
* Cache inteligente
* Melhorias de desempenho

---

# 🔐 Licença

Projeto desenvolvido para fins de estudo, demonstração técnica e acompanhamento da Copa do Mundo FIFA 2026.

O uso da API Football-Data.org está sujeito aos termos de utilização do respectivo fornecedor.

---

# 👨‍💻 Autor

**Huemerson Ferreira Gonçalves**

GitHub:

https://github.com/HuemersonFMG

---

## ⭐ Se este projeto foi útil

Considere deixar uma ⭐ no repositório para apoiar o desenvolvimento.
