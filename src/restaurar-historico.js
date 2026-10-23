// Recupera o histórico a partir de um painel.html já gerado (os dados ficam embutidos nele)
// e grava dados/movimentacoes.json, para a próxima coleta somar a ele.
//
// Uso: node src/restaurar-historico.js caminho/do/painel.html

const fs = require('fs');
const path = require('path');
const { numerarRepetidas } = require('./movimentacoes');

const ARQUIVO = path.join(__dirname, '..', 'dados', 'movimentacoes.json');

function extrairDados(html) {
  const m = /<script id="dados" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('Não encontrei os dados embutidos no painel.');
  const dados = JSON.parse(m[1]);
  const comId = dados.movimentacoes.map((mov) => ({
    ...mov,
    id: [mov.veiculo, mov.data, mov.comando, mov.valorAnterior, mov.valorAtual].join('|'),
    primeiraColeta: dados.atualizadoEm,
  }));
  return { atualizadoEm: dados.atualizadoEm, movimentacoes: numerarRepetidas(comId) };
}

if (require.main === module) {
  const origem = process.argv[2];
  if (!origem) throw new Error('Informe o caminho do painel.html anterior.');
  const dados = extrairDados(fs.readFileSync(origem, 'utf8'));
  fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  fs.writeFileSync(ARQUIVO, JSON.stringify(dados, null, 1) + '\n');
  console.log(`Histórico restaurado: ${dados.movimentacoes.length} movimentações (até ${dados.atualizadoEm}).`);
}

module.exports = { extrairDados };
