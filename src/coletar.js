// Entra no portal SASCAR Telemetry, abre o relatório "Mudança de Configuração" do último mês
// e grava as movimentações em dados/movimentacoes.json, somando ao histórico já coletado.
//
// Credenciais: variáveis de ambiente SASCAR_USUARIO, SASCAR_LOGIN e SASCAR_SENHA.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { COLUNAS, linhaParaMovimentacao, numerarRepetidas, mesclar } = require('./movimentacoes');

const URL_LOGIN = 'https://telemetria.sascar.com.br/telemetria/pages/login.jsf';
const ARQUIVO = path.join(__dirname, '..', 'dados', 'movimentacoes.json');
const PASTA_DEPURACAO = path.join(__dirname, '..', 'tmp');

function exigirVariavel(nome) {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ${nome} não definida.`);
  return valor;
}

async function entrar(page) {
  await page.goto(URL_LOGIN, { waitUntil: 'domcontentloaded' });
  // O botão Entrar fica desabilitado até aceitar o aviso de cookies.
  const permitir = page.locator('.cookies-warning button').first();
  if (await permitir.isVisible().catch(() => false)) await permitir.click();

  await page.fill('[id="form:usuario"]', exigirVariavel('SASCAR_USUARIO'));
  await page.fill('[id="form:login"]', exigirVariavel('SASCAR_LOGIN'));
  await page.fill('[id="form:senha"]', exigirVariavel('SASCAR_SENHA'));
  await page.selectOption('[id="form:locale"]', 'pt-br');
  await page.click('[id="form:btnOk"]');
  await page.waitForLoadState('networkidle');

  if (await page.locator('[id="form:senha"]').count()) {
    throw new Error('Login recusado pelo portal. Confira SASCAR_USUARIO, SASCAR_LOGIN e SASCAR_SENHA.');
  }
}

async function abrirRelatorio(page) {
  await page.getByText('Mudança de Configuração', { exact: true }).click();
  await page.getByText('Último Mês', { exact: true }).click();
  await page.getByText('Normal', { exact: true }).click();
  await page.getByText('Visualizar Relatório').click();
  await page.waitForLoadState('networkidle');
  await page.locator('th', { hasText: 'Descrição do comando' }).first().waitFor({ timeout: 120000 });
}

async function lerLinhas(page) {
  return page.evaluate((totalColunas) => {
    const tabela = [...document.querySelectorAll('table')]
      .filter((t) => /Descrição do comando/i.test(t.querySelector('tr')?.innerText || ''))
      .pop();
    if (!tabela) return [];
    return [...tabela.querySelectorAll('tr')]
      .map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText))
      .filter((celulas) => celulas.length === totalColunas);
  }, COLUNAS.length);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  // O proxy do ambiente recusa caminhos com ";jsessionid=..."; a sessão segue pelo cookie JSESSIONID.
  await context.route(/;jsessionid=/i, (route) =>
    route.continue({ url: route.request().url().replace(/;jsessionid=[^?#]*/i, '') }));
  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  try {
    await entrar(page);
    await abrirRelatorio(page);
    const linhas = await lerLinhas(page);
    if (!linhas.length) throw new Error('O relatório abriu, mas nenhuma linha foi encontrada na tabela.');

    const coletadoEm = new Date().toISOString();
    const novas = numerarRepetidas(linhas.map(linhaParaMovimentacao).filter((m) => m.data));
    const anterior = fs.existsSync(ARQUIVO) ? JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')) : { movimentacoes: [] };
    const movimentacoes = mesclar(anterior.movimentacoes, novas, coletadoEm);

    fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
    fs.writeFileSync(ARQUIVO, JSON.stringify({ atualizadoEm: coletadoEm, movimentacoes }, null, 1) + '\n');
    console.log(`Coletadas ${novas.length} movimentações; histórico com ${movimentacoes.length}.`);
  } catch (erro) {
    fs.mkdirSync(PASTA_DEPURACAO, { recursive: true });
    await page.screenshot({ path: path.join(PASTA_DEPURACAO, 'erro.png'), fullPage: true }).catch(() => {});
    throw erro;
  } finally {
    await browser.close();
  }
}

main().catch((erro) => {
  console.error(`Falha na coleta: ${erro.message}`);
  process.exit(1);
});
