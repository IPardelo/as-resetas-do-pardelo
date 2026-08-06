"""
As Resetas do Pardelo
Servidor local moi sinxelo (só biblioteca estándar de Python).
Garda cada receita como un ficheiro XML na carpeta "Receitas".

Uso:
    python server.py
e a app ábrese no navegador.
"""
import json
import os
import re
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
        "ingredientes": [e.text or "" for e in raiz.iter("ingrediente")],
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
        if i.strip():
            ET.SubElement(ings, "ingrediente").text = i.strip()

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


if __name__ == "__main__":
    servidor = ThreadingHTTPServer(("127.0.0.1", PORTO), Manexador)
    url = f"http://127.0.0.1:{PORTO}"
    print(f"\n  As Resetas do Pardelo  ->  {url}\n  (Ctrl+C para saír)\n")
    webbrowser.open(url)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
