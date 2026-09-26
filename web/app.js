// As Resetas do Pardelo — interface
const $ = (s) => document.querySelector(s);

const el = {
  lista: $("#lista"), baleiroLista: $("#baleiro-lista"), buscar: $("#buscar"),
  titulo: $("#titulo"), foto: $("#foto"), fotoImg: $("#foto-img"), ficheiro: $("#ficheiro"),
  ingredientes: $("#ingredientes"), bloques: $("#bloques"),
  estado: $("#estado"), aviso: $("#aviso"), pdf: $("#folla-pdf"),
  categorias: $("#categorias"), etiquetas: $("#etiquetas"), novaEtiqueta: $("#nova-etiqueta"),
  todasEtiquetas: $("#todas-etiquetas"), notas: $("#notas"),
  filtroCat: $("#filtro-cat"), filtroEti: $("#filtro-etiquetas"),
};

const CATEGORIAS = { comida: "Comida", postre: "Postre" };
let filtroCat = "";
let filtroEtiqueta = "";

let receitas = [];
let actual = baleira();
let temporizador = null;
let gardando = Promise.resolve();

function baleira() {
  return {
    id: "", titulo: "", foto: "", categoria: filtroCat, etiquetas: [], notas: "",
    ingredientes: [ingBaleiro()], bloques: [{ nome: "", pasos: [""] }],
  };
}

function ingBaleiro() { return { nome: "", cantidade: "" }; }

// Separa "130g de fariña" en { nome: "Fariña", cantidade: "130g" } (ao pegar listas)
const PARTIR = new RegExp(
  "^((?:\\d+(?:[.,/]\\d+)?(?:\\s*-\\s*\\d+)?|un|unha|medio|media)" +
  "(?:\\s*(?:de\\s+)?(?:k?gr?s?|gramos?|kilos?|ml|cl|dl|l|litros?|cdta?s?|cda?s?|" +
  "cucharad(?:a|ita|iña)s?|cuchar(?:a|ita|iña)s?|cullerad(?:a|iña)s?|culler(?:a|iña)s?|" +
  "vasos?|cuncas?|tazas?|sobres?|tarros?|tarrinas?|botes?|latas?|paquetes?|bandexas?|" +
  "láminas?|follas?|dentes?|cabezas?|chorr(?:o|iño)s?|pizcas?|pitadas?|puñados?|ramas?|" +
  "rodajas?|rodas?|anacos?|unidades?)" +
  "(?:\\s+(?:soperas?|rasas?|colmadas?|grandes?|pequen[oa]s?|mediano?s?))?(?![\\wñáéíóú]))?)" +
  "\\.?\\s+(?:de\\s+|d\\s+)?(.+)$", "i");

function partirIngrediente(t) {
  t = (t || "").trim();
  const m = t.match(PARTIR);
  if (!m) return { nome: t, cantidade: "" };
  const nome = m[2].trim();
  return { nome: nome[0].toUpperCase() + nome.slice(1), cantidade: m[1].trim() };
}

// ---------- API ----------
// Escritorio: server.py (XML na carpeta Receitas). Móbil: Firebase (js/nube.js).
const api = MOBIL ? nube : {
  listar: () => fetch("/api/receitas").then((r) => r.json()),
  ler: (id) => fetch("/api/receitas/" + encodeURIComponent(id)).then((r) => r.json()),
  gardar: (d) => fetch("/api/receitas", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d),
  }).then((r) => r.json()),
  borrar: (id) => fetch("/api/receitas/" + encodeURIComponent(id), { method: "DELETE" }),
};

// ---------- Lista lateral ----------
async function cargarLista() {
  try {
    receitas = await api.listar();
  } catch (err) {
    avisar(MOBIL ? "Sen conexión coa nube" : "Erro ao cargar as receitas");
  }
  pintarLista();
}

