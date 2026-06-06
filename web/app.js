// As Resetas do Pardelo — interface
const $ = (s) => document.querySelector(s);

const el = {
  lista: $("#lista"), baleiroLista: $("#baleiro-lista"),
  titulo: $("#titulo"),
  ingredientes: $("#ingredientes"), pasos: $("#pasos"),
  estado: $("#estado"), aviso: $("#aviso"),
};

let receitas = [];
let actual = baleira();

function baleira() {
  return {
    id: "", titulo: "",
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
    const nome = document.createElement("span");
    nome.textContent = r.titulo;
    li.append(nome);
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
  try {
    actual = normalizar(await api.ler(id));
  } catch (err) {
    return avisar("Non se puido abrir: " + err.message);
  }
  pintarEditor();
  pintarLista();
  estado("", "");
}

async function nova() {
  actual = baleira();
  pintarEditor();
  pintarLista();
  estado("", "");
  el.titulo.focus();
}

function pintarEditor() {
  el.titulo.value = actual.titulo;
  axustarAltura(el.titulo);
  pintarLinhas("ingredientes");
  pintarLinhas("pasos");
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

// ---------- Título ----------
el.titulo.addEventListener("input", () => {
  actual.titulo = el.titulo.value.replace(/\n/g, " ");
  axustarAltura(el.titulo);
  cambiou();
});
el.titulo.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); enfocar("ingredientes", 0); }
});

// Aínda non se garda: só se marca que hai cambios
function cambiou() {
  estado("pendente", "Sen gardar");
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

// ---------- Botóns ----------
$("#nova").onclick = nova;
$("#engadir-ingrediente").onclick = () => engadirLinha("ingredientes");
$("#engadir-paso").onclick = () => engadirLinha("pasos");

// ---------- Inicio ----------
pintarEditor();
cargarLista();
