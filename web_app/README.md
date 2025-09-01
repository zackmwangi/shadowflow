# ShadowFlow - Task Management App

A modern, intuitive task management application inspired by Pomofocus.io, built with Next.js, Supabase, and n8n integration for AI-powered task enrichment.

## Features

### 🔐 Authentication
- Email-based user registration and login
- Secure authentication with Supabase Auth
- User session management

### 📝 Task Management
- Create, read, update, and delete tasks
- Mark tasks as completed/uncompleted
- Toggle between active and completed tasks
- Real-time task updates with Supabase subscriptions
- Inline task editing

### 🤖 AI-Powered Task Enrichment
- Automatic task enrichment via n8n workflows
- Enhanced task titles and suggested subtasks
- Collapsible enrichment suggestions
- Real-time updates when enrichment completes

### ⚙️ User Settings
- Profile management (first name, last name)
- Password change functionality
- Telegram integration for chatbot-based task management
- Secure settings storage

### 🔗 Telegram Integration Workflow
- Generate 6-digit alphanumeric codes for account linking
- 30-minute expiration for security
- Show/hide code functionality
- Regenerate codes as needed
- Secure callback system for n8n integration
- Account unlinking with confirmation
- Real-time status updates

### 🎨 Modern UI/UX
- Clean, minimalistic design inspired by Pomofocus.io
- Responsive design for all devices
- Loading states and error handling
- Color scheme: #00A0DC and white

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime
- **Workflow Automation**: n8n
- **Form Handling**: React Hook Form with Zod validation

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- n8n instance (optional, for task enrichment)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd shadowflow
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
N8N_ENRICHMENT_WEBHOOK_URL=http://localhost:5678/webhook/task-enrichment
N8N_TO_TELEGRAM_NOTIFICATION_WEBHOOK_URL=http://localhost:5678/webhook/telegram-notification
TELEGRAM_MSG_ENRICH_DONE=Your task has been enriched with helpful suggestions!
```

### 4. Supabase Setup

1. Create a new Supabase project
2. Enable Authentication with Email provider
3. Run the SQL commands from `database-setup.sql` in your Supabase SQL editor to create all necessary tables, policies, and functions
4. The setup includes:
   - `todo_users` table for user profiles
   - `todo_tasks` table for task management
   - `telegram_integration_codes` table for temporary integration codes
   - Row Level Security (RLS) policies
   - Database triggers for user synchronization
   - Indexes for optimal performance

#### Users Table
```sql
CREATE TABLE todo_users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  telegram_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE todo_users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON todo_users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON todo_users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON todo_users
  FOR INSERT WITH CHECK (auth.uid() = id);
```

#### Tasks Table
```sql
CREATE TABLE todo_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  title_enriched TEXT,
  description_enriched TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE todo_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own tasks" ON todo_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" ON todo_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON todo_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON todo_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE todo_tasks;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_todo_tasks_user_id ON todo_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_created_at ON todo_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_is_completed ON todo_tasks(is_completed);

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.todo_users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create todo_users record when auth.users record is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

### 5. n8n Setup (Optional)

For task enrichment functionality:

1. Install and run n8n
2. Create a webhook workflow that:
   - Receives task data from the app
   - Processes the task title for enrichment
   - Calls back to `/api/n8n/enrichment-callback` with enriched data

### 6. Run the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## API Endpoints

### Tasks API
- `GET /api/tasks` - Get all tasks for the authenticated user
- `POST /api/tasks` - Create a new task
- `PUT /api/tasks/[id]` - Update a task
- `DELETE /api/tasks/[id]` - Delete a task
- `POST /api/tasks/telegram` - Create a new task via Telegram (external access)

### Telegram Integration API
- `GET /api/telegram` - Get current integration code for user
- `POST /api/telegram` - Generate new integration code
- `DELETE /api/telegram` - Delete current integration code
- `POST /api/telegram/callback` - Handle n8n callback for account linking
- `POST /api/telegram/unlink` - Unlink Telegram account
- `GET /api/users/telegram/[telegram_id]` - Look up user by Telegram ID (external access)

### n8n Webhook
- `POST /api/n8n/enrichment-callback` - Receive enriched task data from n8n workflows

### External API Access
The following endpoints are designed for external processes (like Telegram bots) and do not require user authentication:

- `GET /api/users/telegram/[telegram_id]` - Look up user by Telegram ID
  - Returns user profile data or empty values if not found
  - Used by external processes to verify user existence

- `POST /api/tasks/telegram` - Create tasks via Telegram
  - Requires `title` and `telegram_id` in request body
  - Automatically finds user by Telegram ID and creates task
  - Triggers n8n enrichment workflow
  - Returns created task data

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── tasks/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   └── telegram/
│   │   │       └── route.ts
│   │   ├── users/
│   │   │   └── telegram/
│   │   │       └── [telegram_id]/route.ts
│   │   ├── telegram/
│   │   │   ├── route.ts
│   │   │   ├── callback/route.ts
│   │   │   └── unlink/route.ts
│   │   └── n8n/
│   │       └── route.ts
│   ├── settings/
│   │   └── page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── AddTaskForm.tsx
│   ├── Dashboard.tsx
│   ├── Header.tsx
│   ├── LoginForm.tsx
│   └── TaskList.tsx
├── contexts/
│   └── AuthContext.tsx
└── lib/
    └── supabase.ts
```

## Features in Detail

### Task Enrichment Flow
1. User creates a new task
2. Task is saved to Supabase
3. n8n webhook is triggered with task data
4. n8n processes the task and enriches it
5. Enriched data is sent back via `/api/n8n/enrichment-callback`
6. Frontend receives real-time update via Supabase subscription
7. User sees enriched suggestions with collapsible details

### Real-time Updates
- Supabase Realtime subscriptions for instant UI updates
- Optimistic updates for better UX
- Error handling and retry mechanisms

### Security
- Row Level Security (RLS) in Supabase
- User authentication required for all operations
- Input validation with Zod schemas
- XSS protection with proper escaping

### User Data Synchronization
- Automatic user data sync between Supabase Auth and todo_users table
- Database trigger ensures new users are automatically created in todo_users
- Frontend fallback mechanism for handling edge cases
- Proper error handling for sync failures

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
