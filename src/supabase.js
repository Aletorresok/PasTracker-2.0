import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ewgidnguhikjseetlinj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Z2lkbmd1aGlranNlZXRsaW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTg1NDUsImV4cCI6MjA4NzY5NDU0NX0.HiD5jrhFMAoLDz7Cc90U5As3wMHyDa7D2HmSu0J6dP0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)