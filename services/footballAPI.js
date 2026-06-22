const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.FOOTBALL_API_KEY;
const API_BASE = process.env.FOOTBALL_API_BASE || "https://api.football-data.org/v4";

const CACHE_FILE = path.join(__dirname, "..", "cache", "copa.json");

const GRUPOS_ESPERADOS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

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

    jogosApi.forEach(jogo => {
        const grupoLetra = identificarGrupo(jogo);

        if (!grupoLetra || !grupos[grupoLetra]) return;

        const casa = normalizarNomeTime(jogo.homeTeam?.name || jogo.homeTeam?.shortName || "A definir");
        const fora = normalizarNomeTime(jogo.awayTeam?.name || jogo.awayTeam?.shortName || "A definir");

        const golsCasa = obterGols(jogo, "home");
        const golsFora = obterGols(jogo, "away");

        const status = traduzirStatus(jogo.status);

        garantirTime(grupos[grupoLetra], casa);
        garantirTime(grupos[grupoLetra], fora);

        if (jogoFinalizado(status) && golsCasa !== null && golsFora !== null) {
            aplicarResultado(grupos[grupoLetra], casa, fora, golsCasa, golsFora);
        }

        grupos[grupoLetra].jogos.push({
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
            status
        });
    });

    return {
        atualizadoEm: new Date().toISOString(),
        fonte: "football-data.org",
        grupos: Object.values(grupos).map(grupo => ({
            nome: grupo.nome,
            times: ordenarTimes(Object.values(grupo.timesMap)),
            jogos: ordenarJogos(grupo.jogos)
        }))
    };
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

function identificarGrupo(jogo) {
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

    return identificarGrupoPorTimes(jogo);
}

function identificarGrupoPorTimes(jogo) {
    const casa = normalizarNomeTime(jogo.homeTeam?.name || jogo.homeTeam?.shortName || "");
    const fora = normalizarNomeTime(jogo.awayTeam?.name || jogo.awayTeam?.shortName || "");

    const mapa = {
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

    for (const [grupo, times] of Object.entries(mapa)) {
        if (times.includes(casa) || times.includes(fora)) {
            return grupo;
        }
    }

    return null;
}

function obterGols(jogo, lado) {
    const fullTime = jogo.score?.fullTime?.[lado];
    const regularTime = jogo.score?.regularTime?.[lado];

    if (fullTime !== null && fullTime !== undefined) return fullTime;
    if (regularTime !== null && regularTime !== undefined) return regularTime;

    return null;
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
    if (s === "IN_PLAY" || s === "PAUSED") return "Em andamento";
    if (s === "SCHEDULED" || s === "TIMED") return "Agendado";
    if (s === "POSTPONED") return "Adiado";
    if (s === "CANCELLED") return "Cancelado";

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

function normalizarNomeTime(nome) {
    const mapa = {
        "Brazil": "Brasil",
        "Morocco": "Marrocos",
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

    return mapa[nome] || nome;
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
            return {
                atualizadoEm: null,
                fonte: "cache inexistente",
                grupos: []
            };
        }

        const conteudo = fs.readFileSync(CACHE_FILE, "utf8");

        if (!conteudo || !conteudo.trim()) {
            return {
                atualizadoEm: null,
                fonte: "cache vazio",
                grupos: []
            };
        }

        const dados = JSON.parse(conteudo);

        if (!dados || !Array.isArray(dados.grupos)) {
            return {
                atualizadoEm: null,
                fonte: "cache inválido",
                grupos: []
            };
        }

        return dados;
    } catch (erro) {
        return {
            atualizadoEm: null,
            fonte: "cache corrompido",
            erro: erro.message,
            grupos: []
        };
    }
}

module.exports = {
    atualizarDadosDaCopa,
    lerCache
};