'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, X, Edit, ChevronDown, ChevronRight, Sparkles, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Task = Database['public']['Tables']['todo_tasks']['Row']
type TaskFilter = 'all' | 'active' | 'completed'

interface TaskListProps {
  taskFilter: TaskFilter
}

export default function TaskList({ taskFilter }: TaskListProps) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const [editError, setEditError] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  
  // Progress indicators for individual operations
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set())
  const [deletingTasks, setDeletingTasks] = useState<Set<string>>(new Set())
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set())

  const fetchTasks = useCallback(async () => {
    if (!user) return

    try {
      let query = supabase
        .from('todo_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      // Apply filter based on taskFilter
      if (taskFilter === 'active') {
        query = query.eq('is_completed', false)
      } else if (taskFilter === 'completed') {
        query = query.eq('is_completed', true)
      }
      // For 'all' filter, no additional filter is applied

      const { data, error } = await query

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }, [user, taskFilter])

  const subscribeToChanges = useCallback(() => {
    if (!user) return

    const subscription = supabase
      .channel('tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todo_tasks',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as Task
            // Only add the task if it matches the current filter
            if (taskFilter === 'all' || 
                (taskFilter === 'active' && !newTask.is_completed) ||
                (taskFilter === 'completed' && newTask.is_completed)) {
              setTasks(prev => [newTask, ...prev])
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = payload.new as Task
            const oldTask = payload.old as Task
            
            // Check if the task should be in the current view
            const shouldBeInCurrentView = taskFilter === 'all' || 
              (taskFilter === 'active' && !updatedTask.is_completed) ||
              (taskFilter === 'completed' && updatedTask.is_completed)
            
            // Check if the task was in the current view before the update
            const wasInCurrentView = taskFilter === 'all' || 
              (taskFilter === 'active' && !oldTask.is_completed) ||
              (taskFilter === 'completed' && oldTask.is_completed)
            
            if (shouldBeInCurrentView && wasInCurrentView) {
              // Update the task in place
              setTasks(prev => prev.map(task => 
                task.id === updatedTask.id ? updatedTask : task
              ))
            } else if (shouldBeInCurrentView && !wasInCurrentView) {
              // Add the task to the current view
              setTasks(prev => [updatedTask, ...prev])
            } else if (!shouldBeInCurrentView && wasInCurrentView) {
              // Remove the task from the current view
              setTasks(prev => prev.filter(task => task.id !== updatedTask.id))
            }
          } else if (payload.eventType === 'DELETE') {
            setTasks(prev => prev.filter(task => task.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user, taskFilter])

  useEffect(() => {
    if (user) {
      // Set loading to true when switching between task types
      setLoading(true)
      fetchTasks()
      subscribeToChanges()
    }
  }, [user, taskFilter, fetchTasks, subscribeToChanges])

  const toggleTaskCompletion = async (taskId: string, isCompleted: boolean) => {
    if (!user) return

    // Add task to completing set
    setCompletingTasks(prev => new Set(prev).add(taskId))

    // Optimistically update the task in the current list
    if (taskFilter === 'all') {
      // In "all tasks" view, update the task in place to show the new status
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, is_completed: !isCompleted, updated_at: new Date().toISOString() }
          : task
      ))
    } else {
      // In filtered views (active/completed), remove the task as it will move to the other list
      setTasks(prev => prev.filter(task => task.id !== taskId))
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          is_completed: !isCompleted,
        }),
      })

      if (!response.ok) {
        // If update failed, re-fetch tasks to ensure UI is in sync with database
        const errorData = await response.json()
        console.error('Error updating task completion:', errorData.error)
        fetchTasks()
      }
    } catch (error) {
      console.error('Error updating task completion:', error)
      // If update failed, re-fetch tasks to ensure UI is in sync with database
      fetchTasks()
    } finally {
      // Remove task from completing set
      setCompletingTasks(prev => {
        const newSet = new Set(prev)
        newSet.delete(taskId)
        return newSet
      })
    }
  }

  const deleteTask = async (taskId: string) => {
    if (!user) return

    // Add task to deleting set
    setDeletingTasks(prev => new Set(prev).add(taskId))

    // Optimistically remove the task from the UI immediately
    setTasks(prev => prev.filter(task => task.id !== taskId))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        // If deletion failed, restore the task to the UI
        const errorData = await response.json()
        console.error('Error deleting task:', errorData.error)
        // Re-fetch tasks to ensure UI is in sync with database
        fetchTasks()
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      // If deletion failed, restore the task to the UI
      fetchTasks()
    } finally {
      // Remove task from deleting set
      setDeletingTasks(prev => {
        const newSet = new Set(prev)
        newSet.delete(taskId)
        return newSet
      })
    }
  }

  const saveTaskTitle = async (taskId: string) => {
    if (!editTitle.trim() || !user) return

    const newTitle = editTitle.trim()
    
    // Clear any previous errors
    setEditError(null)
    
    // Add task to updating set
    setUpdatingTasks(prev => new Set(prev).add(taskId))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: newTitle,
        }),
      })

      if (!response.ok) {
        // If update failed, show error message
        const errorData = await response.json()
        console.error('Error updating task title:', errorData.error)
        setEditError('Failed to save changes. Please try again.')
        // Re-fetch tasks to ensure UI is in sync with database
        fetchTasks()
      } else {
        // Success - clear editing state
        setEditingTask(null)
        setEditTitle('')
        setEditError(null)
      }
    } catch (error) {
      console.error('Error updating task title:', error)
      setEditError('Network error. Please check your connection and try again.')
      // Re-fetch tasks to ensure UI is in sync with database
      fetchTasks()
    } finally {
      // Remove task from updating set
      setUpdatingTasks(prev => {
        const newSet = new Set(prev)
        newSet.delete(taskId)
        return newSet
      })
    }
  }

  const cancelEdit = () => {
    setEditingTask(null)
    setEditTitle('')
    setEditError(null)
  }

  const startEdit = (taskId: string, currentTitle: string) => {
    setEditingTask(taskId)
    setEditTitle(currentTitle)
    setEditError(null)
  }

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#00A0DC]" />
          <span className="text-gray-600">
            Loading {taskFilter === 'all' ? 'all' : taskFilter === 'active' ? 'active' : 'completed'} tasks...
          </span>
        </div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {taskFilter === 'active' ? 'No active tasks yet' : taskFilter === 'completed' ? 'No completed tasks yet' : 'No tasks yet. Create your first task!'}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const isUpdating = updatingTasks.has(task.id)
        const isDeleting = deletingTasks.has(task.id)
        const isCompleting = completingTasks.has(task.id)
        const isProcessing = isUpdating || isDeleting || isCompleting

        return (
          <div
            key={task.id}
            className={`bg-white border border-gray-200 rounded-lg p-4 transition-all ${
              task.is_completed ? 'opacity-75' : ''
            } ${isProcessing ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start space-x-3">
              <button
                onClick={() => toggleTaskCompletion(task.id, task.is_completed)}
                disabled={isProcessing}
                className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  task.is_completed
                    ? 'bg-[#00A0DC] border-[#00A0DC]'
                    : 'border-gray-300 hover:border-[#00A0DC]'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isCompleting ? (
                  <Loader2 className="w-3 h-3 animate-spin text-[#00A0DC]" />
                ) : task.is_completed ? (
                  <Check className="w-4 h-4 text-white" />
                ) : null}
              </button>

              <div className="flex-1 min-w-0">
                {editingTask === task.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && saveTaskTitle(task.id)}
                        disabled={isUpdating}
                        className="flex-1 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#00A0DC] disabled:opacity-50"
                        autoFocus
                      />
                    </div>
                    
                    {editError && (
                      <div className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded text-sm">
                        <span className="text-red-700">{editError}</span>
                        <button
                          onClick={cancelEdit}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => saveTaskTitle(task.id)}
                        disabled={isUpdating || !editTitle.trim()}
                        className="flex items-center space-x-1 px-3 py-1 bg-[#00A0DC] text-white rounded text-sm hover:bg-[#0088B8] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <span>Save</span>
                        )}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={isUpdating}
                        className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3
                          className={`text-sm font-medium ${
                            task.is_completed ? 'line-through text-gray-500' : 'text-gray-900'
                          }`}
                        >
                          {task.title}
                        </h3>
                        {(task.title_enriched || task.description_enriched) && (
                          <div className="flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 text-[#00A0DC]" />
                            <span className="text-xs text-[#00A0DC] font-medium">AI Enhanced</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Enriched Task Indicator */}
                      {(task.title_enriched || task.description_enriched) && (
                        <div className="mt-2">
                          <button
                            onClick={() => toggleExpanded(task.id)}
                            disabled={isProcessing}
                            className="flex items-center space-x-2 text-xs text-[#00A0DC] hover:text-[#0088B8] disabled:opacity-50 transition-colors"
                          >
                            {expandedTasks.has(task.id) ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                            <div className="flex items-center space-x-1">
                              <Sparkles className="w-3 h-3" />
                              <span className="font-medium">AI Enhanced</span>
                            </div>
                          </button>
                          
                          {expandedTasks.has(task.id) && (
                            <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                              <div className="space-y-4">
                                {task.title_enriched && (
                                  <div>
                                    <div className="flex items-center space-x-2 mb-2">
                                      <Sparkles className="w-4 h-4 text-[#00A0DC]" />
                                      <h4 className="text-sm font-semibold text-gray-800">What needs to happen</h4>
                                    </div>
                                    <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-[#00A0DC]">
                                      {task.title_enriched}
                                    </p>
                                  </div>
                                )}
                                {task.description_enriched && (
                                  <div>
                                    <div className="flex items-center space-x-2 mb-2">
                                      <Sparkles className="w-4 h-4 text-[#00A0DC]" />
                                      <h4 className="text-sm font-semibold text-gray-800">Suggested plan of action</h4>
                                    </div>
                                    <div className="bg-white p-3 rounded border-l-4 border-[#00A0DC]">
                                      <div 
                                        className="text-sm text-gray-700 prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ 
                                          __html: task.description_enriched || '' 
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        onClick={() => startEdit(task.id, task.title)}
                        disabled={isProcessing}
                        className="p-1 text-gray-400 hover:text-[#00A0DC] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        disabled={isProcessing}
                        className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
