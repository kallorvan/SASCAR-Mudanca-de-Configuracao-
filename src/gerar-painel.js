// Gera painel.html a partir de dados/movimentacoes.json e do modelo src/painel.template.html.

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DADOS = path.join(RAIZ, 'dados', 'movimentacoes.json');
const MODELO = path.join(__dirname, 'painel.template.html');
const SAIDA = path.join(RAIZ, 'painel.html');
const LAYOUT = path.join(__dirname, 'layout');

// Só os campos que o painel usa, para manter o arquivo leve.
const CAMPOS = ['data', 'veiculo', 'comando', 'valorAnterior', 'valorAtual', 'medida', 'usuario', 'login', 'situacao', 'dataSituacao'];

// Layout padrão Grupo Dínamo / Tóliman, embutido para o painel funcionar como arquivo único.
function lerLayout(pasta = LAYOUT) {
  const imagem = (nome) => `data:image/png;base64,${fs.readFileSync(path.join(pasta, nome)).toString('base64')}`;
  return {
    css: fs.readFileSync(path.join(pasta, 'layout.css'), 'utf8'),
    js: fs.readFileSync(path.join(pasta, 'layout.js'), 'utf8'),
    logo: imagem('logo.png'),
    logoClaro: imagem('logo-light.png'),
    favicon: imagem('favicon-32.png'),
  };
}

function gerarPainel(dados, modelo, layout = { css: '', js: '', logo: '', logoClaro: '', favicon: '' }) {
  const enxuto = {
    atualizadoEm: dados.atualizadoEm,
    movimentacoes: dados.movimentacoes.map((m) => Object.fromEntries(CAMPOS.map((c) => [c, m[c] ?? '']))),
  };
  // Impede que algum texto do portal feche a tag <script> antes da hora.
  const json = JSON.stringify(enxuto).replace(/</g, '\\u003c');
  return modelo
    .replace('/*__LAYOUT_CSS__*/', () => layout.css)
    .replace('/*__LAYOUT_JS__*/', () => layout.js)
    .replace('__LOGO_LIGHT__', () => layout.logoClaro)
    .replace('__LOGO__', () => layout.logo)
    .replace('__FAVICON__', () => layout.favicon)
    .replace('__DADOS__', () => json);
}

if (require.main === module) {
  const dados = JSON.parse(fs.readFileSync(DADOS, 'utf8'));
  fs.writeFileSync(SAIDA, gerarPainel(dados, fs.readFileSync(MODELO, 'utf8'), lerLayout()));
  console.log(`painel.html gerado com ${dados.movimentacoes.length} movimentações.`);
}

module.exports = { gerarPainel, lerLayout };
