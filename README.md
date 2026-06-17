# IV Scanner — Pokémon GO IV Calculator

Calcula a porcentagem de IV de um Pokémon do Pokémon GO a partir dos valores de
Ataque, Defesa e Vida (0–15 cada). Vem em duas interfaces que compartilham a
mesma lógica de cálculo:

- **CLI** (`iv_calculator.py`) — seleção por autocomplete no terminal.
- **Web** (`app.py`) — terminal de appraisal holográfico com sliders, gauge
  radial e celebração de HUNDO.

![IV Scanner — estado HUNDO](hundo.png)

## Cálculo

```python
porcentagem = (ataque + defesa + vida) / 45 * 100
```

| Tier      | Faixa     |
|-----------|-----------|
| HUNDO     | 100%      |
| Excelente | 80–99%    |
| Ótimo     | 67–79%    |
| Bom       | 51–66%    |
| Fraco     | 0–50%     |

## Como rodar

Requisitos: Python 3, dataset `pokemon.csv` na raiz.

```bash
pip install -r requirements.txt
```

### Interface web

```bash
python app.py
# abre http://127.0.0.1:5000
```

### CLI

```bash
python iv_calculator.py
```

## Estrutura

```
├── app.py             # servidor Flask (web)
├── iv_calculator.py   # CLI + função porcentagem (canônica)
├── templates/
│   └── index.html     # interface web
├── pokemon.csv        # dataset (coluna usada: pokemon_name, type, pokemon_id)
└── requirements.txt
```

## Dataset

`pokemon.csv` com 1007 espécies. A coluna `pokemon_name` alimenta a busca;
`type` e `pokemon_id` enriquecem a UI web.
