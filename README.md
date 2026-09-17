# Cotizador — Hotel Gran Caimán

Página web para generar las cotizaciones de hospedaje en PDF, con el mismo diseño del
documento de siempre. Se llena el formulario, se descarga el PDF y se manda por WhatsApp.

**En línea: https://josefon31.github.io/gran-caiman/**

Funciona en celular y en laptop (Windows o Mac). No necesita instalarse nada.

## Cómo se usa

1. Escribe el nombre del cliente y las fechas de entrada y salida.
   Las **noches** y el número de **personas** se calculan solos (se pueden corregir a mano).
2. Si ya sabes cuántas personas son, escríbelo en **"¿Para cuántas personas?"** y toca
   **Usar** en la combinación de cuartos que quieras (ver abajo). O pon a mano, en cada tipo
   de habitación, **cuántas le vas a cotizar**. Las que dejes en **0** no aparecen en el PDF.
   Las tarifas vienen precargadas y se pueden cambiar.
3. Revisa los totales y el anticipo (50% por defecto).
4. **Descargar PDF**, o **Enviar por WhatsApp**.

### Habitaciones del hotel

| Tipo | Cuartos | Personas | Tarifa por noche |
|---|---|---|---|
| Sencilla | 3 | 2 | $900 |
| Triple | 10 | 3 | $1,200 |
| Cuadruple | 8 | 4 | $1,500 |
| Bungalow | 2 | 5 | $2,600 |
| **Nupcial** | 1 | 2 | $1,400 |

24 cuartos, **80 personas** de capacidad. El número de cuartos de cada tipo se puede cambiar
en su tarjeta ("Cuartos en el hotel"); es lo que usan las combinaciones.

### Combinaciones posibles

Al escribir un número de personas aparecen **todas** las combinaciones de cuartos que
alcanzan sin pasarse del inventario — para 45 personas son 120. Solo se cuentan las que no
desperdician: si quitando un cuarto todavía caben todos, esa combinación no aparece.

- Se ordenan por **más barata**, **menos cuartos** o **mejor ajuste** (la que deja menos
  lugares vacíos). Se ven las primeras 10 y el botón **Ver todas** muestra el resto.
- Cada una muestra el costo por noche y el total por las noches elegidas.
- **Usar** llena las cantidades y fija el número de personas del grupo, para que el PDF
  diga "grupo de 45 personas" aunque la combinación tenga un lugar de sobra.

El número de personas por cuarto se toma de "Ocupación máxima" (el primer número del
texto), así que un tipo nuevo agregado con "+ Agregar otro tipo" también entra en las
combinaciones.

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
| `js/combinaciones.js` | Las combinaciones posibles de cuartos para N personas |
| `img/sidebar.jpg` | La barra verde con logo y foto |
| `img/icon-*.png` | Iconos para pantalla de inicio, recortados del logo |
| `manifest.webmanifest` | Para instalarla como app en el celular |
| `vendor/` | jsPDF 2.5.1 (copia local, no se baja de internet) |
| `tools/` | Pruebas, no forman parte del sitio |

### Dónde tocar qué

| Qué cambiar | Dónde |
|---|---|
| Tarifas base, tipos de habitación, cuántos cuartos hay | `HABITACIONES` en `js/defaults.js` |
| Servicios incluidos | `SERVICIOS` en `js/defaults.js` |
| Condiciones generales | `CONDICIONES` en `js/defaults.js` |
| Nombre y teléfonos de la firma | `FIRMA` en `js/defaults.js` |
| Anticipo por defecto | `ANTICIPO_PCT` en `js/defaults.js` |
| Márgenes, columnas, tipografía del PDF | `GEO` en `js/pdf.js` |

Ojo: quien ya haya usado la página tiene sus propias tarifas guardadas en su dispositivo y
seguirá viendo esas. Para tomar las nuevas hay que darle a "Restaurar valores originales".

**Los tipos nuevos sí aparecen solos**: cada navegador guarda qué tipos de fábrica conocía,
y al abrir la página se le agregan los que no había visto (así llegó el nupcial a quien ya
usaba el cotizador). Un tipo que el usuario borró a propósito no vuelve a aparecer. Por eso
los tipos nuevos se agregan **al final** de `HABITACIONES` y nunca se renombran los viejos.

## Desarrollo

```bash
npm install
npm test    # genera PDFs de prueba en tools/ y valida los cálculos
npm run dev # servidor local en http://localhost:4173
```

`npm test` corre `js/pdf.js` y `js/combinaciones.js` —los mismos módulos que usa el
navegador— en Node, así que lo que valida es exactamente el código que se publica.

`tools/pdf-original.js` es una copia congelada del generador antes del ajuste para el hotel
completo (ver abajo). Las pruebas comparan contra ella que las cotizaciones de hasta 4 tipos
sigan saliendo idénticas, hoja por hoja. No se edita.

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

### Hotel completo (los 5 tipos a la vez)

Con los 5 tipos cotizados juntos, la tabla de importes ya no cabe en la hoja 1. Antes se
partía: el renglón "Anticipo para reservar" quedaba solo en la hoja 2 y el cierre se iba a
la 3. Ahora, **solo en ese caso**:

1. la tabla de importes se pasa **entera** a la hoja 2 en vez de partirse;
2. el cierre la sigue en esa misma hoja;
3. si aun así no cabe, se vuelve a armar con separaciones más cortas entre los párrafos del
   cierre, y esa versión se usa únicamente si ahorra la hoja.

Resultado: 2 hojas. Con hasta 4 tipos nada de esto se activa y el PDF sale idéntico al de
antes. Si además se agregan varios servicios o condiciones, puede volver a salir en 3 hojas,
pero con la tabla completa.
