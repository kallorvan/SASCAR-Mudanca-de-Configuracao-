// Resumo dos últimos 30 dias com as mesmas regras do painel, para a mensagem da atualização diária.

const fs = require('fs');
const path = require('path');

const DADOS = path.join(__dirname, '..', 'dados', 'movimentacoes.json');
// Mesmos valores de src/painel.template.html.
const LIMITE_PENDENCIA_HORAS = 24;
const COMANDOS_AJUSTE = /HOD[OÔ]METRO|HOR[IÍ]METRO/i;
const FUSO = 'America/Sao_Paulo';

const { atualizadoEm, dadosAte, movimentacoes } = JSON.parse(fs.readFileSync(DADOS, 'utf8'));
const agora = new Date(atualizadoEm);
// Último dia fechado coletado; históricos antigos sem o campo usam o dia da coleta.
const hoje = dadosAte || new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora);
const inicio = new Date(`${hoje}T00:00:00Z`);
inicio.setUTCDate(inicio.getUTCDate() - 29);
const desde = inicio.toISOString().slice(0, 10);

const periodo = movimentacoes.filter((m) => m.data.slice(0, 10) >= desde);
const tipo = (m) => (/^execut/i.test(m.situacao) ? 'executado' : /^expir/i.test(m.situacao) ? 'expirado' : 'pendente');
const expiradas = periodo.filter((m) => tipo(m) === 'expirado').length;
const atrasadas = periodo.filter((m) => tipo(m) === 'pendente' && (agora - new Date(m.data)) / 36e5 > LIMITE_PENDENCIA_HORAS).length;
const ajustes = periodo.filter((m) => COMANDOS_AJUSTE.test(m.comando)).length;

console.log(`Histórico: ${movimentacoes.length} movimentações, até ${hoje}. Últimos 30 dias (${desde} a ${hoje}): ${periodo.length} movimentações, ` +
  `${expiradas} expiradas, ${atrasadas} pendentes há mais de ${LIMITE_PENDENCIA_HORAS} h, ${ajustes} ajustes de hodômetro/horímetro.`);
