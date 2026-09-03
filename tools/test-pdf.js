// Smoke test del generador de PDF.
//
// Corre js/pdf.js — el mismo módulo que usa el navegador — contra jsPDF en Node
// y escribe PDFs de prueba para comparar contra PLANTILLA_COTIZACION.docx.
//
//   npm test

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';

import { buildPdf, calcularTotales, nombreArchivo, money } from '../js/pdf.js';
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

let fallos = 0;
const check = (etiqueta, real, esperado) => {
  const ok = real === esperado;
  if (!ok) fallos++;
  console.log(`  ${ok ? 'ok  ' : 'FALLA'} ${etiqueta}: ${real}${ok ? '' : `  (esperado ${esperado})`}`);
};

// --- Caso 1: 2 cuádruples + 1 bungalow, 7 noches --------------------------
const caso1 = base();
caso1.habitaciones[2].cantidad = 2; // Cuadruple
caso1.habitaciones[3].cantidad = 1; // Bungalow

console.log('\nCaso 1 — 2 cuadruples + 1 bungalow, 7 noches');
const t1 = calcularTotales(caso1);
check('tipos en el PDF', t1.rows.length, 2);
check('subtotal', money(t1.subtotal), '$39,200.00 MXN');
check('anticipo 50%', money(t1.anticipo), '$19,600.00 MXN');
check('nombre de archivo', nombreArchivo(caso1), 'Cotizacion_Juan_Jose_Fonseca_Barajas_2026-09-03.pdf');

const doc1 = buildPdf(caso1, jsPDF, sidebar);
check('paginas', doc1.getNumberOfPages(), 2);
writeFileSync(join(root, 'tools/salida-caso1.pdf'), Buffer.from(doc1.output('arraybuffer')));

// --- Caso 2: los 4 tipos, el peor caso para el alto de la página 1 --------
const caso2 = base();
caso2.cliente = 'Grupo Empresarial del Pacífico S.A. de C.V.';
caso2.habitaciones.forEach((h, i) => { h.cantidad = [3, 10, 8, 2][i]; });
caso2.personas = 61;

console.log('\nCaso 2 — los 4 tipos (peor caso de alto)');
const t2 = calcularTotales(caso2);
check('tipos en el PDF', t2.rows.length, 4);
check('subtotal', money(t2.subtotal), '$223,300.00 MXN');
const doc2 = buildPdf(caso2, jsPDF, sidebar);
check('paginas', doc2.getNumberOfPages(), 2);
writeFileSync(join(root, 'tools/salida-caso2.pdf'), Buffer.from(doc2.output('arraybuffer')));

// --- Caso 3: acentos y caracteres especiales ------------------------------
console.log('\nCaso 3 — acentos');
const caso3 = base();
caso3.cliente = 'Señora Ángeles Muñoz Íñiguez';
caso3.habitaciones[0].cantidad = 1;
caso3.habitaciones[0].descripcion = 'Habitación ¡ñ! áéíóú ÁÉÍÓÚ üÜ ¿?';
const doc3 = buildPdf(caso3, jsPDF, sidebar);
writeFileSync(join(root, 'tools/salida-caso3.pdf'), Buffer.from(doc3.output('arraybuffer')));
console.log('  (revisar salida-caso3.pdf a ojo: los acentos deben verse bien)');

console.log(`\n${fallos === 0 ? 'TODO OK' : fallos + ' FALLAS'}\n`);
process.exit(fallos === 0 ? 0 : 1);
