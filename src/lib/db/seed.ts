// FILE: src/lib/db/seed.ts
// dotenv MUST be loaded before any other imports
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

// Now safe to import db
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'
import { workspaces, agents, knowledgeEntries } from './schema'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

async function seed() {
  console.log('🌱 Seeding...')

  const [ws] = await db.insert(workspaces).values({
    name: 'My Workspace',
    slug: 'my-workspace',
    plan: 'growth',
    callLimit: 2000,
  }).returning()

  console.log(`✅ Workspace: ${ws.id}`)

  const [emma] = await db.insert(agents).values({
    workspaceId: ws.id,
    name: 'Emma – Front Desk',
    businessName: 'My Business',
    greeting: "Hi! Thanks for calling. I'm Emma, your AI receptionist. How can I help?",
    systemPrompt: `You are Emma, a friendly AI receptionist. Keep responses to 1-3 sentences. No markdown. Natural speech only.`,
    escalationEmail: 'admin@mybusiness.com',
    status: 'active',
  }).returning()

  await db.insert(knowledgeEntries).values([
    { agentId: emma.id, category: 'General',    question: 'What are your hours?',       answer: 'Monday to Friday, 9am to 5pm.' },
    { agentId: emma.id, category: 'General',    question: 'Where are you located?',     answer: 'Based in New York. We also serve clients remotely.' },
    { agentId: emma.id, category: 'Scheduling', question: 'Can I book an appointment?', answer: 'Yes! Give me your name and preferred time.' },
  ])

  console.log(`✅ Agent: ${emma.id}`)
  console.log(`\n🎉 Done! Add to .env.local:\n`)
  console.log(`WORKSPACE_ID=${ws.id}`)
  console.log(`NEXT_PUBLIC_WORKSPACE_ID=${ws.id}\n`)
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })