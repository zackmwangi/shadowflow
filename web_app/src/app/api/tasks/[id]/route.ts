import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Get the session from the request headers
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('API PUT /tasks/[id] - No Bearer token in Authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    console.log('API PUT /tasks/[id] - Auth check:', { 
      hasUser: !!user, 
      authError: authError?.message,
      userId: user?.id
    })
    
    if (authError || !user) {
      console.log('API PUT /tasks/[id] - Unauthorized:', { authError: authError?.message })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, is_completed } = body

    // Validate the task belongs to the user
    const { data: existingTask, error: fetchError } = await supabase
      .from('todo_tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Update the task
    const updateData: {
      updated_at: string;
      title?: string;
      is_completed?: boolean;
    } = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) {
      updateData.title = title.trim()
    }

    if (is_completed !== undefined) {
      updateData.is_completed = is_completed
    }

    const { data: task, error } = await supabase
      .from('todo_tasks')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(task)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Get the session from the request headers
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('API DELETE /tasks/[id] - No Bearer token in Authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    console.log('API DELETE /tasks/[id] - Auth check:', { 
      hasUser: !!user, 
      authError: authError?.message,
      userId: user?.id
    })
    
    if (authError || !user) {
      console.log('API DELETE /tasks/[id] - Unauthorized:', { authError: authError?.message })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate the task belongs to the user
    const { data: existingTask, error: fetchError } = await supabase
      .from('todo_tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Delete the task
    const { error } = await supabase
      .from('todo_tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
