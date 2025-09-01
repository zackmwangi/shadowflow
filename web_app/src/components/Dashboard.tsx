'use client'

import { useState } from 'react'
import { Eye, EyeOff, List } from 'lucide-react'
import AddTaskForm from './AddTaskForm'
import TaskList from './TaskList'

type TaskFilter = 'all' | 'active' | 'completed'

export default function Dashboard() {
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleTaskAdded = () => {
    setRefreshKey(prev => prev + 1)
  }

  const getFilterTitle = () => {
    switch (taskFilter) {
      case 'all':
        return 'All Tasks'
      case 'active':
        return 'Active Tasks'
      case 'completed':
        return 'Completed Tasks'
      default:
        return 'Tasks'
    }
  }

  const getFilterIcon = () => {
    switch (taskFilter) {
      case 'all':
        return <List className="w-4 h-4" />
      case 'active':
        return <Eye className="w-4 h-4" />
      case 'completed':
        return <EyeOff className="w-4 h-4" />
      default:
        return <List className="w-4 h-4" />
    }
  }

  const getNextFilter = (): TaskFilter => {
    switch (taskFilter) {
      case 'active':
        return 'completed'
      case 'completed':
        return 'all'
      case 'all':
        return 'active'
      default:
        return 'active'
    }
  }

  const getFilterButtonText = () => {
    switch (taskFilter) {
      case 'active':
        return 'Show Completed'
      case 'completed':
        return 'Show All'
      case 'all':
        return 'Show Active'
      default:
        return 'Toggle View'
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">ShadowFlow</h1>
        <p className="text-gray-600">Organize your tasks and boost your productivity</p>
      </div>

      <AddTaskForm onTaskAdded={handleTaskAdded} />

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {getFilterTitle()}
        </h2>
        
        <button
          onClick={() => setTaskFilter(getNextFilter())}
          className="flex items-center space-x-2 text-sm text-[#00A0DC] hover:text-[#0088B8] focus:outline-none focus:ring-2 focus:ring-[#00A0DC] focus:ring-offset-2 rounded-md px-3 py-1"
        >
          {getFilterIcon()}
          <span>{getFilterButtonText()}</span>
        </button>
      </div>

      <TaskList key={refreshKey} taskFilter={taskFilter} />
    </div>
  )
}
