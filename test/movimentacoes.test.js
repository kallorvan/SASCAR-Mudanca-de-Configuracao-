const test = require('node:test');
const assert = require('node:assert');
const { dataParaIso, lerStatus, linhaParaMovimentacao, numerarRepetidas, mesclar } = require('../src/movimentacoes');
const { gerarPainel } = require('../src/gerar-painel');

const linha = (status) => ['ORDEM DE SERVIÇO', 'ADM', '23/10/2026 09:57:25 (UTC-3)', 'UVR1I57', '', '',
  'CONFIGURAÇÃO BLOQUEIO AUTOMÁTICO IGNIÇÃO', 'Desativado', 'Ativado', 'N/A', status];

test('converte data do portal para ISO com fuso', () => {
  assert.strictEqual(dataParaIso('23/10/2026 09:57:25 (UTC-3)'), '2026-10-23T09:57:25-03:00');
  assert.strictEqual(dataParaIso(''), null);
});

test('separa situação e data do status', () => {
  assert.deepStrictEqual(lerStatus('Executado 23/10/2026 10:03:30 (UTC-3)'),
    { situacao: 'Executado', dataSituacao: '2026-10-23T10:03:30-03:00' });
  assert.deepStrictEqual(lerStatus('Expirado'), { situacao: 'Expirado', dataSituacao: null });
});

test('numera envios repetidos no mesmo instante', () => {
  const [a, b] = numerarRepetidas([linhaParaMovimentacao(linha('Expirado')), linhaParaMovimentacao(linha('Expirado'))]);
  assert.notStrictEqual(a.id, b.id);
  assert.ok(b.id.endsWith('#2'));
});

test('mescla mantendo a primeira coleta e atualizando o status', () => {
  const pendente = { ...linhaParaMovimentacao(linha('Pendente')), primeiraColeta: '2026-10-22T12:00:00Z' };
  const executado = linhaParaMovimentacao(linha('Executado 23/10/2026 10:03:30 (UTC-3)'));
  const [m, ...resto] = mesclar([pendente], [executado], '2026-10-23T12:00:00Z');
  assert.strictEqual(resto.length, 0);
  assert.strictEqual(m.situacao, 'Executado');
  assert.strictEqual(m.primeiraColeta, '2026-10-22T12:00:00Z');
});

test('painel não deixa texto do portal fechar a tag script', () => {
  const html = gerarPainel({ atualizadoEm: 'x', movimentacoes: [{ comando: '</script><b>' }] }, '<script>__DADOS__</script>');
  assert.ok(!html.includes('</script><b>'));
});

test('restaura o histórico embutido no painel com os mesmos ids da coleta', () => {
  const { extrairDados } = require('../src/restaurar-historico');
  const mov = linhaParaMovimentacao(linha('Expirado'));
  const html = gerarPainel({ atualizadoEm: '2026-10-23T12:00:00Z', movimentacoes: [mov, mov] },
    '<script id="dados" type="application/json">__DADOS__</script>');
  const { movimentacoes } = extrairDados(html);
  assert.deepStrictEqual(movimentacoes.map((m) => m.id), numerarRepetidas([mov, mov]).map((m) => m.id));
});
