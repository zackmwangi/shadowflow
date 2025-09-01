'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)

      // Handle user creation - ensure user data is synced to todo_users table
      if ((event as string) === 'SIGNED_UP' && session?.user) {
        try {
          // Check if user already exists in todo_users table
          const { data: existingUser, error: fetchError } = await supabase
            .from('todo_users')
            .select('id')
            .eq('id', session.user.id)
            .single()

          // If user doesn't exist in todo_users, create them
          if (fetchError && fetchError.code === 'PGRST116') {
            const { error: insertError } = await supabase
              .from('todo_users')
              .insert({
                id: session.user.id,
                email: session.user.email!,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })

            if (insertError) {
              console.error('Error creating user in todo_users table:', insertError)
            }
          }
        } catch (error) {
          console.error('Error syncing user data:', error)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    try {
      console.log('AuthContext: Starting signout...')
      
      // First, try to sign out from Supabase to properly invalidate the session
      const { error } = await supabase.auth.signOut()
      if (error) {
        // Don't log session_not_found errors as they're expected when session is already cleared
        if (error.message !== 'Auth session missing!' && !error.message.includes('session_not_found')) {
          console.error('AuthContext: Signout error:', error)
        }
      } else {
        console.log('AuthContext: Signout successful')
      }
      
      // Clear user state after attempting to sign out
      setUser(null)
      
      // Force a page reload to ensure all session data is cleared
      window.location.href = '/'
      
    } catch (error) {
      // Don't log session-related errors as they're expected
      if (error instanceof Error && !error.message.includes('session')) {
        console.error('AuthContext: Signout failed:', error)
      }
      
      // Even if there's an error, clear the user state and redirect
      setUser(null)
      window.location.href = '/'
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