function sinTiles(t) {
  return (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function pintarLista() {
  const q = el.buscar.value.trim().toLowerCase();

  // Etiquetas existentes (para filtrar e para suxerir)
  const todas = [...new Set(receitas.flatMap((r) => r.etiquetas || []))].sort();
  if (filtroEtiqueta && !todas.includes(filtroEtiqueta)) filtroEtiqueta = "";
  el.filtroEti.innerHTML = "";
  for (const e of todas) {
    const b = document.createElement("button");
    b.textContent = "#" + e;
    b.className = e === filtroEtiqueta ? "activo" : "";
    b.onclick = () => { filtroEtiqueta = filtroEtiqueta === e ? "" : e; pintarLista(); };
    el.filtroEti.append(b);
  }
  el.todasEtiquetas.innerHTML = todas.map((e) => `<option value="${e.replace(/"/g, "&quot;")}">`).join("");
  el.filtroCat.querySelectorAll("button").forEach((b) => b.classList.toggle("activo", b.dataset.cat === filtroCat));

  // Busca por nome, etiqueta ou ingrediente (sen importar tiles).
  // Con varias palabras ("ovos fariña") teñen que estar todas.
  const palabras = sinTiles(q).split(/\s+/).filter(Boolean);
  const coincidencias = new Map();
  const visibles = receitas.filter((r) => {
    if (filtroCat && r.categoria !== filtroCat) return false;
    if (filtroEtiqueta && !(r.etiquetas || []).includes(filtroEtiqueta)) return false;
    const titulo = sinTiles(r.titulo);
    const etiquetas = (r.etiquetas || []).map(sinTiles);
    const ings = (r.ingredientes || []).map((i) => i.nome || "");
    const atopados = new Set();
    for (const p of palabras) {
      const nosIngs = ings.filter((i) => sinTiles(i).includes(p));
      nosIngs.forEach((i) => atopados.add(i));
      if (!titulo.includes(p) && !etiquetas.some((e) => e.includes(p)) && !nosIngs.length) return false;
    }
    if (atopados.size) coincidencias.set(r.id, [...atopados]);
    return true;
  });
  el.lista.innerHTML = "";
  for (const r of visibles) {
    const li = document.createElement("li");
    li.className = r.id === actual.id ? "activa" : "";
    const mini = document.createElement("div");
    mini.className = "miniatura";
    if (r.foto) mini.style.backgroundImage = `url("${r.foto}")`;
    else mini.textContent = (r.titulo[0] || "?").toUpperCase();
    const textos = document.createElement("div");
    textos.className = "textos";
    const nome = document.createElement("span");
    nome.textContent = r.titulo;
    textos.append(nome);
    const det = [CATEGORIAS[r.categoria], ...(r.etiquetas || []).map((e) => "#" + e)].filter(Boolean).join(" · ");
    if (coincidencias.has(r.id)) {
      const d = document.createElement("small");
      d.className = "detalle ingrediente-atopado";
      d.textContent = "✓ " + coincidencias.get(r.id).join(" · ");
      textos.append(d);
    } else if (det) {
      const d = document.createElement("small");
      d.className = "detalle";
      d.textContent = det;
      textos.append(d);
    }
    li.append(mini, textos);
    li.onclick = () => abrir(r.id);
    el.lista.append(li);
  }
  el.baleiroLista.textContent = receitas.length ? "Ningunha receita con ese filtro." : "Aínda non hai receitas.";
  el.baleiroLista.style.display = visibles.length ? "none" : "block";
}

// ---------- Editor ----------
// Listas editables: "ingredientes" ou "b0", "b1"… (bloques de pasos)
function arr(k) { return k === "ingredientes" ? actual.ingredientes : actual.bloques[+k.slice(1)].pasos; }
function cont(k) { return k === "ingredientes" ? el.ingredientes : document.querySelector(`[data-lista="${k}"]`); }

function normalizar(r) {
  r.categoria = r.categoria || "";
  r.etiquetas = r.etiquetas || [];
  r.notas = r.notas || "";
  r.ingredientes = (r.ingredientes || []).map((i) => typeof i === "string" ? partirIngrediente(i) : i);
  r.ingredientes = r.ingredientes.map((i) => ({ nome: i.nome || "", cantidade: i.cantidade || "" }));
  if (!r.ingredientes.length) r.ingredientes = [ingBaleiro()];
  if (!r.bloques || !r.bloques.length) r.bloques = [{ nome: "", pasos: [""] }];
  r.bloques.forEach((b) => { b.nome = b.nome || ""; b.pasos = b.pasos || []; if (!b.pasos.length) b.pasos = [""]; });
  return r;
}

async function abrir(id) {
  await gardarAgora();
  try {
    actual = normalizar(await api.ler(id));
  } catch (err) {
    return avisar("Non se puido abrir: " + err.message);
  }
  editando = !MOBIL;
  pintarEditor();
  pintarLista();
  estado("ok", "Gardado");
  vista("receita");
}

async function nova() {
  await gardarAgora();
  actual = baleira();
  editando = true;
  pintarEditor();
  pintarLista();
  estado("", "");
  vista("receita");
  el.titulo.focus();
}

function pintarEditor() {
  el.titulo.value = actual.titulo;
  axustarAltura(el.titulo);
  pintarFoto();
  pintarCategoria();
  pintarEtiquetas();
  el.notas.value = actual.notas;
  axustarAltura(el.notas);
  pintarLinhas("ingredientes");
  pintarBloques();
  aplicarModo();
}

// ---------- Categoría, etiquetas e notas ----------
function pintarCategoria() {
  el.categorias.querySelectorAll("button").forEach((b) => b.classList.toggle("activo", b.dataset.cat === actual.categoria));
}

el.categorias.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  actual.categoria = actual.categoria === b.dataset.cat ? "" : b.dataset.cat;
  pintarCategoria();
  cambiou();
});

