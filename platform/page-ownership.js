/**
 * Build ownership is deny-by-default for bespoke experiences. Generic generators
 * must consult this registry before writing a route or its route-owned assets.
 */
export const PAGE_OWNERSHIP=Object.freeze({
  '/azizi-florence':Object.freeze({
    kind:'PROTECTED_BESPOKE',
    renderer:'api/_lib/azizi-florence.js',
    handler:'api/_lib/azizi-florence-page.js',
    styles:'public/azizi-florence.css',
    script:'public/azizi-florence.js',
    assets:'public/assets/azizi-florence',
    restorationSource:'e24bf57'
  })
});

export function assertGeneratorOwnsRoute(route,generator='generic platform generator'){
  const ownership=PAGE_OWNERSHIP[route];
  if(ownership?.kind==='PROTECTED_BESPOKE')throw new Error(`${generator} cannot write protected route ${route}; use its bespoke renderer`);
  return true;
}

export function assertGeneratorOutputPath(path,generator='generic platform generator'){
  const normalized=String(path).replaceAll('\\','/').replace(/^\.\//,'');
  const protectedPaths=Object.values(PAGE_OWNERSHIP).flatMap(owner=>[owner.renderer,owner.handler,owner.styles,owner.script,owner.assets]);
  if(protectedPaths.some(item=>normalized===item||normalized.startsWith(`${item}/`)))throw new Error(`${generator} cannot write protected output ${normalized}`);
  return true;
}
