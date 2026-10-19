import fs from 'node:fs/promises';
import {q,pool,root} from '../server/db.js';
import {passwordHash} from '../server/auth.js';
const command=process.argv[2];
if(command==='setup-token'){if((await q('SELECT 1 FROM users LIMIT 1')).rowCount)throw new Error('Setup has already been claimed');console.log((await fs.readFile(`${root}/config/setup-token`,'utf8')).trim());}
else if(command==='reset-password'){const email=process.argv[3]?.toLowerCase();let value='';for await(const chunk of process.stdin)value+=chunk;value=value.trim();if(value.length<12||value.length>128)throw new Error('Provide a 12–128 character password on stdin');const result=await q('UPDATE users SET password=$2 WHERE email=$1 RETURNING id',[email,await passwordHash(value)]);if(!result.rowCount)throw new Error('Account not found');await q('DELETE FROM sessions WHERE user_id=$1',[result.rows[0].id]);await q("INSERT INTO audit_events(user_id,event) VALUES($1,'local_password_recovery')",[result.rows[0].id]);console.log('Password changed; all account sessions revoked.');}
else throw new Error('Commands: setup-token | reset-password <email> (password on stdin)');
await pool.end();
