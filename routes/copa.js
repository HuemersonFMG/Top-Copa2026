const express = require("express");

const router = express.Router();

const {
    atualizarDadosDaCopa,
    lerCache
} = require("../services/footballAPI");

/*
    routes/copa.js
    Rotas internas do site Copa 2026

    Base no server.js:
    app.use("/api/copa", copaRoutes);

    Endpoints:
    GET  /api/copa/status
    GET  /api/copa/home
    POST /api/copa/atualizar
*/

let ultimaAtualizacaoManual = null;

/* =========================
   STATUS DA API
========================= */

router.get("/status", (req, res) => {
    res.json({
        online: true,
        rota: "/api/copa/status",
        mensagem: "API da Copa 2026 funcionando.",
        dataHora: new Date().toISOString(),
        cache: obterResumoCache()
    });
});

/* =========================
   HOME / DADOS PRINCIPAIS
========================= */

router.get("/home", (req, res) => {
    try {
        const dados = obterDadosParaTela();

        res.json(dados);

    } catch (erro) {
        console.error("Erro ao carregar /api/copa/home:", erro);

        res.status(500).json({
            erro: true,
            mensagem: "Não foi possível carregar os dados da Copa."
        });
    }
});

/* =========================
   ATUALIZAÇÃO MANUAL
   Chama API externa e atualiza o cache
========================= */

router.post("/atualizar", async (req, res) => {
    try {
        ultimaAtualizacaoManual = new Date();

        const dados = await atualizarDadosDaCopa();

        res.json({
            sucesso: true,
            mensagem: "Dados atualizados com sucesso pela API externa.",
            atualizadoEm: ultimaAtualizacaoManual.toISOString(),
            fonte: dados.fonte || "football-data.org",
            totalGrupos: Array.isArray(dados.grupos) ? dados.grupos.length : 0,
            dados
        });

    } catch (erro) {
        console.error("Erro ao atualizar dados da Copa pela API externa:", erro.message);

        const fallback = obterDadosParaTela();

        res.status(200).json({
            sucesso: false,
            mensagem: "Não foi possível atualizar pela API externa. Mantendo dados atuais.",
            erro: erro.message,
            atualizadoEm: new Date().toISOString(),
            dados: fallback
        });
    }
});

/* =========================
   OBTÉM DADOS PARA A TELA
========================= */

function obterDadosParaTela() {
    try {
        const cache = lerCache();

        if (
            cache &&
            Array.isArray(cache.grupos) &&
            cache.grupos.length > 0
        ) {
            return {
                ...cache,
                origem: cache.fonte || "cache"
            };
        }

        return montarDadosFallback();

    } catch (erro) {
        console.error("Erro ao ler cache, usando fallback:", erro.message);
        return montarDadosFallback();
    }
}

function obterResumoCache() {
    try {
        const cache = lerCache();

        return {
            existe: !!cache,
            atualizadoEm: cache?.atualizadoEm || null,
            fonte: cache?.fonte || null,
            totalGrupos: Array.isArray(cache?.grupos) ? cache.grupos.length : 0
        };

    } catch (erro) {
        return {
            existe: false,
            erro: erro.message
        };
    }
}

/* =========================
   FALLBACK MANUAL
   Usado caso a API externa/cache falhem
========================= */

