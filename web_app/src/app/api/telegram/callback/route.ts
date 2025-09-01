import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const body = await request.json()
    const { email, telegram_id, code } = body

    // Validate required fields
    if (!email || !telegram_id || !code) {
      return NextResponse.json({ 
        error: 'Missing required fields: email, telegram_id, code' 
      }, { status: 400 })
    }

    console.log('Telegram callback received:', { email, telegram_id, code })

    // Find the integration code
    const { data: integrationCode, error: codeError } = await supabase
      .from('telegram_integration_codes')
      .select('*')
      .eq('user_email', email)
      .eq('code', code)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (codeError || !integrationCode) {
      console.log('Invalid or expired code:', { email, code, error: codeError?.message })
      return NextResponse.json({ 
        error: 'Invalid or expired integration code' 
      }, { status: 400 })
    }

    // Find the user
    const { data: user, error: userError } = await supabase
      .from('todo_users')
      .select('*')
      .eq('email', email)
      .single()

    if (userError || !user) {
      console.log('User not found:', { email, error: userError?.message })
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 })
    }

    // Update user with telegram_id
    const { error: updateError } = await supabase
      .from('todo_users')
      .update({ 
        telegram_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating user:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update user' 
      }, { status: 500 })
    }

    // Delete the used integration code for cleanup
    const { error: codeDeleteError } = await supabase
      .from('telegram_integration_codes')
      .delete()
      .eq('id', integrationCode.id)

    if (codeDeleteError) {
      console.error('Error deleting code:', codeDeleteError)
      // Don't fail the request, but log the error
    }

    console.log('Telegram integration successful:', { email, telegram_id })

    // Trigger n8n notification workflow (optional)
    try {
      await fetch(process.env.N8N_TO_TELEGRAM_NOTIFICATION_WEBHOOK_URL || 'http://localhost:5678/webhook/telegram-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          telegram_id,
          action: 'integration_successful',
          telegram_message: process.env.TELEGRAM_MSG_BOT_WELCOME
        }),
      })
    } catch (n8nError) {
      console.error('Failed to trigger n8n notification:', n8nError)
      // Don't fail the request if n8n is not available
    }

    return NextResponse.json({ 
      success: true,
      message: 'Telegram integration successful'
    })
  } catch (error) {
    console.error('Telegram callback error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

