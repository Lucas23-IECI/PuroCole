import { useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle2, FileSpreadsheet, History, UploadCloud, XCircle } from 'lucide-react';

import { API_URL } from '../config';
import { exportOperationalReport, readObjectRows } from '../utils/spreadsheet';

const FoodImportPanel = ({ onNotice }) => {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [deactivateMissing, setDeactivateMissing] = useState(false);

  const loadHistory = () => axios.get(`${API_URL}/food/imports`)
    .then(({ data }) => setHistory(data))
    .catch(() => setHistory([]));

  useEffect(() => {
    loadHistory();
  }, []);

  const selectFile = async (event) => {
    const nextFile = event.target.files?.[0];
    setFile(nextFile || null);
    setRows([]);
    setPreview(null);
    if (!nextFile) return;
    setBusy(true);
    try {
      const parsed = await readObjectRows(nextFile);
      setRows(parsed);
      const { data } = await axios.post(`${API_URL}/food/beneficiaries/import/preview`, { rows: parsed });
      setPreview(data);
    } catch (error) {
      const data = error.response?.data;
      if (data?.errors) setPreview(data);
      onNotice({
        type: data?.errors ? 'warning' : 'error',
        text: data?.message || (data?.errors ? 'La previsualización encontró filas por corregir.' : 'No fue posible leer la nómina.'),
      });
    } finally {
      setBusy(false);
    }
  };

  const applyImport = async () => {
    if (!preview?.contentHash || preview.errors?.length || busy) return;
    setBusy(true);
    try {
      const { data } = await axios.post(`${API_URL}/food/beneficiaries/import`, {
        rows,
        idempotencyKey: preview.contentHash,
        fileName: file?.name,
        deactivateMissing,
      });
      onNotice({ type: data.duplicate ? 'warning' : 'success', text: data.message });
      await loadHistory();
    } catch (error) {
      onNotice({ type: 'error', text: error.response?.data?.message || 'No fue posible aplicar la nómina.' });
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    await exportOperationalReport({
      title: 'Plantilla de nómina PAE · PuroCole',
      fileName: 'PuroCole_Plantilla_PAE.xlsx',
      sheet: 'Nómina PAE',
      widths: [18, 14, 18, 18, 32],
      rows: [
        ['RUT', 'Estado', 'Vigente desde', 'Vigente hasta', 'Observación'],
        ['15.987.654-3', 'Activo', '2026-07-26', '', 'Dato completamente ficticio'],
      ],
    });
  };

  return (
    <div className="food-management-grid">
      <section className="food-panel food-import-panel">
        <header>
          <span className="food-step">PAE</span>
          <div>
            <h2>Importar nómina con previsualización</h2>
            <p>Ninguna fila se aplica hasta que el archivo completo pase las validaciones.</p>
          </div>
        </header>

        <div className="food-import-actions">
          <label className="food-file-picker">
            <UploadCloud size={22} />
            <span>
              <strong>{file?.name || 'Seleccionar archivo Excel'}</strong>
              <small>RUT, estado y vigencias. Máximo 5.000 filas.</small>
            </span>
            <input type="file" accept=".xlsx" onChange={selectFile} />
          </label>
          <button type="button" className="food-secondary" onClick={downloadTemplate}>
            <FileSpreadsheet size={18} /> Descargar plantilla
          </button>
        </div>

        {busy && <div className="food-list-state">Validando la nómina…</div>}

        {preview && !busy && (
          <div className="food-import-preview">
            <div className="food-preview-metrics">
              <article><span>Filas</span><strong>{preview.total || rows.length}</strong></article>
              <article data-tone="success"><span>Válidas</span><strong>{preview.valid || 0}</strong></article>
              <article data-tone={preview.errors?.length ? 'danger' : 'success'}>
                <span>Errores</span><strong>{preview.errors?.length || 0}</strong>
              </article>
            </div>

            {preview.errors?.length > 0 ? (
              <div className="food-import-errors">
                {preview.errors.slice(0, 20).map((error, index) => (
                  <p key={`${error.row}-${index}`}>
                    <XCircle size={16} />
                    <span>Fila {error.row || '—'}: {error.message}</span>
                  </p>
                ))}
              </div>
            ) : (
              <div className="food-import-ready">
                <CheckCircle2 size={20} />
                <span>La nómina está lista. El mismo archivo no podrá aplicarse dos veces.</span>
              </div>
            )}

            <label className="food-checkbox">
              <input
                type="checkbox"
                checked={deactivateMissing}
                onChange={(event) => setDeactivateMissing(event.target.checked)}
              />
              <span>
                <strong>Desactivar beneficiarios PAE ausentes</strong>
                <small>Úsalo solo cuando el archivo representa la nómina institucional completa.</small>
              </span>
            </label>

            <button
              type="button"
              className="food-primary food-import-submit"
              onClick={applyImport}
              disabled={!preview.contentHash || preview.errors?.length > 0 || busy}
            >
              <CheckCircle2 size={19} /> Aplicar nómina validada
            </button>
          </div>
        )}
      </section>

      <section className="food-panel food-import-history">
        <header>
          <span className="food-step"><History size={18} /></span>
          <div>
            <h2>Últimas importaciones</h2>
            <p>Resumen auditable; no se almacena una segunda copia de la planilla.</p>
          </div>
        </header>
        {history.length ? history.map((batch) => (
          <article key={batch.id_batch}>
            <div>
              <strong>{batch.file_name || 'Nómina sin nombre'}</strong>
              <span>{new Date(batch.created_at).toLocaleString('es-CL')}</span>
            </div>
            <b>{batch.rows_applied} aplicadas</b>
          </article>
        )) : <div className="food-list-state">Aún no hay importaciones registradas.</div>}
      </section>
    </div>
  );
};

export default FoodImportPanel;
