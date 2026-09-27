import { PUBLISHED_PROJECTS } from './catalog.js';

const text = value => String(value ?? '').trim().toLowerCase();
const list = value => Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
const money = value => {
  const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const haystack = project => [
  project.name, project.developer, project.area, project.emirate, project.launchStatus,
  project.summary, project.snapshot?.overview, project.snapshot?.locationNarrative,
  ...(project.propertyTypes || []), ...(project.unitTypes || []), ...(project.bedrooms || [])
].filter(Boolean).join(' ').toLowerCase();

export const INVESTOR_DISCOVERY_FILTERS = Object.freeze({
  intent: ['investment', 'end-use'],
  status: ['new-launches', 'pre-launch', 'off-plan', 'under-construction', 'ready', 'resale'],
  emirate: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah', 'Umm Al Quwain'],
  propertyType: ['apartments', 'villas', 'townhouses', 'penthouses', 'duplexes', 'branded-residences', 'plots', 'commercial', 'office-spaces', 'retail']
});

export function matchInvestorBrief(brief = {}, projects = PUBLISHED_PROJECTS) {
  const budget = money(brief.budget);
  const bedrooms = list(brief.bedrooms).map(text);
  const emirates = list(brief.emirate).map(text);
  const propertyTypes = list(brief.propertyType).map(text);
  const statuses = list(brief.status).map(text);
  const query = text(brief.query);

  return projects.map(project => {
    const reasons = [];
    let score = 0;
    const projectPrice = money(project.startingPrice);
    const projectBedrooms = (project.bedrooms || []).map(text);
    const projectTypes = (project.propertyTypeSlugs || []).map(text);

    if (budget != null && projectPrice != null) {
      if (projectPrice <= budget) { score += 30; reasons.push('Within stated budget'); }
      else return null;
    }
    if (emirates.length) {
      if (emirates.includes(text(project.emirate))) { score += 20; reasons.push(`Matches ${project.emirate}`); }
      else return null;
    }
    if (propertyTypes.length) {
      if (propertyTypes.some(type => projectTypes.includes(type))) { score += 20; reasons.push('Matches property type'); }
      else return null;
    }
    if (bedrooms.length) {
      if (bedrooms.some(bedroom => projectBedrooms.includes(bedroom))) { score += 15; reasons.push('Matches bedroom brief'); }
      else return null;
    }
    if (statuses.length) {
      if (statuses.includes(text(project.statusSlug))) { score += 10; reasons.push('Matches lifecycle preference'); }
      else return null;
    }
    if (query) {
      if (haystack(project).includes(query)) { score += 10; reasons.push('Matches search brief'); }
      else return null;
    }
    if (brief.intent) {
      score += 5;
      reasons.push(text(brief.intent) === 'end-use' ? 'Suitable for end-use review' : 'Suitable for investment review');
    }

    return {
      slug: project.slug,
      path: project.path,
      name: project.name,
      developer: project.developer,
      area: project.area,
      emirate: project.emirate,
      statusSlug: project.statusSlug,
      propertyTypes: project.propertyTypes,
      bedrooms: project.bedrooms,
      startingPrice: project.startingPrice,
      handover: project.handover,
      currentAvailability: project.currentAvailability,
      score,
      reasons,
      commercialVerificationRequired: project.currentAvailability !== 'VERIFIED'
    };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function discoveryLeadPayload(brief = {}, project = null) {
  return Object.freeze({
    source: 'INVESTOR_DISCOVERY',
    intent: brief.intent || null,
    budget: money(brief.budget),
    emirate: brief.emirate || null,
    propertyType: brief.propertyType || null,
    bedrooms: brief.bedrooms || null,
    status: brief.status || null,
    timeframe: brief.timeframe || null,
    projectSlug: project?.slug || null,
    projectName: project?.name || null,
    consent: brief.consent === true,
    requiresAvailabilityConfirmation: project ? project.currentAvailability !== 'VERIFIED' : true
  });
}
