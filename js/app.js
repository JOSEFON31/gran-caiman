// Cotizador Hotel Gran Caimán — formulario, vista previa y salida a PDF.

import {
  HOTEL, FIRMA, HABITACIONES, SERVICIOS, CONDICIONES, ANTICIPO_PCT, COLUMNAS_HABITACIONES,
} from './defaults.js';
import {
  buildPdf, calcularTotales, cotizadas, nombreArchivo, money, moneyPlain,
  fechaLarga, rangoFechas, mesAnio, GEO,
} from './pdf.js';

const $ = (id) => document.getElementById(id);
const CLAVE = 'granCaiman.preferencias.v1';

// --------------------------------------------------------------------------
// Fechas: los <input type=date> dan "YYYY-MM-DD", que new Date() interpreta en
// UTC y corre un día. Se arman y se leen siempre en hora local.
// --------------------------------------------------------------------------

const aFecha = (valor) => {
  if (!valor) return null;
  const [a, m, d] = valor.split('-').map(Number);
  if (!a || !m || !d) return null;
  return new Date(a, m - 1, d);
};

const aValor = (fecha) => {
  if (!fecha) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
};

const DIA_MS = 24 * 60 * 60 * 1000;
const nochesEntre = (a, b) =>
  a && b ? Math.max(0, Math.round((b - a) / DIA_MS)) : 0;

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// --------------------------------------------------------------------------
// Estado
// --------------------------------------------------------------------------

const hoy = new Date();

const estadoInicial = () => ({
  cliente: '',
  fechaDocumento: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()),
  fechaEntrada: null,
  fechaSalida: null,
  noches: 0,
  personas: 0,
  nochesManual: false,
  personasManual: false,
  anticipoPct: ANTICIPO_PCT,
  telefono: '',
  hotel: { ...HOTEL },
  firma: { ...FIRMA },
  servicios: [...SERVICIOS],
  condiciones: [...CONDICIONES],
  habitaciones: HABITACIONES.map((h) => ({ ...h })),
});

let state = estadoInicial();
let sidebarDataUrl = null;

// --- Preferencias guardadas en el dispositivo (tarifas y textos, no clientes)

function guardarPreferencias() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({
      anticipoPct: state.anticipoPct,
      hotel: state.hotel,
      firma: state.firma,
      servicios: state.servicios,
      condiciones: state.condiciones,
      habitaciones: state.habitaciones.map(({ tipo, descripcion, ocupacion, personas, tarifa }) =>
        ({ tipo, descripcion, ocupacion, personas, tarifa })),
    }));
  } catch (e) { /* modo privado o almacenamiento bloqueado: no pasa nada */ }
}

function cargarPreferencias() {
  let guardado = null;
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) guardado = JSON.parse(crudo);
  } catch (e) { return; }
  if (!guardado || typeof guardado !== 'object') return;

  if (Number.isFinite(guardado.anticipoPct)) state.anticipoPct = guardado.anticipoPct;
  if (guardado.hotel) state.hotel = { ...state.hotel, ...guardado.hotel };
  if (guardado.firma) state.firma = { ...state.firma, ...guardado.firma };
  if (Array.isArray(guardado.servicios)) state.servicios = guardado.servicios;
  if (Array.isArray(guardado.condiciones)) state.condiciones = guardado.condiciones;
  if (Array.isArray(guardado.habitaciones) && guardado.habitaciones.length) {
    state.habitaciones = guardado.habitaciones.map((h) => ({
      tipo: h.tipo || '',
      descripcion: h.descripcion || '',
      ocupacion: h.ocupacion || '',
      personas: Number(h.personas) || 0,
      tarifa: Number(h.tarifa) || 0,
      cantidad: 0,
    }));
  }
}

// --------------------------------------------------------------------------
// Habitaciones
// --------------------------------------------------------------------------

