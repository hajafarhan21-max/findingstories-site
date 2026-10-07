import newsletter from './_lib/newsletter-route.js';
import searchConsole from './_lib/search-console-route.js';
import events from './_lib/acquisition-events.js';
import page from './_lib/acquisition-page.js';
import sitemap from './_lib/acquisition-sitemap.js';
import robots from './_lib/robots.js';
import aziziFlorence from './_lib/azizi-florence-page.js';
import aziziFlorenceMedia from './_lib/azizi-florence-media.js';
import { json, method } from './_lib/http.js';
import { PUBLISHED_PROJECTS } from '../platform/catalog.js';
import { matchInvestorBrief, discoveryLeadPayload } from '../platform/investor-discovery.js';

const clean=value=>typeof value==='string'?value.trim():'';
function investorDiscovery(req,res){if(!method(req,res,['GET']))return;const brief={intent:clean(req.query?.intent),budget:clean(req.query?.budget),emirate:clean(req.query?.emirate),propertyType:clean(req.query?.propertyType),bedrooms:clean(req.query?.bedrooms),status:clean(req.query?.status),timeframe:clean(req.query?.timeframe),query:clean(req.query?.query)};const matches=matchInvestorBrief(brief,PUBLISHED_PROJECTS).slice(0,12).map(project=>({...project,lead:discoveryLeadPayload(brief,project)}));return json(res,200,{ok:true,brief,count:matches.length,matches,governance:{availability:'Commercial details and current availability require confirmation.',catalogue:'Only published Finding Stories project guides are ranked.'}});}
export default function handler(req,res){const route=req.query?.route;if(route==='newsletter')return newsletter(req,res);if(route==='events')return events(req,res);if(route==='azizi-florence')return aziziFlorence(req,res);if(route==='azizi-media')return aziziFlorenceMedia(req,res);if(route==='page')return page(req,res);if(route==='sitemap')return sitemap(req,res);if(route==='robots')return robots(req,res);if(route==='search-console')return searchConsole(req,res);if(route==='investor-discovery')return investorDiscovery(req,res);res.statusCode=404;return res.end('Not found');}
