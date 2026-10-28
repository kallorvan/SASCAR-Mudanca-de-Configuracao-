// Entra no portal SASCAR Telemetry, abre o relatório "Mudança de Configuração" dos últimos 30 dias
// fechados (até 23:59 de ontem) e grava as movimentações em dados/movimentacoes.json, somando ao
// histórico já coletado. O dia em curso nunca entra, para o painel só mostrar dias completos.
//
// Credenciais: variáveis de ambiente SASCAR_USUARIO, SASCAR_LOGIN e SASCAR_SENHA.
// Período opcional no formato do portal: --de 01/09/2026 --ate 30/09/2026 (até ontem, no máximo).

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { COLUNAS, linhaParaMovimentacao, numerarRepetidas, mesclar } = require('./movimentacoes');

const URL_LOGIN = 'https://telemetria.sascar.com.br/telemetria/pages/login.jsf';
const ARQUIVO = path.join(__dirname, '..', 'dados', 'movimentacoes.json');
const PASTA_DEPURACAO = path.join(__dirname, '..', 'tmp');
// O portal aceita no máximo 30 dias por consulta.
const MAX_DIAS = 30;
const FUSO = 'America/Sao_Paulo';

const somarDias = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isoParaPortal = (iso) => iso.split('-').reverse().join('/');
// Último dia fechado (ontem, no horário de Brasília) em aaaa-mm-dd.
function ultimoDiaFechado(agora = new Date()) {
  return somarDias(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora), -1);
}
// Padrão da atualização diária: os 30 dias fechados mais recentes.
function periodoPadrao(agora = new Date()) {
  const ate = ultimoDiaFechado(agora);
  return { de: isoParaPortal(somarDias(ate, -(MAX_DIAS - 1))), ate: isoParaPortal(ate) };
}

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

async function abrirRelatorio(page, periodo) {
  await page.getByText('Mudança de Configuração', { exact: true }).click();
  await page.getByText('Último Mês', { exact: true }).click();
  await page.getByText('Normal', { exact: true }).click();
  await page.getByText('Visualizar Relatório').click();
  await page.waitForLoadState('networkidle');
  await page.locator('th', { hasText: 'Descrição do comando' }).first().waitFor({ timeout: 120000 });

  if (periodo) {
    await page.fill('[id="formrelatorio:datainicio"]', `${periodo.de} 00:00`);
    await page.fill('[id="formrelatorio:dataFinal"]', `${periodo.ate} 23:59`);
    // "Aplicar" recarrega a tabela por AJAX; espera até as linhas serem do período pedido.
    await page.click('[id="formrelatorio:botaoPesquisa"]');
    const paraIso = (d) => d.split('/').reverse().join('-');
    const linhasDoPeriodo = page.waitForFunction(({ de, ate, colunas }) => {
      const iso = (t) => t.slice(0, 10).split('/').reverse().join('-');
      const datas = [...document.querySelectorAll('tr')]
        .map((tr) => tr.querySelectorAll('td'))
        .filter((tds) => tds.length === colunas)
        .map((tds) => iso(tds[2].innerText.trim()));
      return datas.length > 0 && datas.every((d) => d >= de && d <= ate);
    }, { de: paraIso(periodo.de), ate: paraIso(periodo.ate), colunas: COLUNAS.length }, { timeout: 180000, polling: 1000 });
    await linhasDoPeriodo.catch(() => {
      throw new Error(`O portal não mostrou movimentações de ${periodo.de} a ${periodo.ate} em 3 min. O período pode não ter nenhuma.`);
    });
  }
}

// Lê --de e --ate (dd/mm/aaaa) da linha de comando.
function lerPeriodo(args, agora = new Date()) {
  const valor = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : null; };
  const de = valor('--de'), ate = valor('--ate');
  if (!de && !ate) return null;
  const formato = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!formato.test(de || '') || !formato.test(ate || '')) throw new Error('Use --de e --ate juntos, no formato dd/mm/aaaa.');
  const paraData = (texto) => {
    const [dia, mes, ano] = texto.split('/').map(Number);
    const d = new Date(Date.UTC(ano, mes - 1, dia));
    if (d.getUTCDate() !== dia || d.getUTCMonth() !== mes - 1) throw new Error(`Data inválida: ${texto}.`);
    return d;
  };
  const dias = (paraData(ate) - paraData(de)) / 864e5 + 1;
  if (dias < 1) throw new Error('--de deve ser anterior ou igual a --ate.');
  if (dias > MAX_DIAS) throw new Error(`O período tem ${dias} dias; o portal aceita no máximo ${MAX_DIAS}.`);
  const fechado = ultimoDiaFechado(agora);
  if (paraData(ate) > new Date(`${fechado}T00:00:00Z`)) throw new Error(`--ate vai no máximo até ${isoParaPortal(fechado)}, o último dia fechado.`);
  return { de, ate };
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
    const agora = new Date();
    const manual = lerPeriodo(process.argv.slice(2), agora);
    const periodo = manual || periodoPadrao(agora);
    await abrirRelatorio(page, periodo);
    const linhas = await lerLinhas(page);
    if (!linhas.length) throw new Error('O relatório abriu, mas nenhuma linha foi encontrada na tabela.');

    const coletadoEm = new Date().toISOString();
    const novas = numerarRepetidas(linhas.map(linhaParaMovimentacao).filter((m) => m.data));
    const anterior = fs.existsSync(ARQUIVO) ? JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')) : { movimentacoes: [] };
    // Coleta manual de um período antigo não avança o último dia fechado do histórico.
    const dadosAte = manual ? anterior.dadosAte || ultimoDiaFechado(agora) : ultimoDiaFechado(agora);
    // Tira também dias incompletos que coletas antigas (feitas durante o dia) deixaram no histórico.
    const movimentacoes = mesclar(anterior.movimentacoes, novas, coletadoEm).filter((m) => m.data.slice(0, 10) <= dadosAte);

    fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
    fs.writeFileSync(ARQUIVO, JSON.stringify({ atualizadoEm: coletadoEm, dadosAte, movimentacoes }, null, 1) + '\n');
    const datas = novas.map((m) => m.data.slice(0, 10)).sort();
    console.log(`Coletadas ${novas.length} movimentações (${datas[0]} a ${datas[datas.length - 1]}); histórico com ${movimentacoes.length}.`);
  } catch (erro) {
    fs.mkdirSync(PASTA_DEPURACAO, { recursive: true });
    await page.screenshot({ path: path.join(PASTA_DEPURACAO, 'erro.png'), fullPage: true }).catch(() => {});
    throw erro;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((erro) => {
    console.error(`Falha na coleta: ${erro.message}`);
    process.exit(1);
  });
}

module.exports = { lerPeriodo, periodoPadrao, ultimoDiaFechado };
