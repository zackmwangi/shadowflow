import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    const body = await request.json()
    const { task_id, user_id, title_enriched, description_enriched } = body

    if (!task_id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    // Update the task with enriched data
    const { data: task, error: updateError } = await supabase
      .from('todo_tasks')
      .update({
        title_enriched: title_enriched || null,
        description_enriched: description_enriched || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task_id)
      .eq('user_id', user_id)
      .select(`
        *,
        todo_users (
          telegram_id,
          email
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating task with enriched data:', updateError)
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }

    console.log('Task enriched successfully:', { task_id, title_enriched, description_enriched })

    // Send Telegram notification if user has linked Telegram account
    if (task.todo_users?.telegram_id) {
      try {
        await fetch(process.env.N8N_TO_TELEGRAM_NOTIFICATION_WEBHOOK_URL || 'http://localhost:5678/webhook/telegram-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: task.todo_users.telegram_id,
            email: task.todo_users.email,
            action: 'task_enrichment_completed',
            task_id: task_id,
            task_title: task.title,
            title_enriched: title_enriched,
            description_enriched: description_enriched,
            telegram_message: process.env.TELEGRAM_MSG_ENRICH_DONE || 'Your task has been enriched with helpful suggestions!'
          }),
        })
      } catch (n8nError) {
        console.error('Failed to send Telegram notification:', n8nError)
        // Don't fail the request if Telegram notification fails
      }
    } else {
      console.log('No Telegram account linked for user:', task.todo_users?.email)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Task enriched successfully',
      task_id,
      title_enriched,
      description_enriched
    })
  } catch (error) {
    console.error('n8n enrichment callback error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
