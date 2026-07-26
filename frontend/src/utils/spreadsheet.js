const HEADER_STYLE = {
  backgroundColor: '#17324D',
  color: '#FFFFFF',
  fontWeight: 'bold',
  align: 'center',
  wrap: true,
};

const normalizeCell = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
};

const downloadSheet = async (data, { fileName, sheet, widths, stickyRowsCount = 1 }) => {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const columns = widths?.map((width) => ({ width }));
  await writeExcelFile(data, {
    sheet,
    columns,
    stickyRowsCount,
    fontFamily: 'Arial',
    fontSize: 10,
  }).toFile(fileName);
};

export const exportObjectRows = async (objects, { fileName, sheet }) => {
  if (!objects.length) return;
  const headers = Object.keys(objects[0]);
  const data = [
    headers.map((value) => ({ value, ...HEADER_STYLE })),
    ...objects.map((row) => headers.map((header) => normalizeCell(row[header]))),
  ];
  const widths = headers.map((header) => Math.min(48, Math.max(14, header.length + 3)));
  await downloadSheet(data, { fileName, sheet, widths });
};

export const exportOperationalReport = async ({
  title,
  rows,
  fileName,
  sheet,
  widths,
}) => {
  const columnCount = rows[0]?.length || 1;
  const titleRow = [
    {
      value: title,
      columnSpan: columnCount,
      fontWeight: 'bold',
      fontSize: 15,
      color: '#17324D',
      height: 28,
      align: 'left',
    },
    ...Array(Math.max(0, columnCount - 1)).fill(null),
  ];
  const headerRow = (rows[0] || []).map((value) => ({ value: normalizeCell(value), ...HEADER_STYLE }));
  const data = [
    titleRow,
    Array(columnCount).fill(null),
    headerRow,
    ...rows.slice(1).map((row) => row.map(normalizeCell)),
  ];
  await downloadSheet(data, { fileName, sheet, widths, stickyRowsCount: 3 });
};

export const readObjectRows = async (file, preferredSheet = '') => {
  const { default: readExcelFile } = await import('read-excel-file/browser');
  const sheets = await readExcelFile(file);
  const selected = sheets.find(({ sheet }) => sheet === preferredSheet) || sheets[0];
  if (!selected?.data?.length) return [];

  const [rawHeaders, ...rows] = selected.data;
  const headers = rawHeaders.map((value) => String(value ?? '').trim());
  return rows.map((row) => Object.fromEntries(
    headers.map((header, index) => [header || `Columna ${index + 1}`, normalizeCell(row[index])])
  ));
};
