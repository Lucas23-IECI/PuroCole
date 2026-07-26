import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Ban,
  BookOpenCheck,
  ChartNoAxesCombined,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  ScanLine,
  Search,
  ShieldAlert,
  UtensilsCrossed,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { API_URL } from './config';
import { AuthContext } from './context/AuthContext';
import ModuleHeader from './components/ModuleHeader';
import AppSelect from './components/AppSelect';
import FoodImportPanel from './components/FoodImportPanel';
import FoodReportsPanel from './components/FoodReportsPanel';
import { PERMISSIONS, hasPermission } from './permissions';

const fullName = (student) => [student?.nombres, student?.paterno, student?.materno].filter(Boolean).join(' ');

const FoodDashboard = () => {
  const navigate = useNavigate();
  const { logout, user } = useContext(AuthContext);
  const canRegister = hasPermission(user, PERMISSIONS.FOOD_REGISTER);
  const canManage = hasPermission(user, PERMISSIONS.FOOD_MANAGE);
  const canImport = hasPermission(user, PERMISSIONS.FOOD_IMPORT);
  const canReport = hasPermission(user, PERMISSIONS.FOOD_REPORTS);
  const canManageAlerts = hasPermission(user, PERMISSIONS.FOOD_ALERTS_MANAGE);

  const [view, setView] = useState('operation');
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState('');
  const [day, setDay] = useState({ summary: {}, registrations: [] });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedOrigin, setSelectedOrigin] = useState('manual');
  const [alertText, setAlertText] = useState('');
  const [loadingDay, setLoadingDay] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');

  const selectedService = useMemo(
    () => services.find((service) => String(service.id_service) === String(serviceId)),
    [serviceId, services],
  );

  const loadDay = useCallback(async (nextServiceId = serviceId) => {
    setLoadingDay(true);
    try {
      const { data } = await axios.get(`${API_URL}/food/today`, {
        params: nextServiceId ? { serviceId: nextServiceId } : {},
      });
      setDay(data);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No fue posible cargar la jornada.' });
    } finally {
      setLoadingDay(false);
    }
  }, [serviceId]);

  useEffect(() => {
    axios.get(`${API_URL}/food/services`)
      .then(({ data }) => {
        setServices(data);
        const current = data.find((service) => service.current_window) || data[0];
        if (current) setServiceId(String(current.id_service));
      })
      .catch((error) => setMessage({
        type: 'error',
        text: error.response?.data?.message || 'No fue posible cargar los servicios.',
      }));
  }, []);

  useEffect(() => {
    if (serviceId) loadDay(serviceId);
  }, [serviceId, loadDay]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const search = async (event) => {
    event?.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setSelected(null);
    try {
      const cleanedQuery = query.trim();
      const looksScanned = !cleanedQuery.includes(' ') && /^[0-9.kK-]{3,80}$/.test(cleanedQuery);
      if (looksScanned) {
        try {
          const { data } = await axios.get(`${API_URL}/food/students/scan/${encodeURIComponent(cleanedQuery)}`);
          setSelected(data);
          setSelectedOrigin('lector');
          setAlertText(data.alerta_alimentaria || '');
          setResults([]);
          return;
        } catch (scanError) {
          if (scanError.response?.status !== 404) throw scanError;
        }
      }
      const { data } = await axios.get(`${API_URL}/food/students/search`, { params: { q: query.trim() } });
      setResults(data);
      setSelectedOrigin('manual');
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No fue posible buscar.' });
    } finally {
      setSearching(false);
    }
  };

  const setBeneficiary = async (active) => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      await axios.put(`${API_URL}/food/beneficiaries/${selected.id_alumno}`, { active });
      const updated = { ...selected, beneficiario: active, origen_beneficio: 'manual' };
      setSelected(updated);
      setResults((current) => current.map((student) => (
        student.id_alumno === updated.id_alumno ? updated : student
      )));
      setMessage({ type: 'success', text: active ? 'Beneficiario habilitado.' : 'Beneficiario deshabilitado.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No fue posible actualizar el beneficio.' });
    } finally {
      setSubmitting(false);
    }
  };

  const registerDelivery = async () => {
    if (!selected || !serviceId || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API_URL}/food/registrations`, {
        studentId: selected.id_alumno,
        serviceId: Number(serviceId),
        origin: selectedOrigin,
      });
      setMessage({ type: 'success', text: data.message });
      setSelected(null);
      setResults([]);
      setQuery('');
      await loadDay();
    } catch (error) {
      setMessage({
        type: error.response?.data?.code === 'DUPLICATE_DELIVERY' ? 'warning' : 'error',
        text: error.response?.data?.message || 'No fue posible registrar la entrega.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateAlert = async (active = true) => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await axios.put(`${API_URL}/food/alerts/${selected.id_alumno}`, {
        active,
        alertText: alertText.trim(),
      });
      const updated = { ...selected, alerta_alimentaria: data.alert?.active ? data.alert.alert_text : null };
      setSelected(updated);
      setResults((current) => current.map((student) => (
        student.id_alumno === updated.id_alumno ? updated : student
      )));
      setMessage({ type: 'success', text: data.message });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No fue posible actualizar la alerta.' });
    } finally {
      setSubmitting(false);
    }
  };

  const voidDelivery = async (event) => {
    event.preventDefault();
    if (voidReason.trim().length < 10 || submitting) return;
    setSubmitting(true);
    try {
      await axios.patch(`${API_URL}/food/registrations/${voidTarget.id_registration}/void`, {
        reason: voidReason.trim(),
      });
      setMessage({ type: 'success', text: 'Entrega anulada con trazabilidad.' });
      setVoidTarget(null);
      setVoidReason('');
      await loadDay();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'No fue posible anular la entrega.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="food-page">
      <ModuleHeader
        icon={UtensilsCrossed}
        title="Jornada de alimentación"
        description="Entregas rápidas sobre el padrón institucional, sin duplicar personas ni perder trazabilidad."
        onBack={() => navigate('/admin')}
        onLogout={handleLogout}
      />

      {message && (
        <div className="food-notice" data-kind={message.type} role={message.type === 'error' ? 'alert' : 'status'}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Cerrar aviso"><X size={16} /></button>
        </div>
      )}

      <nav className="food-mode-nav" aria-label="Áreas de Alimentación">
        <button type="button" data-active={view === 'operation' || undefined} onClick={() => setView('operation')}>
          <BookOpenCheck size={18} /> Operación
        </button>
        {canImport && (
          <button type="button" data-active={view === 'import' || undefined} onClick={() => setView('import')}>
            <FileSpreadsheet size={18} /> Nómina PAE
          </button>
        )}
        {canReport && (
          <button type="button" data-active={view === 'reports' || undefined} onClick={() => setView('reports')}>
            <ChartNoAxesCombined size={18} /> Reportes
          </button>
        )}
      </nav>

      {view === 'operation' && (
        <>
          <section className="food-command" aria-labelledby="food-command-title">
        <div className="food-command__service">
          <span className="food-kicker">{selectedService?.current_window ? 'Servicio recomendado ahora' : 'Servicio seleccionado'}</span>
          <h2 id="food-command-title">{selectedService?.name || 'Seleccionar servicio'}</h2>
          <p>
            {selectedService
              ? `Ventana configurada: ${selectedService.start_time} a ${selectedService.end_time}.`
              : 'Selecciona la instancia que estás operando.'}
          </p>
          <AppSelect
            value={serviceId}
            onChange={setServiceId}
            ariaLabel="Servicio de alimentación"
            options={services.map((service) => ({
              value: String(service.id_service),
              label: `${service.name} · ${service.start_time}–${service.end_time}`,
            }))}
          />
        </div>
        <div className="food-day-stats" aria-label="Resumen de la jornada">
          <article>
            <span>Entregas</span>
            <strong>{loadingDay ? '—' : day.summary?.entregas || 0}</strong>
            <small>en este servicio</small>
          </article>
          <article>
            <span>Personas</span>
            <strong>{loadingDay ? '—' : day.summary?.estudiantes || 0}</strong>
            <small>sin contar duplicados</small>
          </article>
          <article>
            <span>Beneficiarios</span>
            <strong>{loadingDay ? '—' : day.summary?.beneficiarios_activos || 0}</strong>
            <small>vigentes hoy</small>
          </article>
        </div>
          </section>

          <div className="food-workspace">
        <section className="food-register" aria-labelledby="food-register-title">
          <header>
            <span className="food-step">01</span>
            <div>
              <h2 id="food-register-title">Buscar y confirmar</h2>
              <p>Utiliza nombre, RUT o código de barras.</p>
            </div>
          </header>

          {canRegister ? (
            <>
              <form className="food-search" onSubmit={search}>
                <Search size={20} aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ej.: 12.345.678-5 o Martina Rojas"
                  aria-label="Buscar estudiante"
                />
                <button type="submit" disabled={query.trim().length < 2 || searching}>
                  {searching ? 'Buscando…' : 'Buscar'}
                </button>
              </form>

              {results.length > 0 && !selected && (
                <div className="food-results" role="listbox" aria-label="Resultados de estudiantes">
                  {results.map((student) => (
                    <button
                      type="button"
                      key={student.id_alumno}
                      onClick={() => {
                        setSelected(student);
                        setSelectedOrigin('manual');
                        setAlertText(student.alerta_alimentaria || '');
                      }}
                      className="food-result"
                    >
                      <span className="food-result__avatar">{student.nombres?.[0]}{student.paterno?.[0]}</span>
                      <span>
                        <strong>{fullName(student)}</strong>
                        <small>{student.curso} · {student.rut}-{student.dv}</small>
                      </span>
                      <i data-active={student.beneficiario || undefined}>
                        {student.beneficiario ? 'Beneficiario' : 'Sin beneficio'}
                      </i>
                    </button>
                  ))}
                </div>
              )}

              {selected && (
                <article className="food-selection">
                  <button type="button" className="food-selection__close" onClick={() => setSelected(null)} aria-label="Cambiar estudiante">
                    <X size={17} />
                  </button>
                  <span className="food-result__avatar">{selected.nombres?.[0]}{selected.paterno?.[0]}</span>
                  <div className="food-selection__identity">
                    <span>
                      {selectedOrigin === 'lector' && <ScanLine size={14} />}
                      {selectedOrigin === 'lector' ? 'Credencial leída' : 'Persona seleccionada'}
                    </span>
                    <h3>{fullName(selected)}</h3>
                    <p>{selected.curso} · {selected.rut}-{selected.dv}</p>
                  </div>
                  <div className="food-selection__state" data-active={selected.beneficiario || undefined}>
                    {selected.beneficiario ? <UserCheck size={19} /> : <ShieldAlert size={19} />}
                    <div>
                      <strong>{selected.beneficiario ? 'Beneficio vigente' : 'No habilitado'}</strong>
                      <small>{selected.beneficiario ? 'Puede recibir el servicio.' : 'Requiere habilitación administrativa.'}</small>
                    </div>
                  </div>
                  {selected.alerta_alimentaria && (
                    <div className="food-dietary-alert" role="alert">
                      <ShieldAlert size={21} />
                      <div>
                        <strong>Alerta alimentaria</strong>
                        <span>{selected.alerta_alimentaria}</span>
                      </div>
                    </div>
                  )}
                  {canManageAlerts && (
                    <div className="food-alert-editor">
                      <label htmlFor="food-alert-text">Alerta operacional restringida</label>
                      <textarea
                        id="food-alert-text"
                        value={alertText}
                        onChange={(event) => setAlertText(event.target.value)}
                        minLength={4}
                        maxLength={280}
                        placeholder="Ej.: no entregar producto con maní. Evita diagnósticos clínicos."
                      />
                      <div>
                        {selected.alerta_alimentaria && (
                          <button type="button" className="food-secondary" onClick={() => updateAlert(false)} disabled={submitting}>
                            Desactivar alerta
                          </button>
                        )}
                        <button type="button" className="food-secondary" onClick={() => updateAlert(true)} disabled={alertText.trim().length < 4 || submitting}>
                          Guardar alerta
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="food-selection__actions">
                    {!selected.beneficiario && canManage && (
                      <button type="button" className="food-secondary" onClick={() => setBeneficiary(true)} disabled={submitting}>
                        Habilitar beneficio
                      </button>
                    )}
                    <button
                      type="button"
                      className="food-primary"
                      onClick={registerDelivery}
                      disabled={!selected.beneficiario || submitting}
                    >
                      <CheckCircle2 size={19} />
                      {submitting ? 'Registrando…' : `Registrar ${selectedService?.name || 'entrega'}`}
                    </button>
                  </div>
                </article>
              )}

              {!selected && results.length === 0 && (
                <div className="food-empty-search">
                  <Search size={28} />
                  <strong>Esperando una búsqueda</strong>
                  <span>El sistema nunca registra una entrega sin confirmación visible.</span>
                </div>
              )}
            </>
          ) : (
            <div className="food-readonly">
              <ShieldAlert size={23} />
              <p>Tu perfil puede consultar la jornada, pero no registrar entregas.</p>
            </div>
          )}
        </section>

        <section className="food-recent" aria-labelledby="food-recent-title">
          <header>
            <span className="food-step">02</span>
            <div>
              <h2 id="food-recent-title">Entregas recientes</h2>
              <p>Últimos movimientos activos del servicio.</p>
            </div>
          </header>

          {loadingDay ? (
            <div className="food-list-state">Actualizando jornada…</div>
          ) : day.registrations?.length ? (
            <div className="food-deliveries">
              {day.registrations.map((registration) => (
                <article className="food-delivery" key={registration.id_registration}>
                  <time><Clock3 size={15} /> {registration.delivered_time?.slice(0, 5)}</time>
                  <div>
                    <strong>{fullName(registration)}</strong>
                    <span>{registration.course} · {registration.service_name}</span>
                  </div>
                  {canManage && (
                    <button type="button" onClick={() => setVoidTarget(registration)} aria-label={`Anular entrega de ${fullName(registration)}`}>
                      <Ban size={16} />
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="food-list-state">
              <Users size={24} />
              <strong>Aún no hay entregas</strong>
              <span>El primer registro aparecerá aquí de inmediato.</span>
            </div>
          )}
        </section>
          </div>
        </>
      )}

      {view === 'import' && canImport && <FoodImportPanel onNotice={setMessage} />}
      {view === 'reports' && canReport && <FoodReportsPanel services={services} onNotice={setMessage} />}

      {voidTarget && (
        <div className="food-dialog-backdrop" onClick={() => setVoidTarget(null)}>
          <form className="food-dialog" onSubmit={voidDelivery} onClick={(event) => event.stopPropagation()}>
            <span className="food-kicker">Corrección auditada</span>
            <h2>Anular entrega</h2>
            <p>La entrega de <strong>{fullName(voidTarget)}</strong> permanecerá en el historial.</p>
            <label htmlFor="food-void-reason">Motivo obligatorio</label>
            <textarea
              id="food-void-reason"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              minLength={10}
              maxLength={500}
              placeholder="Describe por qué corresponde anular este registro…"
              autoFocus
            />
            <div>
              <button type="button" className="food-secondary" onClick={() => setVoidTarget(null)}>Cancelar</button>
              <button type="submit" className="food-danger" disabled={voidReason.trim().length < 10 || submitting}>
                {submitting ? 'Anulando…' : 'Anular con trazabilidad'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default FoodDashboard;
