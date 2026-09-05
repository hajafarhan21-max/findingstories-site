export const CRM_ROUTES = Object.freeze([
  'dashboard', 'leads', 'smart-views', 'opportunities', 'tasks', 'meetings',
  'site-visits', 'eois', 'inventory', 'projects', 'campaigns', 'reports',
  'project-performance', 'users-teams', 'automations', 'settings'
]);

export const DEFAULT_CRM_ROUTE = 'dashboard';

// Old bookmarks are kept deliberately, but navigation always writes canonical hashes.
export const CRM_ROUTE_ALIASES = Object.freeze({
  stats: 'dashboard',
  'property-opportunities': 'opportunities',
  productivity: 'tasks',
  'pipeline-overview': 'meetings',
  'binghatti-attribution': 'eois',
  'acquisition-performance': 'campaigns',
  'advisor-performance': 'reports',
  'ai-queue': 'automations'
});

export function resolveCrmRoute(hash = '') {
  const requested = String(hash).replace(/^#/, '').trim().toLowerCase();
  const route = CRM_ROUTE_ALIASES[requested] || requested;
  return CRM_ROUTES.includes(route) ? route : DEFAULT_CRM_ROUTE;
}

export function applyCrmRoute(crm, hash, role) {
  const route = resolveCrmRoute(hash);
  crm.dataset.activeRoute = route;
  crm.querySelectorAll('[data-crm-screen]').forEach(screen => {
    const visible = screen.dataset.crmScreen.split(/\s+/).includes(route)
      && (route !== 'projects' || role === 'SUPER_ADMIN');
    screen.classList.toggle('hidden', !visible);
    screen.toggleAttribute('aria-hidden', !visible);
  });
  crm.querySelectorAll('.crm-nav a[data-crm-route]').forEach(link => {
    link.toggleAttribute('aria-current', link.dataset.crmRoute === route);
  });
  return route;
}
