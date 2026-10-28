# Painel – Mudança de Configuração (SASCAR)

Acompanha as movimentações do relatório **Mudança de Configuração** do portal
[SASCAR Telemetry](https://telemetria.sascar.com.br/telemetria/) (Michelin Connected Fleet).

Painel publicado: https://claude.ai/artifact/AL9375gSpfmvYvrmN6ouqo

## O que o painel mostra

- **Indicadores**: movimentações, executadas, expiradas, pendentes, tempo mediano até executar e veículos.
- **Alertas**: mudanças **expiradas**, pendentes há mais de **24 h** (`LIMITE_PENDENCIA_HORAS`) e todo
  ajuste de **hodômetro** ou **horímetro** (`COMANDOS_AJUSTE`), ambos em `src/painel.template.html`.
- **Gráficos**: movimentações por dia (por situação), comandos mais enviados e por login.
- **Lista filtrável**: período (padrão: últimos 30 dias), placa, comando, situação, usuário e login.

## Atualização diária

Uma tarefa agendada do Claude Code roda todo dia às 8:38 (Brasília):

1. lê o painel publicado e recupera o histórico embutido nele (`src/restaurar-historico.js`);
2. `src/coletar.js` entra no portal com Playwright, lê o relatório dos **últimos 30 dias fechados** (até 23:59 de ontem; o dia em curso nunca entra) e soma ao histórico
   (a versão mais nova de cada movimentação prevalece);
3. `src/gerar-painel.js` gera `painel.html` e a tarefa o republica no mesmo link.

Os dados coletados (`dados/` e `painel.html`) não são versionados neste repositório.

## Rodar manualmente

```bash
npm install
export SASCAR_USUARIO=... SASCAR_LOGIN=... SASCAR_SENHA=...
npm run atualizar   # coleta os últimos 30 dias fechados + gera painel.html (arquivo único, abre em qualquer navegador)
node src/coletar.js --de 01/09/2026 --ate 30/09/2026   # coleta um período específico (máx. 30 dias, até ontem)
npm test
```

Se a coleta falhar, uma captura da tela fica em `tmp/erro.png`.
