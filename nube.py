"""
As Resetas do Pardelo — sincronización coa nube (Firebase / Firestore)

O escritorio e o móbil comparten as receitas a través de Firestore (colección "receitas"):
  - Ao abrir a app de escritorio (e despois de cada cambio) sincronízase todo:
    o novo ou editado na carpeta "Receitas" súbese, e o novo ou editado no móbil baixa a XML.
  - Se unha receita se editou nos dous sitios, queda a do escritorio.
  - Borrar no escritorio bórraa da nube. Borrar no móbil marca a receita como "borrada"
    e o escritorio elimina o XML ao sincronizar.
  - Se unha receita desaparece da nube sen marca de borrado (p. ex. base de datos nova),
    súbese outra vez: nunca se borran XML por erro.

Só usa a biblioteca estándar: fala coa API REST de Firestore.
A configuración está en web/config/firebase.json (ver firebase.exemplo.json).
"""
import json
import os
import secrets
import string
import threading
import urllib.error
import urllib.parse
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(BASE, "web", "config", "firebase.json")
# Rexistro local: { id_nube: {"id": id_local, "remota": modificada_na_nube, "local": pegada_do_xml} }
REXISTRO = os.path.join(BASE, ".nube.json")
COLECCION = "receitas"
CAMPOS = ("titulo", "categoria", "etiquetas", "foto", "ingredientes", "bloques", "notas", "creada", "modificada")
MAX_DOC = 1_000_000  # Firestore non admite documentos de máis de 1 MiB

_bloqueo = threading.RLock()  # RLock: gardar unha receita pode chamar a renomear() durante a sincronización


# ---------- Configuración ----------

def config():
    try:
        with open(CONFIG, encoding="utf-8") as f:
            c = json.load(f)
        if c.get("apiKey") and c.get("projectId") and "PON_AQUI" not in c["apiKey"]:
            return c
    except (OSError, ValueError):
        pass
    return None


def configurada():
    return config() is not None


def _url(c, doc=""):
    ruta = f"https://firestore.googleapis.com/v1/projects/{c['projectId']}/databases/(default)/documents/{COLECCION}"
    return ruta + (f"/{doc}" if doc else "")


def _pedir(metodo, url, c, params=None, corpo=None):
    q = [("key", c["apiKey"])] + list((params or {}).items())
    url += "?" + urllib.parse.urlencode(q, doseq=True)
    datos = json.dumps(corpo).encode("utf-8") if corpo is not None else None
    req = urllib.request.Request(url, data=datos, method=metodo,
                                 headers={"Content-Type": "application/json"} if datos else {})
    with urllib.request.urlopen(req, timeout=20) as r:
        texto = r.read().decode("utf-8")
    return json.loads(texto) if texto else {}


# ---------- Formato de Firestore <-> Python ----------

def de_firestore(v):
    if "stringValue" in v:
        return v["stringValue"]
    if "arrayValue" in v:
        return [de_firestore(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v:
        return {k: de_firestore(x) for k, x in v["mapValue"].get("fields", {}).items()}
    if "integerValue" in v:
        return int(v["integerValue"])
    if "doubleValue" in v:
        return v["doubleValue"]
    if "booleanValue" in v:
        return v["booleanValue"]
    return None


def a_firestore(v):
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, int):
        return {"integerValue": str(v)}
    if isinstance(v, float):
        return {"doubleValue": v}
    if isinstance(v, (list, tuple)):
        return {"arrayValue": {"values": [a_firestore(x) for x in v]} if v else {}}
    if isinstance(v, dict):
        return {"mapValue": {"fields": {k: a_firestore(x) for k, x in v.items()}}}
    return {"stringValue": "" if v is None else str(v)}


def documento(doc):
    """Documento de Firestore -> dict de receita (mesmo formato que usa a web)."""
    d = {k: de_firestore(v) for k, v in doc.get("fields", {}).items()}
    d["nube"] = doc["name"].rsplit("/", 1)[1]
    return d


# ---------- Operacións na nube ----------

def listar():
    c = config()
    saida, token = [], None
    while True:
        params = {"pageSize": 100, **({"pageToken": token} if token else {})}
        r = _pedir("GET", _url(c), c, params)
        saida += [documento(d) for d in r.get("documents", [])]
        token = r.get("nextPageToken")
        if not token:
            return saida


def subir(id_nube, receita):
    c = config()
    campos = {k: receita.get(k, [] if k in ("etiquetas", "ingredientes", "bloques") else "") for k in CAMPOS}
    corpo = {"fields": {k: a_firestore(v) for k, v in campos.items()}}
    if len(json.dumps(corpo)) > MAX_DOC:
        raise ValueError(f'"{receita.get("titulo")}" ocupa máis de 1 MB (foto demasiado grande)')
    _pedir("PATCH", _url(c, id_nube), c, corpo=corpo)


def borrar(id_nube):
    c = config()
    try:
        _pedir("DELETE", _url(c, id_nube), c)
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise


def novo_id():
    letras = string.ascii_letters + string.digits
    return "".join(secrets.choice(letras) for _ in range(20))


# ---------- Rexistro local ----------

def ler_rexistro():
    try:
        with open(REXISTRO, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def gardar_rexistro(r):
    with open(REXISTRO, "w", encoding="utf-8") as f:
        json.dump(r, f, ensure_ascii=False, indent=2)


def renomear(vello, novo):
    """A receita local cambiou de nome de ficheiro: actualizar o rexistro."""
    with _bloqueo:
        rex = ler_rexistro()
        cambiou = False
        for info in rex.values():
            if info["id"] == vello:
                info["id"] = novo
                cambiou = True
        if cambiou:
            gardar_rexistro(rex)
