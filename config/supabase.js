import { createClient } from '@supabase/supabase-js';
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing required Supabase environment variables. Please check your .env file.');
}

export const dbClient = createClient(supabaseUrl, supabaseKey);

export default dbClient;