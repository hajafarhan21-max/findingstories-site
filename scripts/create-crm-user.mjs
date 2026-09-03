import { database } from '../api/_lib/db.js'; import { hashPassword } from '../api/_lib/password.js'; import { ROLES } from '../api/_lib/rbac.js';
const [email,name,role='SUPER_ADMIN']=process.argv.slice(2); const password=process.env.CRM_USER_PASSWORD;
if(!email||!name||!ROLES.includes(role)||!password)throw new Error('Usage: CRM_USER_PASSWORD=... node scripts/create-crm-user.mjs <email> <display-name> [role]');
const sql=database(), passwordHash=await hashPassword(password);
const rows=await sql`INSERT INTO crm_users(email,display_name,role,password_hash) VALUES(${email.toLowerCase()},${name},${role},${passwordHash}) ON CONFLICT(lower(email)) DO UPDATE SET display_name=EXCLUDED.display_name,role=EXCLUDED.role,password_hash=EXCLUDED.password_hash,active=TRUE,password_changed_at=NOW(),updated_at=NOW() RETURNING id,email,display_name,role`;
console.log(JSON.stringify(rows[0]));
