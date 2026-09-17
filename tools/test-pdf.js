// Pruebas del cotizador: generador de PDF y combinaciones posibles.
//
// Corre js/pdf.js y js/combinaciones.js — los mismos módulos que usa el
// navegador — en Node, y escribe PDFs de prueba en tools/.
//
//   npm test

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';

import { buildPdf, calcularTotales, nombreArchivo, money } from '../js/pdf.js';
// Copia congelada del generador ANTES del ajuste para el hotel completo. Sirve
// para comprobar que las cotizaciones normales siguen saliendo idénticas.
import * as pdfOriginal from './pdf-original.js';
import { combinaciones, ordenar, personasDeOcupacion } from '../js/combinaciones.js';
import {
  HOTEL, FIRMA, HABITACIONES, SERVICIOS, CONDICIONES, ANTICIPO_PCT,
} from '../js/defaults.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sidebar =
  'data:image/jpeg;base64,' + readFileSync(join(root, 'img/sidebar.jpg')).toString('base64');

const base = () => ({
  cliente: 'Juan José Fonseca Barajas',
  fechaDocumento: new Date(2026, 8, 3), // jueves 3 de septiembre 2026
  fechaEntrada: new Date(2026, 11, 15),
  fechaSalida: new Date(2026, 11, 22),
  noches: 7,
  personas: 12,
  anticipoPct: ANTICIPO_PCT,
  hotel: HOTEL,
  firma: FIRMA,
  servicios: SERVICIOS,
  condiciones: CONDICIONES,
  habitaciones: HABITACIONES.map((h) => ({ ...h })),
});

/** Pone cantidades por NOMBRE de tipo, no por posición. */
function cotizar(caso, cantidades) {
  for (const [tipo, n] of Object.entries(cantidades)) {
    const h = caso.habitaciones.find((x) => x.tipo === tipo);
    if (!h) throw new Error(`No existe el tipo ${tipo}`);
    h.cantidad = n;
  }
  return caso;
}

let fallos = 0;
const grupo = (t) => console.log(`\n${t}`);
const check = (etiqueta, real, esperado) => {
  const ok = real === esperado;
  if (!ok) fallos++;
  console.log(`  ${ok ? 'ok  ' : 'FALLA'} ${etiqueta}: ${real}${ok ? '' : `  (esperado ${esperado})`}`);
};
const checkQue = (etiqueta, condicion, detalle = '') => {
  if (!condicion) fallos++;
  console.log(`  ${condicion ? 'ok  ' : 'FALLA'} ${etiqueta}${detalle ? ` — ${detalle}` : ''}`);
};

// Documento sin comprimir, para poder leer el contenido de cada hoja.
const Plano = function (opciones) {
  return new jsPDF({ ...opciones, compress: false });
};
const hojas = (modulo, estado) =>
  modulo.buildPdf(estado, Plano, null).internal.pages.slice(1).map((p) => p.join('\n'));
const textoDe = (hoja) =>
  (hoja.match(/\(([^()]*)\) Tj/g) ?? []).map((s) => s.slice(1, s.indexOf(') Tj'))).join(' ');

// ---------------------------------------------------------------------------

grupo('Inventario');
const nupcial = HABITACIONES.find((h) => h.tipo === 'Nupcial');
checkQue('existe el cuarto nupcial', !!nupcial);
check('nupcial: tarifa', nupcial?.tarifa, 1400);
check('nupcial: personas', nupcial?.personas, 2);
check('nupcial: descripción', nupcial?.descripcion, '1 cama nupcial');
check('nupcial va al final de la lista', HABITACIONES.at(-1)?.tipo, 'Nupcial');
check('cuartos en total', HABITACIONES.reduce((s, h) => s + h.unidades, 0), 24);
check('capacidad del hotel', HABITACIONES.reduce((s, h) => s + h.unidades * h.personas, 0), 80);

// ---------------------------------------------------------------------------

