import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load from backend directory first
const envPath = join(__dirname, '.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

// Also try root directory as fallback
const rootEnvPath = join(__dirname, '..', '.env');
console.log('Also checking:', rootEnvPath);
dotenv.config({ path: rootEnvPath });

console.log('\n=== Environment Variables Check ===');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? `✅ Found (${process.env.GEMINI_API_KEY.length} characters)` : '❌ NOT FOUND');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? `✅ Found (${process.env.OPENAI_API_KEY.length} characters)` : '❌ NOT FOUND');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? `✅ Found (${process.env.ANTHROPIC_API_KEY.length} characters)` : '❌ NOT FOUND');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ Found' : '❌ NOT FOUND');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Found' : '❌ NOT FOUND');

if (!process.env.GEMINI_API_KEY) {
  console.log('\n⚠️  WARNING: GEMINI_API_KEY not found!');
  console.log('Please check:');
  console.log('1. The .env file exists in the backend/ directory');
  console.log('2. The file contains: GEMINI_API_KEY=your-key-here');
  console.log('3. There are no spaces around the = sign');
  console.log('4. The key is not wrapped in quotes (unless it contains spaces)');
  process.exit(1);
} else {
  console.log('\n✅ GEMINI_API_KEY is properly configured!');
  process.exit(0);
}
