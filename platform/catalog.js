export const PLATFORM_ROUTES = Object.freeze([
  '/', '/projects', '/new-launches', '/pre-launch', '/recently-launched', '/ready-properties',
  '/areas', '/areas/sharjah', '/developers', '/developers/azizi-developments',
  '/property-types', '/property-types/townhouses', '/property-types/villas',
  '/compare', '/services/private-buyer-advisory', '/services/mortgage-solutions',
  '/services/equity-solutions', '/insights'
]);

export const DISCOVERY_GROUPS = Object.freeze({
  statuses: [
    { slug: 'new-launches', label: 'New launches', description: 'Reviewed launch opportunities with published, source-backed project information.' },
    { slug: 'pre-launch', label: 'Pre-launch / EOI', description: 'Early-stage opportunities where the enquiry process and unknowns are stated clearly.' },
    { slug: 'recently-launched', label: 'Recently launched', description: 'Recently released projects that have passed Finding Stories’ publication checks.' },
    { slug: 'ready-properties', label: 'Ready / near ready', description: 'Published opportunities with a verified completion position.' }
  ],
  areas: [{ slug: 'sharjah', label: 'Sharjah', description: 'Explore our currently published, verified project guide in Sharjah.' }],
  developers: [{ slug: 'azizi-developments', label: 'Azizi Developments', description: 'View the approved Azizi project guide currently published by Finding Stories.' }],
  propertyTypes: [
    { slug: 'townhouses', label: 'Townhouses', description: 'Compare published townhouse opportunities by location, configuration and verified commercial facts.' },
    { slug: 'villas', label: 'Villas', description: 'Discover published villa opportunities with a buyer-focused view of the facts.' }
  ]
});

export const PUBLISHED_PROJECTS = Object.freeze([{
  slug: 'azizi-florence', path: '/azizi-florence', name: 'Azizi Florence', developer: 'Azizi Developments',
  developerSlug: 'azizi-developments', area: 'Sharjah', areaSlug: 'sharjah', emirate: 'Sharjah',
  launchStatus: 'Pre-launch', statusSlug: 'pre-launch', propertyTypes: ['Townhouses', 'Villas'],
  propertyTypeSlugs: ['townhouses', 'villas'], bedrooms: ['3 bedroom', '4 bedroom', '5 bedroom', '6 bedroom'],
  image: '/assets/azizi-florence/hero.webp', imageAlt: 'Azizi Florence townhouse and villa community exterior',
  summary: 'A buyer-focused guide to the published residence mix, location context and process for requesting current details.',
  startingPrice: null, handover: null, paymentPlan: 'Request the current verified milestone schedule',
  suitability: 'For buyers considering townhouse or villa living in Sharjah; individual suitability requires an advisor review.',
  verifiedHighlights: ['3 and 4 bedroom townhouses', '4, 5 and 6 bedroom villas', 'Verified information is reconfirmed before commitment'],
  verification: { status: 'PUBLISHED', lastReviewed: '2026-08-26', source: 'Approved project manifest and production records', confidence: 'verified', pendingFields: ['Current unit availability', 'Release-specific commercial terms'] }
}]);

export const SERVICE_PAGES = Object.freeze({
  'private-buyer-advisory': { title: 'Private Buyer Advisory', eyebrow: 'DECISIONS WITH PERSPECTIVE', description: 'A considered, private process for defining your brief, comparing published opportunities and deciding what deserves a closer look.', points: ['Requirement and objective discovery', 'Fact-led project comparison', 'Clear next-step coordination'] },
  'mortgage-solutions': { title: 'Mortgage Solutions', eyebrow: 'PARTNER-LED ASSISTANCE', description: 'Discover potential mortgage routes and request an introduction to an appropriate, independently verified provider.', points: ['Requirement discovery', 'Document-readiness guidance', 'Introductions where an appropriate provider is available'] },
  'equity-solutions': { title: 'Equity Solutions', eyebrow: 'EXPLORE YOUR OPTIONS', description: 'Discuss whether an existing property may support your wider plans, with any regulated product handled by an appropriately authorised third party.', points: ['Initial objective discovery', 'Questions to prepare for a provider', 'Partner-led next steps where available'] }
});

export function projectsFor({ status, area, developer, propertyType } = {}) {
  return PUBLISHED_PROJECTS.filter(project => (!status || project.statusSlug === status) && (!area || project.areaSlug === area) && (!developer || project.developerSlug === developer) && (!propertyType || project.propertyTypeSlugs.includes(propertyType)));
}
