import { database,ensureSchema } from '../api/_lib/db.js';
import { activateBinghattiInventory } from '../api/_lib/binghatti-import.js';
await ensureSchema();const sql=database();
const result=await activateBinghattiInventory(sql);
console.log(JSON.stringify({activated:result.activated,already_activated:result.already_activated,verified:result.verified,records:result.records},null,2));
