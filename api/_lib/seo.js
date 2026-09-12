export const CANONICAL_ORIGIN='https://www.finding-stories.com';
export const SITEMAP_PATH='/sitemap.xml';

export function canonicalUrl(path='/'){
  const pathname=`/${String(path).split(/[?#]/,1)[0].replace(/^\/+|\/+$/g,'')}`;
  return `${CANONICAL_ORIGIN}${pathname==='/'?'/':pathname}`;
}

export function isPreviewDeployment(env=process.env){
  return env.VERCEL_ENV?env.VERCEL_ENV!=='production':env.NODE_ENV==='production'&&Boolean(env.VERCEL_URL)&&env.VERCEL_URL!=='www.finding-stories.com';
}

export function sitemapXml(paths){
  const urls=[...new Set(paths)].map(canonicalUrl);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url=>`  <url><loc>${url.replaceAll('&','&amp;')}</loc></url>`).join('\n')}\n</urlset>\n`;
}
