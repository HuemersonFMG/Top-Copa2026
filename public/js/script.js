document.addEventListener("DOMContentLoaded", iniciarPagina);

let dadosCopa = null;
let intervaloContador = null;
let intervaloAtualizacao = null;
let carregandoDados = false;
let atualizandoAgora = false;

const API_HOME = "/api/copa/home";
const API_ATUALIZAR = "/api/copa/atualizar";
const TEMPO_ATUALIZACAO = 15000;

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

    if (botaoAtualizar) {
        botaoAtualizar.addEventListener("click", atualizarCopaAgora);
    } else {
        console.warn("Botão #btnAtualizarCopa não encontrado.");
    }
}

async function atualizarCopaAgora() {
    if (atualizandoAgora) return;

    const botaoAtualizar = document.getElementById("btnAtualizarCopa");

    try {
        atualizandoAgora = true;
        alterarEstadoBotao(botaoAtualizar, true, "⏳ Atualizando...");

        const retorno = await atualizarDadosExternos();

        if (!atualizacaoFoiBemSucedida(retorno)) {
            throw new Error(retorno?.mensagem || retorno?.erro || "A API não confirmou a atualização.");
        }

        if (retorno.dados && dadosValidos(retorno.dados)) {
            dadosCopa = retorno.dados;
            renderizarDadosCopa(dadosCopa);
        } else {
            await carregarDadosCopa(true);
        }

    } catch (erro) {
        console.error("Erro ao atualizar manualmente:", erro);
        alert("Não foi possível atualizar os dados agora.");
    } finally {
        atualizandoAgora = false;
        alterarEstadoBotao(botaoAtualizar, false, "🔄 Atualizar agora");
    }
}

function alterarEstadoBotao(botao, desabilitado, texto) {
    if (!botao) return;

    botao.disabled = desabilitado;
    botao.innerHTML = texto;

    if (desabilitado) {
        botao.classList.add("carregando");
    } else {
        botao.classList.remove("carregando");
    }
}

function atualizacaoFoiBemSucedida(retorno) {
    if (!retorno) return false;
    if (retorno.sucesso === true) return true;
    if (String(retorno.sucesso).toLowerCase() === "true") return true;
    if (retorno.dados && dadosValidos(retorno.dados)) return true;

    return false;
}

function dadosValidos(dados) {
    return (
        dados &&
        (
            Array.isArray(dados.grupos) ||
            Array.isArray(dados.mataMata)
        )
    );
}

