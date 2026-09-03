// Generador del PDF de cotización.
//
// Calca la geometría de PLANTILLA_COTIZACION.docx. Las medidas del .docx están
// en DXA (1/20 de punto); aquí van en puntos, o sea DXA / 20.
//
// El módulo no depende del navegador: recibe el constructor de jsPDF y la
// imagen de la barra lateral por parámetro, para que tools/test-pdf.js corra
// exactamente este mismo código en Node.

export const GEO = {
  pageW: 612, // 12240 DXA
  pageH: 792, // 15840 DXA
  marginL: 214.8, // 4296 DXA
  marginR: 90, // 1800 DXA
  marginT: 54, // 1080 DXA
  marginB: 54, // 1080 DXA
  textW: 307.2, // 6144 DXA
  lineH: 13, // spacing.line 260 twips
  fontSize: 10, // size 20 (medios puntos)
  baseOffset: 10, // del borde superior de la línea a la línea base
  colRoom: [62.5, 82.2, 62.5, 37.5, 62.5], // COLW: 1250,1644,1250,750,1250
  // SW del .docx es [222.2, 85], pero esos 85pt solo alcanzaban porque la
  // plantilla traía ceros de relleno: $18,200.00 MXN mide 74.5pt contra 74.2pt
  // útiles y se partía en dos renglones. Se reparte distinto el mismo ancho total.
  colSum: [211.2, 96],
  rowMinH: 25, // height.value 500 DXA
  cellPadX: 5.4, // margen de celda de Word: 108 DXA
  cellPadYRoom: 1, // spacing before/after 20 twips
  cellPadYSum: 0.5, // spacing before/after 10 twips
  // El .docx encaja la imagen (575x1773 px) en 275x1056 px @96dpi, o sea que
  // la deforma a lo alto. Se replica igual para que el PDF salga idéntico.
  sidebarW: 206.25,
  sidebarH: 792,
  blue: [0, 112, 192], // 0070C0
};

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const dosDigitos = (n) => String(n).padStart(2, '0');

