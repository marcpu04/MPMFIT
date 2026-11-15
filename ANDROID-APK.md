# MPMFIT para Android

La aplicación Android se empaqueta con Capacitor a partir de la versión web de la rama `mobile-first`.

## Compilación automática

Cada cambio relevante en `mobile-first` ejecuta el workflow **Build MPMFIT Android APK**. También se puede iniciar manualmente desde la pestaña Actions de GitHub.

Al terminar correctamente:
1. Abre la ejecución más reciente del workflow.
2. Baja hasta **Artifacts**.
3. Descarga `MPMFIT-Android-debug`.
4. Descomprime el ZIP y abre `app-debug.apk` en Android.

Es un APK de depuración para pruebas, no una versión firmada para Google Play. Android puede pedir autorización para instalar aplicaciones desde el navegador o gestor de archivos.

## Alcance de esta primera versión

- Mantiene la interfaz web y sus datos/sincronización existentes.
- La aplicación se identifica como `MPMFIT` y usa el identificador Android `com.mpmfit.app`.
- Se declara el permiso de cámara para preparar la compatibilidad del lector.
- El lector por cámara depende de las capacidades de BarcodeDetector del WebView del dispositivo; si no está disponible, se puede introducir el código manualmente.
- La sincronización con Supabase necesita conexión a internet.
