import { CANONICAL_ORIGIN } from '../api/_lib/seo.js';

const alternateOrigin='https://finding-stories.com';
const request=async(url,redirect='follow')=>fetch(url,{redirect,headers:{'user-agent':'FindingStories-SEO-Check/1.0'}});
const directCanonical=await request(`${CANONICAL_ORIGIN}/`,'manual');
if(directCanonical.status!==200)throw new Error(`Canonical host returned ${directCanonical.status}, expected 200`);
const alternate=await request(`${alternateOrigin}/`,'manual');
if(![301,302,307,308].includes(alternate.status))throw new Error(`Alternate host returned ${alternate.status}, expected redirect`);
if(new URL(alternate.headers.get('location'),alternateOrigin).origin!==CANONICAL_ORIGIN)throw new Error(`Alternate host does not redirect to ${CANONICAL_ORIGIN}`);

const get=async path=>{const response=await request(`${CANONICAL_ORIGIN}${path}`);if(!response.ok)throw new Error(`${path} returned ${response.status}`);if(new URL(response.url).origin!==CANONICAL_ORIGIN)throw new Error(`${path} escaped the canonical host`);return response.text();};
const [sitemap,robots,florence]=await Promise.all([get('/sitemap.xml'),get('/robots.txt'),get('/azizi-florence')]);
const canonical=florence.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
if(!sitemap.includes(`<loc>${CANONICAL_ORIGIN}/azizi-florence</loc>`))throw new Error('Sitemap does not contain canonical Florence URL');
if(!robots.includes(`Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`))throw new Error('robots.txt canonical sitemap is incorrect');
if(canonical!==`${CANONICAL_ORIGIN}/azizi-florence`)throw new Error(`Florence canonical is incorrect: ${canonical||'missing'}`);
if(/noindex/i.test(florence))throw new Error('Production Florence is noindex');
console.log(`SEO verification passed: ${alternateOrigin} redirects to ${CANONICAL_ORIGIN}, the direct 200 host.`);
