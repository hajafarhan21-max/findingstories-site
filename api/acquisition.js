import events from './_lib/acquisition-events.js';
import page from './_lib/acquisition-page.js';
import sitemap from './_lib/acquisition-sitemap.js';
export default function handler(req,res){const route=req.query?.route;if(route==='events')return events(req,res);if(route==='page')return page(req,res);if(route==='sitemap')return sitemap(req,res);res.statusCode=404;return res.end('Not found');}