function pintarEtiquetas() {
  el.etiquetas.querySelectorAll(".chip").forEach((c) => c.remove());
  actual.etiquetas.forEach((t, i) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = "#" + t;
    const x = document.createElement("button");
    x.type = "button";
    x.title = "Quitar etiqueta";
    x.textContent = "×";
    x.onclick = () => { actual.etiquetas.splice(i, 1); pintarEtiquetas(); cambiou(); };
    chip.append(x);
    el.etiquetas.insertBefore(chip, el.novaEtiqueta);
  });
}

function engadirEtiqueta() {
  const t = el.novaEtiqueta.value.replace(/^#/, "").replace(/,/g, "").trim().toLowerCase();
  el.novaEtiqueta.value = "";
  if (!t || actual.etiquetas.includes(t)) return;
  actual.etiquetas.push(t);
  pintarEtiquetas();
  cambiou();
}

el.novaEtiqueta.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === ",") { e.preventDefault(); engadirEtiqueta(); }
  else if (e.key === "Backspace" && !el.novaEtiqueta.value && actual.etiquetas.length) {
    actual.etiquetas.pop(); pintarEtiquetas(); cambiou();
  }
});
// Ao escoller unha suxestión da lista
el.novaEtiqueta.addEventListener("input", (e) => {
  if (e.inputType === "insertReplacementText" || !e.inputType) engadirEtiqueta();
});
el.novaEtiqueta.addEventListener("blur", engadirEtiqueta);

el.notas.addEventListener("input", () => {
  actual.notas = el.notas.value;
  axustarAltura(el.notas);
  cambiou();
});

el.filtroCat.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  filtroCat = b.dataset.cat;
  pintarLista();
});

function pintarFoto() {
  el.foto.classList.toggle("con-foto", !!actual.foto);
  el.fotoImg.src = actual.foto || "";
}

