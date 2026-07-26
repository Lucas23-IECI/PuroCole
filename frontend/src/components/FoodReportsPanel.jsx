import { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, Filter, PieChart } from 'lucide-react';

import { API_URL } from '../config';
import AppSelect from './AppSelect';
import { exportOperationalReport } from '../utils/spreadsheet';

const isoToday = () => new Date().toISOString().slice(0, 10);

const FoodReportsPanel = ({ services, onNotice }) => {
  const [today] = useState(isoToday);
  const [courses, setCourses] = useState([]);
  const [filters, setFilters] = useState({ from: today, to: today, serviceId: '', courseId: '', studentId: '' });
  const [report, setReport] = useState({ summary: [], registrations: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/courses`).then(({ data }) => setCourses(data)).catch(() => setCourses([]));
  }, []);

  const generate = async (event) => {
    event?.preventDefault();
    setBusy(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
      const { data } = await axios.get(`${API_URL}/food/reports`, { params });
      setReport(data);
    } catch (error) {
      onNotice({ type: 'error', text: error.response?.data?.message || 'No fue posible generar el reporte.' });
    } finally {
      setBusy(false);
    }
  };

  const exportReport = async () => {
    if (!report.registrations?.length) return;
    await exportOperationalReport({
      title: `Reporte de Alimentación · ${filters.from} a ${filters.to}`,
      fileName: `PuroCole_Alimentacion_${filters.from}_${filters.to}.xlsx`,
      sheet: 'Alimentación',
      widths: [14, 12, 18, 32, 18, 16, 16, 18],
      rows: [
        ['Fecha', 'Hora', 'Servicio', 'Estudiante', 'RUT', 'Curso', 'Origen', 'Estado'],
        ...report.registrations.map((row) => [
          row.service_date,
          row.delivered_time,
          row.service_name,
          [row.nombres, row.paterno, row.materno].filter(Boolean).join(' '),
          `${row.rut}-${row.dv}`,
          row.course,
          row.origin,
          row.voided ? 'Anulada' : 'Vigente',
        ]),
      ],
    });
  };

  return (
    <section className="food-panel food-reports-panel">
      <header>
        <span className="food-step"><PieChart size={18} /></span>
        <div>
          <h2>Reportes operacionales</h2>
          <p>Filtra entregas sin mezclar anulaciones ni estadísticas de Puntualidad.</p>
        </div>
      </header>

      <form className="food-report-filters" onSubmit={generate}>
        <label>Desde<input type="date" value={filters.from} max={filters.to} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
        <label>Hasta<input type="date" value={filters.to} min={filters.from} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
        <label>
          Servicio
          <AppSelect
            value={filters.serviceId}
            onChange={(value) => setFilters({ ...filters, serviceId: value })}
            ariaLabel="Filtrar servicio"
            options={[{ value: '', label: 'Todos' }, ...services.map((service) => ({ value: String(service.id_service), label: service.name }))]}
          />
        </label>
        <label>
          Curso
          <AppSelect
            value={filters.courseId}
            onChange={(value) => setFilters({ ...filters, courseId: value })}
            ariaLabel="Filtrar curso"
            options={[{ value: '', label: 'Todos' }, ...courses.map((course) => ({ value: String(course.id_curso), label: course.nombre_curso }))]}
          />
        </label>
        <label>ID estudiante<input inputMode="numeric" value={filters.studentId} onChange={(event) => setFilters({ ...filters, studentId: event.target.value.replace(/\D/g, '') })} placeholder="Opcional" /></label>
        <button type="submit" className="food-primary" disabled={busy}><Filter size={18} /> {busy ? 'Generando…' : 'Generar'}</button>
      </form>

      <div className="food-report-summary">
        {report.summary?.map((item) => (
          <article key={item.id_service}>
            <span>{item.service_name}</span>
            <strong>{item.deliveries}</strong>
            <small>{item.students} estudiantes · {item.voided} anuladas</small>
          </article>
        ))}
        {!report.summary?.length && <div className="food-list-state">Configura los filtros y genera el reporte.</div>}
      </div>

      {report.registrations?.length > 0 && (
        <>
          <div className="food-report-heading">
            <span>{report.total} movimientos encontrados</span>
            <button type="button" className="food-secondary" onClick={exportReport}><Download size={17} /> Exportar Excel</button>
          </div>
          <div className="food-report-table-wrap">
            <table className="food-report-table">
              <thead><tr><th>Fecha</th><th>Servicio</th><th>Estudiante</th><th>Curso</th><th>Estado</th></tr></thead>
              <tbody>
                {report.registrations.slice(0, 250).map((row) => (
                  <tr key={row.id_registration}>
                    <td>{row.service_date}<small>{row.delivered_time?.slice(0, 5)}</small></td>
                    <td>{row.service_name}</td>
                    <td>{[row.nombres, row.paterno, row.materno].filter(Boolean).join(' ')}</td>
                    <td>{row.course}</td>
                    <td><span data-voided={row.voided || undefined}>{row.voided ? 'Anulada' : 'Vigente'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

export default FoodReportsPanel;
