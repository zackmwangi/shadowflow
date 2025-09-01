import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

export type Database = {
  public: {
    Tables: {
      todo_users: {
        Row: {
          id: string
          email: string
          first_name: string | null
          last_name: string | null
          telegram_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          first_name?: string | null
          last_name?: string | null
          telegram_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          telegram_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      todo_tasks: {
        Row: {
          id: string
          user_id: string
          title: string
          title_enriched: string | null
          description_enriched: string | null
          is_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          title_enriched?: string | null
          description_enriched?: string | null
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          title_enriched?: string | null
          description_enriched?: string | null
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      telegram_integration_codes: {
        Row: {
          id: string
          user_email: string
          code: string
          created_at: string
          expires_at: string
          used_at: string | null
          telegram_id: string | null
        }
        Insert: {
          id?: string
          user_email: string
          code: string
          created_at?: string
          expires_at: string
          used_at?: string | null
          telegram_id?: string | null
        }
        Update: {
          id?: string
          user_email?: string
          code?: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          telegram_id?: string | null
        }
      }
    }
  }
}
