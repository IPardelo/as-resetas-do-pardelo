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
    ingredientes: [""], bloques: [{ nome: "", pasos: [""] }],
  };
}

// ---------- API ----------
const api = {
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
    avisar("Erro ao cargar as receitas");
  }
  pintarLista();
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

  const visibles = receitas.filter((r) => {
    if (filtroCat && r.categoria !== filtroCat) return false;
    if (filtroEtiqueta && !(r.etiquetas || []).includes(filtroEtiqueta)) return false;
    return r.titulo.toLowerCase().includes(q) || (r.etiquetas || []).some((e) => e.includes(q));
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
    if (det) {
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
  if (!r.ingredientes || !r.ingredientes.length) r.ingredientes = [""];
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
  pintarEditor();
  pintarLista();
  estado("ok", "Gardado");
}

async function nova() {
  await gardarAgora();
  actual = baleira();
  pintarEditor();
  pintarLista();
  estado("", "");
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
      quitar.onclick = () => {
        const ten = b.pasos.some((p) => p.trim());
        if (ten && !confirm(`Quitar o bloque "${b.nome || "Pasos"}" cos seus pasos?`)) return;
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

function limparPrefixo(t) {
  return t.replace(/^\s*(?:[-*•·]|\d+[.)-]?)\s+/, "").trim();
}

function indice(li) {
  return [...li.parentNode.children].indexOf(li);
}

function engadirLinha(k, pos = arr(k).length) {
  arr(k).splice(pos, 0, "");
  pintarLinhas(k);
  enfocar(k, pos);
}

function borrarLinha(k, n, enfocarAnterior) {
  const a = arr(k);
  a.splice(n, 1);
  if (!a.length) a.push("");
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

// Reduce a foto para que o XML non pese demasiado
function cargarFoto(ficheiro) {
  const img = new Image();
  img.onload = () => {
    const max = 1200;
    const esc = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * esc);
    c.height = Math.round(img.height * esc);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    actual.foto = c.toDataURL("image/jpeg", 0.82);
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
    actual.ingredientes.some((t) => t.trim()) ||
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
      estado("ok", "Gardado en Receitas/" + r.id + ".xml");
      await cargarLista();
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
  const ings = actual.ingredientes.filter((t) => t.trim());
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
      <ul class="pdf-ingredientes">${ings.map((t) => `<li>${esc(t.trim())}</li>`).join("")}</ul>` : ""}
    ${bloques.map((b) => `<section class="pdf-bloque"><h2>Pasos${b.nome ? " " + esc(b.nome) : ""}</h2>
      <ol class="pdf-pasos">${b.pasos.map((t) => `<li>${esc(t)}</li>`).join("")}</ol></section>`).join("")}
    <div class="pdf-pe">As Resetas do Pardelo</div>`;

  const tituloVello = document.title;
  document.title = actual.titulo || "Receita"; // nome suxerido para o PDF
  const imprimir = () => {
    window.print();
    document.title = tituloVello;
  };
  const img = el.pdf.querySelector("img");
  if (img && !img.complete) img.onload = imprimir; else imprimir();
}

// ---------- Botóns ----------
$("#nova").onclick = nova;
$("#engadir-ingrediente").onclick = () => engadirLinha("ingredientes");
$("#engadir-bloque").onclick = engadirBloque;
$("#exportar").onclick = exportarPDF;
$("#eliminar").onclick = async () => {
  if (!actual.id) { actual = baleira(); pintarEditor(); return; }
  if (!confirm(`Seguro que queres eliminar "${actual.titulo || "Receita sen título"}"?`)) return;
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

// ---------- Inicio ----------
pintarEditor();
cargarLista();
