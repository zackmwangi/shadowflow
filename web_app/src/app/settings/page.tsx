'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Save, Loader2, User, Mail, Lock, MessageCircle, Eye, EyeOff, RefreshCw, X, Check, ArrowLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50, 'First name is too long'),
  last_name: z.string().min(1, 'Last name is required').max(50, 'Last name is too long'),
})

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(6, 'New password must be at least 6 characters'),
  confirm_password: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
})

type ProfileFormData = z.infer<typeof profileSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

interface TelegramCode {
  id: string
  code: string
  created_at: string
  expires_at: string
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [userData, setUserData] = useState<{
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    telegram_id?: string;
    created_at: string;
    updated_at: string;
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<string | null>(null)
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<string | null>(null)
  
  // Telegram integration states
  const [telegramCode, setTelegramCode] = useState<TelegramCode | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [unlinkingTelegram, setUnlinkingTelegram] = useState(false)
  const [telegramSuccessMessage, setTelegramSuccessMessage] = useState<string | null>(null)
  const [telegramErrorMessage, setTelegramErrorMessage] = useState<string | null>(null)
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false)
  const [countdownTime, setCountdownTime] = useState<string>('')

  // Confirmation states
  const [showProfileConfirm, setShowProfileConfirm] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [pendingProfileData, setPendingProfileData] = useState<ProfileFormData | null>(null)
  const [pendingPasswordData, setPendingPasswordData] = useState<PasswordFormData | null>(null)

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
    formState: { errors: profileErrors, isDirty: profileIsDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  })

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors, isDirty: passwordIsDirty },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  })

  useEffect(() => {
    if (user) {
      fetchUserData()
      fetchTelegramCode()
    } else {
      setLoading(false)
    }
  }, [user])

  // Countdown timer for Telegram integration code
  useEffect(() => {
    if (!telegramCode) {
      setCountdownTime('')
      return
    }

    const updateCountdown = () => {
      const expiry = new Date(telegramCode.expires_at)
      const now = new Date()
      const diffMs = expiry.getTime() - now.getTime()
      
      if (diffMs <= 0) {
        setCountdownTime('Expired')
        setTelegramCode(null)
        setShowCode(false)
        return
      }
      
      const diffMins = Math.floor(diffMs / 60000)
      const diffSecs = Math.floor((diffMs % 60000) / 1000)
      
      if (diffMins < 60) {
        setCountdownTime(`${diffMins}:${diffSecs.toString().padStart(2, '0')}`)
      } else {
        const diffHours = Math.floor(diffMins / 60)
        setCountdownTime(`${diffHours}:${(diffMins % 60).toString().padStart(2, '0')}:${diffSecs.toString().padStart(2, '0')}`)
      }
    }

    // Update immediately
    updateCountdown()
    
    // Update every second
    const interval = setInterval(updateCountdown, 1000)
    
    return () => clearInterval(interval)
  }, [telegramCode])

  // Real-time subscription to todo_users table for Telegram integration
  useEffect(() => {
    if (!user?.id) return

    console.log('Setting up real-time subscription for Telegram integration')

    const subscription = supabase
      .channel('telegram-integration')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'todo_users',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          const updatedUser = payload.new as {
            id: string;
            email: string;
            first_name?: string;
            last_name?: string;
            telegram_id?: string;
            created_at: string;
            updated_at: string;
          }
          console.log('User record updated:', updatedUser)
          
          if (updatedUser.telegram_id) {
            console.log('Telegram account linked:', updatedUser.telegram_id)
            
            // Update local state
            setUserData(updatedUser)
            setTelegramCode(null)
            setShowCode(false)
            setCountdownTime('')
            
            // Show success message
            setTelegramSuccessMessage('Telegram account linked successfully!')
            
            // Clean up subscription
            subscription.unsubscribe()
          }
        }
      )
      .subscribe()

    return () => {
      console.log('Cleaning up Telegram integration subscription')
      subscription.unsubscribe()
    }
  }, [user?.id])

  const fetchUserData = async () => {
    try {
      const { data, error } = await supabase
        .from('todo_users')
        .select('*')
        .eq('id', user?.id)
        .single()

      if (error) throw error

      setUserData(data)
      resetProfile({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
      })
    } catch (error) {
      console.error('Error fetching user data:', error)
      setErrorMessage('Failed to load user data')
    } finally {
      setLoading(false)
    }
  }

  const fetchTelegramCode = async () => {
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.error('No active session')
        return
      }

      const response = await fetch('/api/telegram', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setTelegramCode(data.code)
      }
    } catch (error) {
      console.error('Error fetching Telegram code:', error)
    }
  }

  const generateTelegramCode = async () => {
    setGeneratingCode(true)
    setTelegramErrorMessage(null)
    setTelegramSuccessMessage(null)

    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate code')
      }

      const data = await response.json()
      setTelegramCode(data.code)
      setShowCode(true)
      setTelegramSuccessMessage('Integration code generated successfully')
    } catch (error) {
      console.error('Error generating Telegram code:', error)
      setTelegramErrorMessage(error instanceof Error ? error.message : 'Failed to generate code')
    } finally {
      setGeneratingCode(false)
    }
  }

  const deleteTelegramCode = async () => {
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.error('No active session')
        return
      }

      await fetch('/api/telegram', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      
      setTelegramCode(null)
      setShowCode(false)
    } catch (error) {
      console.error('Error deleting Telegram code:', error)
    }
  }

  const unlinkTelegram = async () => {
    setUnlinkingTelegram(true)
    setTelegramErrorMessage(null)
    setTelegramSuccessMessage(null)

    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch('/api/telegram/unlink', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to unlink Telegram')
      }

      setTelegramSuccessMessage('Telegram account unlinked successfully')
      setShowUnlinkConfirm(false)
      fetchUserData() // Refresh user data to show updated telegram_id
    } catch (error) {
      console.error('Error unlinking Telegram:', error)
      setTelegramErrorMessage(error instanceof Error ? error.message : 'Failed to unlink Telegram')
    } finally {
      setUnlinkingTelegram(false)
    }
  }

  const onProfileSubmit = (data: ProfileFormData) => {
    setPendingProfileData(data)
    setShowProfileConfirm(true)
  }

  const confirmProfileUpdate = async () => {
    if (!user || !pendingProfileData) return

    setSaving(true)
    setSuccessMessage(null)
    setErrorMessage(null)
    setShowProfileConfirm(false)

    try {
      const { error } = await supabase
        .from('todo_users')
        .update({
          first_name: pendingProfileData.first_name,
          last_name: pendingProfileData.last_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      setSuccessMessage('Profile updated successfully')
      fetchUserData()
      setPendingProfileData(null)
    } catch (error) {
      console.error('Error updating profile:', error)
      setErrorMessage('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const onPasswordSubmit = (data: PasswordFormData) => {
    setPendingPasswordData(data)
    setShowPasswordConfirm(true)
  }

  const confirmPasswordUpdate = async () => {
    if (!user || !pendingPasswordData) return

    setPasswordSaving(true)
    setPasswordSuccessMessage(null)
    setPasswordErrorMessage(null)
    setShowPasswordConfirm(false)

    try {
      const { error } = await supabase.auth.updateUser({
        password: pendingPasswordData.new_password,
      })

      if (error) throw error

      setPasswordSuccessMessage('Password updated successfully')
      resetPassword()
      setPendingPasswordData(null)
    } catch (error) {
      console.error('Error updating password:', error)
      setPasswordErrorMessage('Failed to update password')
    } finally {
      setPasswordSaving(false)
    }
  }



  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#00A0DC]" />
      </div>
    )
  }

  // Show configuration error if Supabase is not properly configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Link
                  href="/"
                  className="flex items-center space-x-2 text-gray-600 hover:text-[#00A0DC] transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Back to Tasks</span>
                </Link>
              </div>
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-[#00A0DC]">ShadowFlow</h1>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600">Manage your account settings and preferences</p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-900 mb-4">Configuration Error</h2>
            <p className="text-red-700">
              Supabase environment variables are not configured. Please create a <code>.env.local</code> file with the following variables:
            </p>
            <div className="mt-4 p-4 bg-gray-100 rounded-md">
              <pre className="text-sm">
{`NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center space-x-2 text-gray-600 hover:text-[#00A0DC] transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Tasks</span>
              </Link>
            </div>
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-[#00A0DC]">ShadowFlow</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account settings and preferences</p>
        </div>

        <div className="space-y-8">
          {/* Profile Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <User className="w-6 h-6 text-[#00A0DC] mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
              </div>
              {profileIsDirty && (
                <div className="flex items-center space-x-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">Unsaved changes</span>
                </div>
              )}
            </div>

            <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    {...registerProfile('first_name')}
                    type="text"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00A0DC] focus:border-[#00A0DC]"
                  />
                  {profileErrors.first_name && (
                    <p className="mt-1 text-sm text-red-600">{profileErrors.first_name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    {...registerProfile('last_name')}
                    type="text"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00A0DC] focus:border-[#00A0DC]"
                  />
                  {profileErrors.last_name && (
                    <p className="mt-1 text-sm text-red-600">{profileErrors.last_name.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={userData?.email || ''}
                  disabled
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-500"
                />
                <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !profileIsDirty}
                  className="bg-[#00A0DC] text-white px-6 py-2 rounded-md hover:bg-[#0088B8] focus:outline-none focus:ring-2 focus:ring-[#00A0DC] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>

              {successMessage && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-sm text-green-600">{successMessage}</p>
                </div>
              )}

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600">{errorMessage}</p>
                </div>
              )}
            </form>
          </div>



          {/* Password Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Lock className="w-6 h-6 text-[#00A0DC] mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>
              </div>
              {passwordIsDirty && (
                <div className="flex items-center space-x-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">Unsaved changes</span>
                </div>
              )}
            </div>

            <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-4">
              <div>
                <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <input
                  {...registerPassword('current_password')}
                  type="password"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00A0DC] focus:border-[#00A0DC]"
                />
                {passwordErrors.current_password && (
                  <p className="mt-1 text-sm text-red-600">{passwordErrors.current_password.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    {...registerPassword('new_password')}
                    type="password"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00A0DC] focus:border-[#00A0DC]"
                  />
                  {passwordErrors.new_password && (
                    <p className="mt-1 text-sm text-red-600">{passwordErrors.new_password.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    {...registerPassword('confirm_password')}
                    type="password"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00A0DC] focus:border-[#00A0DC]"
                  />
                  {passwordErrors.confirm_password && (
                    <p className="mt-1 text-sm text-red-600">{passwordErrors.confirm_password.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={passwordSaving || !passwordIsDirty}
                  className="bg-[#00A0DC] text-white px-6 py-2 rounded-md hover:bg-[#0088B8] focus:outline-none focus:ring-2 focus:ring-[#00A0DC] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {passwordSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{passwordSaving ? 'Updating...' : 'Update Password'}</span>
                </button>
              </div>

              {passwordSuccessMessage && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-sm text-green-600">{passwordSuccessMessage}</p>
                </div>
              )}

              {passwordErrorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600">{passwordErrorMessage}</p>
                </div>
              )}
            </form>
          </div>

          {/* Telegram Integration Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center mb-6">
              <MessageCircle className="w-6 h-6 text-[#00A0DC] mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Telegram Integration</h2>
            </div>

            <div className="space-y-4">
              {/* Current Status */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {userData?.telegram_id ? (
                    <>
                      <Check className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-medium text-gray-900">Telegram Connected</p>
                        <p className="text-sm text-gray-600">ID: {userData.telegram_id}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <X className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">Telegram Not Connected</p>
                        <p className="text-sm text-gray-600">Connect your Telegram account for chatbot-based task management</p>
                      </div>
                    </>
                  )}
                </div>

                {userData?.telegram_id && (
                  <button
                    onClick={() => setShowUnlinkConfirm(true)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Unlink Account
                  </button>
                )}
              </div>

              {/* Integration Code Section */}
              {!userData?.telegram_id && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Connect Your Telegram Account</h3>
                  
                  {!telegramCode ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        Generate a code to link your Telegram account and interact with your tasks
                      </p>
                      <button
                        onClick={generateTelegramCode}
                        disabled={generatingCode}
                        className="bg-[#00A0DC] text-white px-4 py-2 rounded-md hover:bg-[#0088B8] focus:outline-none focus:ring-2 focus:ring-[#00A0DC] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {generatingCode ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        <span>{generatingCode ? 'Generating...' : 'Generate Code'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        Use this code in your Telegram bot to connect your account:
                      </p>
                      
                      <div className="flex items-center space-x-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <input
                              type={showCode ? 'text' : 'password'}
                              value={telegramCode.code}
                              readOnly
                              className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 font-mono text-lg text-center tracking-wider"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCode(!showCode)}
                              className="p-2 text-gray-400 hover:text-gray-600"
                            >
                              {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Expires in: <span className="font-mono font-medium">{countdownTime}</span>
                          </p>
                        </div>
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={generateTelegramCode}
                            disabled={generatingCode}
                            className="p-2 text-[#00A0DC] hover:text-[#0088B8] disabled:opacity-50"
                            title="Generate new code"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={deleteTelegramCode}
                            className="p-2 text-gray-400 hover:text-red-600"
                            title="Delete code"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <p className="text-sm text-blue-800">
                          <strong>Instructions:</strong> Send this code to your Telegram bot to complete the connection.
                        </p>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        <p className="mb-2">To connect your Telegram account:</p>
                        <ol className="list-decimal list-inside space-y-1 ml-4">
                          <li>Install the <a href="https://telegram.org/" target="_blank" rel="noopener noreferrer" className="text-[#00A0DC] hover:underline">Telegram app for your device</a></li>
                          <li>Search for our bot (<strong>shadowlightsbot</strong>) and start a conversation</li>
                          <li>Generate a code above</li>
                          <li>Use the code on the bot to link your account</li>
                          <li>Account will be automatically linked</li>
                        </ol>
                        <p className="mt-2 text-gray-700">You will then get notifications on Telegram</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {telegramSuccessMessage && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-sm text-green-600">{telegramSuccessMessage}</p>
                </div>
              )}

              {telegramErrorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600">{telegramErrorMessage}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Update Confirmation Modal */}
      {showProfileConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Profile Update</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to update your profile information?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowProfileConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmProfileUpdate}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-[#00A0DC] text-white rounded-md hover:bg-[#0088B8] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                <span>{saving ? 'Updating...' : 'Update Profile'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Update Confirmation Modal */}
      {showPasswordConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Password Update</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to update your password? You will need to use the new password for your next login.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowPasswordConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmPasswordUpdate}
                disabled={passwordSaving}
                className="flex-1 px-4 py-2 bg-[#00A0DC] text-white rounded-md hover:bg-[#0088B8] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {passwordSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                <span>{passwordSaving ? 'Updating...' : 'Update Password'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlink Confirmation Modal */}
      {showUnlinkConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Unlink Telegram Account</h3>
                          <p className="text-gray-600 mb-6">
                Are you sure you want to unlink your Telegram account? You&apos;ll need to generate a new code to reconnect.
              </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowUnlinkConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={unlinkTelegram}
                disabled={unlinkingTelegram}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {unlinkingTelegram ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                <span>{unlinkingTelegram ? 'Unlinking...' : 'Unlink'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


