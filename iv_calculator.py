"""Pokémon GO IV Calculator (CLI).

Lê o dataset local, deixa o usuário escolher um Pokémon por autocomplete,
recebe os IVs (Ataque, Defesa, Vida) e exibe a porcentagem de IV.
"""

import os
import sys

import pandas as pd
import questionary

CAMINHO_CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pokemon.csv")


def carregar_pokemon(caminho_csv):
    """Carrega o CSV e devolve a coluna pokemon_name como lista de strings."""
    if not os.path.exists(caminho_csv):
        print(f"Erro: arquivo não encontrado: {caminho_csv}")
        sys.exit(1)

    df = pd.read_csv(caminho_csv)
    if "pokemon_name" not in df.columns:
        print("Erro: coluna 'pokemon_name' não existe no CSV.")
        sys.exit(1)

    return df["pokemon_name"].dropna().astype(str).tolist()


def porcentagem(ataque, defesa, vida):
    """Porcentagem de IV: soma dos 3 stats sobre o máximo (45)."""
    return ((ataque + defesa + vida) / 45) * 100


def selecionar_pokemon(nomes):
    """Prompt de autocomplete; só aceita nome existente na lista."""
    nomes_set = set(nomes)
    while True:
        escolha = questionary.autocomplete(
            "Qual pokémon deseja avaliar?",
            choices=nomes,
            match_middle=True,
            ignore_case=True,
        ).ask()

        if escolha is None:  # Ctrl+C / Esc
            return None
        if escolha in nomes_set:
            return escolha
        print(f"'{escolha}' não está na lista. Tente novamente.")


def pedir_iv(campo, nome_pokemon):
    """Pede um IV inteiro entre 0 e 15; repete até ser válido."""
    while True:
        bruto = input(f"Quantos pontos {nome_pokemon} tem de {campo}? (0–15) ").strip()
        try:
            valor = int(bruto)
        except ValueError:
            print("Valor inválido: digite um número inteiro.")
            continue
        if 0 <= valor <= 15:
            return valor
        print("Valor fora do intervalo: precisa estar entre 0 e 15.")


def main():
    nomes = carregar_pokemon(CAMINHO_CSV)

    while True:
        nome = selecionar_pokemon(nomes)
        if nome is None:
            break

        ataque = pedir_iv("Ataque", nome)
        defesa = pedir_iv("Defesa", nome)
        vida = pedir_iv("Vida", nome)

        pct = porcentagem(ataque, defesa, vida)

        if pct == 100.0:
            print(f"Parabéns! {nome} é um HUNDO!")
        else:
            print(f"{nome} é um pokémon de {pct:.1f}% de IV.")

        de_novo = input("Deseja avaliar outro Pokémon? (s/n) ").strip().lower()
        if de_novo != "s":
            break


if __name__ == "__main__":
    main()
