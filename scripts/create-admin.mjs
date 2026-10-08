import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const username = (process.env.ADMIN_USERNAME || '').trim()
const password = process.env.ADMIN_PASSWORD || ''
const displayName = (process.env.ADMIN_DISPLAY_NAME || username).trim()
const email = (process.env.ADMIN_EMAIL || `${username || 'admin'}@km11.local`).trim().toLowerCase()

if (!url || !serviceKey || !username || password.length < 8) {
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USERNAME, ADMIN_PASSWORD (min 8 chars). Optional: ADMIN_EMAIL.')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

let userId
const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listError) throw listError
const existing = list.users.find(u => (u.email || '').toLowerCase() === email)

if (existing) {
  userId = existing.id
  const { error } = await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true })
  if (error) throw error
} else {
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error || new Error('Failed creating auth user')
  userId = data.user.id
}

const { error: upsertError } = await supabase.from('admins').upsert({
  username,
  display_name: displayName,
  auth_email: email,
  auth_user_id: userId,
  active: true
}, { onConflict: 'username' })
if (upsertError) throw upsertError

console.log(`Admin ready: ${displayName} / ${username} (${email})`)
