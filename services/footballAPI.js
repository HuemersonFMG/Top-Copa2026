const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.FOOTBALL_API_KEY;
const API_BASE = process.env.FOOTBALL_API_BASE || "https://api.football-data.org/v4";

const CACHE_FILE = path.join(__dirname, "..", "cache", "copa.json");

const GRUPOS_ESPERADOS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const FASES_MATA_MATA = [
    "ROUND_OF_32",
    "LAST_32",
    "ROUND_OF_16",
    "LAST_16",
    "QUARTER_FINALS",
    "SEMI_FINALS",
    "THIRD_PLACE",
    "FINAL"
];

async function atualizarDadosDaCopa() {
    validarConfiguracao();

    const jogosApi = await buscarJogosDaApi();

    if (!Array.isArray(jogosApi) || jogosApi.length === 0) {
        throw new Error("A API externa não retornou jogos.");
    }

    const dadosTratados = converterJogosParaFormatoDoSite(jogosApi);

    if (!dadosTratados.grupos || dadosTratados.grupos.length === 0) {
        throw new Error("Não foi possível montar os grupos.");
    }

    salvarCache(dadosTratados);

    return dadosTratados;
}

function validarConfiguracao() {
    if (!API_KEY || API_KEY.trim() === "" || API_KEY === "SUA_CHAVE_AQUI") {
        throw new Error("FOOTBALL_API_KEY não configurada corretamente no .env.");
    }
}

async function buscarJogosDaApi() {
    const response = await axios.get(`${API_BASE}/competitions/WC/matches`, {
        headers: {
            "X-Auth-Token": API_KEY
        },
        params: {
            season: 2026
        },
        timeout: 20000,
        validateStatus: () => true
    });

    if (response.status === 401 || response.status === 403) {
        throw new Error("Chave da Football-Data inválida ou sem permissão.");
    }

    if (response.status === 429) {
        throw new Error("Limite de requisições da Football-Data atingido.");
    }

    if (response.status < 200 || response.status >= 300) {
        throw new Error(`Erro na Football-Data: HTTP ${response.status}`);
    }

    return response.data?.matches || [];
}

function converterJogosParaFormatoDoSite(jogosApi) {
    const grupos = criarEstruturaBaseGrupos();
    const mataMataMap = criarEstruturaBaseMataMata();

    jogosApi.forEach(jogo => {
        const faseMataMata = identificarFaseMataMata(jogo);

        if (faseMataMata) {
            const jogoTratado = converterJogo(jogo, {
                fase: faseMataMata.nome,
                stage: faseMataMata.stage,
                tipo: "mata-mata"
            });

            mataMataMap[faseMataMata.stage].jogos.push(jogoTratado);
            return;
        }

        const grupoLetra = identificarGrupo(jogo);

        if (!grupoLetra || !grupos[grupoLetra]) return;

        const jogoTratado = converterJogo(jogo, {
            grupo: grupoLetra,
            fase: "Fase de grupos",
            stage: "GROUP_STAGE",
            tipo: "grupo"
        });

        garantirTime(grupos[grupoLetra], jogoTratado.casa);
        garantirTime(grupos[grupoLetra], jogoTratado.fora);

        if (
            jogoFinalizado(jogoTratado.status) &&
            jogoTratado.golsCasa !== null &&
            jogoTratado.golsFora !== null
        ) {
            aplicarResultado(
                grupos[grupoLetra],
                jogoTratado.casa,
                jogoTratado.fora,
                jogoTratado.golsCasa,
                jogoTratado.golsFora
            );
        }

        grupos[grupoLetra].jogos.push(jogoTratado);
    });

    const gruposFormatados = Object.values(grupos).map(grupo => ({
        nome: grupo.nome,
        times: ordenarTimes(Object.values(grupo.timesMap)),
        jogos: ordenarJogos(grupo.jogos)
    }));

    const mataMataFormatado = Object.values(mataMataMap)
        .map(fase => ({
            fase: fase.nome,
            nome: fase.nome,
            stage: fase.stage,
            ordem: fase.ordem,
            jogos: ordenarJogos(fase.jogos)
        }))
        .filter(fase => fase.jogos.length > 0)
        .sort((a, b) => a.ordem - b.ordem);

    return {
        atualizadoEm: new Date().toISOString(),
        fonte: "football-data.org",
        origem: "football-data.org",
        grupos: gruposFormatados,
        mataMata: mataMataFormatado
    };
}

