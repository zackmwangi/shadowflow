-- ShadowFlow Database Setup
-- Run this in your Supabase SQL editor

-- Create users table
CREATE TABLE IF NOT EXISTS todo_users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  telegram_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS todo_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  title_enriched TEXT,
  description_enriched TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE todo_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_tasks ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile" ON todo_users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON todo_users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON todo_users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Tasks table policies
CREATE POLICY "Users can view own tasks" ON todo_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" ON todo_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON todo_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON todo_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for tasks table
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

-- Create telegram_integration_codes table for tracking temporary codes
CREATE TABLE telegram_integration_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  telegram_id TEXT
);

-- Enable RLS
ALTER TABLE telegram_integration_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for telegram_integration_codes
CREATE POLICY "Users can view own codes" ON telegram_integration_codes
  FOR SELECT USING (
    user_email IN (
      SELECT email FROM todo_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own codes" ON telegram_integration_codes
  FOR INSERT WITH CHECK (
    user_email IN (
      SELECT email FROM todo_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own codes" ON telegram_integration_codes
  FOR UPDATE USING (
    user_email IN (
      SELECT email FROM todo_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own codes" ON telegram_integration_codes
  FOR DELETE USING (
    user_email IN (
      SELECT email FROM todo_users WHERE id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_telegram_codes_user_email ON telegram_integration_codes(user_email);
CREATE INDEX IF NOT EXISTS idx_telegram_codes_code ON telegram_integration_codes(code);
CREATE INDEX IF NOT EXISTS idx_telegram_codes_expires_at ON telegram_integration_codes(expires_at);

-- Create function to clean up expired codes (optional)
CREATE OR REPLACE FUNCTION cleanup_expired_telegram_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM telegram_integration_codes 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired codes (optional)
-- This would need to be set up in Supabase dashboard or via cron