function pintarHabitaciones() {
  const cont = $('habitaciones');
  cont.innerHTML = state.habitaciones.map((h, i) => `
    <div class="hab ${Number(h.cantidad) > 0 ? 'activa' : ''}" data-i="${i}">
      <div class="hab-cab">
        <input type="text" class="tipo" data-campo="tipo" value="${esc(h.tipo)}"
               aria-label="Tipo de habitación">
        <button class="borrar" type="button" data-borrar="${i}"
                title="Quitar este tipo" aria-label="Quitar ${esc(h.tipo)}">×</button>
      </div>
      <div class="rejilla">
        <div class="campo" style="grid-column:1/-1">
          <label>Descripción</label>
          <textarea data-campo="descripcion" rows="2">${esc(h.descripcion)}</textarea>
        </div>
        <div class="campo">
          <label>Ocupación máxima</label>
          <input type="text" data-campo="ocupacion" value="${esc(h.ocupacion)}">
        </div>
        <div class="campo">
          <label>No. de hab. a cotizar</label>
          <input type="number" data-campo="cantidad" min="0" step="1" inputmode="numeric"
                 value="${Number(h.cantidad) || 0}">
        </div>
        <div class="campo">
          <label>Tarifa por noche (MXN)</label>
          <input type="number" data-campo="tarifa" min="0" step="1" inputmode="decimal"
                 value="${Number(h.tarifa) || 0}">
        </div>
      </div>
      <div class="hab-importe">
        <span>${Number(h.cantidad) > 0
          ? `${h.cantidad} hab. × ${state.noches || 0} noches × ${moneyPlain(h.tarifa)}`
          : 'No se incluye en el PDF'}</span>
        <b>${Number(h.cantidad) > 0
          ? money(Number(h.cantidad) * (state.noches || 0) * Number(h.tarifa))
          : ''}</b>
      </div>
    </div>`).join('');
}

function alCambiarHabitacion(e) {
  const caja = e.target.closest('.hab');
  const campo = e.target.dataset.campo;
  if (!caja || !campo) return;
  const h = state.habitaciones[Number(caja.dataset.i)];
  if (!h) return;

  h[campo] = (campo === 'cantidad' || campo === 'tarifa')
    ? Math.max(0, Number(e.target.value) || 0)
    : e.target.value;

  if (campo === 'cantidad') {
    caja.classList.toggle('activa', h.cantidad > 0);
    autoPersonas();
  }
  if (campo === 'tarifa' || campo === 'cantidad') actualizarImporteFila(caja, h);
  guardarPreferencias();
  refrescar({ saltarHabitaciones: true });
}

function actualizarImporteFila(caja, h) {
  const fila = caja.querySelector('.hab-importe');
  if (!fila) return;
  const activa = Number(h.cantidad) > 0;
  fila.children[0].textContent = activa
    ? `${h.cantidad} hab. × ${state.noches || 0} noches × ${moneyPlain(h.tarifa)}`
    : 'No se incluye en el PDF';
  fila.children[1].textContent = activa
    ? money(Number(h.cantidad) * (state.noches || 0) * Number(h.tarifa))
    : '';
}

// --------------------------------------------------------------------------
// Totales y campos calculados
// --------------------------------------------------------------------------

function autoNoches() {
  if (state.nochesManual) return;
  state.noches = nochesEntre(state.fechaEntrada, state.fechaSalida);
  $('noches').value = state.noches || '';
}

function autoPersonas() {
  if (state.personasManual) return;
  state.personas = cotizadas(state.habitaciones)
    .reduce((s, h) => s + Number(h.cantidad) * (Number(h.personas) || 0), 0);
  $('personas').value = state.personas || '';
}

function pintarAyudas() {
  const texto = (manual) => manual ? 'Editado a mano · tocar para recalcular' : 'Se calcula solo';
  $('ayuda-noches').textContent = texto(state.nochesManual);
  $('ayuda-personas').textContent = texto(state.personasManual);
  for (const [id, manual] of [['ayuda-noches', state.nochesManual], ['ayuda-personas', state.personasManual]]) {
    $(id).style.cursor = manual ? 'pointer' : '';
    $(id).style.color = manual ? 'var(--verde)' : '';
  }
}