grupo('Caso 1 — 2 cuadruples + 1 bungalow, 7 noches');
const caso1 = cotizar(base(), { Cuadruple: 2, Bungalow: 1 });
const t1 = calcularTotales(caso1);
check('tipos en el PDF', t1.rows.length, 2);
check('subtotal', money(t1.subtotal), '$39,200.00 MXN');
check('anticipo 50%', money(t1.anticipo), '$19,600.00 MXN');
check('nombre de archivo', nombreArchivo(caso1), 'Cotizacion_Juan_Jose_Fonseca_Barajas_2026-09-03.pdf');

const doc1 = buildPdf(caso1, jsPDF, sidebar);
check('paginas', doc1.getNumberOfPages(), 2);
writeFileSync(join(root, 'tools/salida-caso1.pdf'), Buffer.from(doc1.output('arraybuffer')));

// ---------------------------------------------------------------------------

grupo('Cotizaciones normales — deben salir IDÉNTICAS a antes del ajuste');

const descripcionEnorme = 'Una descripción muy larga para forzar el desborde. '.repeat(20);
const casosIguales = [
  ['caso 1', () => cotizar(base(), { Cuadruple: 2, Bungalow: 1 })],
  ['los 4 tipos originales', () =>
    cotizar(base(), { Sencilla: 3, Triple: 10, Cuadruple: 8, Bungalow: 2 })],
  ['4 tipos con el nupcial', () =>
    cotizar(base(), { Triple: 10, Cuadruple: 8, Bungalow: 2, Nupcial: 1 })],
  ['un solo tipo', () => cotizar(base(), { Sencilla: 1 })],
  ['sin habitaciones', () => base()],
  ['4 tipos con descripción enorme', () => {
    const c = cotizar(base(), { Sencilla: 3, Triple: 10, Cuadruple: 8, Bungalow: 2 });
    c.habitaciones[0].descripcion = descripcionEnorme;
    return c;
  }],
];
for (const [nombre, armar] of casosIguales) {
  const antes = JSON.stringify(hojas(pdfOriginal, armar()));
  const ahora = JSON.stringify(hojas({ buildPdf }, armar()));
  checkQue(nombre, antes === ahora);
}

// ---------------------------------------------------------------------------

grupo('Caso 2 — hotel completo: los 5 tipos a la vez');
const caso2 = cotizar(base(), { Sencilla: 3, Triple: 10, Cuadruple: 8, Bungalow: 2, Nupcial: 1 });
caso2.cliente = 'Grupo Empresarial del Pacífico S.A. de C.V.';
caso2.personas = 80;

const t2 = calcularTotales(caso2);
check('tipos en el PDF', t2.rows.length, 5);
check('subtotal', money(t2.subtotal), '$233,100.00 MXN');

const doc2 = buildPdf(caso2, jsPDF, sidebar);
check('paginas', doc2.getNumberOfPages(), 2);
writeFileSync(join(root, 'tools/salida-caso2.pdf'), Buffer.from(doc2.output('arraybuffer')));

const hojas2 = hojas({ buildPdf }, caso2).map(textoDe);
const hojaCon = (re) => hojas2.findIndex((t) => re.test(t)) + 1;
check('antes del ajuste salía en', hojas(pdfOriginal, caso2).length, 3);
checkQue(
  'la tabla de importes no se parte',
  hojaCon(/Subtotal/) === hojaCon(/Anticipo para reservar/),
  `Subtotal en hoja ${hojaCon(/Subtotal/)}, Anticipo en hoja ${hojaCon(/Anticipo para reservar/)}`,
);
check('la firma queda en la hoja', hojaCon(/Atentamente/), 2);

// Con un nombre de cliente de dos renglones también debe caber.
const caso2largo = cotizar(base(), { Sencilla: 3, Triple: 10, Cuadruple: 8, Bungalow: 2, Nupcial: 1 });
caso2largo.cliente =
  'Boda de la Familia Hernández Castañeda y la Familia Ruiz Navarro de Guadalajara, Jalisco';
