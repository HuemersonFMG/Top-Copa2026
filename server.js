require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const copaRoutes = require("./routes/copa");
const { atualizarDadosDaCopa } = require("./services/footballAPI");

const app = express();

const PORT = Number(process.env.PORT) || 5051;

const LOG_DIR = path.join(__dirname, "logs");
const LOG_ACCESS = path.join(LOG_DIR, "access.log");
const LOG_ERROR = path.join(LOG_DIR, "error.log");

const PUBLIC_DIR = path.join(__dirname, "public");
const HTML_COPA = path.join(PUBLIC_DIR, "Copa2026.html");

const TEMPO_ATUALIZACAO_API = 1 * 60 * 1000;

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

function gravarLog(arquivo, mensagem) {
    const linha = `[${new Date().toLocaleString("pt-BR")}] ${mensagem}\n`;

    fs.appendFile(arquivo, linha, err => {
        if (err) {
            console.error("Erro ao gravar log:", err.message);
        }
    });
}

app.use((req, res, next) => {
    gravarLog(LOG_ACCESS, `${req.method} ${req.originalUrl} - IP: ${req.ip}`);
    next();
});

app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
    res.sendFile(HTML_COPA);
});

app.get("/Copa2026.html", (req, res) => {
    res.sendFile(HTML_COPA);
});

app.use("/api/copa", copaRoutes);

app.get("/api/status", (req, res) => {
    res.json({
        online: true,
        projeto: "Site Copa 2026 - Top Cestas",
        porta: PORT,
        dataHora: new Date().toLocaleString("pt-BR")
    });
});

async function atualizarCopaAutomaticamente() {
    try {
        console.log(`[${new Date().toLocaleString("pt-BR")}] Atualizando dados da Copa...`);

        const dados = await atualizarDadosDaCopa();

        console.log(
            `[${new Date().toLocaleString("pt-BR")}] Copa atualizada com sucesso. Grupos: ${
                Array.isArray(dados.grupos) ? dados.grupos.length : 0
            }`
        );

    } catch (erro) {
        const mensagem = `Falha na atualização automática da Copa: ${erro.message}`;

        console.error(`[${new Date().toLocaleString("pt-BR")}] ${mensagem}`);
        gravarLog(LOG_ERROR, mensagem);
    }
}

setTimeout(() => {
    atualizarCopaAutomaticamente();
}, 3000);

setInterval(() => {
    atualizarCopaAutomaticamente();
}, TEMPO_ATUALIZACAO_API);

app.use((req, res) => {
    res.status(404).json({
        erro: true,
        mensagem: "Rota não encontrada.",
        rota: req.originalUrl
    });
});

app.use((err, req, res, next) => {
    console.error("Erro interno:", err);

    gravarLog(LOG_ERROR, `${req.method} ${req.originalUrl} - ${err.message}`);

    res.status(500).json({
        erro: true,
        mensagem: "Erro interno no servidor."
    });
});

app.listen(PORT, () => {
    console.log(`Site Copa 2026 rodando em http://localhost:${PORT}`);
    console.log(`Página principal: http://localhost:${PORT}`);
    console.log(`Página direta: http://localhost:${PORT}/Copa2026.html`);
    console.log(`API status: http://localhost:${PORT}/api/status`);
    console.log(`API Copa: http://localhost:${PORT}/api/copa/status`);
    console.log(`Atualização automática: a cada ${TEMPO_ATUALIZACAO_API / 60000} minutos`);
});