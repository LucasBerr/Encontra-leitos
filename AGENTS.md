# Encontra-leitos

Produto independente de demonstração para busca e coordenação operacional de leitos SUS no Paraná. O projeto é um protótipo estático sem backend.

## Dados e limites

- `data/hospitals-pr.json` contém estabelecimentos hospitalares extraídos do CNES e seus leitos SUS cadastrados.
- `data/demo-operations.json` contém disponibilidade simulada, separada do cadastro oficial.
- Disponibilidade, reserva, tempo de viagem e alocação de transporte são sempre demonstrações locais. Não afirmar que há integração em tempo real, vaga efetivamente reservada ou ambulância despachada.
- As coordenadas dos marcadores vêm dos campos de latitude e longitude do estabelecimento no cadastro CNES (cruzamento pelo código CNES). A localização depende da qualidade do cadastro; distâncias são estimativas em linha reta, sem roteamento viário.
- Não coletar dados identificáveis de pacientes neste protótipo.
- Manter este produto independente do `Prioriza-leitos` e do Engine. A página de módulos pode apontar para o dashboard existente no workspace, sem compartilhar código ou dados.

## Execução

Projeto HTML, CSS e JavaScript sem build step. Sirva a pasta por HTTP, por exemplo:

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000/Encontra-leitos/` a partir da raiz do workspace. Leaflet e tiles do OpenStreetMap são carregados pela internet.
