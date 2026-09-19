import { readFile } from 'node:fs/promises'

// Uses the deployment credential already held by GitHub Actions. Never logs it.
// Explicit release list: diagnostic temp_ migrations must never reach production.
const plan = JSON.parse(await readFile(new URL('../supabase/releases/reliability-20260919.json', import.meta.url), 'utf8'))
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) throw new Error('Secret SUPABASE_ACCESS_TOKEN manquant dans GitHub Actions')
if (plan.projectRef !== 'gamumybcoxxanhjakpde') throw new Error('Projet inattendu')

const sql = []
for (const name of plan.migrations) {
  if (!/^\d{14}_[a-z_]+\.sql$/.test(name) || name.includes('temp_')) throw new Error('Migration refusée')
  sql.push(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'))
}
// All four reviewed migrations are idempotent. Apply them atomically so storage
// cannot be exposed with a half-installed policy set.
const response = await fetch(`https://api.supabase.com/v1/projects/${plan.projectRef}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `BEGIN;\nSET LOCAL lock_timeout = '15s';\n${sql.join('\n')}\nNOTIFY pgrst, 'reload schema';\nCOMMIT;` }),
  signal: AbortSignal.timeout(120000),
})
if (!response.ok) {
  throw new Error(`Migration Supabase refusée (HTTP ${response.status}): ${(await response.text()).slice(0, 1000)}`)
}
console.log(`Migrations appliquées : ${plan.migrations.join(', ')}`)