function converterJogo(jogo, extra = {}) {
    const casa = normalizarNomeTime(jogo.homeTeam?.name || jogo.homeTeam?.shortName || "A definir");
    const fora = normalizarNomeTime(jogo.awayTeam?.name || jogo.awayTeam?.shortName || "A definir");

    const golsCasa = obterGols(jogo, "home");
    const golsFora = obterGols(jogo, "away");

    const penaltisCasa = obterPenaltis(jogo, "home");
    const penaltisFora = obterPenaltis(jogo, "away");

    const status = traduzirStatus(jogo.status);

    return {
        id: jogo.id || null,
        data: formatarData(jogo.utcDate),
        hora: formatarHora(jogo.utcDate),
        dataISO: jogo.utcDate || null,
        casa,
        fora,
        bandeiraCasa: obterBandeira(casa),
        bandeiraFora: obterBandeira(fora),
        golsCasa,
        golsFora,
        penaltisCasa,
        penaltisFora,
        status,
        grupo: extra.grupo || null,
        fase: extra.fase || traduzirFase(jogo.stage),
        stage: extra.stage || jogo.stage || null,
        tipo: extra.tipo || "jogo",
        local: obterLocal(jogo),
        observacao: montarObservacaoJogo(jogo, penaltisCasa, penaltisFora)
    };
}

function criarEstruturaBaseGrupos() {
    const grupos = {};

    GRUPOS_ESPERADOS.forEach(letra => {
        grupos[letra] = {
            nome: letra,
            timesMap: {},
            jogos: []
        };
    });

    return grupos;
}

function criarEstruturaBaseMataMata() {
    return {
        OITAVAS: {
            nome: "Oitavas de Final",
            stage: "OITAVAS",
            ordem: 1,
            jogos: []
        },
        QUARTAS: {
            nome: "Quartas de Final",
            stage: "QUARTAS",
            ordem: 2,
            jogos: []
        },
        SEMIFINAL: {
            nome: "Semifinal",
            stage: "SEMIFINAL",
            ordem: 3,
            jogos: []
        },
        TERCEIRO_LUGAR: {
            nome: "Disputa do 3º Lugar",
            stage: "TERCEIRO_LUGAR",
            ordem: 4,
            jogos: []
        },
        FINAL: {
            nome: "Final",
            stage: "FINAL",
            ordem: 5,
            jogos: []
        }
    };
}

function identificarFaseMataMata(jogo) {
    const stageOriginal = String(jogo.stage || "").toUpperCase();

    if (!stageOriginal) return null;
    if (!FASES_MATA_MATA.includes(stageOriginal)) return null;

    const stageNormalizado = normalizarStageMataMata(stageOriginal);
    const mapa = criarEstruturaBaseMataMata();

    return mapa[stageNormalizado] || null;
}

function normalizarStageMataMata(stage) {
    const s = String(stage || "").toUpperCase();

    if (
        s === "ROUND_OF_32" ||
        s === "LAST_32" ||
        s === "ROUND_OF_16" ||
        s === "LAST_16"
    ) {
        return "OITAVAS";
    }

    if (s === "QUARTER_FINALS") return "QUARTAS";
    if (s === "SEMI_FINALS") return "SEMIFINAL";
    if (s === "THIRD_PLACE") return "TERCEIRO_LUGAR";
    if (s === "FINAL") return "FINAL";

    return s;
}

function identificarGrupo(jogo) {
    if (ehJogoMataMata(jogo)) return null;

    const texto = [
        jogo.group,
        jogo.stage,
        jogo.matchday,
        jogo.competition?.name
    ]
        .filter(Boolean)
        .join(" ")
        .toUpperCase();

    let match = texto.match(/GROUP[_\s-]?([A-L])/);
    if (match) return match[1];

    match = texto.match(/GRUPO[_\s-]?([A-L])/);
    if (match) return match[1];

    if (jogo.group && /^[A-L]$/i.test(String(jogo.group))) {
        return String(jogo.group).toUpperCase();
    }

    if (String(jogo.stage || "").toUpperCase() === "GROUP_STAGE") {
        return identificarGrupoPorTimes(jogo);
    }

    if (Number(jogo.matchday) >= 1 && Number(jogo.matchday) <= 3) {
        return identificarGrupoPorTimes(jogo);
    }

    return identificarGrupoPorTimes(jogo);
}