function pintarTotales() {
  const { rows, subtotal, total, anticipo } = calcularTotales(state);
  $('totales').innerHTML = rows.length ? `
    <div class="tot-fila"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    <div class="tot-fila fuerte"><span>Total</span><span>${money(total)}</span></div>
    <div class="tot-fila anticipo">
      <span>Anticipo para reservar (${state.anticipoPct}%)</span><span>${money(anticipo)}</span>
    </div>`
    : `<div class="aviso">Pon al menos una habitación para ver los totales.</div>`;
}

// --------------------------------------------------------------------------
// Vista previa: la hoja mide 612x792 px, o sea los mismos puntos que el PDF.
// --------------------------------------------------------------------------

const pv = (txt, clases = '') =>
  `<p class="${clases}">${esc(txt)}</p>`;
const vacio = '<div class="vacio"></div>';

function vistaPagina1() {
  const { rows, subtotal, total, anticipo } = calcularTotales(state);
  const rango = rangoFechas(state.fechaEntrada, state.fechaSalida);
  const grupo = Number(state.personas) > 0
    ? `un grupo de ${state.personas} personas` : 'un grupo de personas';

  const colgroup = `<colgroup>${GEO.colRoom.map((w) => `<col style="width:${w}px">`).join('')}</colgroup>`;
  const tablaHab = rows.length ? `
    <table class="habitaciones">${colgroup}
      <tr>${COLUMNAS_HABITACIONES.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>
      ${rows.map((h) => `<tr>
        <td>${esc(h.tipo)}</td><td>${esc(h.descripcion)}</td><td>${esc(h.ocupacion)}</td>
        <td>${esc(h.cantidad)}</td><td>${esc(money(h.tarifa))}</td></tr>`).join('')}
    </table>` : '';

  const colSum = `<colgroup>${GEO.colSum.map((w) => `<col style="width:${w}px">`).join('')}</colgroup>`;
  const filaSum = (etq, val, fuerte) =>
    `<tr><td class="etiqueta">${fuerte ? '<b>' : ''}${esc(etq)}${fuerte ? '</b>' : ''}</td>
         <td class="valor">${fuerte ? '<b>' : ''}${esc(val)}${fuerte ? '</b>' : ''}</td></tr>`;
  const tablaSum = rows.length ? `
    <table class="importes">${colSum}
      ${rows.map((h) => filaSum(
        `${h.tipo} (${h.cantidad} hab. x ${state.noches} noches x ${moneyPlain(h.tarifa)})`,
        money(h.importe), false)).join('')}
      ${filaSum('Subtotal', money(subtotal), false)}
      ${filaSum('Total', money(total), true)}
      ${filaSum(`Anticipo para reservar (${state.anticipoPct}%)`, money(anticipo), true)}
    </table>` : '';

  return `
    <p class="azul">${esc(state.hotel.nombre)}</p>
    ${pv(state.hotel.direccion)}${pv(state.hotel.telefono)}${pv(state.hotel.correo)}
    ${pv('Fecha: ' + fechaLarga(state.fechaDocumento))}
    ${vacio}
    <p><span class="azul">Asunto:</span>&nbsp; Cotización del ${esc(rango)}</p>
    ${vacio}
    <p><span class="azul">Estimado(a)cliente</span>: ${esc(state.cliente)}</p>
    ${vacio}
    <p class="just">Reciba un cordial saludo de parte del Hotel Gran Caimán. Por medio del
      presente, nos permitimos hacerle llegar la cotización de hospedaje de
      ${esc(mesAnio(state.fechaEntrada))}, en la que encontrará las opciones disponibles y sus
      respectivas tarifas.</p>
    ${vacio}
    <p class="just">La cotización correspondiente a su estancia de ${esc(state.noches)} noches,
      para la fecha del ${esc(rango)} para ${esc(grupo)}. Para reservar se requiere el
      <b>${esc(state.anticipoPct)}%</b> del total.</p>
    ${vacio}
    ${tablaHab}${tablaHab ? vacio : ''}${tablaSum}`;
}

