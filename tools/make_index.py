"""Génère data/index.json (index léger) à partir de data/recettes.json.
À relancer si le catalogue change : python3 tools/make_index.py"""
import json, pathlib
racine = pathlib.Path(__file__).resolve().parent.parent
recettes = json.loads((racine / "data" / "recettes.json").read_text(encoding="utf-8"))
index = [
    {
        "id": r["id"],
        "titre": r["titre"],
        "categorie": r["categorie"],
        "sous_categorie": r["sous_categorie"],
        "regimes": r["regimes_compatibles"],
        "allergenes": r["allergenes"],
        "temps": r["temps"]["total_min"],
    }
    for r in recettes
]
(racine / "data" / "index.json").write_text(
    json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(len(index), "recettes indexées")
