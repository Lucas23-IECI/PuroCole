import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowRight,
  BarChart2,
  ClipboardList,
  Clock3,
  ContactRound,
  LogOut,
  ScanLine,
  Settings2,
  UserCog,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { AuthContext } from './context/AuthContext';
import InstitutionalMark from './components/InstitutionalMark';
import { roleLabel } from './permissions';
import { API_URL, getInstitutionMeta, INSTITUTION_CONFIG, PRODUCT_CONFIG } from './config';

const ICONS = {
  chart: BarChart2,
  clipboard: ClipboardList,
  clock: Clock3,
  scan: ScanLine,
  settings: Settings2,
  'user-cog': UserCog,
  users: Users,
  utensils: UtensilsCrossed,
};

const RESERVED_ICONS = {
  food: UtensilsCrossed,
  visits: ContactRound,
};

const formatCurrentDate = () => new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date());

const AdminHub = () => {
  const navigate = useNavigate();
  const { logout, user } = useContext(AuthContext);
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setCatalogError('');
    axios.get(`${API_URL}/modules`)
      .then(({ data }) => {
        if (active) setCatalog(data);
      })
      .catch(() => {
        if (active) setCatalogError('No fue posible cargar los módulos habilitados.');
      });
    return () => { active = false; };
  }, [reloadKey]);

  const activeDomains = useMemo(() => (catalog?.domains || [])
    .filter((domain) => domain.status === 'active' && domain.enabled_experiences > 0), [catalog]);
  const reservedDomains = useMemo(() => (catalog?.domains || [])
    .filter((domain) => domain.status === 'reserved'), [catalog]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="hub-page">
      <main className="hub-card">
        <header className="hub-header">
          <InstitutionalMark />
          <div className="hub-header__product">
            <span>{PRODUCT_CONFIG.name}</span>
            <strong>{PRODUCT_CONFIG.descriptor}</strong>
          </div>
          <div className="hub-user">
            <div className="hub-user__identity">
              <span>{user?.profile_name || roleLabel(user?.rol)}</span>
              <strong>{user?.nombre || user?.correo}</strong>
            </div>
            <button className="hub-logout" onClick={handleLogout} title="Cerrar sesión">
              <LogOut size={17} /> <span>Cerrar sesión</span>
            </button>
          </div>
        </header>

        <section className="hub-intro hub-intro--campus" aria-label="Resumen operacional del establecimiento" data-tour="hub-intro">
          <div className="hub-intro__content">
            <span className="section-kicker">Centro operacional</span>
            <h1 className="hub-title">{INSTITUTION_CONFIG.name}</h1>
            <p className="hub-date">{formatCurrentDate()}</p>
            <span className="hub-campus-label">{getInstitutionMeta() || 'Operación y trazabilidad de la jornada'}</span>
          </div>
          <div className="hub-summary">
            <strong>{catalog?.experiences?.length ?? '—'}</strong>
            <span>herramientas habilitadas<br />para tu perfil</span>
          </div>
        </section>

        <section className="hub-modules" aria-labelledby="modules-title" data-tour="hub-modules">
          <div className="hub-section-heading">
            <div>
              <span className="section-kicker">Tu espacio de trabajo</span>
              <h2 id="modules-title">Módulos habilitados</h2>
            </div>
            <span>Las opciones se ajustan a los permisos efectivos de tu cuenta.</span>
          </div>

          {!catalog && !catalogError && (
            <div className="hub-catalog-state" role="status">Organizando tus módulos…</div>
          )}
          {catalogError && (
            <div className="hub-catalog-state hub-catalog-state--error" role="alert">
              <span>{catalogError}</span>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Reintentar</button>
            </div>
          )}

          {activeDomains.map((domain) => {
            const domainExperiences = catalog.experiences.filter((experience) => experience.domain_id === domain.id);
            return (
              <section className="hub-domain" key={domain.id} aria-labelledby={`domain-${domain.id}`}>
                <header className="hub-domain__heading">
                  <div>
                    <h3 id={`domain-${domain.id}`}>{domain.name}</h3>
                    <p>{domain.description}</p>
                  </div>
                  <span>{domain.enabled_experiences} {domain.enabled_experiences === 1 ? 'acceso' : 'accesos'}</span>
                </header>
                <div className="hub-grid">
                  {domainExperiences.map((experience) => {
                    const Icon = ICONS[experience.icon] || ClipboardList;
                    return (
                      <button
                        key={experience.id}
                        className="hub-module"
                        data-tone={experience.tone}
                        onClick={() => navigate(experience.path)}
                      >
                        <div className="hub-module-icon"><Icon size={22} /></div>
                        <span className="hub-module-category">{experience.eyebrow}</span>
                        <h4 className="hub-module-title">{experience.label}</h4>
                        <p className="hub-module-desc">{experience.description}</p>
                        <span className="hub-module-go">Ingresar <ArrowRight size={16} /></span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </section>

        {reservedDomains.length > 0 && (
          <section className="hub-roadmap" aria-labelledby="roadmap-title">
            <div className="hub-section-heading">
              <div>
                <span className="section-kicker">Arquitectura preparada</span>
                <h2 id="roadmap-title">Próximas integraciones</h2>
              </div>
              <span>Reservadas en el catálogo; todavía no están habilitadas.</span>
            </div>
            <div className="hub-roadmap__grid">
              {reservedDomains.map((domain) => {
                const Icon = RESERVED_ICONS[domain.id] || ClipboardList;
                return (
                  <article className="hub-module hub-module--reserved" key={domain.id}>
                    <div className="hub-module-icon"><Icon size={22} /></div>
                    <span className="hub-module-category">Integración reservada</span>
                    <h3 className="hub-module-title">{domain.name}</h3>
                    <p className="hub-module-desc">{domain.description}</p>
                    <span className="hub-module-status">Sin acceso operativo</span>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <footer className="hub-footer">
          <span className="hub-footer__status"><i /> Servicios operativos</span>
          <span>
            {[INSTITUTION_CONFIG.name, getInstitutionMeta()].filter(Boolean).join(' · ')}
          </span>
          <span className="hub-footer__branding">
            © 2026 Todos los derechos reservados. Desarrollado por{' '}
            <a href="https://purocode.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
              PuroCode
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
};

export default AdminHub;
