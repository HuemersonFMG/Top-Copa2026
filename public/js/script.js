document.addEventListener("DOMContentLoaded", iniciarPagina);

let dadosCopa = null;
let intervaloContador = null;
let intervaloAtualizacao = null;

const API_HOME = "/api/copa/home";
const API_ATUALIZAR = "/api/copa/atualizar";
const TEMPO_ATUALIZACAO = 60000;

async function iniciarPagina() {
    console.log("script.js carregado com sucesso");

    configurarEventos();

    await carregarDadosCopa();

    if (intervaloAtualizacao) {
        clearInterval(intervaloAtualizacao);
    }

    intervaloAtualizacao = setInterval(carregarDadosCopa, TEMPO_ATUALIZACAO);
}

function configurarEventos() {
    const botaoAtualizar = document.getElementById("btnAtualizarCopa");

    if (!botaoAtualizar) return;

    botaoAtualizar.addEventListener("click", async () => {
        botaoAtualizar.disabled = true;
        botaoAtualizar.innerHTML = "⏳ Atualizando...";

        try {
            await atualizarDadosExternos();
            await carregarDadosCopa();
        } catch (erro) {
            console.error("Erro ao atualizar manualmente:", erro);
            alert("Não foi possível atualizar os dados agora.");
        } finally {
            botaoAtualizar.disabled = false;
            botaoAtualizar.innerHTML = "🔄 Atualizar agora";
        }
    });
}

async function atualizarDadosExternos() {
    const resposta = await fetch(API_ATUALIZAR, {
        method: "POST"
    });

    if (!resposta.ok) {
        throw new Error("Erro ao executar atualização manual.");
    }

    return await resposta.json();
}

async function carregarDadosCopa() {
    try {
        const resposta = await fetch(API_HOME, {
            cache: "no-store"
        });

        if (!resposta.ok) {
            throw new Error("Erro ao buscar dados da Copa.");
        }

        const dados = await resposta.json();

        if (!dados || !Array.isArray(dados.grupos)) {
            throw new Error("Formato de dados inválido.");
        }

        dadosCopa = dados;

        montarTabelaCopa(dadosCopa.grupos);
        atualizarDataAtualizacao(dadosCopa.atualizadoEm);
        atualizarProgressoBrasil(dadosCopa.grupos);
        atualizarProximoJogoBrasil(dadosCopa.grupos);

    } catch (erro) {
        console.error("Erro ao carregar dados:", erro);
        exibirErroTabela("Não foi possível carregar a tabela da Copa.");
    }
}

function montarTabelaCopa(grupos) {
    const container = document.getElementById("tabelaCopa");

    if (!container) {
        console.warn("Elemento #tabelaCopa não encontrado no HTML.");
        return;
    }

    container.innerHTML = "";

    if (!Array.isArray(grupos) || grupos.length === 0) {
        container.innerHTML = `
            <div class="erro-api">
                Nenhum grupo encontrado para exibição.
            </div>
        `;
        return;
    }

    grupos.forEach(grupo => {
        const times = Array.isArray(grupo.times) ? grupo.times : [];
        const jogos = Array.isArray(grupo.jogos) ? grupo.jogos : [];

        const linhasTimes = times.map(time => {
            const nomeTime = textoSeguro(time.nome);
            const classeBrasil = nomeTime.toLowerCase() === "brasil" ? "time-brasil" : "";

            return `
                <tr class="${classeBrasil}">
                    <td>${numeroSeguro(time.posicao)}</td>
                    <td class="nome-time">${textoSeguro(time.bandeira)} ${nomeTime}</td>
                    <td>${numeroSeguro(time.pontos)}</td>
                    <td>${numeroSeguro(time.jogos)}</td>
                    <td>${numeroSeguro(time.vitorias)}</td>
                    <td>${numeroSeguro(time.empates)}</td>
                    <td>${numeroSeguro(time.derrotas)}</td>
                    <td>${numeroSeguro(time.saldo)}</td>
                </tr>
            `;
        }).join("");

        const linhasJogos = jogos.length > 0
            ? jogos.map(jogo => montarLinhaJogo(jogo)).join("")
            : `
                <div class="jogo-linha jogo-vazio">
                    <span>Jogos ainda não carregados</span>
                </div>
            `;

        container.innerHTML += `
            <div class="grupo-card">
                <h3>Grupo ${textoSeguro(grupo.nome)}</h3>

                <table class="tabela-grupo">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Seleção</th>
                            <th>P</th>
                            <th>J</th>
                            <th>V</th>
                            <th>E</th>
                            <th>D</th>
                            <th>SG</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhasTimes}
                    </tbody>
                </table>

                <div class="jogos-grupo">
                    ${linhasJogos}
                </div>
            </div>
        `;
    });
}