function ehJogoMataMata(jogo) {
    return Boolean(identificarFaseMataMata(jogo));
}

function identificarGrupoPorTimes(jogo) {
    const casa = normalizarNomeTime(jogo.homeTeam?.name || jogo.homeTeam?.shortName || "");
    const fora = normalizarNomeTime(jogo.awayTeam?.name || jogo.awayTeam?.shortName || "");

    const mapa = obterMapaGrupos();

    for (const [grupo, times] of Object.entries(mapa)) {
        if (times.includes(casa) || times.includes(fora)) {
            return grupo;
        }
    }

    return null;
}

function obterMapaGrupos() {
    return {
        A: ["México", "África do Sul", "Coreia do Sul", "Tchéquia"],
        B: ["Canadá", "Bósnia e Herzegovina", "Catar", "Suíça"],
        C: ["Brasil", "Marrocos", "Haiti", "Escócia"],
        D: ["Estados Unidos", "Paraguai", "Austrália", "Turquia"],
        E: ["Alemanha", "Curaçao", "Costa do Marfim", "Equador"],
        F: ["Holanda", "Japão", "Suécia", "Tunísia"],
        G: ["Bélgica", "Egito", "Irã", "Nova Zelândia"],
        H: ["Espanha", "Cabo Verde", "Arábia Saudita", "Uruguai"],
        I: ["França", "Senegal", "Iraque", "Noruega"],
        J: ["Argentina", "Argélia", "Áustria", "Jordânia"],
        K: ["Portugal", "RD Congo", "Uzbequistão", "Colômbia"],
        L: ["Inglaterra", "Croácia", "Gana", "Panamá"]
    };
}

function obterGols(jogo, lado) {
    const fullTime = jogo.score?.fullTime?.[lado];
    const regularTime = jogo.score?.regularTime?.[lado];
    const halfTime = jogo.score?.halfTime?.[lado];

    if (fullTime !== null && fullTime !== undefined) return fullTime;
    if (regularTime !== null && regularTime !== undefined) return regularTime;
    if (jogo.status === "PAUSED" && halfTime !== null && halfTime !== undefined) return halfTime;

    return null;
}

function obterPenaltis(jogo, lado) {
    const penalties = jogo.score?.penalties?.[lado];

    if (penalties !== null && penalties !== undefined) {
        return penalties;
    }

    return null;
}

function obterLocal(jogo) {
    return (
        jogo.venue ||
        jogo.area?.name ||
        jogo.location ||
        ""
    );
}

function montarObservacaoJogo(jogo, penaltisCasa, penaltisFora) {
    if (penaltisCasa !== null && penaltisFora !== null) {
        return `Pênaltis: ${penaltisCasa} x ${penaltisFora}`;
    }

    if (jogo.score?.winner) {
        return `Vencedor: ${traduzirVencedor(jogo.score.winner)}`;
    }

    const fase = traduzirFase(jogo.stage);

    if (fase && fase !== "Fase de grupos") {
        return fase;
    }

    return "";
}

function traduzirVencedor(winner) {
    const w = String(winner || "").toUpperCase();

    if (w === "HOME_TEAM") return "Mandante";
    if (w === "AWAY_TEAM") return "Visitante";
    if (w === "DRAW") return "Empate";

    return winner || "";
}

function garantirTime(grupo, nome) {
    if (!nome || nome === "A definir") return;

    if (!grupo.timesMap[nome]) {
        grupo.timesMap[nome] = {
            posicao: 0,
            bandeira: obterBandeira(nome),
            nome,
            pontos: 0,
            jogos: 0,
            vitorias: 0,
            empates: 0,
            derrotas: 0,
            saldo: 0
        };
    }
}

function aplicarResultado(grupo, casa, fora, golsCasa, golsFora) {
    const timeCasa = grupo.timesMap[casa];
    const timeFora = grupo.timesMap[fora];

    if (!timeCasa || !timeFora) return;

    timeCasa.jogos++;
    timeFora.jogos++;

    timeCasa.saldo += golsCasa - golsFora;
    timeFora.saldo += golsFora - golsCasa;

    if (golsCasa > golsFora) {
        timeCasa.vitorias++;
        timeCasa.pontos += 3;
        timeFora.derrotas++;
    } else if (golsCasa < golsFora) {
        timeFora.vitorias++;
        timeFora.pontos += 3;
        timeCasa.derrotas++;
    } else {
        timeCasa.empates++;
        timeFora.empates++;
        timeCasa.pontos++;
        timeFora.pontos++;
    }
}

