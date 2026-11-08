// © 2026 Michel Ebertz. Todos os direitos reservados. Proibido copiar, reproduzir, modificar ou distribuir sem autorização por escrito (Leis 9.610/1998 e 9.609/1998).
// Parâmetros do planejamento: tabelas fiscais e premissas.
// Tudo o que muda com a lei ou com o mercado fica aqui. Ao atualizar,
// troque "verificadoEm" e aumente a VERSAO em sw.js.

const PARAMETROS = {
  verificadoEm: '07/11/2026',

  // Autor da metodologia (crédito fixo) e atendimento padrão (quando o assessor não configura o dele).
  planejador: {
    nome: 'Michel Ebertz',
    titulo: 'Assessor de Investimentos e Planejador Financeiro',
    whatsapp: '5549999158181', // 55 + DDD + número, só dígitos
  },

  // true: app só para assessores (exige licença e PIN; abre na lista de clientes).
  // false: volta o modo cliente livre (pessoa física), guardado para uma versão futura.
  soAssessor: true,
  // Minutos com o app em segundo plano antes de pedir o PIN de novo.
  bloqueioMinutos: 5,

  direitos: '© 2026 Michel Ebertz. Todos os direitos reservados. A metodologia, os textos e o software deste app são protegidos pelas Leis 9.610/1998 (direitos autorais) e 9.609/1998 (programas de computador). É proibido copiar, reproduzir, modificar ou distribuir, no todo ou em parte, sem autorização por escrito do autor.',

  // Licença do Modo Planejador: códigos assinados por Michel (licencas/gerar-licenca.js).
  // Esta é só a chave PÚBLICA, que confere a assinatura; ela não gera códigos.
  licenca: {
    chavePublica: { kty: 'EC', crv: 'P-256', x: '_xTIFEFqBEBDmPbyRA0fQpE1ZE0KhckcCB29ngSNJb8', y: 'u5OJ2GZtV3qYx0rjGcPxzXc0x8PuZRN9CWBBG7x99OI' },
    avisoDias: 15, // avisa o assessor quando faltar isso para vencer
  },

  salarioMinimo: 1621.00,

  // INSS 2026 (empregado), progressivo por faixa. Portaria Interministerial MPS/MF nº 13/2026.
  inss: {
    teto: 8475.55,
    faixas: [[1621.00, 0.075], [2902.84, 0.09], [4354.27, 0.12], [8475.55, 0.14]],
  },

  // IRPF anual, ano-calendário 2026 (tabela de 05/2025 x 12) + redutor da Lei 15.270/2025.
  irAnual: {
    faixas: [ // [até, alíquota, parcela a deduzir]
      [29145.60, 0, 0],
      [33919.80, 0.075, 2185.92],
      [45012.60, 0.15, 4729.92],
      [55976.16, 0.225, 8105.88],
      [Infinity, 0.275, 10904.76],
    ],
    redutor: { ate: 60000, maxReducao: 2694.15, limite: 88200, a: 8429.73, b: 0.095575 },
    deducaoDependente: 2275.08,
    educacaoLimitePessoa: 3561.50,
    descontoSimplificado: { pct: 0.20, limite: 16754.34 },
  },

  previdencia: {
    limitePGBL: 0.12, // da renda bruta tributável anual
    regressiva: [[2, 0.35], [4, 0.30], [6, 0.25], [8, 0.20], [10, 0.15], [Infinity, 0.10]],
  },

  premissas: {
    jurosReal: 0.04,          // ao ano, acima da inflação
    retiradaSegura: 0.04,     // ao ano, para viver só da renda (sem consumir o capital)
    expectativaVida: 95,      // idade até onde o dinheiro precisa durar (conservador)
    idadeAposentadoria: 65,
    mesesReservaEstavel: 6,   // CLT, servidor, aposentado
    mesesReservaInstavel: 12, // PJ, autônomo, empresário
    limiteParcelas: 0.30,     // parcelas de dívida / renda
    taxaDividaCara: 0.015,    // ao mês: acima disso, quitar vem antes de investir
    anosRendaDependentes: 5,  // anos de despesas da família cobertos pelo seguro de vida
    custoEducacaoAnualFilho: 30000,
    idadeFimEducacao: 24,
    revisaoMeses: 6,
  },

  sucessao: {
    honorarios: 0.06,       // advogado do inventário, sobre o espólio
    custas: 0.02,           // cartório, certidões, taxas
    patrimonioHolding: 3000000, // a partir daqui, vale estudar holding patrimonial
    patrimonioTestamento: 500000,
    // ITCMD. SC: Lei 13.136/2004 (1% a 7% por faixa; a alíquota fixa de 8% foi revogada pela Lei 19.053/2024).
    // Demais UFs: alíquota média estimada, até cadastrar a tabela da UF.
    itcmd: {
      SC: { faixas: [[20000, 0.01], [50000, 0.03], [150000, 0.05], [Infinity, 0.07]] },
      padrao: 0.04,
    },
  },

  // Alocação-alvo por perfil (classes, nunca ativos específicos). Soma 100.
  alocacao: {
    conservador: { 'Pós-fixado': 55, 'Inflação (IPCA+)': 25, 'Prefixado': 10, 'Ações': 0, 'Fundos imobiliários': 5, 'Exterior': 5, 'Cripto': 0 },
    moderado:    { 'Pós-fixado': 30, 'Inflação (IPCA+)': 25, 'Prefixado': 10, 'Ações': 15, 'Fundos imobiliários': 10, 'Exterior': 10, 'Cripto': 0 },
    arrojado:    { 'Pós-fixado': 15, 'Inflação (IPCA+)': 20, 'Prefixado': 5, 'Ações': 30, 'Fundos imobiliários': 10, 'Exterior': 15, 'Cripto': 5 },
  },
};

if (typeof module !== 'undefined') module.exports = PARAMETROS;
