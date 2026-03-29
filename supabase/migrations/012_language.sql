-- Add language preference to user profiles
-- Values: 'en' | 'nl' | 'de' | 'fr' | 'es' — null defaults to 'en' in the app
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language text DEFAULT NULL;