function pintarBloques() {
  el.bloques.innerHTML = "";
  actual.bloques.forEach((b, i) => {
    const sec = document.createElement("section");
    const h2 = document.createElement("h2");
    h2.append("Pasos");

    const nome = document.createElement("input");
    nome.className = "nome-bloque";
    nome.value = b.nome;
    nome.placeholder = actual.bloques.length > 1 ? "(nome)" : "";
    nome.title = "Nome do bloque (opcional), p. ex. Biscoito";
    const axustarNome = () => (nome.style.width = Math.max(nome.value.length, nome.placeholder.length, 6) + 2 + "ch");
    axustarNome();
    nome.addEventListener("input", () => { b.nome = nome.value; axustarNome(); cambiou(); });
    nome.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); enfocar("b" + i, 0); } });
    h2.append(nome);

    if (actual.bloques.length > 1) {
      const quitar = document.createElement("button");
      quitar.className = "borrar-bloque";
      quitar.textContent = "Quitar bloque";
      quitar.onclick = async () => {
        const ten = b.pasos.some((p) => p.trim());
        if (ten && !(await confirmar({ titulo: "Quitar bloque", texto: `Quitar o bloque "${b.nome || "Pasos"}" cos seus pasos?`, si: "Quitar" }))) return;
        actual.bloques.splice(i, 1);
        pintarBloques();
        cambiou();
      };
      h2.append(quitar);
    }

    const ol = document.createElement("ol");
    ol.className = "pasos";
    ol.dataset.lista = "b" + i;

    const mais = document.createElement("button");
    mais.className = "engadir";
    mais.textContent = "+ Engadir paso";
    mais.onclick = () => engadirLinha("b" + i);

    sec.append(h2, ol, mais);
    el.bloques.append(sec);
    pintarLinhas("b" + i);
  });
}

function engadirBloque() {
  actual.bloques.push({ nome: "", pasos: [""] });
  pintarBloques();
  const nomes = el.bloques.querySelectorAll(".nome-bloque");
  nomes[nomes.length - 1].focus();
}

function pintarLinhas(k) {
  const c = cont(k);
  c.innerHTML = "";
  arr(k).forEach((_, i) => c.append(crearLinha(k, i)));
}

function crearLinha(k, i) {
  if (k === "ingredientes") return crearIngrediente(i);
  const ePaso = k !== "ingredientes";
  const li = document.createElement("li");
  const campo = document.createElement(ePaso ? "textarea" : "input");
  campo.value = arr(k)[i];
  campo.placeholder = ePaso ? "Describe o paso…" : "p. ex. 200 g de fariña";
  if (ePaso) campo.rows = 1;

  campo.addEventListener("input", () => {
    arr(k)[indice(li)] = campo.value;
    if (ePaso) axustarAltura(campo);
    cambiou();
  });

  campo.addEventListener("keydown", (e) => {
    const n = indice(li);
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      engadirLinha(k, n + 1);
    } else if (e.key === "Backspace" && campo.value === "" && arr(k).length > 1) {
      e.preventDefault();
      borrarLinha(k, n, true);
    }
  });

  // Pegar unha lista => unha liña por elemento
  campo.addEventListener("paste", (e) => {
    const texto = e.clipboardData.getData("text");
    const partes = texto.split(/\r?\n/).map(limparPrefixo).filter((t) => t.trim());
    if (partes.length < 2) return;
    e.preventDefault();
    const n = indice(li);
    const antes = arr(k)[n];
    arr(k).splice(n, 1, ...(antes.trim() ? [antes, ...partes] : partes));
    pintarLinhas(k);
    cambiou();
  });

  const borrar = document.createElement("button");
  borrar.className = "borrar";
  borrar.title = "Borrar";
  borrar.textContent = "×";
  borrar.onclick = () => borrarLinha(k, indice(li));

  li.append(campo, borrar);
  if (ePaso) requestAnimationFrame(() => axustarAltura(campo));
  return li;
}

