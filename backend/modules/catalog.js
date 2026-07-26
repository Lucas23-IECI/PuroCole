const domains = [
  {
    id: 'core',
    name: 'Núcleo escolar',
    short_name: 'Núcleo',
    description: 'Personas, cursos, matrículas y ficha operacional compartida.',
    status: 'active',
    order: 10
  },
  {
    id: 'punctuality',
    name: 'Puntualidad',
    short_name: 'Puntualidad',
    description: 'Ingresos, atrasos, correcciones, justificaciones e indicadores.',
    status: 'active',
    order: 20
  },
  {
    id: 'administration',
    name: 'Administración',
    short_name: 'Administración',
    description: 'Cuentas, perfiles, permisos y parámetros institucionales.',
    status: 'active',
    order: 30
  },
  {
    id: 'audit',
    name: 'Auditoría',
    short_name: 'Auditoría',
    description: 'Trazabilidad transversal de consultas y cambios sensibles.',
    status: 'active',
    order: 40
  },
  {
    id: 'food',
    name: 'Alimentación',
    short_name: 'Alimentación',
    description: 'Integración reservada para servicios, beneficiarios y control PAE.',
    status: 'reserved',
    order: 50
  },
  {
    id: 'visits',
    name: 'Control de visitas y retiros',
    short_name: 'Visitas y retiros',
    description: 'Integración reservada para portería, permanencia y retiros autorizados.',
    status: 'reserved',
    integration_strategy: 'external-generalization',
    order: 60
  }
];

const experiences = [
  {
    id: 'students',
    domain_id: 'core',
    label: 'Personas y cursos',
    eyebrow: 'Comunidad',
    description: 'Padrón institucional, importaciones y asignación de matrículas.',
    path: '/admin/estudiantes',
    icon: 'users',
    tone: 'navy',
    surface: 'portal',
    order: 10,
    permissions: ['students.view', 'students.manage', 'students.import']
  },
  {
    id: 'punctuality-dashboard',
    domain_id: 'punctuality',
    label: 'Control de atrasos',
    eyebrow: 'Gestión diaria',
    description: 'Registro diario, seguimiento de puntualidad y reportes por período.',
    path: '/admin/atrasos',
    icon: 'clock',
    tone: 'blue',
    surface: 'portal',
    order: 10,
    permissions: ['punctuality.view']
  },
  {
    id: 'punctuality-analytics',
    domain_id: 'punctuality',
    label: 'Estadísticas',
    eyebrow: 'Información',
    description: 'Indicadores de atrasos y puntualidad desglosados por curso.',
    path: '/admin/analiticas',
    icon: 'chart',
    tone: 'green',
    surface: 'portal',
    order: 20,
    permissions: ['analytics.view']
  },
  {
    id: 'punctuality-settings',
    domain_id: 'punctuality',
    label: 'Configuración de jornada',
    eyebrow: 'Parámetros',
    description: 'Horarios, severidad y umbrales preventivos de atrasos.',
    path: '/admin/configuracion',
    icon: 'settings',
    tone: 'slate',
    surface: 'portal',
    order: 30,
    permissions: ['settings.manage']
  },
  {
    id: 'punctuality-terminal',
    domain_id: 'punctuality',
    label: 'Terminal de registro',
    eyebrow: 'Operación',
    description: 'Registro de ingresos con pistola de códigos o búsqueda manual.',
    path: '/scanner',
    icon: 'scan',
    tone: 'green',
    surface: 'terminal',
    order: 40,
    permissions: ['punctuality.register']
  },
  {
    id: 'users',
    domain_id: 'administration',
    label: 'Usuarios y permisos',
    eyebrow: 'Accesos',
    description: 'Cuentas de acceso, perfiles y permisos administrativos.',
    path: '/admin/usuarios',
    icon: 'user-cog',
    tone: 'ochre',
    surface: 'portal',
    order: 10,
    permissions: ['users.manage']
  },
  {
    id: 'audit-log',
    domain_id: 'audit',
    label: 'Auditoría del sistema',
    eyebrow: 'Seguridad',
    description: 'Trazabilidad de accesos, cambios, registros e importaciones.',
    path: '/admin/auditoria',
    icon: 'clipboard',
    tone: 'slate',
    surface: 'portal',
    order: 10,
    permissions: ['audit.view']
  }
];

const hasAnyPermission = (available, required) => required.some((permission) => available.has(permission));

const getVisibleModuleCatalog = (permissions = []) => {
  const available = new Set(permissions);
  const visibleExperiences = experiences
    .filter((experience) => hasAnyPermission(available, experience.permissions))
    .sort((left, right) => left.order - right.order);
  const activeDomainIds = new Set(visibleExperiences.map((experience) => experience.domain_id));
  const canSeeRoadmap = hasAnyPermission(available, ['users.manage', 'settings.manage']);
  const visibleDomains = domains
    .filter((domain) => activeDomainIds.has(domain.id) || (canSeeRoadmap && domain.status === 'reserved'))
    .sort((left, right) => left.order - right.order)
    .map((domain) => ({
      ...domain,
      enabled_experiences: visibleExperiences.filter((experience) => experience.domain_id === domain.id).length
    }));

  return {
    version: 1,
    domains: visibleDomains,
    experiences: visibleExperiences
  };
};

const validateModuleCatalog = () => {
  const domainIds = new Set();
  for (const domain of domains) {
    if (domainIds.has(domain.id)) throw new Error(`Dominio duplicado: ${domain.id}`);
    domainIds.add(domain.id);
  }

  const experienceIds = new Set();
  const paths = new Set();
  for (const experience of experiences) {
    if (experienceIds.has(experience.id)) throw new Error(`Experiencia duplicada: ${experience.id}`);
    if (!domainIds.has(experience.domain_id)) throw new Error(`Dominio inexistente: ${experience.domain_id}`);
    if (paths.has(experience.path)) throw new Error(`Ruta duplicada: ${experience.path}`);
    if (!Array.isArray(experience.permissions) || experience.permissions.length === 0) {
      throw new Error(`Experiencia sin permisos: ${experience.id}`);
    }
    experienceIds.add(experience.id);
    paths.add(experience.path);
  }

  return true;
};

validateModuleCatalog();

module.exports = {
  domains,
  experiences,
  getVisibleModuleCatalog,
  validateModuleCatalog
};
