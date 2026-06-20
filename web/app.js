// As Resetas do Pardelo — interface
const $ = (s) => document.querySelector(s);

const el = {
  lista: $("#lista"), baleiroLista: $("#baleiro-lista"),
  titulo: $("#titulo"), foto: $("#foto"), fotoImg: $("#foto-img"), ficheiro: $("#ficheiro"),
  ingredientes: $("#ingredientes"), pasos: $("#pasos"),
  estado: $("#estado"), aviso: $("#aviso"), pdf: $("#folla-pdf"),
};

let receitas = [];
let actual = baleira();
let temporizador = null;
let gardando = Promise.resolve();

function baleira() {
  return {
    id: "", titulo: "", foto: "",
    ingredientes: [""], pasos: [""],
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
  const visibles = receitas;
  el.lista.innerHTML = "";
  for (const r of visibles) {
    const li = document.createElement("li");
    li.className = r.id === actual.id ? "activa" : "";
    const mini = document.createElement("div");
    mini.className = "miniatura";
    if (r.foto) mini.style.backgroundImage = `url("${r.foto}")`;
    else mini.textContent = (r.titulo[0] || "?").toUpperCase();
    const nome = document.createElement("span");
    nome.textContent = r.titulo;
    li.append(mini, nome);
    li.onclick = () => abrir(r.id);
    el.lista.append(li);
  }
  el.baleiroLista.style.display = visibles.length ? "none" : "block";
}

// ---------- Editor ----------
// Listas editables: "ingredientes" ou "pasos"
function arr(k) { return actual[k]; }
function cont(k) { return el[k]; }

function normalizar(r) {
  if (!r.ingredientes || !r.ingredientes.length) r.ingredientes = [""];
  if (!r.pasos || !r.pasos.length) r.pasos = [""];
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
  pintarLinhas("ingredientes");
  pintarLinhas("pasos");
}

function pintarFoto() {
  el.foto.classList.toggle("con-foto", !!actual.foto);
  el.fotoImg.src = actual.foto || "";
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
  return actual.titulo.trim() || actual.foto ||
    actual.ingredientes.some((t) => t.trim()) ||
    actual.pasos.some((t) => t.trim());
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
  const pasos = actual.pasos.filter((t) => t.trim());
  el.pdf.innerHTML = `
    <header class="pdf-cabeceira">
      <div class="pdf-titulo">
        <h1>${esc(actual.titulo || "Receita sen título")}</h1>
      </div>
      ${actual.foto ? `<img class="pdf-foto" src="${actual.foto}" alt="">` : ""}
    </header>
    ${ings.length ? `<h2>Ingredientes</h2>
      <ul class="pdf-ingredientes">${ings.map((t) => `<li>${esc(t.trim())}</li>`).join("")}</ul>` : ""}
    ${pasos.length ? `<h2>Pasos</h2>
      <ol class="pdf-pasos">${pasos.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>` : ""}
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
$("#engadir-paso").onclick = () => engadirLinha("pasos");
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

window.addEventListener("beforeunload", () => { if (temporizador) gardarAgora(); });

// ---------- Inicio ----------
pintarEditor();
cargarLista();
