// Motor de cálculo do planejamento financeiro (os 6 domínios do planejamento
// profissional + reserva e dívidas). Funções puras: não mexem na tela,
// por isso rodam igual no celular e no Node (testes/calc.test.js).
'use strict';

(function (raiz) {
  const PARAM_PADRAO = typeof PARAMETROS !== 'undefined' ? PARAMETROS : require('./parametros.js');

  // ===================== Utilidades =====================

  const n = (v) => (Number.isFinite(+v) ? +v : 0);
  const soma = (arr, f = (x) => x) => (arr || []).reduce((s, x) => s + n(f(x)), 0);
  const lim = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
  const arred = (v) => Math.round(v * 100) / 100;
  const taxaMensal = (anual) => Math.pow(1 + anual, 1 / 12) - 1;
  const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Math.round(n(v)));
  const pct = (v, casas = 1) => (n(v) * 100).toFixed(casas).replace('.', ',') + '%';

  // Valor futuro de um saldo inicial (pv) mais aportes mensais (pmt).
  function vf(pv, pmt, i, nper) {
    if (nper <= 0) return pv;
    if (i === 0) return pv + pmt * nper;
    const f = Math.pow(1 + i, nper);
    return pv * f + (pmt * (f - 1)) / i;
  }

  // Aporte mensal para chegar a um alvo, partindo de um saldo.
  function aporteParaAlvo(alvo, pv, i, nper) {
    if (nper <= 0) return Math.max(0, alvo - pv);
    const f = Math.pow(1 + i, nper);
    const falta = alvo - pv * f;
    if (falta <= 0) return 0;
    return i === 0 ? falta / nper : (falta * i) / (f - 1);
  }

  // Capital que paga uma renda mensal por nper meses (consumindo o capital).
  function capitalParaRenda(renda, i, nper) {
    if (nper <= 0 || renda <= 0) return 0;
    if (i === 0) return renda * nper;
    return (renda * (1 - Math.pow(1 + i, -nper))) / i;
  }

  // ===================== Tributos =====================

  function inssMensal(salario, P = PARAM_PADRAO) {
    let anterior = 0;
    let total = 0;
    for (const [teto, aliq] of P.inss.faixas) {
      if (salario > anterior) total += (Math.min(salario, teto) - anterior) * aliq;
      anterior = teto;
    }
    return arred(total);
  }

  function irPelaTabela(base, faixas) {
    for (const [ate, aliq, ded] of faixas) if (base <= ate) return Math.max(0, base * aliq - ded);
    return 0;
  }

  // IR anual com o redutor da Lei 15.270/2025.
  // rendimentos = rendimentos tributáveis (define o redutor); base = depois das deduções.
  function irAnual(rendimentos, base, P = PARAM_PADRAO) {
    const ir = irPelaTabela(Math.max(0, base), P.irAnual.faixas);
    const R = P.irAnual.redutor;
    let reducao = 0;
    if (rendimentos <= R.ate) reducao = R.maxReducao;
    else if (rendimentos <= R.limite) reducao = Math.max(0, R.a - R.b * rendimentos);
    return arred(Math.max(0, ir - reducao));
  }

  function itcmd(valor, uf, P = PARAM_PADRAO) {
    if (valor <= 0) return 0;
    const tabela = P.sucessao.itcmd[uf];
    if (!tabela) return arred(valor * P.sucessao.itcmd.padrao);
    let anterior = 0;
    let total = 0;
    for (const [teto, aliq] of tabela.faixas) {
      if (valor > anterior) total += (Math.min(valor, teto) - anterior) * aliq;
      anterior = teto;
    }
    return arred(total);
  }

  // ===================== Perfil de investidor =====================

  const QUESTOES_PERFIL = [
    { p: 'Qual é o seu principal objetivo ao investir?', o: ['Proteger o dinheiro, sem perdas', 'Ter uma renda estável', 'Crescer o patrimônio aceitando alguma oscilação', 'Fazer o patrimônio crescer o máximo possível'] },
    { p: 'Por quanto tempo pretende deixar a maior parte do dinheiro investida?', o: ['Menos de 1 ano', 'De 1 a 3 anos', 'De 3 a 5 anos', 'Mais de 5 anos'] },
    { p: 'Se seus investimentos caíssem 20% em um mês, o que você faria?', o: ['Resgataria tudo', 'Resgataria uma parte', 'Manteria e esperaria', 'Aproveitaria para investir mais'] },
    { p: 'Em quais investimentos você já aplicou?', o: ['Só poupança', 'CDB, Tesouro ou fundos de renda fixa', 'Já comprei ações ou fundos imobiliários', 'Invisto em renda variável com frequência'] },
    { p: 'Quanto do seu patrimônio pode ficar em investimentos que oscilam?', o: ['Nada', 'Até 20%', 'Até 50%', 'Mais de 50%'] },
    { p: 'Como você avalia seu conhecimento sobre investimentos?', o: ['Nenhum', 'Básico', 'Bom', 'Avançado ou profissional'] },
    { p: 'Vai precisar desse dinheiro para despesas nos próximos 2 anos?', o: ['Sim, de quase tudo', 'Sim, de uma parte', 'De muito pouco', 'Não'] },
    { p: 'Qual frase combina mais com você?', o: ['Prefiro ganhar pouco e dormir tranquilo', 'Aceito pequenas perdas para ganhar um pouco mais', 'Aceito perdas moderadas para ganhar mais no longo prazo', 'Aceito perdas grandes no curto prazo em busca de ganhos maiores'] },
  ];

  // Cada resposta vale de 1 a 4 pontos (índice + 1).
  function perfilInvestidor(respostas) {
    const r = (respostas || []).map((x) => (x === null || x === undefined || x === '' ? null : n(x)));
    if (r.length < QUESTOES_PERFIL.length || r.some((x) => x === null)) return { perfil: null, pontos: 0 };
    const pontos = soma(r, (x) => x + 1);
    let perfil = pontos <= 16 ? 'conservador' : pontos <= 24 ? 'moderado' : 'arrojado';
    // Quem venderia na queda não deve ficar em carteira arrojada.
    if (r[2] <= 1 && perfil === 'arrojado') perfil = 'moderado';
    if (r[2] === 0) perfil = 'conservador';
    return { perfil, pontos };
  }

  // ===================== Agregados do perfil =====================

  function agregados(pf) {
    const pat = pf.patrimonio || {};
    const renda = pf.renda || {};
    const desp = pf.despesas || {};
    const dividas = (pf.dividas || []).filter((d) => n(d.saldo) > 0 || n(d.parcela) > 0);
    const investido = n(pat.rendaFixa) + n(pat.acoes) + n(pat.fiis) + n(pat.exterior) + n(pat.cripto) + n(pat.pgbl) + n(pat.vgbl);
    const financeiro = n(pat.reserva) + investido;
    const total = financeiro + n(pat.fgts) + n(pat.imoveis) + n(pat.veiculos) + n(pat.empresa) + n(pat.outros);
    const totalDividas = soma(dividas, (d) => d.saldo);
    return {
      rendaMensal: n(renda.liquida) + n(renda.outras),
      gastos: soma(Object.values(desp)),
      parcelas: soma(dividas, (d) => d.parcela),
      investe: n(renda.investeMensal),
      dividas,
      totalDividas,
      investido,
      financeiro,
      total,
      liquido: total - totalDividas,
    };
  }

  // ===================== Domínios =====================

  function acao(prazo, prio, titulo, texto) { return { prazo, prio, titulo, texto }; }

  function fluxoDeCaixa(pf, A, P) {
    const sobra = A.rendaMensal - A.gastos - A.parcelas;
    const taxa = A.rendaMensal > 0 ? A.investe / A.rendaMensal : 0;
    // A nota usa o que de fato cabe no orçamento: não dá para investir mais do que sobra.
    const taxaNota = A.rendaMensal > 0 ? Math.min(A.investe, Math.max(0, sobra)) / A.rendaMensal : 0;
    const achados = [];
    const acoes = [];
    let nota;
    if (sobra < 0) nota = 10;
    else if (A.investe <= 0) nota = 25;
    else if (taxaNota >= 0.2) nota = 100;
    else if (taxaNota >= 0.15) nota = 85;
    else if (taxaNota >= 0.1) nota = 70;
    else if (taxaNota >= 0.05) nota = 50;
    else nota = 35;

    achados.push({ tipo: 'info', texto: `Entram ${brl(A.rendaMensal)} por mês; saem ${brl(A.gastos)} em gastos e ${brl(A.parcelas)} em parcelas.` });
    if (sobra < 0) {
      achados.push({ tipo: 'risco', texto: `Faltam ${brl(-sobra)} por mês: os gastos são maiores que a renda.` });
      acoes.push(acao('30 dias', 1, 'Fechar o déficit mensal', `Cortar ou renegociar ${brl(-sobra)} por mês. Comece pelas maiores categorias de gasto e pelas parcelas com juros mais altos.`));
    } else {
      achados.push({ tipo: taxa >= 0.15 ? 'ok' : 'atencao', texto: `Você investe ${brl(A.investe)} por mês, ${pct(taxa)} da renda. O ideal é 15% a 20% ou mais.` });
      if (A.investe > sobra + 1) achados.push({ tipo: 'atencao', texto: `O valor que você diz investir é maior que a sobra calculada (${brl(sobra)}). Vale revisar os gastos informados.` });
      if (taxa < 0.15) {
        const meta = Math.min(sobra, A.rendaMensal * 0.15);
        if (meta > A.investe) acoes.push(acao('6 meses', 3, 'Investir pelo menos 15% da renda', `Programe um aporte automático de ${brl(meta)} no dia em que o salário cai, antes de gastar.`));
      }
    }
    return { id: 'fluxo', nome: 'Orçamento', nota, achados, acoes, dados: { sobra, taxa } };
  }

  function reservaEmergencia(pf, A, P) {
    const tipo = (pf.pessoal || {}).tipoRenda;
    const instavel = ['pj', 'autonomo', 'empresario'].includes(tipo);
    const meses = instavel ? P.premissas.mesesReservaInstavel : P.premissas.mesesReservaEstavel;
    const custo = A.gastos + A.parcelas;
    const alvo = custo * meses;
    const atual = n((pf.patrimonio || {}).reserva);
    const falta = Math.max(0, alvo - atual);
    const nota = alvo > 0 ? lim((atual / alvo) * 100) : 100;
    const achados = [];
    const acoes = [];
    achados.push({ tipo: falta === 0 ? 'ok' : nota < 35 ? 'risco' : 'atencao', texto: `Reserva ideal: ${meses} meses do seu custo de vida = ${brl(alvo)}. Você tem ${brl(atual)} (${(custo > 0 ? atual / custo : 0).toFixed(1).replace('.', ',')} meses).` });
    if (falta > 0) {
      const aporte = A.investe > 0 ? A.investe : Math.max(0, A.rendaMensal - A.gastos - A.parcelas);
      const prazo = aporte > 0 ? Math.ceil(falta / aporte) : null;
      acoes.push(acao(atual < custo ? '30 dias' : '6 meses', atual < custo ? 1 : 2, 'Completar a reserva de emergência',
        `Juntar mais ${brl(falta)} em aplicação pós-fixada com liquidez diária (título público pós-fixado ou CDB de liquidez diária que pague perto de 100% do CDI).` +
        (prazo ? ` Com ${brl(aporte)} por mês, leva cerca de ${prazo} ${prazo === 1 ? 'mês' : 'meses'}.` : '')));
    } else if (alvo > 0 && atual > alvo * 2) {
      achados.push({ tipo: 'atencao', texto: `Há ${brl(atual - alvo)} além do necessário parados em liquidez; esse excedente pode trabalhar nos objetivos de longo prazo.` });
      acoes.push(acao('6 meses', 4, 'Investir o excesso da reserva', `Direcionar ${brl(atual - alvo)} para os objetivos de médio e longo prazo, conforme o seu perfil.`));
    }
    if (instavel) achados.push({ tipo: 'info', texto: 'Como sua renda varia, a reserva recomendada é maior (12 meses).' });
    return { id: 'reserva', nome: 'Reserva de emergência', nota, achados, acoes, dados: { alvo, atual, falta, meses } };
  }

  function dividas(pf, A, P) {
    const achados = [];
    const acoes = [];
    if (!A.dividas.length) {
      achados.push({ tipo: 'ok', texto: 'Você não tem dívidas. Ótimo ponto de partida.' });
      return { id: 'dividas', nome: 'Dívidas', nota: 100, achados, acoes, dados: { comprometimento: 0 } };
    }
    const comprometimento = A.rendaMensal > 0 ? A.parcelas / A.rendaMensal : 1;
    const caras = A.dividas.filter((d) => n(d.taxaMes) / 100 > P.premissas.taxaDividaCara).sort((a, b) => n(b.taxaMes) - n(a.taxaMes));
    const jurosMes = soma(A.dividas, (d) => (n(d.saldo) * n(d.taxaMes)) / 100);
    let nota = 100;
    if (comprometimento > P.premissas.limiteParcelas) nota -= 40;
    else if (comprometimento > 0.2) nota -= 15;
    if (caras.length) nota -= caras.some((d) => n(d.taxaMes) > 5) ? 50 : 30;
    nota = lim(nota);

    achados.push({ tipo: comprometimento > P.premissas.limiteParcelas ? 'risco' : 'info', texto: `Dívidas somam ${brl(A.totalDividas)}; as parcelas usam ${pct(comprometimento)} da renda (limite saudável: 30%).` });
    if (jurosMes > 0) achados.push({ tipo: caras.length ? 'risco' : 'info', texto: `Você paga cerca de ${brl(jurosMes)} de juros por mês.` });
    if (caras.length) {
      const ordem = caras.map((d) => `${d.descricao || 'dívida'} (${String(d.taxaMes).replace('.', ',')}% a.m.)`).join(', ');
      acoes.push(acao('30 dias', 1, 'Eliminar as dívidas caras', `Quitar ou renegociar nesta ordem, da taxa maior para a menor: ${ordem}. Trocar por crédito mais barato (consignado ou com garantia) também reduz os juros.`));
      const saldoCaro = soma(caras, (d) => d.saldo);
      const livre = n((pf.patrimonio || {}).rendaFixa) + n((pf.patrimonio || {}).acoes) + n((pf.patrimonio || {}).fiis);
      if (livre > 0) acoes.push(acao('30 dias', 1, 'Usar investimentos para quitar juros altos', `Você tem ${brl(livre)} aplicados rendendo perto de 1% ao mês e paga mais que isso nas dívidas caras (${brl(saldoCaro)}). Resgatar parte para quitar é um ganho garantido.`));
    }
    return { id: 'dividas', nome: 'Dívidas', nota, achados, acoes, dados: { comprometimento, jurosMes, caras: caras.length } };
  }

  function objetivosEInvestimentos(pf, A, P, ctx) {
    const pat = pf.patrimonio || {};
    const { perfil: perfilCalc } = perfilInvestidor((pf.suitability || {}).respostas);
    const perfil = perfilCalc || 'moderado';
    const i = taxaMensal(ctx.jurosReal);
    const achados = [];
    const acoes = [];

    if (!perfilCalc) achados.push({ tipo: 'atencao', texto: 'O questionário de perfil não foi respondido; usamos o perfil moderado como referência.' });
    else achados.push({ tipo: 'info', texto: `Seu perfil de investidor: ${perfil}.` });

    const objetivos = (pf.objetivos || []).filter((o) => n(o.valor) > 0).map((o) => {
      const anos = Math.max(0, n(o.anos));
      const aporte = aporteParaAlvo(n(o.valor), n(o.guardado), i, anos * 12);
      const onde = anos < 2 ? 'pós-fixado com liquidez' : anos <= 5 ? 'renda fixa com vencimento perto da data do objetivo (pós, prefixado ou IPCA+)' : `carteira diversificada do seu perfil (${perfil})`;
      return { nome: o.nome || 'Objetivo', valor: n(o.valor), anos, guardado: n(o.guardado), aporte, onde, prioridade: o.prioridade || 'media' };
    });
    const totalAporteObj = soma(objetivos, (o) => o.aporte);
    // Cobertura: o aporte atual paga os objetivos e a aposentadoria juntos?
    const notaObj = totalAporteObj === 0 ? 100 : lim((Math.max(0, A.investe) / (totalAporteObj + ctx.aporteAposentadoriaNecessario)) * 100);

    for (const o of objetivos) {
      achados.push({ tipo: 'info', texto: `${o.nome}: ${brl(o.valor)} em ${o.anos} anos. Aporte necessário: ${brl(o.aporte)}/mês. Onde investir: ${o.onde}.` });
    }
    if (objetivos.length && totalAporteObj + ctx.aporteAposentadoriaNecessario > A.investe) {
      const falta = totalAporteObj + ctx.aporteAposentadoriaNecessario - A.investe;
      achados.push({ tipo: 'atencao', texto: `Para cumprir todos os objetivos e a aposentadoria, faltam ${brl(falta)} por mês de aporte.` });
      acoes.push(acao('6 meses', 3, 'Ajustar objetivos ao orçamento', `Faltam ${brl(falta)} por mês. Opções: aumentar o aporte, alongar prazos ou priorizar os objetivos de prioridade alta.`));
    }

    // Diversificação: atual x alvo do perfil, em grandes classes (previdência fica fora).
    const alvo = P.alocacao[perfil];
    const alvoMacro = {
      'Renda fixa': alvo['Pós-fixado'] + alvo['Inflação (IPCA+)'] + alvo['Prefixado'],
      'Renda variável Brasil': alvo['Ações'] + alvo['Fundos imobiliários'],
      'Exterior': alvo['Exterior'],
      'Cripto': alvo['Cripto'],
    };
    const atualMacro = {
      'Renda fixa': n(pat.reserva) + n(pat.rendaFixa),
      'Renda variável Brasil': n(pat.acoes) + n(pat.fiis),
      'Exterior': n(pat.exterior),
      'Cripto': n(pat.cripto),
    };
    const base = soma(Object.values(atualMacro));
    let notaDiv = 80;
    const comparativo = Object.keys(alvoMacro).map((k) => ({ classe: k, alvo: alvoMacro[k] / 100, atual: base > 0 ? atualMacro[k] / base : 0 }));
    if (base >= 10000) {
      const distancia = soma(comparativo, (c) => Math.abs(c.atual - c.alvo)) / 2;
      notaDiv = lim((1 - distancia) * 100);
      if (distancia > 0.2) {
        acoes.push(acao('12 meses', 4, 'Rebalancear a carteira', `A carteira está ${pct(distancia, 0)} distante da alocação do seu perfil. Ajuste aos poucos, usando os novos aportes.`));
      }
      if (atualMacro['Cripto'] / base > 0.1) achados.push({ tipo: 'atencao', texto: `Cripto representa ${pct(atualMacro['Cripto'] / base, 0)} da carteira. Acima de 10% o risco de oscilação fica alto.` });
    }
    if (ctx.semBase) achados.push({ tipo: 'atencao', texto: 'Antes de aumentar o risco da carteira, complete a reserva e elimine as dívidas caras.' });

    const nota = Math.round(0.5 * notaDiv + 0.5 * notaObj);
    return { id: 'investimentos', nome: 'Objetivos e investimentos', nota, achados, acoes, dados: { perfil, perfilRespondido: !!perfilCalc, objetivos, totalAporteObj, comparativo, alocacao: alvo } };
  }

  function aposentadoria(pf, A, P, ctx) {
    const ap = pf.aposentadoria || {};
    const idade = n((pf.pessoal || {}).idade);
    const idadeAp = n(ctx.idadeAposentadoria) || n(ap.idadeDesejada) || P.premissas.idadeAposentadoria;
    const renda = n(ctx.rendaDesejada) || n(ap.rendaDesejada) || A.gastos;
    const aCobrir = Math.max(0, renda - n(ap.inssEstimado) - n(ap.outrasRendas));
    const i = taxaMensal(ctx.jurosReal);
    const expectativa = P.premissas.expectativaVida;
    const nAte = Math.max(0, idadeAp - idade) * 12;
    const nUso = Math.max(1, expectativa - Math.max(idade, idadeAp)) * 12;
    const necessario = capitalParaRenda(aCobrir, i, nUso);
    const perpetuo = (aCobrir * 12) / P.premissas.retiradaSegura;
    const guardadoObj = soma(pf.objetivos || [], (o) => o.guardado);
    const base = Math.max(0, A.investido + n((pf.patrimonio || {}).fgts) - guardadoObj);
    const aporte = Math.max(0, (ap.aporteMensal !== '' && ap.aporteMensal !== undefined && ap.aporteMensal !== null ? n(ap.aporteMensal) : Math.max(0, A.investe - ctx.aporteObjetivos)) + n(ctx.aporteExtra));
    const projetado = vf(base, aporte, i, nAte);
    const aporteNecessario = aporteParaAlvo(necessario, base, i, nAte);
    const nota = necessario > 0 ? lim((projetado / necessario) * 100) : 100;

    let idadePossivel = null;
    for (let a = Math.max(idade, 40); a <= 85; a++) {
      const nA = Math.max(0, a - idade) * 12;
      const nU = Math.max(1, expectativa - a) * 12;
      if (vf(base, aporte, i, nA) >= capitalParaRenda(aCobrir, i, nU)) { idadePossivel = a; break; }
    }

    const achados = [];
    const acoes = [];
    achados.push({ tipo: 'info', texto: `Meta: ${brl(renda)} por mês (em valores de hoje) a partir dos ${idadeAp} anos${n(ap.inssEstimado) ? `, sendo ${brl(ap.inssEstimado)} do INSS` : ''}.` });
    achados.push({ tipo: 'info', texto: `Patrimônio necessário: ${brl(necessario)} (consumindo o capital até os ${expectativa} anos) ou ${brl(perpetuo)} para viver só da renda, sem mexer no principal.` });
    achados.push({ tipo: nota >= 100 ? 'ok' : nota >= 70 ? 'atencao' : 'risco', texto: `No ritmo atual (${brl(aporte)}/mês), você chega com cerca de ${brl(projetado)}: ${pct(projetado / (necessario || 1), 0)} do necessário.` });
    if (idadePossivel && idadePossivel !== idadeAp) achados.push({ tipo: 'info', texto: `Mantendo esse aporte, a aposentadoria com essa renda fica possível aos ${idadePossivel} anos.` });
    if (!idadePossivel && necessario > 0) achados.push({ tipo: 'risco', texto: 'Com o aporte atual, a renda desejada não é alcançada nem aos 85 anos.' });
    if (aporteNecessario > aporte + 1) {
      acoes.push(acao('6 meses', 2, 'Aumentar o aporte da aposentadoria', `Para chegar à meta aos ${idadeAp} anos, o aporte precisa ser de ${brl(aporteNecessario)} por mês (hoje: ${brl(aporte)}). Outra saída é ajustar a idade ou a renda desejada.`));
    }
    return { id: 'aposentadoria', nome: 'Aposentadoria', nota, achados, acoes, dados: { idadeAp, renda, aCobrir, necessario, perpetuo, base, aporte, projetado, aporteNecessario, idadePossivel } };
  }

  function sucessao(pf, A, P) {
    const pessoal = pf.pessoal || {};
    const pat = pf.patrimonio || {};
    const suc = pf.sucessao || {};
    const prot = pf.protecao || {};
    const casado = ['casado', 'uniao'].includes(pessoal.estadoCivil);
    const meacao = casado && pessoal.regimeBens !== 'separacao' ? 0.5 : 0;
    const previdencia = n(pat.pgbl) + n(pat.vgbl);
    const bens = Math.max(0, A.total - previdencia - A.totalDividas);
    const heranca = bens * (1 - meacao);
    const imposto = itcmd(heranca, pessoal.uf, P);
    const custo = imposto + heranca * (P.sucessao.honorarios + P.sucessao.custas);
    const liquidezFora = previdencia + n(prot.seguroVida);
    const temHerdeiros = casado || (pessoal.dependentes || []).some((d) => d.parentesco === 'filho');
    const precisaHolding = A.total >= P.sucessao.patrimonioHolding || (n(pat.empresa) > 0 && !!suc.empresaFamiliar);
    const precisaTestamento = heranca >= P.sucessao.patrimonioTestamento || suc.familiaRecomposta;

    const achados = [];
    const acoes = [];
    let nota;
    if (heranca < 50000) {
      nota = 90;
      achados.push({ tipo: 'ok', texto: 'O patrimônio a inventariar ainda é pequeno. O mais importante agora é a proteção da família (seguro de vida).' });
    } else {
      const cobertura = custo > 0 ? Math.min(1, liquidezFora / custo) : 1;
      nota = Math.round(50 * cobertura + (precisaTestamento ? (suc.testamento ? 20 : 0) : 20) + (precisaHolding ? (suc.holding ? 30 : 0) : 30));
      achados.push({ tipo: 'info', texto: `Patrimônio que iria a inventário: ${brl(heranca)}${meacao ? ' (já descontada a meação do cônjuge)' : ''}.` });
      achados.push({ tipo: 'atencao', texto: `Custo estimado do inventário: ${brl(custo)} (ITCMD ${brl(imposto)} + advogado e custas). Durante o inventário, contas e bens ficam bloqueados.` });
      achados.push({ tipo: liquidezFora >= custo ? 'ok' : 'risco', texto: `Dinheiro disponível para a família fora do inventário (previdência e seguro de vida): ${brl(liquidezFora)}.` });
      if (liquidezFora < custo) {
        acoes.push(acao('6 meses', 2, 'Criar liquidez para a sucessão', `Garantir ${brl(custo - liquidezFora)} fora do inventário, com seguro de vida ou previdência (VGBL/PGBL) com beneficiários indicados.`));
      }
      if (precisaTestamento && !suc.testamento) {
        acoes.push(acao('12 meses', 3, 'Fazer testamento', `Organizar a divisão dos bens em testamento${temHerdeiros ? ', respeitando a legítima (50% do patrimônio fica com os herdeiros necessários)' : ''}.`));
      }
      if (precisaHolding && !suc.holding) {
        acoes.push(acao('12 meses', 3, 'Estudar holding patrimonial', 'Pelo tamanho do patrimônio, vale avaliar holding patrimonial com doação das cotas e reserva de usufruto: reduz custo, tempo e conflitos na sucessão.'));
      }
      if (suc.empresaFamiliar) achados.push({ tipo: 'atencao', texto: 'Empresa familiar: defina acordo de sócios e regras de sucessão na gestão, além da sucessão das cotas.' });
    }
    if (previdencia > 0) achados.push({ tipo: 'info', texto: 'Previdência privada costuma ficar fora do inventário. A reforma tributária (LC 227/2026) mudou regras do ITCMD: confirme a situação do seu plano com o planejador.' });
    return { id: 'sucessao', nome: 'Sucessão', nota: lim(nota), achados, acoes, dados: { heranca, imposto, custo, liquidezFora, meacao } };
  }

  function protecao(pf, A, P, ctx) {
    const pessoal = pf.pessoal || {};
    const prot = pf.protecao || {};
    const deps = pessoal.dependentes || [];
    const casado = ['casado', 'uniao'].includes(pessoal.estadoCivil);
    const temDependentes = deps.length > 0 || casado;
    const filhos = deps.filter((d) => d.parentesco === 'filho');
    const educacao = soma(filhos, (f) => Math.max(0, P.premissas.idadeFimEducacao - n(f.idade)) * P.premissas.custoEducacaoAnualFilho);
    const rendaFamilia = A.gastos * 12 * P.premissas.anosRendaDependentes;
    const seguro = n(prot.seguroVida);
    const recursos = A.financeiro + n((pf.patrimonio || {}).fgts);
    const necessidadeBruta = A.totalDividas + educacao + rendaFamilia + ctx.custoSucessao;
    const lacuna = temDependentes ? Math.max(0, necessidadeBruta - recursos - seguro) : 0;
    const aposentado = pessoal.tipoRenda === 'aposentado';

    const notaVida = !temDependentes ? 100 : lacuna === 0 ? 100 : lim((seguro / (seguro + lacuna)) * 100);
    const notaInv = aposentado || prot.seguroInvalidez ? 100 : 0;
    const notaSaude = prot.planoSaude ? 100 : 40;
    const nota = Math.round(0.6 * notaVida + 0.25 * notaInv + 0.15 * notaSaude);

    const achados = [];
    const acoes = [];
    if (temDependentes) {
      achados.push({ tipo: lacuna > 0 ? 'risco' : 'ok', texto: `Se você faltar, a família precisaria de cerca de ${brl(necessidadeBruta)} (dívidas, ${P.premissas.anosRendaDependentes} anos de despesas${educacao ? ', estudo dos filhos' : ''} e inventário). Recursos atuais + seguro: ${brl(recursos + seguro)}.` });
      if (lacuna > 0) acoes.push(acao('30 dias', 2, 'Contratar seguro de vida', `Cobertura de cerca de ${brl(lacuna)}. O seguro de vida temporário costuma ser o de menor custo para essa proteção.`));
    } else {
      achados.push({ tipo: 'ok', texto: 'Sem dependentes financeiros, o seguro de vida não é prioridade agora.' });
    }
    if (!aposentado && !prot.seguroInvalidez) {
      achados.push({ tipo: 'atencao', texto: 'Sua renda depende do seu trabalho e não há proteção para invalidez ou doença grave.' });
      acoes.push(acao('6 meses', 3, 'Proteger a sua renda', 'Avaliar cobertura de invalidez por acidente ou doença e de doenças graves.'));
    }
    if (!prot.planoSaude) achados.push({ tipo: 'atencao', texto: 'Sem plano de saúde, um imprevisto pode consumir a reserva. Avalie um plano compatível com o orçamento.' });
    return { id: 'protecao', nome: 'Proteção da família', nota, achados, acoes, dados: { lacuna, necessidadeBruta, temDependentes } };
  }

  function tributario(pf, A, P) {
    const trib = pf.tributario || {};
    const pessoal = pf.pessoal || {};
    const bruta = n((pf.renda || {}).brutaAnual);
    const achados = [];
    const acoes = [];
    if (bruta <= 0) {
      achados.push({ tipo: 'info', texto: 'Renda bruta anual não informada; a análise de imposto de renda não foi feita.' });
      return { id: 'tributario', nome: 'Impostos', nota: null, aplicavel: false, achados, acoes, dados: {} };
    }
    const I = P.irAnual;
    const contribui = !!trib.contribuiINSS;
    const inss = contribui ? Math.min(inssMensal(bruta / 13, P), inssMensal(P.inss.teto, P)) * 13 : 0;
    const nDeps = (pessoal.dependentes || []).length;
    const dedutiveis = n(trib.despesasMedicas) + Math.min(n(trib.despesasEducacao), I.educacaoLimitePessoa * (1 + nDeps));
    const maxPGBL = bruta * P.previdencia.limitePGBL;
    const pgblAtual = Math.min(n(trib.aportePGBLAnual), maxPGBL);
    const baseCompleta = (pgbl) => bruta - inss - nDeps * I.deducaoDependente - dedutiveis - (contribui ? pgbl : 0);
    const irSimpl = irAnual(bruta, bruta - Math.min(bruta * I.descontoSimplificado.pct, I.descontoSimplificado.limite), P);
    const irCompAtual = irAnual(bruta, baseCompleta(pgblAtual), P);
    const irCompMax = irAnual(bruta, baseCompleta(maxPGBL), P);
    const irAtual = Math.min(irSimpl, irCompAtual);
    const irOtimo = contribui ? Math.min(irSimpl, irCompMax) : irAtual;
    const economia = Math.max(0, irAtual - irOtimo);
    const melhorModelo = irCompAtual < irSimpl ? 'completa' : 'simplificada';
    const nota = economia <= 0 ? 100 : lim(100 - (economia / bruta) * 1000, 40, 95);

    achados.push({ tipo: 'info', texto: `IR anual estimado: ${brl(irSimpl)} na declaração simplificada e ${brl(irCompAtual)} na completa. Hoje a melhor é a ${melhorModelo}.` });
    if (trib.declaracao && trib.declaracao !== 'nao_sei' && trib.declaracao !== 'nao_declara' && trib.declaracao !== melhorModelo && Math.abs(irSimpl - irCompAtual) > 100) {
      achados.push({ tipo: 'atencao', texto: `Você declara no modelo ${trib.declaracao}, mas o ${melhorModelo} sairia ${brl(Math.abs(irSimpl - irCompAtual))} mais barato.` });
    }
    if (bruta <= I.redutor.ate) achados.push({ tipo: 'ok', texto: 'Com renda tributável de até R$ 60 mil por ano, o IR fica zerado pela nova regra de 2026. Para previdência, o VGBL é o mais indicado.' });
    if (economia > 0) {
      acoes.push(acao('12 meses', 3, 'Usar o PGBL para pagar menos IR', `Aportar mais ${brl(maxPGBL - pgblAtual)} por ano em PGBL (até 12% da renda bruta) e declarar no modelo completo reduz o IR em cerca de ${brl(economia)} por ano. O imposto é pago no resgate; na tabela regressiva, cai para 10% após 10 anos.`));
    } else if (contribui && bruta > I.redutor.ate) {
      achados.push({ tipo: 'ok', texto: 'O PGBL não traz ganho de IR na sua situação; para previdência, prefira o VGBL.' });
    }
    if (!contribui) achados.push({ tipo: 'info', texto: 'Quem não contribui para o INSS ou regime próprio não pode deduzir o PGBL.' });
    if (bruta + n((pf.renda || {}).outras) * 12 > 600000) achados.push({ tipo: 'atencao', texto: 'Renda acima de R$ 600 mil por ano entra na tributação mínima de altas rendas (Lei 15.270/2025). Vale um planejamento tributário específico.' });
    if (['pj', 'empresario'].includes(pessoal.tipoRenda)) achados.push({ tipo: 'info', texto: 'Desde 2026, dividendos acima de R$ 50 mil por mês de uma mesma empresa têm 10% de IR retido. O equilíbrio entre pró-labore e dividendos merece revisão.' });
    achados.push({ tipo: 'info', texto: 'Em previdência de longo prazo (mais de 10 anos), a tabela regressiva leva o IR a 10%.' });
    return { id: 'tributario', nome: 'Impostos', nota, aplicavel: true, achados, acoes, dados: { irSimpl, irCompAtual, irOtimo, economia, melhorModelo, maxPGBL } };
  }

  // ===================== Plano completo =====================

  const PESOS = { fluxo: 15, reserva: 15, dividas: 15, investimentos: 10, aposentadoria: 15, protecao: 15, tributario: 5, sucessao: 10 };
  const ORDEM_PRAZO = { '30 dias': 0, '6 meses': 1, '12 meses': 2 };

  function faltandoParaCalcular(pf) {
    const f = [];
    if (!(n((pf.pessoal || {}).idade) > 0)) f.push('idade (Sobre você)');
    if (!(n((pf.renda || {}).liquida) + n((pf.renda || {}).outras) > 0)) f.push('renda (Renda e gastos)');
    if (!(soma(Object.values(pf.despesas || {})) > 0)) f.push('gastos mensais (Renda e gastos)');
    return f;
  }

  function faixaIndice(v) {
    if (v >= 80) return 'Excelente';
    if (v >= 60) return 'Bom caminho';
    if (v >= 40) return 'Em construção';
    return 'Atenção urgente';
  }

  // ajustes (simulador): { jurosReal, idadeAposentadoria, aporteExtra, rendaDesejada }
  function calcular(pf, ajustes = {}, P = PARAM_PADRAO) {
    const faltando = faltandoParaCalcular(pf);
    if (faltando.length) return { incompleto: true, faltando };
    const A = agregados(pf);
    const jurosReal = ajustes.jurosReal !== undefined && ajustes.jurosReal !== '' ? n(ajustes.jurosReal) : P.premissas.jurosReal;

    const fl = fluxoDeCaixa(pf, A, P);
    const re = reservaEmergencia(pf, A, P);
    const di = dividas(pf, A, P);
    const su = sucessao(pf, A, P);
    const tr = tributario(pf, A, P);

    // Aposentadoria e objetivos dependem um do outro (dividem o aporte): primeiro os objetivos sem aposentadoria.
    const ctxBase = { jurosReal, aporteAposentadoriaNecessario: 0, semBase: re.nota < 50 || di.dados.caras > 0 };
    const obj0 = objetivosEInvestimentos(pf, A, P, ctxBase);
    const apo = aposentadoria(pf, A, P, { jurosReal, idadeAposentadoria: ajustes.idadeAposentadoria, rendaDesejada: ajustes.rendaDesejada, aporteExtra: ajustes.aporteExtra, aporteObjetivos: obj0.dados.totalAporteObj });
    const inv = objetivosEInvestimentos(pf, A, P, { ...ctxBase, aporteAposentadoriaNecessario: apo.dados.aporteNecessario });
    const pr = protecao(pf, A, P, { custoSucessao: su.dados.custo });

    const dominios = [fl, re, di, inv, apo, pr, tr, su];
    // Com patrimônio alto, sucessão e proteção pesam mais no índice.
    const pesos = { ...PESOS };
    if (A.total >= 1000000) { pesos.sucessao = 25; pesos.protecao = 20; }
    let somaPesos = 0;
    let somaNotas = 0;
    for (const d of dominios) {
      if (d.aplicavel === false || d.nota === null) continue;
      d.nota = Math.round(d.nota);
      d.peso = pesos[d.id];
      somaPesos += pesos[d.id];
      somaNotas += pesos[d.id] * d.nota;
    }
    let indice = Math.round(somaNotas / somaPesos);
    // Ninguém é "Excelente" com uma área em risco.
    if (dominios.some((d) => d.aplicavel !== false && d.nota !== null && d.nota < 50)) indice = Math.min(indice, 79);
    const acoes = dominios.flatMap((d) => d.acoes.map((a) => ({ ...a, dominio: d.nome })))
      .sort((a, b) => a.prio - b.prio || ORDEM_PRAZO[a.prazo] - ORDEM_PRAZO[b.prazo]);

    return {
      incompleto: false,
      indice,
      faixa: faixaIndice(indice),
      dominios,
      acoes,
      agregados: A,
      premissas: { jurosReal, retiradaSegura: P.premissas.retiradaSegura, expectativaVida: P.premissas.expectativaVida, verificadoEm: P.verificadoEm },
    };
  }

  const Calc = { calcular, perfilInvestidor, QUESTOES_PERFIL, inssMensal, irAnual, itcmd, vf, aporteParaAlvo, capitalParaRenda, taxaMensal, faixaIndice, PESOS, brl, pct };
  if (typeof module !== 'undefined') module.exports = Calc;
  else raiz.Calc = Calc;
})(typeof self !== 'undefined' ? self : this);
