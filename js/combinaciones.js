// Combinaciones posibles de habitaciones para un número de personas.
//
// Mismo algoritmo que pms/src/lib/sugerencias.ts (la plataforma), portado a
// JavaScript puro para el cotizador. Sin DOM: tools/test-pdf.js lo prueba en Node.
//
// El espacio de búsqueda es chico —con el inventario real son unas cuantas miles
// de combinaciones a revisar— así que se recorre completo con poda. Para 45
// personas salen 120 combinaciones distintas; se devuelven todas y la pantalla
// decide cómo ordenarlas.

/** Tope de seguridad por si alguien captura un inventario enorme. */
export const TOPE = 2000;

/**
 * @param tipos    [{ indice, tipo, personas, unidades, tarifa }]
 *                 `indice` es la posición del tipo en la lista de la pantalla.
 * @param personas cuántas personas hay que acomodar
 * @param noches   para calcular el costo total de la estancia
 * @returns
 *   { factible: false, capacidad, faltan }
 *   { factible: true, lista, total, truncado, capacidad }
 */
export function combinaciones(tipos, personas, noches, { tope = TOPE } = {}) {
  const t = tipos.filter((x) => x.unidades > 0 && x.personas > 0);
  const capacidad = t.reduce((s, x) => s + x.unidades * x.personas, 0);
  const n = Math.floor(Number(personas) || 0);

  if (n <= 0) return { factible: false, capacidad, faltan: 0 };
  if (capacidad < n) return { factible: false, capacidad, faltan: n - capacidad };

  // Lo máximo que todavía pueden aportar los tipos de i en adelante: si ni con
  // todo eso se alcanza, esa rama no vale la pena recorrerla.
  const sufijo = new Array(t.length + 1).fill(0);
  for (let i = t.length - 1; i >= 0; i--) {
    sufijo[i] = sufijo[i + 1] + t[i].unidades * t[i].personas;
  }

  const lista = [];
  const x = new Array(t.length).fill(0);
  let truncado = false;

  const bajar = (i, cap) => {
    if (truncado) return;
    if (cap >= n) {
      if (esMinima(x, t, n, cap)) {
        lista.push(armar(x, t, n, noches));
        if (lista.length >= tope) truncado = true;
      }
      return;
    }
    if (i === t.length || cap + sufijo[i] < n) return;
    for (let k = 0; k <= t[i].unidades; k++) {
      x[i] = k;
      bajar(i + 1, cap + k * t[i].personas);
      // Con este tipo ya se cubrió a todos: agregar más de él solo desperdicia.
      if (cap + k * t[i].personas >= n) break;
    }
    x[i] = 0;
  };

  bajar(0, 0);
  return { factible: true, lista: ordenar(lista, 'costo'), total: lista.length, truncado, capacidad };
}

/**
 * Una combinación es mínima si quitándole un cuarto de cualquier tipo ya no
 * alcanza. Las que no lo son están dominadas: pagas un cuarto de más.
 */
function esMinima(x, tipos, n, cap) {
  for (let i = 0; i < x.length; i++) {
    if (x[i] > 0 && cap - tipos[i].personas >= n) return false;
  }
  return true;
}

function armar(x, tipos, n, noches) {
  const lineas = [];
  let habitaciones = 0;
  let capacidad = 0;
  let costoNoche = 0;
  for (let i = 0; i < x.length; i++) {
    if (x[i] === 0) continue;
    const tp = tipos[i];
    lineas.push({ indice: tp.indice, tipo: tp.tipo, cantidad: x[i], tarifa: tp.tarifa });
    habitaciones += x[i];
    capacidad += x[i] * tp.personas;
    costoNoche += x[i] * tp.tarifa;
  }
  return {
    lineas,
    habitaciones,
    capacidad,
    sobran: capacidad - n,
    costoNoche,
    costoTotal: costoNoche * (Number(noches) || 0),
  };
}

// Cada criterio desempata con los otros dos, para que el orden sea estable.
const COMPARADORES = {
  costo: (a, b) =>
    a.costoNoche - b.costoNoche || a.habitaciones - b.habitaciones || a.sobran - b.sobran,
  habitaciones: (a, b) =>
    a.habitaciones - b.habitaciones || a.costoNoche - b.costoNoche || a.sobran - b.sobran,
  ajuste: (a, b) =>
    a.sobran - b.sobran || a.costoNoche - b.costoNoche || a.habitaciones - b.habitaciones,
};

/** Devuelve una copia ordenada: 'costo' | 'habitaciones' | 'ajuste'. */
export function ordenar(lista, criterio) {
  return [...lista].sort(COMPARADORES[criterio] ?? COMPARADORES.costo);
}

/**
 * Personas por cuarto a partir del texto de "Ocupación máxima" ("4 personas" → 4).
 * Si el texto no trae número, se queda el valor que ya tenía.
 */
export function personasDeOcupacion(texto, anterior) {
  const m = String(texto ?? '').match(/\d+/);
  const v = m ? Number(m[0]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : anterior;
}