function montarLinhaJogo(jogo) {
    const placar = obterPlacarJogo(jogo);

    return `
        <div class="jogo-linha">
            <span class="data-jogo">
                ${textoSeguro(jogo.data)}
                ${jogo.hora ? `<small>${textoSeguro(jogo.hora)}</small>` : ""}
            </span>

            <span>${textoSeguro(jogo.bandeiraCasa)} ${textoSeguro(jogo.casa)}</span>
            <span class="placar-jogo">${placar}</span>
            <span>${textoSeguro(jogo.bandeiraFora)} ${textoSeguro(jogo.fora)}</span>
        </div>
    `;
}

function obterPlacarJogo(jogo) {
    const status = textoSeguro(jogo.status).toLowerCase();

    if (
        status === "finalizado" ||
        status === "encerrado" ||
        status === "complete" ||
        status === "finished" ||
        status === "ft"
    ) {
        return `${numeroSeguro(jogo.golsCasa)} x ${numeroSeguro(jogo.golsFora)}`;
    }

    if (jogo.golsCasa !== null && jogo.golsCasa !== undefined && jogo.golsFora !== null && jogo.golsFora !== undefined) {
        return `${numeroSeguro(jogo.golsCasa)} x ${numeroSeguro(jogo.golsFora)}`;
    }

    return "x";
}

function atualizarDataAtualizacao(data) {
    const elemento = document.getElementById("ultimaAtualizacao");

    if (!elemento) return;

    if (!data) {
        elemento.innerText = "Última atualização: não informada";
        return;
    }

    const dataFormatada = new Date(data);

    if (isNaN(dataFormatada.getTime())) {
        elemento.innerText = "Última atualização: " + data;
        return;
    }

    elemento.innerText = "Última atualização: " + dataFormatada.toLocaleString("pt-BR");
}

function atualizarProgressoBrasil(grupos) {
    const jogosBrasil = obterJogosBrasil(grupos);

    const txtJogos = document.getElementById("jogosConcluidos");
    const barra = document.getElementById("barraProgresso");

    if (jogosBrasil.length === 0) {
        if (txtJogos) txtJogos.innerText = "0";
        if (barra) {
            barra.style.width = "0%";
            barra.innerText = "0%";
        }
        return;
    }

    const jogosFinalizados = jogosBrasil.filter(jogo => jogoFinalizado(jogo)).length;
    const percentual = Math.round((jogosFinalizados / jogosBrasil.length) * 100);

    if (txtJogos) {
        txtJogos.innerText = jogosFinalizados;
    }

    if (barra) {
        barra.style.width = percentual + "%";
        barra.innerText = percentual + "%";
    }
}

