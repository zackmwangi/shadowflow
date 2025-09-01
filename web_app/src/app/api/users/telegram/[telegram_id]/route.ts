import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ telegram_id: string }> }
) {
  try {
    const { telegram_id } = await params
    
    if (!telegram_id) {
      return NextResponse.json({ error: 'Telegram ID is required' }, { status: 400 })
    }

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

    // Query the todo_users table for a user with the specified telegram_id
    const { data: user, error } = await supabase
      .from('todo_users')
      .select('*')
      .eq('telegram_id', telegram_id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No user found with this telegram_id
        return NextResponse.json({
          id: "",
          email: "",
          first_name: "",
          last_name: "",
          telegram_id: "",
          created_at: "",
          updated_at: "",
          active: false
        })
      }
      
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Database error occurred' }, { status: 500 })
    }

    if (!user) {
      // No user found
      return NextResponse.json({
        id: "",
        email: "",
        first_name: "",
        last_name: "",
        telegram_id: "",
        created_at: "",
        updated_at: "",
        active: false
      })
    }

    // Return the user data in the specified format
    return NextResponse.json({
      id: user.id || "",
      email: user.email || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      telegram_id: user.telegram_id || "",
      created_at: user.created_at || "",
      updated_at: user.updated_at || "",
      active: user.active !== false // Default to true if not explicitly set to false
    })

  } catch (error) {
    console.error('Error in telegram user lookup:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