async function atualizarDadosExternos() {
    const resposta = await fetch(`${API_ATUALIZAR}?t=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        headers: {
            "Accept": "application/json"
        }
    });

    const texto = await resposta.text();

    let retorno = null;

    try {
        retorno = texto ? JSON.parse(texto) : null;
    } catch (erro) {
        throw new Error("Resposta inválida da API de atualização.");
    }

    if (!resposta.ok) {
        throw new Error(retorno?.mensagem || retorno?.erro || "Erro ao executar atualização manual.");
    }

    return retorno;
}

async function carregarDadosCopa(forcar = false) {
    if (carregandoDados && !forcar) return;

    try {
        carregandoDados = true;

        const resposta = await fetch(`${API_HOME}?t=${Date.now()}`, {
            method: "GET",
            cache: "no-store",
            headers: {
                "Accept": "application/json"
            }
        });

        const texto = await resposta.text();

        let dados = null;

        try {
            dados = texto ? JSON.parse(texto) : null;
        } catch (erro) {
            throw new Error("Resposta inválida ao buscar dados da Copa.");
        }

        if (!resposta.ok) {
            throw new Error(dados?.mensagem || "Erro ao buscar dados da Copa.");
        }

        if (!dadosValidos(dados)) {
            throw new Error("Formato de dados inválido.");
        }

        dadosCopa = dados;
        renderizarDadosCopa(dadosCopa);

    } catch (erro) {
        console.error("Erro ao carregar dados:", erro);

        if (!dadosCopa) {
            exibirErroTabela("Não foi possível carregar a tabela da Copa.");
        }
    } finally {
        carregandoDados = false;
    }
}

function renderizarDadosCopa(dados) {
    if (!dadosValidos(dados)) return;

    const grupos = Array.isArray(dados.grupos) ? dados.grupos : [];
    const mataMata = Array.isArray(dados.mataMata) ? dados.mataMata : [];

    montarTabelaCopa(grupos);
    montarTabelaMataMata(mataMata);

    atualizarDataAtualizacao(dados.atualizadoEm);
    atualizarProgressoBrasil(dados);
    atualizarProximoJogoBrasil(dados);
    atualizarPainelBrasil(dados);
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

function montarTabelaMataMata(mataMata) {
    const container = document.getElementById("tabelaMataMata");

    if (!container) {
        console.warn("Elemento #tabelaMataMata não encontrado no HTML. O mata-mata não será exibido ainda.");
        return;
    }

    container.innerHTML = "";

    if (!Array.isArray(mataMata) || mataMata.length === 0) {
        container.innerHTML = `
            <div class="erro-api">
                Mata-mata ainda não definido. Os confrontos serão exibidos automaticamente quando a API retornar os jogos.
            </div>
        `;
        return;
    }

    mataMata.forEach(fase => {
        const nomeFase = textoSeguro(fase.fase || fase.nome || "Mata-mata");
        const jogos = Array.isArray(fase.jogos) ? fase.jogos : [];

        const linhasJogos = jogos.length > 0
            ? jogos.map(jogo => montarLinhaJogoMataMata(jogo)).join("")
            : `
                <tr>
                    <td colspan="5">Nenhum jogo nesta fase.</td>
                </tr>
            `;

        container.innerHTML += `
            <div class="grupo-card mata-mata-card">
                <h3>🏆 ${nomeFase}</h3>

                <table class="tabela-grupo tabela-mata-mata">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Jogo</th>
                            <th>Placar</th>
                            <th>Status</th>
                            <th>Observação</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhasJogos}
                    </tbody>
                </table>
            </div>
        `;
    });
}

function montarLinhaJogoMataMata(jogo) {
    const classeBrasil = jogoTemBrasil(jogo) ? "time-brasil" : "";
    const classeAtual = jogoEmAndamento(jogo) ? "linha-jogo-atual" : "";

    return `
        <tr class="${classeBrasil} ${classeAtual}">
            <td>${montarDataHoraPainel(jogo)}</td>
            <td>${montarConfrontoPainel(jogo)}</td>
            <td><strong>${obterPlacarJogo(jogo)}</strong></td>
            <td>${montarStatusPainel(jogo)}</td>
            <td>${textoSeguro(jogo.observacao || jogo.descricao || jogo.fase || "-")}</td>
        </tr>
    `;
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

function atualizarPainelBrasil(dados) {
    const tbody = document.getElementById("tbodyJogosBrasil");

    if (!tbody) {
        console.warn("Elemento #tbodyJogosBrasil não encontrado no HTML.");
        return;
    }

    const jogosBrasil = obterJogosBrasil(dados);
    ordenarJogosPorData(jogosBrasil);

    tbody.innerHTML = "";

    if (jogosBrasil.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">Nenhum jogo do Brasil encontrado.</td>
            </tr>
        `;
        return;
    }

    const jogoDestaque = obterJogoDestaqueBrasil(jogosBrasil);

    jogosBrasil.forEach((jogo, index) => {
        const rodada = obterRodadaBrasil(jogo, index);
        const data = montarDataHoraPainel(jogo);
        const confronto = montarConfrontoPainel(jogo);
        const local = textoSeguro(jogo.local || jogo.estadio || jogo.cidade || "-");
        const placar = obterPlacarJogo(jogo);
        const status = montarStatusPainel(jogo);

        const ehDestaque = jogoDestaque && jogo.id === jogoDestaque.id;
        const classe = ehDestaque ? "linha-jogo-atual" : "";

        tbody.innerHTML += `
            <tr class="${classe}">
                <td>${rodada}</td>
                <td>${data}</td>
                <td>${confronto}</td>
                <td>${local}</td>
                <td><strong>${placar}</strong></td>
                <td>${status}</td>
            </tr>
        `;
    });
}

