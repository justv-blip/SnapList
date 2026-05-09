import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// eBay Marketplace Account Deletion notification handler
// Required by eBay Developer Program for all production apps that persist eBay user data
// https://developer.ebay.com/marketplace-account-deletion

// GET — challenge handshake so eBay can verify this endpoint
export async function GET(req: NextRequest) {
  const challengeCode = req.nextUrl.searchParams.get('challenge_code')

  if (!challengeCode) {
    return NextResponse.json({ error: 'Missing challenge_code' }, { status: 400 })
  }

  const verificationToken = process.env.EBAY_DELETION_VERIFICATION_TOKEN
  const endpoint = process.env.EBAY_DELETION_ENDPOINT ??
    'https://snaplist.gg/api/ebay/account-deletion'

  if (!verificationToken) {
    console.error('[ebay/account-deletion] Missing EBAY_DELETION_VERIFICATION_TOKEN')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  // eBay requires: SHA-256(challengeCode + verificationToken + endpoint)
  const hash = createHmac('sha256', verificationToken)
    .update(challengeCode + verificationToken + endpoint)
    .digest('hex')

  return NextResponse.json({ challengeResponse: hash })
}

// POST — actual deletion notification from eBay
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // eBay sends: { metadata: { topic }, notification: { data: { username, userId, eiasToken } } }
    const topic = body?.metadata?.topic
    const userData = body?.notification?.data

    if (topic !== 'MARKETPLACE_ACCOUNT_DELETION' || !userData) {
      return NextResponse.json({ received: true })
    }

    const { userId, username } = userData

    console.log(`[ebay/account-deletion] Received deletion request for eBay user: ${username} (${userId})`)

    // Delete all eBay tokens associated with this eBay user ID
    // The ebay_tokens table stores the eBay user ID in the ebay_user_id column
    const { error: tokenError } = await supabase
      .from('ebay_tokens')
      .delete()
      .eq('ebay_user_id', userId)

    if (tokenError) {
      console.error('[ebay/account-deletion] Error deleting tokens:', tokenError)
      // Still return 200 — eBay will retry on non-2xx, but we log the error
    } else {
      console.log(`[ebay/account-deletion] Deleted tokens for eBay user ${userId}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[ebay/account-deletion] Error processing deletion:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