check('con un nombre de cliente largo', buildPdf(caso2largo, jsPDF, null).getNumberOfPages(), 2);

// ---------------------------------------------------------------------------

grupo('Caso 3 — acentos');
const caso3 = cotizar(base(), { Sencilla: 1 });
caso3.cliente = 'Señora Ángeles Muñoz Íñiguez';
caso3.habitaciones[0].descripcion = 'Habitación ¡ñ! áéíóú ÁÉÍÓÚ üÜ ¿?';
const doc3 = buildPdf(caso3, jsPDF, sidebar);
writeFileSync(join(root, 'tools/salida-caso3.pdf'), Buffer.from(doc3.output('arraybuffer')));
console.log('  (revisar salida-caso3.pdf a ojo: los acentos deben verse bien)');

// ---------------------------------------------------------------------------

grupo('Combinaciones posibles');
const tipos = HABITACIONES.map((h, indice) => ({
  indice, tipo: h.tipo, personas: h.personas, unidades: h.unidades, tarifa: h.tarifa,
}));
const describir = (c) => c.lineas.map((l) => `${l.cantidad} ${l.tipo}`).join(' + ');

const r45 = combinaciones(tipos, 45, 3);
checkQue('45 personas caben', r45.factible);
check('45 personas: cuántas combinaciones', r45.total, 120);
check('45 personas: la más barata', describir(r45.lista[0]), '7 Triple + 6 Cuadruple');
check('45 personas: su costo por noche', r45.lista[0].costoNoche, 17400);
check('45 personas: costo por 3 noches', r45.lista[0].costoTotal, 52200);
check('menos cuartos para 45', ordenar(r45.lista, 'habitaciones')[0].habitaciones, 11);
check('mejor ajuste para 45 no desperdicia', ordenar(r45.lista, 'ajuste')[0].sobran, 0);

const porTipo = new Map(tipos.map((t) => [t.indice, t]));
checkQue(
  'ninguna usa más cuartos de los que hay',
  r45.lista.every((c) => c.lineas.every((l) => l.cantidad <= porTipo.get(l.indice).unidades)),
);
checkQue('todas acomodan a las 45', r45.lista.every((c) => c.capacidad >= 45));
checkQue(
  'todas son mínimas (quitar un cuarto ya no alcanza)',
  r45.lista.every((c) =>
    c.lineas.every((l) => c.capacidad - porTipo.get(l.indice).personas < 45)),
);
checkQue(
  'no hay combinaciones repetidas',
  new Set(r45.lista.map(describir)).size === r45.lista.length,
);

check('10 personas: cuántas', combinaciones(tipos, 10, 1).total, 25);
check('80 personas (hotel lleno): cuántas', combinaciones(tipos, 80, 1).total, 1);
const r81 = combinaciones(tipos, 81, 1);
checkQue('81 personas no caben', !r81.factible);
check('y dice cuántos lugares faltan', r81.faltan, 1);
checkQue('0 personas no genera nada', !combinaciones(tipos, 0, 1).factible);

const sinCuadruples = tipos.map((t) => (t.tipo === 'Cuadruple' ? { ...t, unidades: 0 } : t));
checkQue(
  'sin cuádruples no las propone',
  combinaciones(sinCuadruples, 20, 1).lista.every((c) =>
    c.lineas.every((l) => l.tipo !== 'Cuadruple')),
);

check('personas desde "4 personas"', personasDeOcupacion('4 personas', 2), 4);
check('personas desde "hasta 6"', personasDeOcupacion('hasta 6', 2), 6);
check('sin número conserva el anterior', personasDeOcupacion('familiar', 3), 3);

console.log(`\n${fallos === 0 ? 'TODO OK' : fallos + ' FALLAS'}\n`);
process.exit(fallos === 0 ? 0 : 1);
