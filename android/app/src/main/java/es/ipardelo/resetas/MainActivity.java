package es.ipardelo.resetas;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.activity.ComponentActivity;
import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;

/**
 * As Resetas do Pardelo para Android.
 * Amosa a mesma interface web do escritorio (carpeta web/ do proxecto) nun WebView.
 * Sen servidor: no móbil as receitas gárdanse en Firebase (web/js/nube.js).
 */
public class MainActivity extends ComponentActivity {

    // Os ficheiros de web/ sérvense desde este enderezo "falso" (https), así
    // fetch() e Firebase funcionan coma nunha web normal.
    private static final String INICIO = "https://appassets.androidplatform.net/assets/index.html";

    private WebView web;
    private ValueCallback<Uri[]> agardandoFoto;

    // Selector de fotos para o <input type="file">
    private final ActivityResultLauncher<Intent> escollerFoto = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), r -> {
                if (agardandoFoto == null) return;
                agardandoFoto.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(r.getResultCode(), r.getData()));
                agardandoFoto = null;
            });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        EdgeToEdge.enable(this);

        FrameLayout raiz = new FrameLayout(this);
        raiz.setBackgroundColor(0xFFF6EFE4);
        web = new WebView(this);
        raiz.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(raiz);

        // Que a app non quede debaixo da barra de estado, da de navegación nin do teclado
        ViewCompat.setOnApplyWindowInsetsListener(raiz, (v, insets) -> {
            Insets i = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            v.setPadding(i.left, i.top, i.right, i.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        // Os ficheiros da web van dentro da app: sen caché, para que cada versión nova se vexa ao momento
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                return assets.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                // As ligazóns externas ábrense no navegador
                if ("appassets.androidplatform.net".equals(req.getUrl().getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, req.getUrl()));
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (agardandoFoto != null) agardandoFoto.onReceiveValue(null);
                agardandoFoto = cb;
                try {
                    escollerFoto.launch(params.createIntent());
                } catch (ActivityNotFoundException e) {
                    agardandoFoto = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Ponte(), "Android");

        // Botón "atrás": se hai unha receita aberta (ou o menú), volve á lista; se non, sae
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                web.evaluateJavascript("window.atras ? window.atras() : false", r -> {
                    if (!"true".equals(r)) {
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    }
                });
            }
        });

        if (estado == null) web.loadUrl(INICIO);
        else web.restoreState(estado);
    }

    @Override
    protected void onSaveInstanceState(Bundle saida) {
        super.onSaveInstanceState(saida);
        web.saveState(saida);
    }

    /** Funcións que a web pode chamar como window.Android.xxx() */
    private class Ponte {
        // "Exportar PDF": abre o diálogo de impresión de Android (→ Gardar como PDF)
        @JavascriptInterface
        public void imprimir(String titulo) {
            runOnUiThread(() -> {
                PrintManager impresion = (PrintManager) getSystemService(PRINT_SERVICE);
                String nome = (titulo == null || titulo.isEmpty()) ? "Receita" : titulo;
                impresion.print(nome, web.createPrintDocumentAdapter(nome),
                        new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            });
        }
    }
}
