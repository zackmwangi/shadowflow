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
    const { task_id, title_enriched, description_enriched } = body

    if (!task_id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    // Update the task with enriched data
    const { data: task, error } = await supabase
      .from('todo_tasks')
      .update({
        title_enriched: title_enriched || null,
        description_enriched: description_enriched || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task_id)
      .select(`
        *,
        todo_users!inner(
          id,
          email,
          telegram_id,
          first_name,
          last_name
        )
      `)
      .single()

    if (error) {
      console.error('Error updating task with enriched data:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('Task enriched successfully:', { taskId: task_id, title: task.title })

    // Send Telegram notification if user has linked Telegram account
    if (task.todo_users?.telegram_id) {
      try {
        console.log('Sending Telegram notification for task enrichment:', {
          taskId: task_id,
          telegramId: task.todo_users.telegram_id,
          userEmail: task.todo_users.email
        })

        await fetch(process.env.N8N_TO_TELEGRAM_NOTIFICATION_WEBHOOK_URL || 'http://localhost:5678/webhook/telegram-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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

        console.log('Telegram notification sent successfully for task enrichment')
      } catch (n8nError) {
        console.error('Failed to send Telegram notification for task enrichment:', n8nError)
        // Don't fail the request if n8n notification is not available
      }
    } else {
      console.log('No Telegram account linked for user, skipping notification')
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error in n8n webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
