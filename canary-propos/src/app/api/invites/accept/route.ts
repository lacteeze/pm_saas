// src/app/api/invites/accept/route.ts
// POST /api/invites/accept — links a newly-signed-up user to their invite (ORGS-02, T-06-02)
// Uses admin client to bypass RLS for the update.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  token: z.string().uuid('Invalid token format'),
  userId: z.string().uuid('Invalid user ID'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }

  const { token, userId, firstName, lastName } = parsed.data
  const admin = createAdminClient()

  // Fetch the invite — must be unaccepted (T-06-02: single-use enforcement)
  const { data: person, error: fetchError } = await admin
    .from('people')
    .select('id, invite_accepted_at')
    .eq('invite_token', token)
    .single()

  if (fetchError || !person) {
    return NextResponse.json({ error: 'Invite not found.' }, { status: 404 })
  }

  if (person.invite_accepted_at) {
    return NextResponse.json({ error: 'Invite already accepted.' }, { status: 410 })
  }

  // Mark invite accepted + link user_id
  const { error: updateError } = await admin
    .from('people')
    .update({
      user_id: userId,
      invite_accepted_at: new Date().toISOString(),
      active: true,
      first_name: firstName ?? null,
      last_name: lastName ?? null,
    })
    .eq('id', person.id)

  if (updateError) {
    console.error('[accept invite] update error:', updateError)
    return NextResponse.json({ error: 'Failed to accept invite.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