function vistaPagina2() {
  return `
    <p class="just">Unicamente le pediriamos de favor que al momento de acomodar a las personas
      no se exceda la ocupacion máxima permitida en cada habitacion. De esta manera podemos
      respetar la capacidad. Muchas gracias por su comprensión.</p>
    ${vacio}
    <p class="just">*Las fechas pueden ajustarse de acuerdo con su preferencia y disponibilidad.*</p>
    ${vacio}
    <p class="just">Le informamos que el bloqueo de habitaciones se mantendrá vigente de 24 a 48
      hrs posteriores al envio de la cotizacion, sujeto a disponibilidad, fecha límite para
      recibir su confirmación y garantizar la disponibilidad y las tarifas cotizadas. Posterior
      a dicha fecha, las habitaciones y condiciones estarán sujetas a disponibilidad al momento
      de su confirmación.</p>
    ${vacio}
    ${pv('Servicios incluidos')}
    ${pv('El Hotel Gran Caimán cuenta con todos los servicios básicos para una estancia cómoda y placentera, entre los cuales se incluyen:')}
    ${state.servicios.map((s) => pv('- ' + s)).join('')}
    ${vacio}
    <p class="just">Ambiente relajante y acogedor, ideal para descansar y disfrutar de un oasis
      de tranquilidad cercas del mar.</p>
    ${vacio}
    <p><b>Condiciones generales</b></p>
    ${state.condiciones.map((c) => pv('- ' + c)).join('')}
    ${vacio}
    <p class="just">Agradecemos su atención y quedamos a sus órdenes para cualquier información
      adicional o para confirmar su reservación.</p>
    ${vacio}
    <p><b>Atentamente,</b></p>
    ${pv(state.firma.nombre)}${pv(state.firma.hotel)}${pv(state.firma.celular)}${pv(state.firma.telefono)}`;
}

function pintarVista() {
  const hoja = (contenido) => `
    <div class="hoja-caja">
      <div class="hoja">
        <img class="barra-lateral" src="img/sidebar.jpg" alt="">
        <div class="contenido">${contenido}</div>
      </div>
    </div>`;
  $('lienzo').innerHTML = hoja(vistaPagina1()) + hoja(vistaPagina2());
  escalarVista();
}

/** Ajusta la escala de las hojas al ancho disponible. */
function escalarVista() {
  for (const caja of document.querySelectorAll('.hoja-caja')) {
    const hoja = caja.querySelector('.hoja');
    if (!hoja) continue;
    const k = Math.min(1, caja.clientWidth / GEO.pageW);
    hoja.style.transform = `scale(${k})`;
    caja.style.height = `${Math.max(hoja.offsetHeight, GEO.pageH) * k}px`;
  }
}

// --------------------------------------------------------------------------
// Refresco general
// --------------------------------------------------------------------------

function refrescar(opts = {}) {
  if (!opts.saltarHabitaciones) pintarHabitaciones();
  pintarAyudas();
  pintarTotales();
  pintarVista();
}

// --------------------------------------------------------------------------
// PDF, descarga y WhatsApp
// --------------------------------------------------------------------------

function mensaje(texto, tipo) {
  const caja = $('aviso');
  caja.textContent = texto;
  caja.className = 'aviso' + (tipo ? ' ' + tipo : '');
  caja.hidden = !texto;
}

function mensajeHTML(html, tipo) {
  const caja = $('aviso');
  caja.innerHTML = html;
  caja.className = 'aviso' + (tipo ? ' ' + tipo : '');
  caja.hidden = !html;
}

/**
 * ¿Este navegador puede mandar el PDF ya adjunto por la hoja de compartir?
 * Sí: Safari en iPhone/iPad y Chrome en Android. No: los navegadores de escritorio,
 * Safari de Mac incluido (comprobado) — ahí toca adjuntarlo a mano.
 *
 * Por eso no se anuncia ningún navegador por nombre: se pregunta al navegador y se
 * dice lo que conteste, que es lo único confiable.
 */
