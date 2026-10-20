# Encontra Leitos

Protótipo de apresentação de uma plataforma de coordenação de leitos SUS no Paraná. O fluxo permite entrar como Lucas Berr, escolher um produto, buscar hospitais por tipo de leito, simular a reserva e selecionar um transporte.

## Rodar localmente

Na raiz do workspace:

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000/Encontra-leitos/`.

## Publicar no GitHub Pages

O repositório inclui um workflow que publica automaticamente o conteúdo estático na raiz quando há push para `main`. No GitHub, abra **Settings → Pages** e selecione **GitHub Actions** como origem de publicação. Depois do primeiro deploy, a demo ficará em `https://lucasberr.github.io/Encontra-leitos/`.

O site não precisa de etapa de build nem backend. O login e a senha de demonstração abaixo são apenas uma simulação local; não use credenciais reais. Os dados de disponibilidade, pacientes e transportes são fictícios.

Credenciais demonstrativas:

- E-mail: `lucas.berr@encontraleitos.demo`
- Senha: `parana2026`

O login é local e demonstrativo; não há autenticação real nem backend.

## Dados usados

O conjunto `data/hospitals-pr.json` traz 433 hospitais do Paraná que aparecem no dataset **Hospitais e Leitos** do CNES/Ministério da Saúde, atualizado em 20/09/2026. Para cada estabelecimento foi selecionado o registro de competência mais recente disponível, até 08/2026. O total SUS e a UTI adulta vêm desse extrato. Leitos obstétricos e pediátricos vêm dos arquivos CNES LT para o Paraná na competência 02/2026.

Fontes oficiais: [CNES — Hospitais e Leitos, recurso Leitos 2026](https://dadosabertos.saude.gov.br/dataset/hospitais-e-leitos/resource/5ac78b13-649f-4b09-8a92-0ae829a56d50) e [downloads mensais da base CNES](https://cnes.datasus.gov.br/pages/downloads/arquivosBaseDados.jsp). A fonte informa que o conteúdo depende dos dados enviados pelos gestores locais.

Os 433 hospitais foram cruzados pelo código CNES com os campos `NU_LATITUDE` e `NU_LONGITUDE` do [CNES — Cadastro Nacional de Estabelecimentos de Saúde](https://dadosabertos.saude.gov.br/dataset/cnes-cadastro-nacional-de-estabelecimentos-de-saude), atualização de 17/10/2026. Todos os registros usados no mapa tinham coordenadas válidas dentro do Paraná. Assim, os marcadores usam o ponto do estabelecimento informado no cadastro CNES, em vez do centroide municipal. A posição depende da qualidade e atualização do cadastro e não é uma verificação de endereço em campo. As distâncias do protótipo são em linha reta, não trajetos rodoviários.

`data/demo-operations.json` é separado dos dados oficiais e contém disponibilidade fictícia para permitir navegar pela demonstração. Reservas e transportes também são simulados e não ocupam leitos nem acionam equipes reais. A tela identifica esses elementos como simulação.