// Fila de ingrediente: [ Nome | Cantidade | × ]
function crearIngrediente(i) {
  const k = "ingredientes";
  const li = document.createElement("li");
  const campos = ["nome", "cantidade"].map((prop) => {
    const c = document.createElement("input");
    c.className = "ing-" + prop;
    c.value = actual.ingredientes[i][prop];
    c.placeholder = prop === "nome" ? "Ingrediente" : "Cantidade";
    c.addEventListener("input", () => { actual.ingredientes[indice(li)][prop] = c.value; cambiou(); });
    return c;
  });
  const [nome, cantidade] = campos;

  nome.addEventListener("keydown", (e) => {
    const n = indice(li);
    if (e.key === "Enter") { e.preventDefault(); cantidade.focus(); cantidade.select(); }
    else if (e.key === "Backspace" && !nome.value && !cantidade.value && actual.ingredientes.length > 1) {
      e.preventDefault(); borrarLinha(k, n, true);
    }
  });
  cantidade.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); engadirLinha(k, indice(li) + 1); }
    else if (e.key === "Backspace" && !cantidade.value) { e.preventDefault(); nome.focus(); }
  });

  // Pegar unha lista ("130g de fariña" en cada liña) => unha fila por ingrediente
  nome.addEventListener("paste", (e) => {
    const texto = e.clipboardData.getData("text");
    const partes = texto.split(/\r?\n/).map(limparPrefixo).filter((t) => t.trim()).map(partirIngrediente);
    const baleira = !nome.value && !cantidade.value;
    if (partes.length < 2 && !(baleira && partes[0]?.cantidade)) return;
    e.preventDefault();
    const n = indice(li);
    actual.ingredientes.splice(n, baleira ? 1 : 0, ...partes);
    pintarLinhas(k);
    enfocar(k, n + partes.length - (baleira ? 1 : 0), true);
    cambiou();
  });

  const borrar = document.createElement("button");
  borrar.className = "borrar";
  borrar.title = "Borrar";
  borrar.textContent = "×";
  borrar.onclick = () => borrarLinha(k, indice(li));

  li.append(nome, cantidade, borrar);
  return li;
}

function limparPrefixo(t) {
  return t.replace(/^\s*(?:[-*•·]|\d+[.)-]?)\s+/, "").trim();
}

function indice(li) {
  return [...li.parentNode.children].indexOf(li);
}

function filaBaleira(k) { return k === "ingredientes" ? ingBaleiro() : ""; }

function engadirLinha(k, pos = arr(k).length) {
  arr(k).splice(pos, 0, filaBaleira(k));
  pintarLinhas(k);
  enfocar(k, pos);
}

function borrarLinha(k, n, enfocarAnterior) {
  const a = arr(k);
  a.splice(n, 1);
  if (!a.length) a.push(filaBaleira(k));
  pintarLinhas(k);
  if (enfocarAnterior) enfocar(k, Math.max(0, n - 1), true);
  cambiou();
}

function enfocar(k, n, oFinal) {
  const c = cont(k)?.children[n]?.firstChild;
  if (!c) return;
  c.focus();
  if (oFinal) c.setSelectionRange(c.value.length, c.value.length);
}

function axustarAltura(t) {
  t.style.height = "auto";
  t.style.height = t.scrollHeight + "px";
}

// ---------- Foto ----------
el.ficheiro.addEventListener("change", () => {
  if (el.ficheiro.files[0]) cargarFoto(el.ficheiro.files[0]);
  el.ficheiro.value = "";
});
$("#quitar-foto").addEventListener("click", (e) => {
  e.preventDefault(); e.stopPropagation();
  actual.foto = ""; pintarFoto(); cambiou();
});
["dragenter", "dragover"].forEach((ev) => el.foto.addEventListener(ev, (e) => {
  e.preventDefault(); el.foto.classList.add("arrastrando");
}));
["dragleave", "drop"].forEach((ev) => el.foto.addEventListener(ev, (e) => {
  e.preventDefault(); el.foto.classList.remove("arrastrando");
}));
el.foto.addEventListener("drop", (e) => {
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith("image/")) cargarFoto(f);
});

// Reduce a foto para que o XML non pese demasiado e caiba en Firebase
// (non admite documentos de máis de 1 MB).
function cargarFoto(ficheiro) {
  const img = new Image();
  img.onload = () => {
    const max = MOBIL ? 1000 : 1200;
    const esc = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * esc);
    c.height = Math.round(img.height * esc);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    actual.foto = c.toDataURL("image/jpeg", MOBIL ? 0.8 : 0.82);
    URL.revokeObjectURL(img.src);
    pintarFoto();
    cambiou();
  };
  img.src = URL.createObjectURL(ficheiro);
}

// ---------- Gardado automático ----------
el.titulo.addEventListener("input", () => {
  actual.titulo = el.titulo.value.replace(/\n/g, " ");
  axustarAltura(el.titulo);
  cambiou();
});
el.titulo.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); enfocar("ingredientes", 0); }
});