function montarDadosFallback() {
    return {
        atualizadoEm: (ultimaAtualizacaoManual || new Date()).toISOString(),
        fonte: "fallback manual",
        origem: "fallback",
        grupos: [
            criarGrupoA(),
            criarGrupoB(),
            criarGrupoC(),

            criarGrupoPadrao("D", [
                ["🇺🇸", "Estados Unidos"],
                ["🇵🇾", "Paraguai"],
                ["🇦🇺", "Austrália"],
                ["🇹🇷", "Turquia"]
            ]),

            criarGrupoPadrao("E", [
                ["🇩🇪", "Alemanha"],
                ["🇨🇼", "Curaçao"],
                ["🇨🇮", "Costa do Marfim"],
                ["🇪🇨", "Equador"]
            ]),

            criarGrupoPadrao("F", [
                ["🇳🇱", "Holanda"],
                ["🇯🇵", "Japão"],
                ["🇸🇪", "Suécia"],
                ["🇹🇳", "Tunísia"]
            ]),

            criarGrupoPadrao("G", [
                ["🇧🇪", "Bélgica"],
                ["🇪🇬", "Egito"],
                ["🇮🇷", "Irã"],
                ["🇳🇿", "Nova Zelândia"]
            ]),

            criarGrupoPadrao("H", [
                ["🇪🇸", "Espanha"],
                ["🇨🇻", "Cabo Verde"],
                ["🇸🇦", "Arábia Saudita"],
                ["🇺🇾", "Uruguai"]
            ]),

            criarGrupoPadrao("I", [
                ["🇫🇷", "França"],
                ["🇸🇳", "Senegal"],
                ["🇮🇶", "Iraque"],
                ["🇳🇴", "Noruega"]
            ]),

            criarGrupoPadrao("J", [
                ["🇦🇷", "Argentina"],
                ["🇩🇿", "Argélia"],
                ["🇦🇹", "Áustria"],
                ["🇯🇴", "Jordânia"]
            ]),

            criarGrupoPadrao("K", [
                ["🇵🇹", "Portugal"],
                ["🇨🇩", "RD Congo"],
                ["🇺🇿", "Uzbequistão"],
                ["🇨🇴", "Colômbia"]
            ]),

            criarGrupoPadrao("L", [
                ["🏴", "Inglaterra"],
                ["🇭🇷", "Croácia"],
                ["🇬🇭", "Gana"],
                ["🇵🇦", "Panamá"]
            ])
        ]
    };
}

/* =========================
   GRUPOS COM RESULTADOS FALLBACK
========================= */

function criarGrupoA() {
    return criarGrupo(
        "A",
        [
            criarTime("🇲🇽", "México", 2, 2, 0, 0, 6, 3),
            criarTime("🇰🇷", "Coreia do Sul", 2, 1, 0, 1, 3, 0),
            criarTime("🇨🇿", "Tchéquia", 2, 0, 1, 1, 1, -1),
            criarTime("🇿🇦", "África do Sul", 2, 0, 1, 1, 1, -2)
        ],
        [
            criarJogo("11/06", "2026-06-11T16:00:00-03:00", "México", "África do Sul", "🇲🇽", "🇿🇦", 2, 0, "Finalizado"),
            criarJogo("11/06", "2026-06-11T23:00:00-03:00", "Coreia do Sul", "Tchéquia", "🇰🇷", "🇨🇿", 2, 1, "Finalizado"),
            criarJogo("18/06", "2026-06-18T13:00:00-03:00", "Tchéquia", "África do Sul", "🇨🇿", "🇿🇦", 1, 1, "Finalizado"),
            criarJogo("18/06", "2026-06-18T22:00:00-03:00", "México", "Coreia do Sul", "🇲🇽", "🇰🇷", 1, 0, "Finalizado"),
            criarJogo("24/06", "2026-06-24T22:00:00-03:00", "Tchéquia", "México", "🇨🇿", "🇲🇽", null, null, "Agendado"),
            criarJogo("24/06", "2026-06-24T22:00:00-03:00", "África do Sul", "Coreia do Sul", "🇿🇦", "🇰🇷", null, null, "Agendado")
        ]
    );
}