/** "Jueves, 03 de septiembre 2026" — formato de la línea "Fecha:" del .docx. */
export function fechaLarga(d) {
  if (!d) return '';
  return `${DIAS[d.getDay()]}, ${dosDigitos(d.getDate())} de ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "15 al 22 de diciembre de 2026", colapsando mes y año cuando coinciden. */
export function rangoFechas(a, b) {
  if (!a || !b) return '';
  const mismoAnio = a.getFullYear() === b.getFullYear();
  const mismoMes = mismoAnio && a.getMonth() === b.getMonth();
  const fin = `${b.getDate()} de ${MESES[b.getMonth()]} de ${b.getFullYear()}`;
  if (mismoMes) return `${a.getDate()} al ${fin}`;
  if (mismoAnio) return `${a.getDate()} de ${MESES[a.getMonth()]} al ${fin}`;
  return `${a.getDate()} de ${MESES[a.getMonth()]} de ${a.getFullYear()} al ${fin}`;
}

/** "diciembre 2026" */
export const mesAnio = (d) => (d ? `${MESES[d.getMonth()]} ${d.getFullYear()}` : '');

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "$1,200.00 MXN" — mismo formato que el helper `money` de gen_plantilla.js. */
export const money = (n) => `$${fmt(n)} MXN`;
/** "$1,200.00" — el que va dentro del paréntesis de la tabla de importes. */
export const moneyPlain = (n) => `$${fmt(n)}`;

/** Habitaciones efectivamente cotizadas: cantidad > 0. */
export const cotizadas = (habitaciones) =>
  (habitaciones || []).filter((h) => Number(h.cantidad) > 0);

/** Subtotal, total y anticipo a partir del estado del formulario. */
export function calcularTotales(state) {
  const noches = Number(state.noches) || 0;
  const rows = cotizadas(state.habitaciones).map((h) => ({
    ...h,
    importe: Number(h.cantidad) * noches * Number(h.tarifa),
  }));
  const subtotal = rows.reduce((s, r) => s + r.importe, 0);
  const total = subtotal;
  const anticipo = total * ((Number(state.anticipoPct) || 0) / 100);
  return { rows, subtotal, total, anticipo };
}

// ---------------------------------------------------------------------------
// Motor de texto: corta líneas con runs de distinto estilo y las justifica.
// ---------------------------------------------------------------------------

const aplicarEstilo = (doc, estilo) => {
  doc.setFont('helvetica', estilo && estilo.bold ? 'bold' : 'normal');
  const c = (estilo && estilo.color) || [0, 0, 0];
  doc.setTextColor(c[0], c[1], c[2]);
};

/**
 * Convierte los runs en palabras medidas. El espacio en blanco que cierra un
 * run se arrastra como separador de la primera palabra del run siguiente, para
 * que `run("... el ") + run("50%", bold)` no acabe pegado como "el50%".
 */
function tokenizar(doc, runs) {
  const toks = [];
  let gapPend = '';
  let gapEstilo = null;
  for (const run of runs) {
    if (!run || !run.text) continue;
    for (const parte of String(run.text).split(/(\s+)/)) {
      if (parte === '') continue;
      if (/^\s+$/.test(parte)) {
        gapPend += parte;
        gapEstilo = run;
      } else {
        toks.push({ word: parte, gapText: gapPend, gapEstilo: gapEstilo || run, estilo: run });
        gapPend = '';
      }
    }
  }
  for (const t of toks) {
    aplicarEstilo(doc, t.estilo);
    t.w = doc.getTextWidth(t.word);
    if (t.gapText) {
      aplicarEstilo(doc, t.gapEstilo);
      t.gap = doc.getTextWidth(t.gapText);
    } else {
      t.gap = 0;
    }
  }
  return toks;
}

function cortarLineas(doc, runs, maxW) {
  const toks = tokenizar(doc, runs);
  const lineas = [];
  let cur = [];
  let w = 0;
  for (const t of toks) {
    const gap = cur.length === 0 ? 0 : t.gap;
    if (cur.length && w + gap + t.w > maxW + 0.01) {
      lineas.push({ toks: cur, w });
      cur = [t];
      w = t.w;
    } else {
      cur.push(t);
      w += gap + t.w;
    }
  }
  if (cur.length) lineas.push({ toks: cur, w });
  return lineas;
}

// ---------------------------------------------------------------------------
// Contexto de dibujo: lleva el cursor vertical y repinta la barra en cada hoja.
// ---------------------------------------------------------------------------

function crearContexto(doc, sidebarDataUrl) {
  const ctx = {
    y: GEO.marginT,
    fondo() {
      if (!sidebarDataUrl) return;
      doc.addImage(sidebarDataUrl, 'JPEG', 0, 0, GEO.sidebarW, GEO.sidebarH);
    },
    get limite() {
      return GEO.pageH - GEO.marginB;
    },
    nuevaPagina() {
      doc.addPage();
      ctx.fondo();
      ctx.y = GEO.marginT;
    },
    /** Abre hoja nueva si el bloque de alto `h` no cabe en lo que queda. */
    asegurar(h) {
      if (ctx.y + h > ctx.limite) ctx.nuevaPagina();
    },
    blanco() {
      ctx.asegurar(GEO.lineH);
      ctx.y += GEO.lineH;
    },
  };
  return ctx;
}

/** Dibuja un párrafo (uno o varios runs) y avanza el cursor. */
function parrafo(doc, ctx, runs, opts = {}) {
  const align = opts.align || 'left';
  const maxW = GEO.textW;
  const lineas = cortarLineas(doc, Array.isArray(runs) ? runs : [{ text: runs }], maxW);
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    ctx.asegurar(GEO.lineH);
    const ultima = i === lineas.length - 1;
    const huecos = linea.toks.length - 1;
    let extra = 0;
    if (align === 'justify' && !ultima && huecos > 0) extra = (maxW - linea.w) / huecos;
    let x = GEO.marginL;
    const base = ctx.y + GEO.baseOffset;
    for (let j = 0; j < linea.toks.length; j++) {
      const t = linea.toks[j];
      if (j > 0) x += t.gap + extra;
      aplicarEstilo(doc, t.estilo);
      doc.text(t.word, x, base);
      x += t.w;
    }
    ctx.y += GEO.lineH;
  }
  doc.setTextColor(0, 0, 0);
}

const just = (doc, ctx, runs) => parrafo(doc, ctx, runs, { align: 'justify' });

// ---------------------------------------------------------------------------
// Tablas dibujadas a mano: control exacto de anchos y altos de fila.
// ---------------------------------------------------------------------------

/**
 * @param filas  array de arrays de celda: string, o {text, bold}
 * @param opts   {cols, aligns, padY, minH, repetirEncabezado}
 */
function tabla(doc, ctx, filas, opts) {
  const cols = opts.cols;
  const aligns = opts.aligns;
  const padY = opts.padY;
  const minH = opts.minH || 0;

  const medirFila = (fila) => {
    let maxLineas = 1;
    const celdas = fila.map((celda, i) => {
      const c = typeof celda === 'string' ? { text: celda } : celda;
      const anchoUtil = cols[i] - 2 * GEO.cellPadX;
      const lineas = cortarLineas(doc, [{ text: c.text, bold: c.bold }], anchoUtil);
      if (lineas.length > maxLineas) maxLineas = lineas.length;
      return { ...c, lineas, anchoUtil };
    });
    return { celdas, alto: Math.max(minH, maxLineas * GEO.lineH + 2 * padY) };
  };

  const medidas = filas.map(medirFila);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.75); // BorderStyle.SINGLE size 6 = 0.75 pt

  for (let f = 0; f < medidas.length; f++) {
    const { celdas, alto } = medidas[f];
    if (ctx.y + alto > ctx.limite) {
      ctx.nuevaPagina();
      if (opts.repetirEncabezado && f > 0) {
        const enc = medidas[0];
        pintarFila(doc, ctx, enc.celdas, enc.alto, cols, aligns, padY);
      }
    }
    pintarFila(doc, ctx, celdas, alto, cols, aligns, padY);
  }
  doc.setTextColor(0, 0, 0);
}

function pintarFila(doc, ctx, celdas, alto, cols, aligns, padY) {
  let x = GEO.marginL;
  for (let i = 0; i < celdas.length; i++) {
    const celda = celdas[i];
    doc.rect(x, ctx.y, cols[i], alto);

    // Centrado vertical dentro de la celda, como VerticalAlign.CENTER.
    const altoTexto = celda.lineas.length * GEO.lineH;
    let ty = ctx.y + (alto - altoTexto) / 2;

    for (const linea of celda.lineas) {
      let tx;
      const align = aligns[i];
      if (align === 'center') tx = x + (cols[i] - linea.w) / 2;
      else if (align === 'right') tx = x + cols[i] - GEO.cellPadX - linea.w;
      else tx = x + GEO.cellPadX;

      let cx = tx;
      for (let j = 0; j < linea.toks.length; j++) {
        const t = linea.toks[j];
        if (j > 0) cx += t.gap;
        aplicarEstilo(doc, t.estilo);
        doc.text(t.word, cx, ty + GEO.baseOffset);
        cx += t.w;
      }
      ty += GEO.lineH;
    }
    x += cols[i];
  }
  ctx.y += alto;
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

const COLUMNAS = [
  'Tipo de habitación',
  'Descripción',
  'Ocupación máxima',
  'No. de hab.',
  'Tarifa por noche',
];

/**
 * Arma la cotización completa.
 *
 * @param {object}   state          datos del formulario
 * @param {Function} jsPDFCtor      constructor de jsPDF (navegador o Node)
 * @param {string}   sidebarDataUrl data URL de la barra lateral (puede ir vacío)
 * @returns {object} el documento jsPDF
 */
export function buildPdf(state, jsPDFCtor, sidebarDataUrl) {
  const doc = new jsPDFCtor({ unit: 'pt', format: 'letter', compress: true });
  doc.setFontSize(GEO.fontSize);
  doc.setFont('helvetica', 'normal');

  const ctx = crearContexto(doc, sidebarDataUrl);
  ctx.fondo();

  const hotel = state.hotel || {};
  const firma = state.firma || {};
  const azul = { color: GEO.blue };
  const { rows, subtotal, total, anticipo } = calcularTotales(state);
  const noches = Number(state.noches) || 0;
  const pct = Number(state.anticipoPct) || 0;
  const rango = rangoFechas(state.fechaEntrada, state.fechaSalida);

  // --- Encabezado -----------------------------------------------------------
  parrafo(doc, ctx, [{ text: hotel.nombre || '', ...azul }]);
  parrafo(doc, ctx, hotel.direccion || '');
  parrafo(doc, ctx, hotel.telefono || '');
  parrafo(doc, ctx, hotel.correo || '');
  parrafo(doc, ctx, `Fecha: ${fechaLarga(state.fechaDocumento)}`);
  ctx.blanco();

  parrafo(doc, ctx, [
    { text: 'Asunto:', ...azul },
    { text: `  Cotización del ${rango}` },
  ]);
  ctx.blanco();

  parrafo(doc, ctx, [
    { text: 'Estimado(a)cliente', ...azul },
    { text: `: ${state.cliente || ''}` },
  ]);
  ctx.blanco();

  just(doc, ctx, [
    {
      text:
        'Reciba un cordial saludo de parte del Hotel Gran Caimán. Por medio del presente, ' +
        'nos permitimos hacerle llegar la cotización de hospedaje de ' +
        `${mesAnio(state.fechaEntrada)}, en la que encontrará las opciones disponibles y ` +
        'sus respectivas tarifas.',
    },
  ]);
  ctx.blanco();

  const grupo = Number(state.personas) > 0 ? `un grupo de ${state.personas} personas` : 'un grupo de personas';
  just(doc, ctx, [
    {
      text:
        `La cotización correspondiente a su estancia de ${noches} noches, para la fecha del ` +
        `${rango} para ${grupo}. Para reservar se requiere el `,
    },
    { text: `${pct}%`, bold: true },
    { text: ' del total.' },
  ]);
  ctx.blanco();

  // --- Tabla de habitaciones cotizadas -------------------------------------
  if (rows.length) {
    tabla(
      doc,
      ctx,
      [
        COLUMNAS,
        ...rows.map((h) => [
          h.tipo,
          h.descripcion,
          h.ocupacion,
          String(h.cantidad),
          money(h.tarifa),
        ]),
      ],
      {
        cols: GEO.colRoom,
        aligns: ['center', 'center', 'center', 'center', 'center'],
        padY: GEO.cellPadYRoom,
        minH: GEO.rowMinH,
        repetirEncabezado: true,
      },
    );
    ctx.blanco();

    // --- Tabla de importes --------------------------------------------------
    const filas = rows.map((h) => [
      `${h.tipo} (${h.cantidad} hab. x ${noches} noches x ${moneyPlain(h.tarifa)})`,
      money(h.importe),
    ]);
    filas.push(['Subtotal', money(subtotal)]);
    filas.push([
      { text: 'Total', bold: true },
      { text: money(total), bold: true },
    ]);
    filas.push([
      { text: `Anticipo para reservar (${pct}%)`, bold: true },
      { text: money(anticipo), bold: true },
    ]);

    tabla(doc, ctx, filas, {
      cols: GEO.colSum,
      aligns: ['left', 'right'],
      padY: GEO.cellPadYSum,
    });
  }

  // --- Página 2 -------------------------------------------------------------
  ctx.nuevaPagina();

  just(doc, ctx, [
    {
      text:
        'Unicamente le pediriamos de favor que al momento de acomodar a las personas no se ' +
        'exceda la ocupacion máxima permitida en cada habitacion. De esta manera podemos ' +
        'respetar la capacidad. Muchas gracias por su comprensión.',
    },
  ]);
  ctx.blanco();
  just(doc, ctx, '*Las fechas pueden ajustarse de acuerdo con su preferencia y disponibilidad.*');
  ctx.blanco();
  just(doc, ctx, [
    {
      text:
        'Le informamos que el bloqueo de habitaciones se mantendrá vigente de 24 a 48 hrs ' +
        'posteriores al envio de la cotizacion, sujeto a disponibilidad, fecha límite para ' +
        'recibir su confirmación y garantizar la disponibilidad y las tarifas cotizadas. ' +
        'Posterior a dicha fecha, las habitaciones y condiciones estarán sujetas a ' +
        'disponibilidad al momento de su confirmación.',
    },
  ]);
  ctx.blanco();

  parrafo(doc, ctx, 'Servicios incluidos');
  parrafo(
    doc,
    ctx,
    'El Hotel Gran Caimán cuenta con todos los servicios básicos para una estancia cómoda y ' +
      'placentera, entre los cuales se incluyen:',
  );
  for (const s of state.servicios || []) parrafo(doc, ctx, `- ${s}`);
  ctx.blanco();

  just(
    doc,
    ctx,
    'Ambiente relajante y acogedor, ideal para descansar y disfrutar de un oasis de ' +
      'tranquilidad cercas del mar.',
  );
  ctx.blanco();

  parrafo(doc, ctx, [{ text: 'Condiciones generales', bold: true }]);
  for (const c of state.condiciones || []) parrafo(doc, ctx, `- ${c}`);
  ctx.blanco();

  just(
    doc,
    ctx,
    'Agradecemos su atención y quedamos a sus órdenes para cualquier información adicional o ' +
      'para confirmar su reservación.',
  );
  ctx.blanco();

  parrafo(doc, ctx, [{ text: 'Atentamente,', bold: true }]);
  parrafo(doc, ctx, firma.nombre || '');
  parrafo(doc, ctx, firma.hotel || '');
  parrafo(doc, ctx, firma.celular || '');
  parrafo(doc, ctx, firma.telefono || '');

  return doc;
}

/** Nombre de archivo tipo Cotizacion_Juan_Perez_2026-09-03.pdf */
export function nombreArchivo(state) {
  const limpio = (state.cliente || 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'cliente';
  const d = state.fechaDocumento || new Date();
  const fecha = `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
  return `Cotizacion_${limpio}_${fecha}.pdf`;
}