function tenContido() {
  return actual.titulo.trim() || actual.foto || actual.notas.trim() || actual.etiquetas.length ||
    actual.ingredientes.some((i) => i.nome.trim() || i.cantidade.trim()) ||
    actual.bloques.some((b) => b.nome.trim() || b.pasos.some((t) => t.trim()));
}

function cambiou() {
  if (!tenContido()) return;
  estado("pendente", "Gardando…");
  clearTimeout(temporizador);
  temporizador = setTimeout(gardarAgora, 700);
}

function gardarAgora() {
  if (!temporizador) return gardando;
  clearTimeout(temporizador);
  temporizador = null;
  gardando = gardando.then(async () => {
    // Copia tomada xusto antes de enviar (así sempre leva o id máis recente)
    const copia = JSON.parse(JSON.stringify(actual));
    try {
      const r = await api.gardar(copia);
      if (r.erro) throw new Error(r.erro);
      if (actual.id === copia.id) actual.id = r.id;
      estado("ok", MOBIL ? "Gardado na nube" : "Gardado en Receitas/" + r.id + ".xml");
      if (MOBIL) {
        // Sen volver descargar toda a lista da nube
        receitas = receitas.filter((x) => x.id !== r.id).concat(r)
          .sort((x, y) => x.titulo.localeCompare(y.titulo, "gl"));
        pintarLista();
      } else await cargarLista();
    } catch (err) {
      estado("pendente", "Non se puido gardar");
      avisar("Erro ao gardar: " + err.message);
    }
  });
  return gardando;
}

function estado(clase, texto) {
  el.estado.className = "estado " + clase;
  el.estado.textContent = texto;
}

function avisar(texto) {
  el.aviso.textContent = texto;
  el.aviso.classList.add("visible");
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => el.aviso.classList.remove("visible"), 2400);
}

// ---------- PDF ----------
function exportarPDF() {
  if (!tenContido()) return avisar("A receita está baleira");
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ings = actual.ingredientes.filter((i) => i.nome.trim() || i.cantidade.trim());
  const meta = [
    ...(actual.categoria ? [`<span class="cat">${CATEGORIAS[actual.categoria]}</span>`] : []),
    ...actual.etiquetas.map((t) => `<span>#${esc(t)}</span>`),
  ];
  const bloques = actual.bloques
    .map((b) => ({ nome: b.nome.trim(), pasos: b.pasos.filter((t) => t.trim()) }))
    .filter((b) => b.pasos.length);
  el.pdf.innerHTML = `
    <header class="pdf-cabeceira">
      <div class="pdf-titulo">
        <h1>${esc(actual.titulo || "Receita sen título")}</h1>
        ${meta.length ? `<div class="pdf-meta">${meta.join("")}</div>` : ""}
      </div>
      ${actual.foto ? `<img class="pdf-foto" src="${actual.foto}" alt="">` : ""}
    </header>
    ${ings.length ? `<h2>Ingredientes</h2>
      <ul class="pdf-ingredientes ${ings.length > 10 ? "dobre" : ""}">${ings.map((i) =>
        `<li><span>${esc(i.nome.trim())}</span><span class="cant">${esc(i.cantidade.trim())}</span></li>`).join("")}</ul>` : ""}
    ${bloques.map((b) => `<section class="pdf-bloque"><h2>Pasos${b.nome ? " " + esc(b.nome) : ""}</h2>
      <ol class="pdf-pasos">${b.pasos.map((t) => `<li>${esc(t)}</li>`).join("")}</ol></section>`).join("")}
    ${actual.notas.trim() ? `<h2>Notas</h2><div class="pdf-notas">${esc(actual.notas.trim())}</div>` : ""}
    <div class="pdf-pe">As Resetas do Pardelo</div>`;

  const tituloVello = document.title;
  document.title = actual.titulo || "Receita"; // nome suxerido para o PDF
  const imprimir = () => {
    // En Android window.print() non fai nada: a app ofrece a súa propia ponte
    if (window.Android?.imprimir) window.Android.imprimir(document.title);
    else window.print();
    document.title = tituloVello;
  };
  const img = el.pdf.querySelector("img");
  if (img && !img.complete) img.onload = imprimir; else imprimir();
}

