<div align="center">

# As Resetas do Pardelo

**As receitas da casa, gardadas por ti**

Cada receita nun ficheiro XML, na túa carpeta e sen depender de ninguén.

<br>

![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white)
![XML](https://img.shields.io/badge/datos-XML-c2562f?style=flat-square)
![Version](https://img.shields.io/badge/version-0.1.0-e9b44c?style=flat-square)

</div>

<br>

## Por que

Precisaba de unha maneira autoxestionada de gardar as receitas de familia. Normalmente as receitas acaban espalladas en cadernos, capturas de pantalla, mensaxes ou vídeos que un día desaparecen. As apps de receitas que existen queren que te rexistres, gardan todo
nos seus servidores e énchense de anuncios. 'As Resetas do Pardelo' é o contrario.

## Funcionalidades

- 💾 **Unha receita, un ficheiro** — cada receita gárdase en `Receitas/nome-da-receita.xml`, fácil de ler, copiar ou meter nun repositorio
- 🔌 **API local** — listar, ler, gardar e eliminar receitas desde `http://127.0.0.1:8765/api/receitas`

## Configuración

### Requisitos

| Requisito | Detalle |
|---|---|
| **Python 3.9+** | Só a biblioteca estándar, sen nada que instalar |

### ▶️ Arrancar a app

```bash
python server.py
```

A API queda en `http://127.0.0.1:8765/api/receitas`.

A app só escoita en `127.0.0.1`, así que non é accesible desde outros equipos da rede.

### 📄 Formato das receitas

Cada receita é un ficheiro en `Receitas/`. Pódese editar á man, copiar a outro ordenador ou
metelo nun repositorio:

```xml
<?xml version='1.0' encoding='utf-8'?>
<receita creada="2026-09-27T13:21:55" modificada="2026-09-27T14:05:10">
  <titulo>Brazo de gitano</titulo>
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
├── server.py                   # Servidor local (stdlib) — le/escribe os XML
└── Receitas/                   # Unha receita por ficheiro .xml (os teus datos)
```

## Evolución por versión

### v0.1.0
- Servidor local en Python, sen dependencias, que garda cada receita nun ficheiro XML dentro de `Receitas/`.
- API sinxela para listar, ler, gardar e eliminar receitas.

## Folla de ruta

- [ ] Foto de cada receita
- [ ] Exportar a PDF para imprimir
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
