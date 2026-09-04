export const PROJECTS_HASH = '#projects';

export function isProjectsRoute(hash) {
  return hash === PROJECTS_HASH;
}

export function applyCrmRoute(crm, hash, role) {
  const projects = isProjectsRoute(hash);
  crm.classList.toggle('projects-workspace', projects);
  const workspace = crm.querySelector('#project-ingestion');
  workspace.classList.toggle('hidden', role !== 'SUPER_ADMIN' || !projects);
  crm.querySelectorAll('.crm-nav a').forEach(link => link.toggleAttribute('aria-current', link.hash === hash));
}