// ---------- Xanela de confirmación ----------
// confirmar({ titulo, texto, si }) -> Promise<boolean>
const modal = $("#modal");
let pecharModal = null;

function confirmar({ titulo, texto, si = "Aceptar" }) {
  $("#modal-titulo").textContent = titulo;
  $("#modal-texto").textContent = texto;
  $("#modal-si").textContent = si;
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add("visible"));
  $("#modal-non").focus();
  return new Promise((resolver) => {
    pecharModal = (resposta) => {
      modal.classList.remove("visible");
      setTimeout(() => (modal.hidden = true), 150);
      pecharModal = null;
      resolver(resposta);
    };
  });
}
$("#modal-si").onclick = () => pecharModal?.(true);
$("#modal-non").onclick = () => pecharModal?.(false);
modal.addEventListener("click", (e) => { if (e.target === modal) pecharModal?.(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pecharModal) pecharModal(false); });

// ---------- Modo lectura (móbil) ----------
// No móbil as receitas ábrense só para ler; o lapis activa a edición.
let editando = !MOBIL;

function aplicarModo() {
  const lectura = MOBIL && !editando;
  document.body.classList.toggle("lectura", lectura);
  document.querySelectorAll(".folla-editor input, .folla-editor textarea").forEach((c) => {
    if (c.type !== "file") c.readOnly = lectura;
  });
  // En lectura non se amosan as filas baleiras nin as seccións sen contido
  document.querySelectorAll(".ingredientes li, .pasos li").forEach((li) => {
    li.classList.toggle("baleira", [...li.querySelectorAll("input, textarea")].every((c) => !c.value.trim()));
  });
  document.querySelectorAll("#bloques section").forEach((s) => {
    s.classList.toggle("baleira", !s.querySelector(".pasos li:not(.baleira)"));
  });
  el.ingredientes.closest("section").classList.toggle("baleira", !el.ingredientes.querySelector("li:not(.baleira)"));
  el.notas.closest("section").classList.toggle("baleira", !el.notas.value.trim());
  const editar = $("#editar");
  editar.querySelector(".fa").className = "fa " + (editando ? "fa-check" : "fa-pencil");
  editar.title = editar.ariaLabel = editando ? "Rematar de editar" : "Editar receita";
  editar.classList.toggle("activo", editando);
  if (lectura) document.activeElement?.blur();
}

function editar(si) {
  editando = si;
  aplicarModo();
  if (si) document.querySelectorAll(".folla-editor textarea").forEach(axustarAltura);
}

// ---------- Botóns ----------
$("#nova").onclick = nova;
$("#engadir-ingrediente").onclick = () => engadirLinha("ingredientes");
$("#engadir-bloque").onclick = engadirBloque;
$("#exportar").onclick = exportarPDF;
$("#editar").onclick = async () => {
  if (editando) { await gardarAgora(); editar(false); } else editar(true);
};
$("#eliminar").onclick = async () => {
  if (!actual.id) { actual = baleira(); pintarEditor(); vista("lista"); return; }
  const si = await confirmar({
    titulo: "Eliminar receita",
    texto: `Seguro que queres eliminar "${actual.titulo || "Receita sen título"}"? Non se pode desfacer.`,
    si: "Eliminar",
  });
  if (!si) return;
  clearTimeout(temporizador); temporizador = null;
  try {
    await api.borrar(actual.id);
  } catch (err) {
    return avisar("Non se puido eliminar: " + err.message);
  }
  avisar("Receita eliminada");
  actual = baleira();
  pintarEditor();
  estado("", "");
  cargarLista();
  vista("lista");
};
el.buscar.addEventListener("input", pintarLista);

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (tenContido()) { temporizador = temporizador || 1; gardarAgora().then(() => avisar("Gardado")); }
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
    e.preventDefault(); exportarPDF();
  }
});
window.addEventListener("beforeunload", () => { if (temporizador) gardarAgora(); });

