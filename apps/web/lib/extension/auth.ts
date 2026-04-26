import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractBearerToken, verifyExtensionToken } from './token'

export type AuthUser = { id: string; email: string }

/**
 * Resolves the authenticated user from either:
 *  - Bearer token (extension requests)
 *  - Supabase session cookie (web app requests)
 */
export async function resolveUser(req: NextRequest): Promise<AuthUser | null> {
  const bearer = extractBearerToken(req.headers.get('authorization'))
  if (bearer) {
    const payload = await verifyExtensionToken(bearer)
    if (!payload) return null
    return { id: payload.userId, email: payload.email }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return { id: user.id, email: user.email ?? '' }
}