function obterRodadaBrasil(jogo, index) {
    if (jogo.fase) return textoSeguro(jogo.fase);
    if (jogo.rodada) return textoSeguro(jogo.rodada);
    if (jogo.stage) return traduzirFase(jogo.stage);

    return `${index + 1}ª`;
}

function obterJogoDestaqueBrasil(jogosBrasil) {
    const agora = new Date();

    const partidaEmAndamento = jogosBrasil.find(jogo => jogoEmAndamento(jogo));
    if (partidaEmAndamento) return partidaEmAndamento;

    const jogosNaoFinalizados = jogosBrasil
        .filter(jogo => !jogoFinalizado(jogo))
        .sort((a, b) => {
            const dataA = obterDataDoJogo(a);
            const dataB = obterDataDoJogo(b);

            const tempoA = dataA ? dataA.getTime() : Number.MAX_SAFE_INTEGER;
            const tempoB = dataB ? dataB.getTime() : Number.MAX_SAFE_INTEGER;

            return tempoA - tempoB;
        });

    const proximo = jogosNaoFinalizados.find(jogo => {
        const dataJogo = obterDataDoJogo(jogo);
        return dataJogo && dataJogo.getTime() >= agora.getTime();
    });

    return proximo || jogosNaoFinalizados[0] || null;
}

function obterPlacarJogo(jogo) {
    const golsCasaExiste = jogo.golsCasa !== null && jogo.golsCasa !== undefined && jogo.golsCasa !== "";
    const golsForaExiste = jogo.golsFora !== null && jogo.golsFora !== undefined && jogo.golsFora !== "";

    if (golsCasaExiste && golsForaExiste) {
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
        elemento.innerText = "Última atualização: " + textoSeguro(data);
        return;
    }

    elemento.innerText = "Última atualização: " + dataFormatada.toLocaleString("pt-BR");
}

function atualizarProgressoBrasil(dados) {
    const jogosBrasil = obterJogosBrasil(dados);

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

    if (txtJogos) txtJogos.innerText = jogosFinalizados;

    if (barra) {
        barra.style.width = percentual + "%";
        barra.innerText = percentual + "%";
    }
}