// ---------- Nube (só escritorio) ----------
// Ao abrir a app (e ao volver á xanela) sincronízase a carpeta Receitas con Firebase:
// súbese o novo do escritorio e baixa o novo do móbil. Despois de cada cambio, o
// servidor sube o cambio el só. A nubiña da barra lateral indica o estado e,
// ao premela, sincroniza agora.
const botonNube = $("#nube-estado");
let ultimaSync = 0;

function pintarNube(clase, texto) {
  botonNube.hidden = false;
  botonNube.className = "nube-estado " + clase;
  botonNube.title = texto;
}

async function sincronizar(avisarSempre) {
  if (botonNube.classList.contains("sincronizando")) return;
  ultimaSync = Date.now();
  pintarNube("sincronizando", "Sincronizando coa nube…");
  try {
    await gardarAgora();
    const r = await fetch("/api/nube/sincronizar", { method: "POST" }).then((x) => x.json());
    if (r.configurada === false) { botonNube.hidden = true; return; }
    if (r.erro) throw new Error(r.erro);
    const hora = new Date().toLocaleTimeString("gl", { hour: "2-digit", minute: "2-digit", hour12: false });
    if (r.erros.length) pintarNube("erro", "Sincronizado ás " + hora + ", con avisos:\n" + r.erros.join("\n"));
    else pintarNube("", "Sincronizado coa nube ás " + hora + " · preme para sincronizar agora");
    if (r.baixadas || r.borradas) await cargarLista();
    const partes = [];
    if (r.baixadas) partes.push(r.baixadas === 1 ? "1 receita do móbil" : r.baixadas + " receitas do móbil");
    if (r.borradas) partes.push(r.borradas === 1 ? "1 borrada" : r.borradas + " borradas");
    if (partes.length) avisar("Nube: " + partes.join(" · "));
    else if (avisarSempre) avisar("Todo sincronizado");
  } catch (err) {
    pintarNube("erro", "Non se puido sincronizar: " + err.message);
    if (avisarSempre) avisar("Non se puido sincronizar: " + err.message);
  }
}

botonNube.onclick = () => sincronizar(true);
// Ao volver á xanela (p. ex. despois de usar o móbil), como moito unha vez cada 30 s
window.addEventListener("focus", () => { if (!MOBIL && Date.now() - ultimaSync > 30000) sincronizar(); });

// ---------- Móbil: dúas pantallas (lista / receita) e menú ----------
const menu = $("#menu-mobil");
const botonMenu = $("#boton-menu");

function vista(v) {
  if (!MOBIL) return;
  document.body.classList.toggle("vista-lista", v === "lista");
  document.body.classList.toggle("vista-receita", v === "receita");
  pecharMenu();
  window.scrollTo(0, 0);
  document.querySelector(".principal").scrollTop = 0;
  // Os textarea calcúlanse mal mentres están ocultos: volver axustalos ao amosalos
  if (v === "receita") document.querySelectorAll(".folla-editor textarea").forEach(axustarAltura);
}

function pecharMenu() {
  menu.classList.remove("aberto");
  botonMenu.setAttribute("aria-expanded", "false");
}

botonMenu.onclick = (e) => {
  e.stopPropagation();
  const aberto = menu.classList.toggle("aberto");
  botonMenu.setAttribute("aria-expanded", aberto);
};
menu.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.vista === "nova") nova();
  else { await gardarAgora(); vista("lista"); }
});
document.addEventListener("click", (e) => { if (!e.target.closest(".menu-mobil")) pecharMenu(); });
// O logotipo da barra superior volve á lista
$("#marca-mobil").onclick = async () => { await gardarAgora(); vista("lista"); };

// Botón "atrás" de Android: pecha o menú ou volve á lista (true = xa se encargou a web)
window.atras = () => {
  if (pecharModal) { pecharModal(false); return true; }
  if (menu.classList.contains("aberto")) { pecharMenu(); return true; }
  if (document.body.classList.contains("vista-receita")) { gardarAgora(); vista("lista"); return true; }
  return false;
};

// ---------- Inicio ----------
if (MOBIL) { document.body.classList.add("mobil"); vista("lista"); }
pintarEditor();
cargarLista().then(() => { if (!MOBIL) sincronizar(); });
