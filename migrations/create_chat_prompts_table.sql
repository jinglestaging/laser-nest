-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create chat_prompts table
CREATE TABLE chat_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_chat_prompts_user_id ON chat_prompts(user_id);
CREATE INDEX idx_chat_prompts_created_at ON chat_prompts(created_at DESC);

-- Enable RLS
ALTER TABLE chat_prompts ENABLE ROW LEVEL SECURITY;

-- Create policies (users manage their own chat prompts)
CREATE POLICY "Users can view their own chat prompts"
  ON chat_prompts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat prompts"
  ON chat_prompts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat prompts"
  ON chat_prompts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat prompts"
  ON chat_prompts FOR DELETE
  USING (auth.uid() = user_id);

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_prompts_updated_at
  BEFORE UPDATE ON chat_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();