function atualizarProximoJogoBrasil(dados) {
    const jogosBrasil = obterJogosBrasil(dados);

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

    ordenarJogosPorData(jogosBrasil);

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
            <strong>${textoSeguro(proximo.data || montarDataHoraPainel(proximo))}</strong>
            ${proximo.hora ? `<span class="hora-jogo">${textoSeguro(proximo.hora)}</span>` : ""}
            <br>
            ${textoSeguro(proximo.casa)} x ${textoSeguro(proximo.fora)}
        `;
    }

    if (timeCasa) timeCasa.innerText = textoSeguro(proximo.casa);
    if (timeFora) timeFora.innerText = textoSeguro(proximo.fora);
    if (golCasa) golCasa.innerText = numeroSeguro(proximo.golsCasa);
    if (golFora) golFora.innerText = numeroSeguro(proximo.golsFora);

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

function obterJogosBrasil(dadosOuGrupos) {
    const jogos = [];
    const todosJogos = obterTodosJogos(dadosOuGrupos);

    todosJogos.forEach(jogo => {
        if (jogoTemBrasil(jogo)) {
            jogos.push(jogo);
        }
    });

    return jogos;
}

function jogoTemBrasil(jogo) {
    const casa = textoSeguro(jogo.casa).toLowerCase();
    const fora = textoSeguro(jogo.fora).toLowerCase();

    return casa === "brasil" || fora === "brasil";
}

function obterTodosJogos(dadosOuGrupos) {
    const jogos = [];

    if (Array.isArray(dadosOuGrupos)) {
        dadosOuGrupos.forEach(grupo => {
            const listaJogos = Array.isArray(grupo.jogos) ? grupo.jogos : [];
            listaJogos.forEach(jogo => jogos.push(jogo));
        });

        return jogos;
    }

    const grupos = Array.isArray(dadosOuGrupos?.grupos) ? dadosOuGrupos.grupos : [];
    const mataMata = Array.isArray(dadosOuGrupos?.mataMata) ? dadosOuGrupos.mataMata : [];

    grupos.forEach(grupo => {
        const listaJogos = Array.isArray(grupo.jogos) ? grupo.jogos : [];
        listaJogos.forEach(jogo => jogos.push(jogo));
    });

    mataMata.forEach(fase => {
        const listaJogos = Array.isArray(fase.jogos) ? fase.jogos : [];
        listaJogos.forEach(jogo => jogos.push(jogo));
    });

    return jogos;
}

function ordenarJogosPorData(jogos) {
    jogos.sort((a, b) => {
        const dataA = obterDataDoJogo(a);
        const dataB = obterDataDoJogo(b);

        const tempoA = dataA ? dataA.getTime() : 0;
        const tempoB = dataB ? dataB.getTime() : 0;

        return tempoA - tempoB;
    });
}

function jogoEmAndamento(jogo) {
    const status = textoSeguro(jogo.status).toLowerCase();

    return (
        status === "em andamento" ||
        status === "ao vivo" ||
        status === "live" ||
        status === "in_play" ||
        status === "in play" ||
        status === "playing" ||
        status === "1h" ||
        status === "2h" ||
        status === "intervalo" ||
        status === "half_time" ||
        status === "ht"
    );
}

function jogoFinalizado(jogo) {
    const status = textoSeguro(jogo.status).toLowerCase();

    return (
        status === "finalizado" ||
        status === "encerrado" ||
        status === "complete" ||
        status === "completed" ||
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

function montarDataHoraPainel(jogo) {
    const data = textoSeguro(jogo.data);
    const hora = textoSeguro(jogo.hora);

    if (data && hora) return `${data} ${hora}`;
    if (data) return data;
    if (hora) return hora;

    const dataJogo = obterDataDoJogo(jogo);

    if (dataJogo) {
        return dataJogo.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    return "-";
}

function montarConfrontoPainel(jogo) {
    return `
        ${textoSeguro(jogo.bandeiraCasa)} ${textoSeguro(jogo.casa)}
        x
        ${textoSeguro(jogo.bandeiraFora)} ${textoSeguro(jogo.fora)}
    `;
}

function montarStatusPainel(jogo) {
    const statusOriginal = textoSeguro(jogo.status);
    const status = statusOriginal.toLowerCase();

    if (jogoEmAndamento(jogo)) {
        return `🔴 ${statusOriginal || "Em andamento"}`;
    }

    if (jogoFinalizado(jogo)) {
        return "✅ Finalizado";
    }

    const dataJogo = obterDataDoJogo(jogo);

    if (dataJogo) {
        const agora = new Date();
        const hoje = agora.toLocaleDateString("pt-BR");
        const dataTexto = dataJogo.toLocaleDateString("pt-BR");
        const horaTexto = dataJogo.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit"
        });

        if (dataTexto === hoje) {
            return `⏳ Hoje ${horaTexto}`;
        }

        return `📅 ${dataTexto} ${horaTexto}`;
    }

    if (status === "agendado" || status === "scheduled") {
        return "⏳ Agendado";
    }

    return statusOriginal || "-";
}

function traduzirFase(stage) {
    const mapa = {
        "GROUP_STAGE": "Fase de grupos",
        "LAST_32": "Oitavas",
        "ROUND_OF_32": "Oitavas",
        "LAST_16": "Oitavas",
        "ROUND_OF_16": "Oitavas",
        "QUARTER_FINALS": "Quartas",
        "SEMI_FINALS": "Semifinal",
        "THIRD_PLACE": "3º lugar",
        "FINAL": "Final"
    };

    return mapa[String(stage).toUpperCase()] || textoSeguro(stage);
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