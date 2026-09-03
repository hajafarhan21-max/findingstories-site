import { authorize } from '../crm-access.js';
import { json,method } from '../http.js';
export default async function handler(req,res){
  if(!method(req,res,['GET']))return; const access=await authorize(req,res,'leads','view'); if(!access)return;
  const permissions=await access.sql`SELECT resource,action FROM crm_role_permissions WHERE role=${access.identity.role} ORDER BY resource,action`;
  json(res,200,{user:access.identity,permissions,scope:access.visibleIds===null?'all':'hierarchy'});
}
