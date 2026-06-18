# samples/

Fixtures para o teste de integração do leitor de IV (`iv-test.html`).

Os prints `*.jpg` **não são versionados** (ver `.gitignore`): são screenshots
reais da appraisal do Pokémon GO e contêm local/data de captura. Ficam só na
máquina de quem calibra.

`expected.json` (versionado) é o gabarito: mapeia cada nome de arquivo de print
para os IVs verdadeiros (Ataque/Defesa/Vida). A regra do teste: stats com valor
**0 ou 15 são exatos** (barra vazia/cheia); os demais aceitam **±1**.

## Rodar a integração

1. Coloque os prints de appraisal nesta pasta com os nomes listados em
   `expected.json`.
2. Sirva a raiz do projeto por HTTP (o `fetch` do `expected.json` não funciona em
   `file://`):

   ```bash
   python -m http.server 8137
   ```

3. Abra `http://localhost:8137/samples/iv-test.html`. A tabela mostra
   esperado × lido e o resumo fica em `window.__ivTestSummary`.

Os testes unitários (que não dependem dos prints) rodam sem isso: `node --test`.
