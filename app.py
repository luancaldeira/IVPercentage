"""IV Scanner — interface web para o Pokémon GO IV Calculator.

Reaproveita a lógica do PRD (`porcentagem`) e serve o dataset local.
Roda em http://127.0.0.1:5000
"""

import ast
import os

import pandas as pd
from flask import Flask, jsonify, render_template, send_from_directory

from iv_calculator import porcentagem  # fonte canônica do cálculo (PRD)

BASE = os.path.dirname(os.path.abspath(__file__))
CSV = os.path.join(BASE, "pokemon.csv")

app = Flask(__name__)


def _parse_types(raw):
    """Converte "['Grass', 'Poison']" -> ['Grass', 'Poison']."""
    if not isinstance(raw, str) or not raw.strip():
        return []
    try:
        val = ast.literal_eval(raw)
        return [str(t) for t in val] if isinstance(val, (list, tuple)) else [str(val)]
    except (ValueError, SyntaxError):
        return []


def carregar_dataset():
    df = pd.read_csv(CSV)
    pokemon = []
    for _, row in df.iterrows():
        pokemon.append(
            {
                "id": int(row["pokemon_id"]),
                "name": str(row["pokemon_name"]),
                "types": _parse_types(row.get("type", "")),
            }
        )
    return pokemon


POKEMON = carregar_dataset()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/pokemon")
def api_pokemon():
    return jsonify(POKEMON)


@app.route("/api/calc/<int:atk>/<int:dfs>/<int:sta>")
def api_calc(atk, dfs, sta):
    """Cálculo via a função canônica do PRD (mesma usada pela CLI)."""
    for v in (atk, dfs, sta):
        if not 0 <= v <= 15:
            return jsonify({"error": "IV fora do intervalo 0-15"}), 400
    pct = porcentagem(atk, dfs, sta)
    return jsonify({"total": atk + dfs + sta, "percentage": round(pct, 1)})


@app.route("/iv-reader.js")
def iv_reader_js():
    """Serve o detector (fonte única, compartilhada com o build estático)."""
    return send_from_directory(os.path.join(BASE, "docs"), "iv-reader.js",
                               mimetype="application/javascript")


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
