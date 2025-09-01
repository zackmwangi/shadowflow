import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // Get the session from the request headers
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's current telegram_id
    const { data: userData, error: userError } = await supabase
      .from('todo_users')
      .select('telegram_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!userData.telegram_id) {
      return NextResponse.json({ error: 'No Telegram account linked' }, { status: 400 })
    }

    const telegramId = userData.telegram_id

    // Remove telegram_id from user
    const { error: updateError } = await supabase
      .from('todo_users')
      .update({ 
        telegram_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to unlink Telegram' }, { status: 500 })
    }

    // Delete any unused integration codes for this user
    await supabase
      .from('telegram_integration_codes')
      .delete()
      .eq('user_email', user.email)
      .is('used_at', null)

    console.log('Telegram unlinked successfully:', { email: user.email, telegramId })

    // Trigger n8n notification workflow for unlink (optional)
    try {
      await fetch(process.env.N8N_TO_TELEGRAM_NOTIFICATION_WEBHOOK_URL || 'http://localhost:5678/webhook/telegram-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          telegram_id: telegramId,
          action: 'integration_removed',
          telegram_message: process.env.TELEGRAM_MSG_BOT_UNLINK
        }),
      })
    } catch (n8nError) {
      console.error('Failed to trigger n8n notification:', n8nError)
      // Don't fail the request if n8n is not available
    }

    return NextResponse.json({ 
      success: true,
      message: 'Telegram account unlinked successfully'
    })
  } catch (error) {
    console.error('Telegram unlink error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

