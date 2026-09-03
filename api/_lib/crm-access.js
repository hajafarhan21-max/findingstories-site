import { authenticate, isSameOrigin } from './auth.js';
import { database } from './db.js';
import { json } from './http.js';
import { hasPermission, visibleUserIds } from './rbac.js';

export async function authorize(req,res,resource,action,{mutation=false}={}) {
  if (mutation && !isSameOrigin(req)) { json(res,403,{error:'Same-origin request required.'}); return null; }
  const sql=database(); const identity=await authenticate(req,sql);
  if (!identity) { json(res,401,{error:'Authentication required.'}); return null; }
  if (!await hasPermission(sql,identity,resource,action)) { json(res,403,{error:'Permission denied.'}); return null; }
  return {sql,identity,visibleIds:await visibleUserIds(sql,identity)};
}

export function ownerVisible(access,ownerId) {
  return access.visibleIds===null || (ownerId && access.visibleIds.includes(ownerId));
}
