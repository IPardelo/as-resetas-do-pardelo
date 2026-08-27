# As Resetas do Pardelo — lanzador de escritorio
# Dobre clic: abre a app na súa propia xanela, sen navegador nin consola.
# (Os ficheiros .pyw ábreos "pythonw", que non amosa a xanela negra.)
import ctypes
import os
import subprocess
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.getcwd())


def mensaxe(texto, icona=0x40):
    try:
        ctypes.windll.user32.MessageBoxW(0, texto, "As Resetas do Pardelo", icona)
    except Exception:
        print(texto)


# A primeira vez instala pywebview (a única dependencia)
try:
    import webview  # noqa: F401
except ImportError:
    mensaxe("A primeira vez hai que instalar pywebview (uns segundos).\nPreme Aceptar e agarda: a app abrirase soa.")
    python = sys.executable.replace("pythonw.exe", "python.exe")
    r = subprocess.run(
        [python, "-m", "pip", "install", "--user", "pywebview"],
        capture_output=True, text=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    if r.returncode != 0:
        mensaxe("Non se puido instalar pywebview.\nAbre unha terminal e executa:\n\n    py -m pip install pywebview\n\n"
                + (r.stderr or "")[-600:], 0x10)
        sys.exit(1)
    import site
    import importlib
    importlib.invalidate_caches()
    if site.getusersitepackages() not in sys.path:
        sys.path.append(site.getusersitepackages())

try:
    import server  # noqa: E402
    server.xanela()
except Exception:
    import traceback
    mensaxe("Erro ao abrir a app:\n\n" + traceback.format_exc()[-900:], 0x10)
