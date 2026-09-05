# Cotizador — Hotel Gran Caimán

Página web para generar las cotizaciones de hospedaje en PDF, con el mismo diseño del
documento de siempre. Se llena el formulario, se descarga el PDF y se manda por WhatsApp.

**En línea: https://josefon31.github.io/gran-caiman/**

Funciona en celular y en laptop (Windows o Mac). No necesita instalarse nada.

## Cómo se usa

1. Escribe el nombre del cliente y las fechas de entrada y salida.
   Las **noches** y el número de **personas** se calculan solos (se pueden corregir a mano).
2. En cada tipo de habitación, pon **cuántas le vas a cotizar**. Las que dejes en **0** no
   aparecen en el PDF. Las tarifas vienen precargadas y se pueden cambiar.
3. Revisa los totales y el anticipo (50% por defecto).
4. **Descargar PDF**, o **Enviar por WhatsApp**.

### Sobre el botón de WhatsApp

Que el PDF se mande **ya adjunto** depende del navegador, no de la página: solo la hoja
nativa de compartir puede adjuntar archivos, y no todos los navegadores la implementan.

| Dónde | Qué pasa |
|---|---|
| iPhone y Android | Abre el menú de compartir con el **PDF ya adjunto** |
| Cualquier computadora (Mac o Windows, Safari incluido) | Baja el PDF, copia el mensaje y abre WhatsApp; el archivo se arrastra a mano |

En escritorio el paso manual **no se puede evitar**: ningún navegador de computadora
implementa compartir archivos, y Safari de Mac tampoco (comprobado en septiembre de 2026,
pese a lo que sugieren varias tablas de compatibilidad). La página no anuncia navegadores
por nombre: le pregunta al navegador con `navigator.canShare({files})` y muestra debajo
del botón lo que conteste.

### Dejarlo como app en el celular

Abre el link en el celular y usa **Agregar a pantalla de inicio** (Compartir → Agregar a
pantalla de inicio en iPhone; menú ⋮ → Agregar a pantalla de inicio en Android). Queda con
el logo del hotel y abre a pantalla completa, como una app.

Las tarifas y los textos que edites se guardan **en ese dispositivo**, así no hay que
volver a capturarlos. El botón "Restaurar valores originales" los regresa a como estaban.
Los datos del cliente no se guardan.

## Cómo está hecho

Sitio estático, sin servidor ni base de datos. El PDF se arma en el navegador con jsPDF.

| Archivo | Qué hace |
|---|---|
| `index.html` | La página |
| `css/styles.css` | Estilos, tema claro y oscuro |
| `js/defaults.js` | **Tarifas, textos, servicios, condiciones y firma** |
| `js/pdf.js` | Arma el PDF con la geometría exacta del documento original |
| `js/app.js` | Formulario, cálculos, vista previa y compartir |
| `img/sidebar.jpg` | La barra verde con logo y foto |
| `img/icon-*.png` | Iconos para pantalla de inicio, recortados del logo |
| `manifest.webmanifest` | Para instalarla como app en el celular |
| `vendor/` | jsPDF 2.5.1 (copia local, no se baja de internet) |
| `tools/` | Pruebas, no forman parte del sitio |

### Dónde tocar qué

| Qué cambiar | Dónde |
|---|---|
| Tarifas base, tipos de habitación | `HABITACIONES` en `js/defaults.js` |
| Servicios incluidos | `SERVICIOS` en `js/defaults.js` |
| Condiciones generales | `CONDICIONES` en `js/defaults.js` |
| Nombre y teléfonos de la firma | `FIRMA` en `js/defaults.js` |
| Anticipo por defecto | `ANTICIPO_PCT` en `js/defaults.js` |
| Márgenes, columnas, tipografía del PDF | `GEO` en `js/pdf.js` |

Ojo: quien ya haya usado la página tiene sus propias tarifas guardadas en su dispositivo y
seguirá viendo esas. Para tomar las nuevas hay que darle a "Restaurar valores originales".

## Desarrollo

```bash
npm install
npm test    # genera PDFs de prueba en tools/ y valida los cálculos
npm run dev # servidor local en http://localhost:4173
```

`npm test` corre `js/pdf.js` —el mismo módulo que usa el navegador— contra jsPDF en Node,
así que lo que valida es exactamente el código que se publica.

Para revisar un PDF de prueba a ojo, con el servidor levantado:
`http://localhost:4173/tools/visor.html#f=salida-caso1.pdf&p=1`

### Geometría del PDF

Las medidas salen de `PLANTILLA_COTIZACION.docx` (el generador original en `docx` usaba
DXA, o sea 1/20 de punto; aquí van en puntos):

| | DOCX (DXA) | PDF (pt) |
|---|---|---|
| Página | 12240 × 15840 | 612 × 792 (Carta) |
| Margen izquierdo | 4296 | 214.8 |
| Columna de texto | 6144 | 307.2 |
| Tabla de habitaciones | 1250, 1644, 1250, 750, 1250 | 62.5, 82.2, 62.5, 37.5, 62.5 |

La única medida que cambió a propósito es la tabla de importes: el documento original le
daba 85 pt a la columna del monto, que solo alcanzaban porque la plantilla traía ceros de
relleno — `$18,200.00 MXN` mide 74.5 pt contra 74.2 pt útiles y se partía en dos
renglones. El mismo ancho total se reparte ahora como 211.2 / 96.
