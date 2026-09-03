// Valores por defecto del cotizador.
// Todo lo que el hotel querría cambiar sin tocar el resto del código vive aquí.
// Espejo de gen_plantilla.js (el generador del .docx original).

export const HOTEL = {
  nombre: 'HOTEL GRAN CAIMÁN',
  direccion: 'Lázaro Cárdenas No. 24, La Manzanilla del Mar, Jalisco',
  telefono: 'Tel. 01 (315) 351 54 33',
  correo: 'Correo electrónico: hgrancaiman@outlook.com',
};

export const FIRMA = {
  nombre: 'Mar López',
  hotel: 'Hotel Gran Caimán',
  celular: 'Celular: 33 32 37 9045',
  telefono: 'Telefono: 01 (315) 351 54 33',
};

// Tarifas base por tipo de habitación. El usuario las puede modificar en la página.
export const HABITACIONES = [
  {
    tipo: 'Sencilla',
    descripcion: '1 cama matrimonial',
    ocupacion: '2 personas',
    personas: 2,
    cantidad: 0,
    tarifa: 900,
  },
  {
    tipo: 'Triple',
    descripcion: '1 cama matrimonial, 1 cama individual',
    ocupacion: '3 personas',
    personas: 3,
    cantidad: 0,
    tarifa: 1200,
  },
  {
    tipo: 'Cuadruple',
    descripcion: '2 camas matrimoniales',
    ocupacion: '4 personas',
    personas: 4,
    cantidad: 0,
    tarifa: 1500,
  },
  {
    tipo: 'Bungalow',
    descripcion:
      '1 cama matrimonial, 1 cama individual, 1 sofá cama matrimonial para 2 personas, cocineta, utensilios básicos, refrigerador y baño',
    ocupacion: '5 personas',
    personas: 5,
    cantidad: 0,
    tarifa: 2600,
  },
];

export const SERVICIOS = [
  'Internet de alta velocidad Starlink',
  'Agua caliente',
  'Televisión con cable',
  'Aire acondicionado',
  'Ventilador',
  'Area de amacas',
  'Area de palapas',
];

export const CONDICIONES = [
  'Tarifas en pesos mexicanos, por habitación, por noche.',
  'Tarifas sujetas a disponibilidad al momento de confirmar la reserva.',
  'Horario de check-in: 3:00 p.m. / check-out: 11:00 am',
  'Se requiere anticipo para garantizar la reservación.',
  'Política de cancelación: sin cargo hasta 7 días antes de la fecha de llegada; después de este periodo se aplicará un cargo del 50% del total de la reserva.',
  'Los precios no incluyen impuestos.',
];

export const ANTICIPO_PCT = 50;

// Encabezados de la tabla de habitaciones, en orden.
export const COLUMNAS_HABITACIONES = [
  'Tipo de habitación',
  'Descripción',
  'Ocupación máxima',
  'No. de hab.',
  'Tarifa por noche',
];
