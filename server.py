"""
As Resetas do Pardelo
Garda cada receita como un ficheiro XML na carpeta "Receitas".
"""
import os
import re
import unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
RECEITAS = os.path.join(BASE, "Receitas")

os.makedirs(RECEITAS, exist_ok=True)


# ---------- XML ----------

def slug(texto):
    t = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t).strip("-").lower()
    return t or "receita"


def ruta(rid):
    if not re.fullmatch(r"[a-z0-9-]+", rid or ""):
        raise ValueError("id non válido")
    return os.path.join(RECEITAS, rid + ".xml")


def ler_receita(rid):
    raiz = ET.parse(ruta(rid)).getroot()
    return {
        "id": rid,
        "titulo": raiz.findtext("titulo", ""),
        "ingredientes": [e.text or "" for e in raiz.iter("ingrediente")],
        "pasos": [e.text or "" for e in raiz.iter("paso")],
        "creada": raiz.get("creada", ""),
        "modificada": raiz.get("modificada", ""),
    }


def gardar_receita(datos):
    titulo = (datos.get("titulo") or "").strip() or "Receita sen título"
    vello = datos.get("id") or ""

    # Novo id a partir do título (evitando pisar outra receita)
    base = slug(titulo)
    rid, n = base, 2
    while os.path.exists(ruta(rid)) and rid != vello:
        rid, n = f"{base}-{n}", n + 1

    agora = datetime.now().isoformat(timespec="seconds")
    creada = agora
    if vello and os.path.exists(ruta(vello)):
        creada = ET.parse(ruta(vello)).getroot().get("creada", agora)

    raiz = ET.Element("receita", creada=creada, modificada=agora)
    ET.SubElement(raiz, "titulo").text = titulo

    ings = ET.SubElement(raiz, "ingredientes")
    for i in datos.get("ingredientes", []):
        if i.strip():
            ET.SubElement(ings, "ingrediente").text = i.strip()

    pasos = ET.SubElement(raiz, "pasos")
    for p in datos.get("pasos", []):
        if p.strip():
            ET.SubElement(pasos, "paso").text = p.strip()

    ET.indent(raiz, space="  ")
    ET.ElementTree(raiz).write(ruta(rid), encoding="utf-8", xml_declaration=True)

    if vello and vello != rid and os.path.exists(ruta(vello)):
        os.remove(ruta(vello))
    return ler_receita(rid)


def listar():
    saida = []
    for f in os.listdir(RECEITAS):
        if f.endswith(".xml"):
            try:
                r = ler_receita(f[:-4])
                saida.append({k: r[k] for k in ("id", "titulo", "modificada")})
            except Exception:
                pass
    return sorted(saida, key=lambda r: r["titulo"].lower())