function criarGrupoB() {
    return criarGrupo(
        "B",
        [
            criarTime("🇨🇦", "Canadá", 2, 1, 1, 0, 4, 6),
            criarTime("🇨🇭", "Suíça", 2, 1, 1, 0, 4, 3),
            criarTime("🇧🇦", "Bósnia", 2, 0, 1, 1, 1, -3),
            criarTime("🇶🇦", "Catar", 2, 0, 1, 1, 1, -6)
        ],
        [
            criarJogo("12/06", "2026-06-12T16:00:00-03:00", "Canadá", "Bósnia", "🇨🇦", "🇧🇦", 1, 1, "Finalizado"),
            criarJogo("13/06", "2026-06-13T16:00:00-03:00", "Catar", "Suíça", "🇶🇦", "🇨🇭", 1, 1, "Finalizado"),
            criarJogo("18/06", "2026-06-18T16:00:00-03:00", "Suíça", "Bósnia", "🇨🇭", "🇧🇦", 4, 1, "Finalizado"),
            criarJogo("18/06", "2026-06-18T19:00:00-03:00", "Canadá", "Catar", "🇨🇦", "🇶🇦", 6, 0, "Finalizado"),
            criarJogo("24/06", "2026-06-24T16:00:00-03:00", "Suíça", "Canadá", "🇨🇭", "🇨🇦", null, null, "Agendado"),
            criarJogo("24/06", "2026-06-24T16:00:00-03:00", "Bósnia", "Catar", "🇧🇦", "🇶🇦", null, null, "Agendado")
        ]
    );
}

function criarGrupoC() {
    return criarGrupo(
        "C",
        [
            criarTime("🇧🇷", "Brasil", 2, 1, 1, 0, 4, 3),
            criarTime("🇲🇦", "Marrocos", 2, 1, 1, 0, 4, 1),
            criarTime("🏴", "Escócia", 2, 1, 0, 1, 3, 0),
            criarTime("🇭🇹", "Haiti", 2, 0, 0, 2, 0, -4)
        ],
        [
            criarJogo("13/06", "2026-06-13T19:00:00-03:00", "Brasil", "Marrocos", "🇧🇷", "🇲🇦", 1, 1, "Finalizado"),
            criarJogo("13/06", "2026-06-13T22:00:00-03:00", "Haiti", "Escócia", "🇭🇹", "🏴", 0, 1, "Finalizado"),
            criarJogo("19/06", "2026-06-19T21:30:00-03:00", "Brasil", "Haiti", "🇧🇷", "🇭🇹", 3, 0, "Finalizado"),
            criarJogo("19/06", "2026-06-19T19:00:00-03:00", "Escócia", "Marrocos", "🏴", "🇲🇦", 0, 1, "Finalizado"),
            criarJogo("24/06", "2026-06-24T19:00:00-03:00", "Escócia", "Brasil", "🏴", "🇧🇷", null, null, "Agendado"),
            criarJogo("24/06", "2026-06-24T19:00:00-03:00", "Marrocos", "Haiti", "🇲🇦", "🇭🇹", null, null, "Agendado")
        ]
    );
}

/* =========================
   FUNÇÕES AUXILIARES FALLBACK
========================= */

function criarGrupo(nome, times, jogos = []) {
    return {
        nome,
        times: ordenarTimes(times),
        jogos
    };
}

function criarGrupoPadrao(nome, selecoes) {
    const times = selecoes.map(([bandeira, nomeTime]) =>
        criarTime(bandeira, nomeTime, 0, 0, 0, 0, 0, 0)
    );

    return criarGrupo(nome, times, []);
}

function criarTime(bandeira, nome, jogos, vitorias, empates, derrotas, pontos, saldo) {
    return {
        posicao: 0,
        bandeira,
        nome,
        pontos,
        jogos,
        vitorias,
        empates,
        derrotas,
        saldo
    };
}

function criarJogo(data, dataISO, casa, fora, bandeiraCasa, bandeiraFora, golsCasa, golsFora, status) {
    return {
        data,
        dataISO,
        casa,
        fora,
        bandeiraCasa,
        bandeiraFora,
        golsCasa,
        golsFora,
        status
    };
}

function ordenarTimes(times) {
    return [...times]
        .sort((a, b) => {
            if (b.pontos !== a.pontos) return b.pontos - a.pontos;
            if (b.saldo !== a.saldo) return b.saldo - a.saldo;
            return a.nome.localeCompare(b.nome, "pt-BR");
        })
        .map((time, index) => ({
            ...time,
            posicao: index + 1
        }));
}

module.exports = router;