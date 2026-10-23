// Conversão das linhas do relatório "Mudança de Configuração" e mesclagem com o histórico.

const COLUNAS = [
  'usuario', 'login', 'data', 'veiculo', 'descricaoVeiculo', 'hodometro',
  'comando', 'valorAnterior', 'valorAtual', 'medida', 'status',
];

// "23/10/2026 09:57:25 (UTC-3)" -> "2026-10-23T09:57:25-03:00"
function dataParaIso(texto) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?(?:\s*\(UTC([+-]\d{1,2})\))?/.exec(texto || '');
  if (!m) return null;
  const [, dia, mes, ano, hh, mm, ss = '00', utc = '-3'] = m;
  const sinal = utc.startsWith('-') ? '-' : '+';
  const horas = String(Math.abs(Number(utc))).padStart(2, '0');
  return `${ano}-${mes}-${dia}T${hh}:${mm}:${ss}${sinal}${horas}:00`;
}

// "Executado 23/10/2026 10:03:30 (UTC-3)" -> { situacao: "Executado", dataSituacao: "2026-10-23T10:03:30-03:00" }
function lerStatus(texto) {
  const limpo = (texto || '').replace(/\s+/g, ' ').trim();
  const pos = limpo.search(/\d{2}\/\d{2}\/\d{4}/);
  const situacao = (pos >= 0 ? limpo.slice(0, pos) : limpo).trim() || 'Sem status';
  return { situacao, dataSituacao: pos >= 0 ? dataParaIso(limpo.slice(pos)) : null };
}

// Mesma mudança no mesmo veículo e instante: o status pode evoluir entre coletas.
function chave(m) {
  return [m.veiculo, m.data, m.comando, m.valorAnterior, m.valorAtual].join('|');
}

function linhaParaMovimentacao(celulas) {
  const bruto = {};
  COLUNAS.forEach((nome, i) => { bruto[nome] = (celulas[i] || '').replace(/\s+/g, ' ').trim(); });
  const { situacao, dataSituacao } = lerStatus(bruto.status);
  const mov = {
    data: dataParaIso(bruto.data),
    veiculo: bruto.veiculo,
    descricaoVeiculo: bruto.descricaoVeiculo,
    hodometro: bruto.hodometro,
    comando: bruto.comando,
    valorAnterior: bruto.valorAnterior,
    valorAtual: bruto.valorAtual,
    medida: bruto.medida,
    usuario: bruto.usuario,
    login: bruto.login,
    situacao,
    dataSituacao,
  };
  mov.id = chave(mov);
  return mov;
}

// O portal pode listar o mesmo comando enviado duas vezes no mesmo instante; numera as repetições.
function numerarRepetidas(movimentacoes) {
  const vistas = new Map();
  return movimentacoes.map((m) => {
    const n = (vistas.get(m.id) || 0) + 1;
    vistas.set(m.id, n);
    return n === 1 ? m : { ...m, id: `${m.id}#${n}` };
  });
}

// Junta a coleta nova ao histórico; a versão mais recente de cada movimentação prevalece.
function mesclar(historico, novas, coletadoEm) {
  const porId = new Map(historico.map((m) => [m.id, m]));
  for (const m of novas) {
    const anterior = porId.get(m.id);
    porId.set(m.id, { ...m, primeiraColeta: anterior ? anterior.primeiraColeta : coletadoEm });
  }
  return [...porId.values()].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}

module.exports = { COLUNAS, dataParaIso, lerStatus, linhaParaMovimentacao, numerarRepetidas, mesclar };
