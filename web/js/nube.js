// As Resetas do Pardelo — almacenamento na nube (só na app de Android)
//
// No escritorio as receitas gárdanse en XML a través de server.py.
// No móbil non hai servidor: lense e gárdanse en Firebase (Firestore) usando a súa API REST.
// A app de escritorio sincroniza a carpeta Receitas coa nube (ver nube.py).
// A configuración está en web/config/firebase.json.

const MOBIL = location.hostname === "appassets.androidplatform.net";

const nube = (() => {
  const COLECCION = "receitas";
  let config = null;
  const cache = new Map();

  async function cfg() {
    if (!config) {
      const r = await fetch("config/firebase.json");
      if (!r.ok) throw new Error("Falta web/config/firebase.json");
      config = await r.json();
    }
    return config;
  }

  async function url(doc = "", params = {}) {
    const c = await cfg();
    // params pode ser un obxecto ou unha lista de pares (para claves repetidas)
    const q = new URLSearchParams([["key", c.apiKey], ...(Array.isArray(params) ? params : Object.entries(params))]);
    return `https://firestore.googleapis.com/v1/projects/${c.projectId}/databases/(default)/documents/${COLECCION}` +
      (doc ? "/" + doc : "") + "?" + q;
  }

  async function pedir(metodo, doc, corpo, params) {
    const r = await fetch(await url(doc, params), {
      method: metodo,
      headers: corpo ? { "Content-Type": "application/json" } : {},
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(datos.error?.message || "Sen conexión");
    return datos;
  }

  // ---------- Formato de Firestore <-> JS ----------
  function a(v) {
    if (Array.isArray(v)) return { arrayValue: v.length ? { values: v.map(a) } : {} };
    if (v && typeof v === "object") return { mapValue: { fields: campos(v) } };
    if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === "boolean") return { booleanValue: v };
    return { stringValue: v == null ? "" : String(v) };
  }
  function campos(o) {
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, a(v)]));
  }
  function de(v) {
    if ("stringValue" in v) return v.stringValue;
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(de);
    if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, de(x)]));
    if ("integerValue" in v) return +v.integerValue;
    if ("doubleValue" in v) return v.doubleValue;
    if ("booleanValue" in v) return v.booleanValue;
    return null;
  }
  function receita(doc) {
    const r = Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, de(v)]));
    r.id = doc.name.split("/").pop();
    return r;
  }

  // Data local co mesmo formato que usa server.py (2026-10-08T20:34:00)
  function agora() {
    const d = new Date();
    return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
  }

  function novoId() {
    const c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from(crypto.getRandomValues(new Uint8Array(20)), (n) => c[n % c.length]).join("");
  }

  return {
    async listar() {
      let token = "", saida = [];
      do {
        const r = await pedir("GET", "", null, { pageSize: 100, ...(token ? { pageToken: token } : {}) });
        saida = saida.concat((r.documents || []).map(receita).filter((x) => !x.borrada));
        token = r.nextPageToken || "";
      } while (token);
      cache.clear();
      saida.forEach((r) => cache.set(r.id, r));
      return saida.sort((x, y) => (x.titulo || "").localeCompare(y.titulo || "", "gl"));
    },

    async ler(id) {
      if (cache.has(id)) return JSON.parse(JSON.stringify(cache.get(id)));
      return receita(await pedir("GET", id));
    },

    async gardar(d) {
      const id = d.id || novoId();
      const r = {
        titulo: (d.titulo || "").trim() || "Receita sen título",
        categoria: d.categoria || "",
        etiquetas: d.etiquetas || [],
        foto: d.foto || "",
        ingredientes: (d.ingredientes || [])
          .map((i) => ({ nome: (i.nome || "").trim(), cantidade: (i.cantidade || "").trim() }))
          .filter((i) => i.nome || i.cantidade),
        bloques: (d.bloques || [])
          .map((b) => ({ nome: (b.nome || "").trim(), pasos: b.pasos.map((p) => p.trim()).filter(Boolean) }))
          .filter((b) => b.nome || b.pasos.length),
        notas: (d.notas || "").trim(),
        creada: cache.get(id)?.creada || agora(),
        modificada: agora(),
      };
      await pedir("PATCH", id, { fields: campos(r) });
      cache.set(id, { ...r, id });
      return { ...r, id };
    },

    // Non se borra de verdade: márcase como borrada para que o escritorio
    // elimine tamén o XML ao sincronizar (e despois bórraa da nube).
    async borrar(id) {
      await pedir("PATCH", id, { fields: campos({ borrada: true, modificada: agora() }) },
        [["updateMask.fieldPaths", "borrada"], ["updateMask.fieldPaths", "modificada"]]);
      cache.delete(id);
    },
  };
})();