function atualizarProximoJogoBrasil(grupos) {
    const jogosBrasil = obterJogosBrasil(grupos);

    const infoProximo = document.getElementById("infoProximo");
    const timeCasa = document.getElementById("timeCasa");
    const timeFora = document.getElementById("timeFora");
    const golCasa = document.getElementById("golCasa");
    const golFora = document.getElementById("golFora");

    if (jogosBrasil.length === 0) {
        if (infoProximo) infoProximo.innerHTML = "Nenhum jogo do Brasil encontrado.";
        pararContador();
        return;
    }

    const proximo = jogosBrasil.find(jogo => !jogoFinalizado(jogo));

    if (!proximo) {
        if (infoProximo) {
            infoProximo.innerHTML = "Todos os jogos do Brasil foram concluídos.";
        }

        const ultimo = jogosBrasil[jogosBrasil.length - 1];

        if (ultimo) {
            if (timeCasa) timeCasa.innerText = textoSeguro(ultimo.casa);
            if (timeFora) timeFora.innerText = textoSeguro(ultimo.fora);
            if (golCasa) golCasa.innerText = numeroSeguro(ultimo.golsCasa);
            if (golFora) golFora.innerText = numeroSeguro(ultimo.golsFora);
        }

        pararContador();
        return;
    }

    if (infoProximo) {
        infoProximo.innerHTML = `
            <strong>${textoSeguro(proximo.data)}</strong>
            ${proximo.hora ? `<span class="hora-jogo">${textoSeguro(proximo.hora)}</span>` : ""}
            <br>
            ${textoSeguro(proximo.casa)} x ${textoSeguro(proximo.fora)}
        `;
    }

    if (timeCasa) timeCasa.innerText = textoSeguro(proximo.casa);
    if (timeFora) timeFora.innerText = textoSeguro(proximo.fora);
    if (golCasa) golCasa.innerText = proximo.golsCasa ?? 0;
    if (golFora) golFora.innerText = proximo.golsFora ?? 0;

    iniciarContador(proximo);
}

function iniciarContador(jogo) {
    const contador = document.getElementById("contador");

    if (!contador) return;

    pararContador();

    function atualizar() {
        const dataJogo = obterDataDoJogo(jogo);

        if (!dataJogo) {
            contador.innerHTML = `⏳ Próximo jogo: ${textoSeguro(jogo.data)}`;
            return;
        }

        const agora = new Date().getTime();
        const destino = dataJogo.getTime();
        const distancia = destino - agora;

        if (distancia <= 0) {
            contador.innerHTML = "⚽ Jogo em andamento ou aguardando atualização.";
            return;
        }

        const dias = Math.floor(distancia / (1000 * 60 * 60 * 24));
        const horas = Math.floor((distancia / (1000 * 60 * 60)) % 24);
        const minutos = Math.floor((distancia / (1000 * 60)) % 60);
        const segundos = Math.floor((distancia / 1000) % 60);

        contador.innerHTML = `⏳ Faltam ${dias}d ${horas}h ${minutos}m ${segundos}s`;
    }

    atualizar();

    intervaloContador = setInterval(atualizar, 1000);
}

function pararContador() {
    if (intervaloContador) {
        clearInterval(intervaloContador);
        intervaloContador = null;
    }
}

function obterJogosBrasil(grupos) {
    const jogos = [];

    if (!Array.isArray(grupos)) return jogos;

    grupos.forEach(grupo => {
        const listaJogos = Array.isArray(grupo.jogos) ? grupo.jogos : [];

        listaJogos.forEach(jogo => {
            const casa = textoSeguro(jogo.casa).toLowerCase();
            const fora = textoSeguro(jogo.fora).toLowerCase();

            if (casa === "brasil" || fora === "brasil") {
                jogos.push(jogo);
            }
        });
    });

    return jogos;
}

function jogoFinalizado(jogo) {
    const status = textoSeguro(jogo.status).toLowerCase();

    return (
        status === "finalizado" ||
        status === "encerrado" ||
        status === "complete" ||
        status === "finished" ||
        status === "ft"
    );
}

function obterDataDoJogo(jogo) {
    if (!jogo) return null;

    if (jogo.dataISO) {
        const dataISO = new Date(jogo.dataISO);
        if (!isNaN(dataISO.getTime())) return dataISO;
    }

    if (jogo.dataCompleta) {
        const dataCompleta = new Date(jogo.dataCompleta);
        if (!isNaN(dataCompleta.getTime())) return dataCompleta;
    }

    if (jogo.dataHora) {
        const dataHora = new Date(jogo.dataHora);
        if (!isNaN(dataHora.getTime())) return dataHora;
    }

    return null;
}

function exibirErroTabela(mensagem) {
    const tabela = document.getElementById("tabelaCopa");

    if (tabela) {
        tabela.innerHTML = `
            <div class="erro-api">
                ${textoSeguro(mensagem)}
            </div>
        `;
    }
}

function textoSeguro(valor) {
    if (valor === null || valor === undefined) return "";
    return String(valor);
}

function numeroSeguro(valor) {
    if (valor === null || valor === undefined || valor === "") return 0;
    return valor;
}