<div align="center">

# As Resetas do Pardelo

**As receitas da casa, gardadas por ti e listas para imprimir**

Escribe os ingredientes e os pasos de cada receita, engádelle unha foto e expórtaa a un PDF nun clic.

<br>

![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![XML](https://img.shields.io/badge/datos-XML-c2562f?style=flat-square)
![Version](https://img.shields.io/badge/version-0.4.0-e9b44c?style=flat-square)

</div>

<br>

## Por que

Precisaba de unha maneira autoxestionada de gardar as receitas de familia. Normalmente as receitas acaban espalladas en cadernos, capturas de pantalla, mensaxes ou vídeos que un día desaparecen. As apps de receitas que existen queren que te rexistres, gardan todo
nos seus servidores e énchense de anuncios. 'As Resetas do Pardelo' é o contrario.

## Funcionalidades

- 🥣 **Crear receitas** — título, foto, ingredientes e pasos nunha soa folla.
- 💾 **Gardado automático** — cada cambio gárdase ao momento en `Receitas/nome-da-receita.xml`. Se cambias o título, o ficheiro renoméase só. Sen botón de gardar.
- 📄 **Exportar a PDF** — título e foto arriba, ingredientes, os pasos numerados. Usa o diálogo de impresión do navegador → *Gardar como PDF*, co nome da receita xa posto

## Configuración

### Requisitos

| Requisito | Detalle |
|---|---|
| **Python 3.9+** | Só a biblioteca estándar, sen nada que instalar |
| **Un navegador** | Calquera actual (Edge, Chrome, Firefox…) |

### ▶️ Arrancar a app

```bash
python server.py
```

Ábrese no navegador, en `http://127.0.0.1:8765`.

A app só escoita en `127.0.0.1`, así que non é accesible desde outros equipos da rede.

### 📄 Formato das receitas

Cada receita é un ficheiro en `Receitas/`. Pódese editar á man, copiar a outro ordenador ou
metelo nun repositorio:

```xml
<?xml version='1.0' encoding='utf-8'?>
<receita creada="2026-09-27T13:21:55" modificada="2026-09-27T14:05:10">
  <titulo>Brazo de gitano</titulo>
  <foto tipo="image/jpeg">/9j/4AAQSkZJRg…</foto>
  <ingredientes>
    <ingrediente>6/7 ovos</ingrediente>
    <ingrediente>6 cucharadas de azucre</ingrediente>
  </ingredientes>
  <pasos>
    <paso>Batir as xemas co azucre</paso>
    <paso>Infusionar o leite</paso>
  </pasos>
</receita>
```

## Estrutura xeral

```
as-resetas-do-pardelo/
├── server.py                   # Servidor local (stdlib) — serve a web e le/escribe os XML
│
├── web/                        # Interface — HTML, CSS e JS sen frameworks nin compilación
│   ├── index.html              # Estrutura da app e da folla do PDF
│   ├── app.js                  # Editor, gardado automático e exportación
│   └── style/
│       └── css/style.css       # Estilos da app e @media print para o PDF
│
└── Receitas/                   # Unha receita por ficheiro .xml (os teus datos)
```

## Evolución por versión

### v0.4.0
- **Exportación a PDF** co deseño de folla de receita (título e foto arriba, ingredientes e pasos numerados).
- Atallo <kbd>Ctrl</kbd>+<kbd>P</kbd> para exportar.

### v0.3.0
- **Foto da receita**: clic ou arrastrar, reducida a 1200 px e gardada dentro do propio XML.
- Miniaturas das fotos na lista lateral.

### v0.2.0
- Interface web: **editor visual** de título, ingredientes e pasos, con atallos de teclado e pegado de listas.
- **Gardado automático** mentres escribes; se cambia o título, o ficheiro renoméase só.
- Lista lateral coas receitas gardadas.

### v0.1.0
- Servidor local en Python, sen dependencias, que garda cada receita nun ficheiro XML dentro de `Receitas/`.
- API sinxela para listar, ler, gardar e eliminar receitas.

## Folla de ruta

- [ ] Categorías e etiquetas
- [ ] Ver e engadir receitas desde o móbil
- [ ] Escalar as cantidades segundo o número de racións
- [ ] Exportar varias receitas xuntas nun libro en PDF
- [ ] Temporizadores nos pasos ("20 minutos no forno")

## Autor

[Ismael Castiñeira](https://ipardelo.es)

```bash
VIVA GHALISIA E A COSTA DA MORTE! 💀
```
