// Gera painel.html a partir de dados/movimentacoes.json e do modelo src/painel.template.html.

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DADOS = path.join(RAIZ, 'dados', 'movimentacoes.json');
const MODELO = path.join(__dirname, 'painel.template.html');
const SAIDA = path.join(RAIZ, 'painel.html');

// Só os campos que o painel usa, para manter o arquivo leve.
const CAMPOS = ['data', 'veiculo', 'comando', 'valorAnterior', 'valorAtual', 'medida', 'usuario', 'login', 'situacao', 'dataSituacao'];

function gerarPainel(dados, modelo) {
  const enxuto = {
    atualizadoEm: dados.atualizadoEm,
    movimentacoes: dados.movimentacoes.map((m) => Object.fromEntries(CAMPOS.map((c) => [c, m[c] ?? '']))),
  };
  // Impede que algum texto do portal feche a tag <script> antes da hora.
  const json = JSON.stringify(enxuto).replace(/</g, '\\u003c');
  return modelo.replace('__DADOS__', () => json);
}

if (require.main === module) {
  const dados = JSON.parse(fs.readFileSync(DADOS, 'utf8'));
  fs.writeFileSync(SAIDA, gerarPainel(dados, fs.readFileSync(MODELO, 'utf8')));
  console.log(`painel.html gerado com ${dados.movimentacoes.length} movimentações.`);
}

module.exports = { gerarPainel };
