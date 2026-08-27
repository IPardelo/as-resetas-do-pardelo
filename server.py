"""
As Resetas do Pardelo
Servidor local moi sinxelo (só biblioteca estándar de Python).
Garda cada receita como un ficheiro XML na carpeta "Receitas".

Normalmente non se abre directamente: "As Resetas do Pardelo.pyw" arráncao
e amosa a app na súa propia xanela. Para probar no navegador:
    python server.py --navegador
"""
import json
import os
import re
import sys
import threading
import unicodedata
import webbrowser
import xml.etree.ElementTree as ET
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

BASE = os.path.dirname(os.path.abspath(__file__))
RECEITAS = os.path.join(BASE, "Receitas")
WEB = os.path.join(BASE, "web")
PORTO = 8765

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


# Separa "130g de fariña" en ("Fariña", "130g") para as receitas antigas,
# onde o ingrediente era un só texto.
_NUM = r"(?:\d+(?:[.,/]\d+)?(?:\s*-\s*\d+)?|un|unha|medio|media)"
_UNIDADE = (
    r"(?:k?gr?s?|gramos?|kilos?|ml|cl|dl|l|litros?|cdta?s?|cda?s?|"
    r"cucharad(?:a|ita|iña)s?|cuchar(?:a|ita|iña)s?|cullerad(?:a|iña)s?|culler(?:a|iña)s?|"
    r"vasos?|cuncas?|tazas?|sobres?|tarros?|tarrinas?|botes?|latas?|paquetes?|bandexas?|"
    r"láminas?|follas?|dentes?|cabezas?|chorr(?:o|iño)s?|pizcas?|pitadas?|puñados?|ramas?|"
    r"rodajas?|rodas?|anacos?|unidades?)"
    r"(?:\s+(?:soperas?|rasas?|colmadas?|grandes?|pequen[oa]s?|mediano?s?))?"
)
_PARTIR = re.compile(rf"^({_NUM}(?:\s*(?:de\s+)?{_UNIDADE}\b)?)\.?\s+(?:de\s+|d\s+)?(.+)$", re.I)


def partir_ingrediente(texto):
    texto = (texto or "").strip()
    m = _PARTIR.match(texto)
    if not m:
        return texto, ""
    cantidade, nome = m.group(1).strip(), m.group(2).strip()
    return nome[:1].upper() + nome[1:], cantidade


def ler_ingrediente(e):
    if "cantidade" in e.attrib:  # formato novo
        return {"nome": e.text or "", "cantidade": e.get("cantidade", "")}
    nome, cantidade = partir_ingrediente(e.text)
    return {"nome": nome, "cantidade": cantidade}


def ler_receita(rid):
    raiz = ET.parse(ruta(rid)).getroot()
    foto = raiz.find("foto")
    return {
        "id": rid,
        "titulo": raiz.findtext("titulo", ""),
        "categoria": raiz.findtext("categoria", ""),
        "etiquetas": [e.text for e in raiz.iter("etiqueta") if e.text],
        "notas": raiz.findtext("notas", ""),
        "foto": f"data:{foto.get('tipo', 'image/jpeg')};base64,{foto.text}" if foto is not None and foto.text else "",
        "ingredientes": [ler_ingrediente(e) for e in raiz.iter("ingrediente")],
        # Cada <pasos nome="..."> é un bloque (Biscoito, Crema...)
        "bloques": [
            {"nome": b.get("nome", ""), "pasos": [e.text or "" for e in b.iter("paso")]}
            for b in raiz.findall("pasos")
        ],
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

    categoria = (datos.get("categoria") or "").strip()
    if categoria:
        ET.SubElement(raiz, "categoria").text = categoria

    etiquetas = []
    for e in datos.get("etiquetas", []):
        e = e.strip().lower()
        if e and e not in etiquetas:
            etiquetas.append(e)
    if etiquetas:
        eti = ET.SubElement(raiz, "etiquetas")
        for e in etiquetas:
            ET.SubElement(eti, "etiqueta").text = e

    foto = datos.get("foto") or ""
    m = re.match(r"data:([^;]+);base64,(.*)", foto, re.S)
    if m:
        ET.SubElement(raiz, "foto", tipo=m.group(1)).text = m.group(2)

    ings = ET.SubElement(raiz, "ingredientes")
    for i in datos.get("ingredientes", []):
        if isinstance(i, str):
            nome, cantidade = partir_ingrediente(i)
        else:
            nome = (i.get("nome") or "").strip()
            cantidade = (i.get("cantidade") or "").strip()
        if nome or cantidade:
            ET.SubElement(ings, "ingrediente", cantidade=cantidade).text = nome

    for bloque in datos.get("bloques", []):
        nome = (bloque.get("nome") or "").strip()
        lista = [p.strip() for p in bloque.get("pasos", []) if p.strip()]
        if not lista and not nome:
            continue
        pasos = ET.SubElement(raiz, "pasos", nome=nome) if nome else ET.SubElement(raiz, "pasos")
        for p in lista:
            ET.SubElement(pasos, "paso").text = p

    notas = (datos.get("notas") or "").strip()
    if notas:
        ET.SubElement(raiz, "notas").text = notas

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
                saida.append({k: r[k] for k in ("id", "titulo", "foto", "categoria", "etiquetas", "ingredientes", "modificada")})
            except Exception:
                pass
    return sorted(saida, key=lambda r: r["titulo"].lower())


# ---------- HTTP ----------

class Manexador(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=WEB, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        # Que o navegador non garde versións vellas da app
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def json(self, obx, estado=200):
        corpo = json.dumps(obx, ensure_ascii=False).encode("utf-8")
        self.send_response(estado)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def id_da_ruta(self):
        return unquote(self.path.split("/api/receitas/", 1)[1]) if "/api/receitas/" in self.path else ""

    def do_GET(self):
        if self.path == "/api/receitas":
            return self.json(listar())
        if self.path.startswith("/api/receitas/"):
            try:
                return self.json(ler_receita(self.id_da_ruta()))
            except Exception:
                return self.json({"erro": "Non atopada"}, 404)
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/receitas":
            return self.json({"erro": "?"}, 404)
        lonx = int(self.headers.get("Content-Length", 0))
        try:
            datos = json.loads(self.rfile.read(lonx).decode("utf-8"))
            return self.json(gardar_receita(datos))
        except Exception as e:
            return self.json({"erro": str(e)}, 400)

    def do_DELETE(self):
        try:
            os.remove(ruta(self.id_da_ruta()))
            return self.json({"ok": True})
        except Exception:
            return self.json({"erro": "Non atopada"}, 404)


def arrancar():
    """Arranca o servidor nun fío e devolve o enderezo. Se xa estaba aberto, reutilízao."""
    url = f"http://127.0.0.1:{PORTO}"
    try:
        servidor = ThreadingHTTPServer(("127.0.0.1", PORTO), Manexador)
    except OSError:
        return url  # xa hai outra xanela aberta: usamos o mesmo servidor
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    return url


def xanela():
    """Abre a app na súa propia xanela (pywebview)."""
    import webview  # pip install pywebview

    url = arrancar()
    webview.create_window(
        "As Resetas do Pardelo", url,
        width=1280, height=860, min_size=(760, 560), background_color="#f6efe4",
    )
    webview.start(private_mode=False)


if __name__ == "__main__":
    if "--navegador" in sys.argv:
        url = arrancar()
        print(f"\n  As Resetas do Pardelo  ->  {url}\n  (Ctrl+C para saír)\n")
        webbrowser.open(url)
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            pass
    else:
        xanela()
