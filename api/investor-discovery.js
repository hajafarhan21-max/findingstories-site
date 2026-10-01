import { json, method } from './_lib/http.js';
import { PUBLISHED_PROJECTS } from '../platform/catalog.js';
import { matchInvestorBrief, discoveryLeadPayload } from '../platform/investor-discovery.js';

const clean=value=>typeof value==='string'?value.trim():'';
export default async function handler(req,res){
  if(!method(req,res,['GET']))return;
  const brief={
    intent:clean(req.query?.intent),budget:clean(req.query?.budget),emirate:clean(req.query?.emirate),
    propertyType:clean(req.query?.propertyType),bedrooms:clean(req.query?.bedrooms),status:clean(req.query?.status),
    timeframe:clean(req.query?.timeframe),query:clean(req.query?.query)
  };
  const matches=matchInvestorBrief(brief,PUBLISHED_PROJECTS).slice(0,12).map(project=>({
    ...project,lead:discoveryLeadPayload(brief,project)
  }));
  return json(res,200,{ok:true,brief,count:matches.length,matches,governance:{availability:'Commercial details and current availability require confirmation.',catalogue:'Only published Finding Stories project guides are ranked.'}});
}
