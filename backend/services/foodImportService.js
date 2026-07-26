const { createHash } = require('crypto');

const cleanKey = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const cleanText = (value) => value === null || value === undefined
  ? ''
  : String(value).trim();

const pick = (row, aliases) => {
  const accepted = new Set(aliases.map(cleanKey));
  for (const [key, value] of Object.entries(row || {})) {
    if (accepted.has(cleanKey(key)) && cleanText(value)) return cleanText(value);
  }
  return '';
};

const calculateDv = (rut) => {
  let sum = 0;
  let multiplier = 2;
  for (let index = rut.length - 1; index >= 0; index -= 1) {
    sum += Number(rut[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const result = 11 - (sum % 11);
  if (result === 11) return '0';
  if (result === 10) return 'K';
  return String(result);
};

const normalizeRut = (rutValue, dvValue = '') => {
  const combined = cleanText(rutValue).toUpperCase().replace(/\./g, '');
  const parts = combined.split('-');
  let rut = parts[0].replace(/\D/g, '');
  let dv = cleanText(parts[1] || dvValue).toUpperCase().replace(/[^0-9K]/g, '').slice(0, 1);

  if (!dv && rut.length >= 7) {
    const possibleDv = rut.slice(-1);
    const possibleRut = rut.slice(0, -1);
    if (calculateDv(possibleRut) === possibleDv) {
      rut = possibleRut;
      dv = possibleDv;
    }
  }
  return { rut, dv };
};

const normalizeDate = (value) => {
  const text = cleanText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parsed = new Date(`${text}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : text;
  }
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : iso;
};

const normalizeActive = (value) => {
  const normalized = cleanKey(value);
  if (!normalized) return true;
  return !['no', 'false', '0', 'inactivo', 'baja'].includes(normalized);
};

const normalizeFoodImportRows = (rows) => {
  if (!Array.isArray(rows)) return { validRows: [], errors: [{ row: 0, message: 'La nómina debe ser una lista.' }] };

  const validRows = [];
  const errors = [];
  const seen = new Set();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const { rut, dv } = normalizeRut(
      pick(row, ['RUT', 'RUN', 'RUT estudiante', 'Identificador']),
      pick(row, ['DV', 'Dígito verificador'])
    );
    const validFromRaw = pick(row, ['Vigente desde', 'Desde', 'Fecha inicio']);
    const validUntilRaw = pick(row, ['Vigente hasta', 'Hasta', 'Fecha término', 'Fecha termino']);
    const validFrom = normalizeDate(validFromRaw);
    const validUntil = normalizeDate(validUntilRaw);

    if (!rut || rut.length < 6 || rut.length > 8 || !dv) {
      errors.push({ row: rowNumber, message: 'RUT incompleto o con formato inválido.' });
      return;
    }
    if (calculateDv(rut) !== dv) {
      errors.push({ row: rowNumber, rut: `${rut}-${dv}`, message: 'El dígito verificador no corresponde.' });
      return;
    }
    if (seen.has(rut)) {
      errors.push({ row: rowNumber, rut: `${rut}-${dv}`, message: 'El RUT está repetido en la nómina.' });
      return;
    }
    if (validFromRaw && !validFrom) {
      errors.push({ row: rowNumber, rut: `${rut}-${dv}`, message: 'La fecha de inicio no es válida.' });
      return;
    }
    if (validUntilRaw && !validUntil) {
      errors.push({ row: rowNumber, rut: `${rut}-${dv}`, message: 'La fecha de término no es válida.' });
      return;
    }
    if (validFrom && validUntil && validUntil < validFrom) {
      errors.push({ row: rowNumber, rut: `${rut}-${dv}`, message: 'La fecha de término antecede al inicio.' });
      return;
    }

    seen.add(rut);
    validRows.push({
      row: rowNumber,
      rut,
      dv,
      active: normalizeActive(pick(row, ['Activo', 'Estado', 'Beneficiario'])),
      validFrom,
      validUntil,
      notes: pick(row, ['Observación', 'Observacion', 'Notas']).slice(0, 280) || null
    });
  });

  return { validRows, errors };
};

const hashFoodImport = (rows) => createHash('sha256')
  .update(JSON.stringify(rows.map(({ row, ...value }) => value)))
  .digest('hex');

module.exports = {
  calculateDv,
  hashFoodImport,
  normalizeFoodImportRows,
  normalizeRut
};
