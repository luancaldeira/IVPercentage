# Leitor de IV por print — Design

Data: 2026-06-18
Status: aprovado (aguardando review do spec)

## Objetivo

Adicionar à interface web uma função: o usuário envia um print da tela de
appraisal do Pokémon GO, o programa lê as 3 barras de IV (Ataque, Defesa, Vida),
infere os números 0–15 de cada uma (que não aparecem em texto na tela, só como
barras), preenche os controles existentes e mostra a porcentagem + a mensagem de
tier que o app já calcula.

## Restrições e decisões

- **100% client-side (JavaScript no navegador).** Motivo: o deploy é GitHub Pages
  estático (`docs/`), que não roda Python/Flask. Backend exigiria hospedagem nova
  + custo; descartado. Tudo roda no site que já existe, em qualquer celular, de
  graça, sem o PC do usuário ligado.
- **Sem bibliotecas externas.** Detecção via Canvas 2D puro. Sem Tesseract.
- **Não lê o nome do Pokémon.** O usuário escolhe na busca que já existe. Lê só os
  3 IVs.
- **Sliders existentes = confirmação.** A leitura é um palpite que pré-preenche os
  sliders; o usuário confere e ajusta. Nunca trava num valor errado.

## Estrutura da tela de appraisal (observada nos prints reais)

- Card branco arredondado na parte de baixo do print.
- Três linhas de stat, cada uma com rótulo ("Attack" / "Defense" / "HP") e abaixo
  uma barra.
- Cada barra = **3 segmentos**, cada segmento vale 5 IV → 15 no total.
- Segmento **preenchido** = cor quente: **laranja** no caso geral, **vermelho**
  quando aquele stat individual é 15. Segmento **vazio** = trilho **cinza claro**.
  Entre segmentos há um **gap branco**.
- A cor (laranja vs vermelho) NÃO altera o número — ambas contam como "preenchido".
- O líder de equipe (personagem de jaqueta laranja) cobre a parte **direita** do
  card em vários prints, mas as barras ficam na **esquerda** e aparecem inteiras.
- A medalha circular de estrelas sobrepõe o canto superior-esquerdo do card, acima
  das barras (não atrapalha as barras).
- O print é a tela inteira do celular (status bar, CP, etc.). A posição vertical
  do card varia (ex.: linha extra "LUCKY POKÉMON" empurra tudo pra baixo), então
  coordenadas fixas não servem — a detecção tem que ser relativa ao conteúdo.

## Arquitetura

Tudo dentro de `docs/index.html` (e espelhado em `templates/index.html` para a
versão Flask local). Sem novos arquivos de runtime.

### Fluxo

1. Controle de upload (`<input type="file" accept="image/*">`) com rótulo
   "📷 Ler print", posicionado acima/junto do bloco de IVs. No mobile abre a
   galeria; no desktop abre o seletor de arquivos. Progressive enhancement no
   desktop: colar (paste de imagem) e arrastar-soltar.
2. Ao receber a imagem: desenha num `<canvas>` com largura normalizada (ex.:
   750px, mantendo proporção) para uniformizar os cálculos.
3. Roda o leitor de barras → obtém `{atk, def, sta}` (0–15 cada) + flag de
   sucesso/confiança.
4. Seta os valores nos sliders existentes (`s-atk`, `s-def`, `s-sta`) e dispara
   `render()`. Resultado (%, gauge, tier, mensagem, celebração de hundo) usa o
   código que já existe — zero duplicação de cálculo.
5. Mostra preview do print enviado + os 3 valores lidos, com aviso de que são
   palpites a conferir.

### Unidade isolada: o leitor

Função pura e testável, sem dependência do DOM além do canvas de entrada:

```
lerIVdoCanvas(canvas) -> { ok: boolean, atk, def, sta, motivo? }
```

- Entrada: um canvas com a imagem já desenhada.
- Saída: os 3 IVs (0–15) e um booleano de sucesso. Em falha, `ok:false` e um
  `motivo` curto pra mensagem ao usuário.