function ordenarTimes(times) {
    return times
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

function ordenarJogos(jogos) {
    return jogos.sort((a, b) => {
        return new Date(a.dataISO || 0) - new Date(b.dataISO || 0);
    });
}

function traduzirStatus(status) {
    const s = String(status || "").toUpperCase();

    if (s === "FINISHED") return "Finalizado";
    if (s === "IN_PLAY" || s === "LIVE" || s === "PAUSED") return "Em andamento";
    if (s === "SCHEDULED" || s === "TIMED") return "Agendado";
    if (s === "POSTPONED") return "Adiado";
    if (s === "CANCELLED") return "Cancelado";
    if (s === "SUSPENDED") return "Suspenso";

    return status || "Agendado";
}

function jogoFinalizado(status) {
    return String(status || "").toLowerCase() === "finalizado";
}

function formatarData(dataISO) {
    if (!dataISO) return "A definir";

    const data = new Date(dataISO);

    if (isNaN(data.getTime())) return "A definir";

    return data.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo"
    });
}

function formatarHora(dataISO) {
    if (!dataISO) return "";

    const data = new Date(dataISO);

    if (isNaN(data.getTime())) return "";

    return data.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo"
    });
}

function traduzirFase(stage) {
    const stageNormalizado = normalizarStageMataMata(stage);
    const s = String(stageNormalizado || stage || "").toUpperCase();

    const mapa = {
        GROUP_STAGE: "Fase de grupos",
        OITAVAS: "Oitavas de Final",
        QUARTAS: "Quartas de Final",
        SEMIFINAL: "Semifinal",
        TERCEIRO_LUGAR: "Disputa do 3º Lugar",
        FINAL: "Final",
        ROUND_OF_32: "Oitavas de Final",
        LAST_32: "Oitavas de Final",
        ROUND_OF_16: "Oitavas de Final",
        LAST_16: "Oitavas de Final",
        QUARTER_FINALS: "Quartas de Final",
        SEMI_FINALS: "Semifinal",
        THIRD_PLACE: "Disputa do 3º Lugar"
    };

    return mapa[s] || stage || "";
}

function normalizarNomeTime(nome) {
    const mapa = {
        "TBD": "A definir",
        "To Be Confirmed": "A definir",
        "To be confirmed": "A definir",
        "Unknown": "A definir",
        "A definir": "A definir",

        "Brazil": "Brasil",
        "Morocco": "Marrocos",
        "Haiti": "Haiti",
        "Scotland": "Escócia",

        "Mexico": "México",
        "South Africa": "África do Sul",
        "Korea Republic": "Coreia do Sul",
        "South Korea": "Coreia do Sul",
        "Czech Republic": "Tchéquia",
        "Czechia": "Tchéquia",

        "Canada": "Canadá",
        "Bosnia and Herzegovina": "Bósnia e Herzegovina",
        "Bosnia-Herzegovina": "Bósnia e Herzegovina",
        "Qatar": "Catar",
        "Switzerland": "Suíça",

        "United States": "Estados Unidos",
        "USA": "Estados Unidos",
        "Paraguay": "Paraguai",
        "Australia": "Austrália",
        "Turkey": "Turquia",

        "Germany": "Alemanha",
        "Curacao": "Curaçao",
        "Curaçao": "Curaçao",
        "Ivory Coast": "Costa do Marfim",
        "Côte d'Ivoire": "Costa do Marfim",
        "Ecuador": "Equador",

        "Netherlands": "Holanda",
        "Japan": "Japão",
        "Sweden": "Suécia",
        "Tunisia": "Tunísia",

        "Belgium": "Bélgica",
        "Egypt": "Egito",
        "Iran": "Irã",
        "New Zealand": "Nova Zelândia",

        "Spain": "Espanha",
        "Cape Verde": "Cabo Verde",
        "Cape Verde Islands": "Cabo Verde",
        "Saudi Arabia": "Arábia Saudita",
        "Uruguay": "Uruguai",

        "France": "França",
        "Senegal": "Senegal",
        "Iraq": "Iraque",
        "Norway": "Noruega",

        "Argentina": "Argentina",
        "Algeria": "Argélia",
        "Austria": "Áustria",
        "Jordan": "Jordânia",

        "Portugal": "Portugal",
        "DR Congo": "RD Congo",
        "Congo DR": "RD Congo",
        "Uzbekistan": "Uzbequistão",
        "Colombia": "Colômbia",

        "England": "Inglaterra",
        "Croatia": "Croácia",
        "Ghana": "Gana",
        "Panama": "Panamá"
    };

    return mapa[nome] || nome || "A definir";
}