function puedeAdjuntar() {
  try {
    // El blob va con contenido: con 0 bytes hay implementaciones que dicen que no.
    const prueba = new File([new Blob(['%PDF-1.3'], { type: 'application/pdf' })], 'p.pdf',
      { type: 'application/pdf' });
    return !!(navigator.canShare && navigator.canShare({ files: [prueba] }));
  } catch (e) {
    return false;
  }
}

// navigator.platform está deprecado y puede venir vacío, así que también se mira
// el userAgent. El iPad se anuncia como "MacIntel", de ahí el filtro por táctil.
const esMac = () =>
  /Mac/i.test(navigator.platform || navigator.userAgent || '') && !('ontouchend' in document);

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (e) {
    return false;
  }
}

function validar() {
  if (!cotizadas(state.habitaciones).length) {
    return 'Pon al menos una habitación con cantidad mayor a 0.';
  }
  if (!state.fechaEntrada || !state.fechaSalida) return 'Falta la fecha de entrada o de salida.';
  if (state.fechaSalida <= state.fechaEntrada) return 'La salida debe ser después de la entrada.';
  if (!state.noches) return 'El número de noches debe ser mayor a 0.';
  return null;
}

function generarPdf() {
  const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDFCtor) throw new Error('No se pudo cargar el generador de PDF.');
  const doc = buildPdf(state, jsPDFCtor, sidebarDataUrl);
  return { blob: doc.output('blob'), nombre: nombreArchivo(state) };
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function resumenWhatsApp() {
  const { rows, total, anticipo } = calcularTotales(state);
  const lineas = [
    `*Hotel Gran Caimán* — Cotización`,
    state.cliente ? `Cliente: ${state.cliente}` : null,
    `Fechas: ${rangoFechas(state.fechaEntrada, state.fechaSalida)} (${state.noches} noches)`,
    '',
    ...rows.map((h) => `• ${h.cantidad} ${h.tipo} × ${moneyPlain(h.tarifa)} por noche`),
    '',
    `Total: ${money(total)}`,
    `Anticipo para reservar (${state.anticipoPct}%): ${money(anticipo)}`,
    '',
    'Le comparto la cotización en PDF. Quedamos a sus órdenes.',
  ];
  return lineas.filter((l) => l !== null).join('\n');
}

function urlWhatsApp() {
  const digitos = (state.telefono || '').replace(/\D/g, '');
  const numero = digitos ? (digitos.length === 10 ? '52' + digitos : digitos) : '';
  return `https://wa.me/${numero}?text=${encodeURIComponent(resumenWhatsApp())}`;
}

function alDescargar() {
  const error = validar();
  if (error) return mensaje(error, 'error');
  try {
    const { blob, nombre } = generarPdf();
    descargar(blob, nombre);
    mensaje(`Listo: ${nombre}`, 'ok');
  } catch (e) {
    mensaje('No se pudo generar el PDF: ' + e.message, 'error');
  }
}

