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
    const { title, telegram_id } = body

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 })
    }

    if (!telegram_id || typeof telegram_id !== 'string') {
      return NextResponse.json({ error: 'Telegram ID is required' }, { status: 400 })
    }

    // Find the user by telegram_id
    const { data: user, error: userError } = await supabase
      .from('todo_users')
      .select('id, email')
      .eq('telegram_id', telegram_id)
      .single()

    if (userError || !user) {
      console.error('Telegram task creation - User not found:', { telegram_id, error: userError?.message })
      return NextResponse.json({ error: 'User not found with this Telegram ID' }, { status: 404 })
    }

    console.log('Telegram task creation - User found:', { telegram_id, userId: user.id, email: user.email })

    // Create the task
    const { data: task, error } = await supabase
      .from('todo_tasks')
      .insert({
        user_id: user.id,
        title: title.trim(),
        is_completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Telegram task creation - Database error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('Telegram task creation - Task created successfully:', { taskId: task.id, title: task.title, userId: user.id })

    // Trigger n8n workflow for task enrichment
    try {
              await fetch(process.env.N8N_ENRICHMENT_WEBHOOK_URL || 'http://localhost:5678/webhook/task-enrichment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: task.id,
          title: task.title,
          user_id: user.id,
          source: 'telegram', // Indicate this task was created via Telegram
        }),
      })
    } catch (n8nError) {
      console.error('Failed to trigger n8n workflow for Telegram task:', n8nError)
      // Don't fail the request if n8n is not available
    }

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Telegram task creation - Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
