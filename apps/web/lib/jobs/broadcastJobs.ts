import { createAdminClient } from '@/lib/supabase/admin'

type JobRow = {
  user_id: string
  title: string
  company: string
  location: string
  salary_range: string | null
  remote: boolean
  url: string
  match_score: number
  tags: string[]
  source: string
  source_name: string | null
  snippet: string | null
  experience_required: string | null
  contact: string | null
  raw_message: string | null
  poster_name?: string | null
  message_fingerprint: string | null
  found_at: string
}

/**
 * Insert `rows` (already saved for the scanning user) for every other user
 * in the system, skipping any fingerprints they already have.
 */
export async function broadcastJobsToAllUsers(
  scanningUserId: string,
  rows: JobRow[]
): Promise<void> {
  if (rows.length === 0) return

  const admin = createAdminClient()

  // Get all user IDs except the scanning user
  const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error || !users) return

  const otherUserIds = users.users
    .map(u => u.id)
    .filter(id => id !== scanningUserId)

  if (otherUserIds.length === 0) return

  const fingerprints = rows.map(r => r.message_fingerprint).filter(Boolean) as string[]

  // For each other user, skip fingerprints they already have
  for (const userId of otherUserIds) {
    const { data: existing } = await admin
      .from('job_opportunities')
      .select('message_fingerprint')
      .eq('user_id', userId)
      .in('message_fingerprint', fingerprints)

    const existingSet = new Set((existing ?? []).map(r => r.message_fingerprint))

    const newRows = rows
      .filter(r => !r.message_fingerprint || !existingSet.has(r.message_fingerprint))
      .map(r => ({ ...r, user_id: userId, match_score: 50 })) // neutral score for other users

    if (newRows.length === 0) continue

    await admin
      .from('job_opportunities')
      .upsert(newRows, { onConflict: 'user_id,message_fingerprint', ignoreDuplicates: true })
  }
}