async function alCompartir() {
  const error = validar();
  if (error) return mensaje(error, 'error');
  let blob, nombre;
  try {
    ({ blob, nombre } = generarPdf());
  } catch (e) {
    return mensaje('No se pudo generar el PDF: ' + e.message, 'error');
  }

  // En celular esto abre la hoja nativa de compartir con el PDF ya adjunto.
  const archivo = new File([blob], nombre, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], text: resumenWhatsApp() });
      mensaje('Compartido.', 'ok');
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return mensaje('');
      // Si el compartir nativo falla, seguimos con el plan B.
    }
  }

  // Plan B (Chrome/Firefox de escritorio): se baja el PDF, se copia el mensaje
  // y se abre WhatsApp. El adjunto hay que arrastrarlo a mano: ningún navegador
  // de escritorio deja que una página adjunte archivos a WhatsApp Web.
  descargar(blob, nombre);
  const copiado = await copiarTexto(resumenWhatsApp());
  window.open(urlWhatsApp(), '_blank', 'noopener');
  mensajeHTML(
    `<b>Ya se descargó el PDF.</b> Falta adjuntarlo en WhatsApp:` +
    `<ol style="margin:8px 0 0;padding-left:20px">` +
    `<li>${copiado ? 'Pega el mensaje con <b>Ctrl/Cmd + V</b>' : 'Escribe el mensaje'}.</li>` +
    `<li>Clic en el <b>clip 📎</b> → Documento → elige <b>${esc(nombre)}</b> en Descargas.</li>` +
    `</ol>` +
    (esMac()
      ? `<div style="margin-top:8px">En Mac lo más rápido es <b>arrastrar</b> el PDF ` +
        `desde Descargas (la flecha ⤓ arriba a la derecha) hasta la conversación.</div>`
      : ''),
    'ok',
  );
}

/** Avisa de antemano si este navegador podrá adjuntar el PDF o no. */
function pintarPistaCompartir() {
  const pista = $('pista-wa');
  if (!pista) return;
  if (puedeAdjuntar()) {
    pista.textContent = 'Se abre el menú de compartir con el PDF ya adjunto.';
    return;
  }
  pista.textContent =
    'En computadora ningún navegador deja adjuntar archivos solo: se baja el PDF, '
    + 'se copia el mensaje y tú lo arrastras a la conversación. Desde el celular sí va adjunto.';
}

// --------------------------------------------------------------------------
// Enlaces con el formulario
// --------------------------------------------------------------------------

function volcarEstadoAlFormulario() {
  $('cliente').value = state.cliente;
  $('fechaDocumento').value = aValor(state.fechaDocumento);
  $('fechaEntrada').value = aValor(state.fechaEntrada);
  $('fechaSalida').value = aValor(state.fechaSalida);
  $('noches').value = state.noches || '';
  $('personas').value = state.personas || '';
  $('anticipoPct').value = state.anticipoPct;
  $('tel').value = state.telefono;
  $('servicios').value = state.servicios.join('\n');
  $('condiciones').value = state.condiciones.join('\n');
  $('hotelNombre').value = state.hotel.nombre;
  $('hotelDireccion').value = state.hotel.direccion;
  $('hotelTelefono').value = state.hotel.telefono;
  $('hotelCorreo').value = state.hotel.correo;
  $('firmaNombre').value = state.firma.nombre;
  $('firmaHotel').value = state.firma.hotel;
  $('firmaCelular').value = state.firma.celular;
  $('firmaTelefono').value = state.firma.telefono;
}

