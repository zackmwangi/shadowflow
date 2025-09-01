'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(200, 'Task title is too long'),
})

type TaskFormData = z.infer<typeof taskSchema>

interface AddTaskFormProps {
  onTaskAdded: () => void
}

export default function AddTaskForm({ onTaskAdded }: AddTaskFormProps) {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
  })

  const onSubmit = async (data: TaskFormData) => {
    if (!user) {
      setError('You must be logged in to create tasks')
      return
    }

    console.log('AddTaskForm - User authenticated:', { userId: user.id, email: user.email })

    setIsLoading(true)
    setError(null)

    try {
      // Create task using API endpoint
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: data.title.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create task')
      }

      const task = await response.json()
      console.log('Task created successfully:', task)
      reset()
      onTaskAdded()
    } catch (err) {
      console.error('Error creating task:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Add New Task
          </label>
          <div className="flex space-x-2">
            <input
              {...register('title')}
              type="text"
              placeholder="What needs to be done?"
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00A0DC] focus:border-[#00A0DC]"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-[#00A0DC] text-white px-4 py-2 rounded-md hover:bg-[#0088B8] focus:outline-none focus:ring-2 focus:ring-[#00A0DC] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>Add</span>
            </button>
          </div>
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </form>
    </div>
  )
}