- Não toca em sliders nem em UI — quem chama faz a ponte. Assim dá pra testar
  isolado contra os prints de gabarito.

## Algoritmo de leitura

Resolução-independente; trabalha em frações, não em pixels absolutos.

### 1. Classificação de pixel

Converter cada pixel pra HSV e rotular:

- **WARM** (segmento preenchido): hue em faixa quente (vermelho ~0–25° e laranja
  ~25–45°), saturação alta (acima de ~0.35), valor médio-alto.
- **TRACK** (segmento vazio): saturação baixa (abaixo de ~0.12) e valor em faixa
  de cinza claro (~0.72–0.90) — distinto do branco do card (valor > ~0.92).
- **OUTRO**: tudo o mais (branco do card, texto, fundo, líder fora da faixa quente).

Os limiares são chutes iniciais — **calibrados contra pixels reais** dos prints na
fase de implementação.

### 2. Localização das 3 barras

- Construir máscara WARM∪TRACK.
- Procurar bandas horizontais finas, na **metade esquerda** da imagem (evita o
  líder à direita), que formem runs largos e contíguos.
- Agrupar linhas em bandas; esperar **3 bandas igualmente espaçadas**. Se achar
  mais candidatas, escolher o trio com melhor espaçamento regular e largura/altura
  consistentes (forma de barra: fina na vertical, larga na horizontal).
- Filtra falsos positivos da jaqueta laranja do líder por forma (blob grande, não
  barra fina) e posição (direita).

### 3. Leitura do preenchimento por barra

Para cada banda de barra, contar pixels WARM e TRACK na faixa vertical central da
barra:

```
fill = WARM / (WARM + TRACK)
IV   = clamp(round(fill * 15), 0, 15)
```

Por que essa razão:

- Ignora os gaps brancos entre segmentos (são OUTRO, ficam fora do denominador).
- Ignora a cor (vermelho e laranja contam igual como WARM).
- PAIMON (tudo preenchido): TRACK≈0 → fill≈1 → 15. ✅
- Dratini Attack (tudo vazio): WARM=0 → fill=0 → 0. ✅
- Parcial: proporcional. ✅

## Tratamento de erros e bordas

- **Não achou 3 barras** → `ok:false`, mensagem "Não consegui ler o print, ajusta
  manual nos controles". Sliders permanecem onde estavam.
- **Jaqueta laranja do líder** → mitigada por forma + posição + exigência de trio
  espaçado (ver passo 2).
- **Imagem que não é appraisal** → cai no caso "não achou 3 barras".
- **Leitura imprecisa** → aceitável por design; os sliders são a rede de
  segurança (o usuário confirma/ajusta).

## Testes

Pasta `samples/` com 15 prints reais de appraisal. Gabarito conhecido inclui:

- PAIMON (Porygon2) — 15/15/15 (hundo, tudo vermelho).
- Dialga — HP = 15 (barra vermelha); Ataque/Defesa parciais.
- Dratini — Ataque = 0 (barra toda cinza), caso-limite.
- Dragonite, Muk — valores intermediários.

Critério: rodar `lerIVdoCanvas` contra os 15 prints e bater com o gabarito (os de
valor conhecido exatos; os demais, dentro de ±1 por stat, confirmados visualmente).
Iterar nos limiares de cor até passar. Validação no navegador (carregar cada
sample no canvas e comparar a saída).

## Fora de escopo

- Ler o nome do Pokémon (OCR/Tesseract).
- Backend ou chamada a API de visão.
- Mudar a fórmula de cálculo ou os tiers (reusa o que já existe).
- CLI (a feature é só na interface web).

## Arquivos afetados

- `docs/index.html` — UI de upload + leitor + ligação aos sliders.
- `templates/index.html` — espelho da mesma mudança (versão Flask).
- `samples/` — 15 prints de teste (novos).
- `README.md` — documentar a nova função.