function conectar() {
  $('cliente').addEventListener('input', (e) => { state.cliente = e.target.value; pintarVista(); });

  $('fechaDocumento').addEventListener('change', (e) => {
    state.fechaDocumento = aFecha(e.target.value); pintarVista();
  });

  for (const id of ['fechaEntrada', 'fechaSalida']) {
    $(id).addEventListener('change', (e) => {
      state[id] = aFecha(e.target.value);
      autoNoches();
      refrescar();
    });
  }

  $('noches').addEventListener('input', (e) => {
    state.noches = Math.max(0, Number(e.target.value) || 0);
    state.nochesManual = true;
    refrescar();
  });

  $('personas').addEventListener('input', (e) => {
    state.personas = Math.max(0, Number(e.target.value) || 0);
    state.personasManual = true;
    pintarAyudas();
    pintarVista();
  });

  $('ayuda-noches').addEventListener('click', () => {
    if (!state.nochesManual) return;
    state.nochesManual = false; autoNoches(); refrescar();
  });
  $('ayuda-personas').addEventListener('click', () => {
    if (!state.personasManual) return;
    state.personasManual = false; autoPersonas(); pintarAyudas(); pintarVista();
  });

  $('anticipoPct').addEventListener('input', (e) => {
    state.anticipoPct = Math.min(100, Math.max(0, Number(e.target.value) || 0));
    guardarPreferencias();
    pintarTotales();
    pintarVista();
  });

  $('tel').addEventListener('input', (e) => { state.telefono = e.target.value; });

  const listas = { servicios: 'servicios', condiciones: 'condiciones' };
  for (const [id, clave] of Object.entries(listas)) {
    $(id).addEventListener('input', (e) => {
      state[clave] = e.target.value.split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim())
        .filter((l) => l !== '');
      guardarPreferencias();
      pintarVista();
    });
  }

  const textos = {
    hotelNombre: ['hotel', 'nombre'], hotelDireccion: ['hotel', 'direccion'],
    hotelTelefono: ['hotel', 'telefono'], hotelCorreo: ['hotel', 'correo'],
    firmaNombre: ['firma', 'nombre'], firmaHotel: ['firma', 'hotel'],
    firmaCelular: ['firma', 'celular'], firmaTelefono: ['firma', 'telefono'],
  };
  for (const [id, [grupo, campo]] of Object.entries(textos)) {
    $(id).addEventListener('input', (e) => {
      state[grupo][campo] = e.target.value;
      guardarPreferencias();
      pintarVista();
    });
  }

  const habs = $('habitaciones');
  habs.addEventListener('input', alCambiarHabitacion);
  habs.addEventListener('click', (e) => {
    const i = e.target.dataset.borrar;
    if (i === undefined) return;
    state.habitaciones.splice(Number(i), 1);
    autoPersonas();
    guardarPreferencias();
    refrescar();
  });

  $('btn-agregar').addEventListener('click', () => {
    state.habitaciones.push({
      tipo: 'Nuevo tipo', descripcion: '', ocupacion: '2 personas',
      personas: 2, cantidad: 0, tarifa: 0,
    });
    guardarPreferencias();
    refrescar();
  });

  $('btn-reset').addEventListener('click', () => {
    try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ }
    const cliente = state.cliente, ent = state.fechaEntrada, sal = state.fechaSalida;
    state = estadoInicial();
    state.cliente = cliente; state.fechaEntrada = ent; state.fechaSalida = sal;
    autoNoches(); autoPersonas();
    volcarEstadoAlFormulario();
    refrescar();
    mensaje('Se restauraron las tarifas y los textos originales.', 'ok');
  });

  for (const id of ['btn-pdf', 'btn-pdf-movil']) $(id).addEventListener('click', alDescargar);
  for (const id of ['btn-wa', 'btn-wa-movil']) $(id).addEventListener('click', alCompartir);

  $('btn-tema').addEventListener('click', () => {
    const actual = document.documentElement.dataset.tema;
    const oscuroSistema = matchMedia('(prefers-color-scheme: dark)').matches;
    const siguiente = actual ? (actual === 'oscuro' ? 'claro' : 'oscuro')
      : (oscuroSistema ? 'claro' : 'oscuro');
    document.documentElement.dataset.tema = siguiente;
    try { localStorage.setItem('granCaiman.tema', siguiente); } catch (e) { /* nada */ }
  });

  addEventListener('resize', escalarVista);
}

// --------------------------------------------------------------------------
// Arranque
// --------------------------------------------------------------------------

async function cargarBarraLateral() {
  try {
    const r = await fetch('img/sidebar.jpg');
    if (!r.ok) throw new Error(r.status);
    const blob = await r.blob();
    sidebarDataUrl = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  } catch (e) {
    // Sin la imagen el PDF sale con el texto pero sin barra lateral: se avisa.
    mensaje('No se pudo cargar la barra lateral; el PDF saldrá sin ella.', 'error');
  }
}

function iniciar() {
  try {
    const tema = localStorage.getItem('granCaiman.tema');
    if (tema) document.documentElement.dataset.tema = tema;
  } catch (e) { /* nada */ }

  cargarPreferencias();
  volcarEstadoAlFormulario();
  conectar();
  refrescar();
  pintarPistaCompartir();
  cargarBarraLateral();
}

iniciar();