function obterBandeira(nome) {
    const mapa = {
        "Brasil": "🇧🇷",
        "Marrocos": "🇲🇦",
        "Haiti": "🇭🇹",
        "Escócia": "🏴",

        "México": "🇲🇽",
        "África do Sul": "🇿🇦",
        "Coreia do Sul": "🇰🇷",
        "Tchéquia": "🇨🇿",

        "Canadá": "🇨🇦",
        "Bósnia e Herzegovina": "🇧🇦",
        "Catar": "🇶🇦",
        "Suíça": "🇨🇭",

        "Estados Unidos": "🇺🇸",
        "Paraguai": "🇵🇾",
        "Austrália": "🇦🇺",
        "Turquia": "🇹🇷",

        "Alemanha": "🇩🇪",
        "Curaçao": "🇨🇼",
        "Costa do Marfim": "🇨🇮",
        "Equador": "🇪🇨",

        "Holanda": "🇳🇱",
        "Japão": "🇯🇵",
        "Suécia": "🇸🇪",
        "Tunísia": "🇹🇳",

        "Bélgica": "🇧🇪",
        "Egito": "🇪🇬",
        "Irã": "🇮🇷",
        "Nova Zelândia": "🇳🇿",

        "Espanha": "🇪🇸",
        "Cabo Verde": "🇨🇻",
        "Arábia Saudita": "🇸🇦",
        "Uruguai": "🇺🇾",

        "França": "🇫🇷",
        "Senegal": "🇸🇳",
        "Iraque": "🇮🇶",
        "Noruega": "🇳🇴",

        "Argentina": "🇦🇷",
        "Argélia": "🇩🇿",
        "Áustria": "🇦🇹",
        "Jordânia": "🇯🇴",

        "Portugal": "🇵🇹",
        "RD Congo": "🇨🇩",
        "Uzbequistão": "🇺🇿",
        "Colômbia": "🇨🇴",

        "Inglaterra": "🏴",
        "Croácia": "🇭🇷",
        "Gana": "🇬🇭",
        "Panamá": "🇵🇦"
    };

    return mapa[nome] || "";
}

function salvarCache(dados) {
    const pastaCache = path.dirname(CACHE_FILE);

    if (!fs.existsSync(pastaCache)) {
        fs.mkdirSync(pastaCache, { recursive: true });
    }

    const temporario = `${CACHE_FILE}.tmp`;

    fs.writeFileSync(temporario, JSON.stringify(dados, null, 4), "utf8");
    fs.renameSync(temporario, CACHE_FILE);
}

function lerCache() {
    try {
        if (!fs.existsSync(CACHE_FILE)) {
            return cacheVazio("cache inexistente");
        }

        const conteudo = fs.readFileSync(CACHE_FILE, "utf8");

        if (!conteudo || !conteudo.trim()) {
            return cacheVazio("cache vazio");
        }

        const dados = JSON.parse(conteudo);

        if (!dados || !Array.isArray(dados.grupos)) {
            return cacheVazio("cache inválido");
        }

        if (!Array.isArray(dados.mataMata)) {
            dados.mataMata = [];
        }

        if (!dados.origem) {
            dados.origem = dados.fonte || "football-data.org";
        }

        return dados;

    } catch (erro) {
        return {
            atualizadoEm: null,
            fonte: "cache corrompido",
            origem: "cache corrompido",
            erro: erro.message,
            grupos: [],
            mataMata: []
        };
    }
}

function cacheVazio(fonte) {
    return {
        atualizadoEm: null,
        fonte,
        origem: fonte,
        grupos: [],
        mataMata: []
    };
}

module.exports = {
    atualizarDadosDaCopa,
    lerCache
};