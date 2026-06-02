// As Resetas do Pardelo — interface
const $ = (s) => document.querySelector(s);

const el = {
  lista: $("#lista"), baleiroLista: $("#baleiro-lista"),
  estado: $("#estado"), aviso: $("#aviso"),
};

let receitas = [];

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
    const nome = document.createElement("span");
    nome.textContent = r.titulo;
    li.append(nome);
    el.lista.append(li);
  }
  el.baleiroLista.style.display = visibles.length ? "none" : "block";
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

// ---------- Inicio ----------
cargarLista();
