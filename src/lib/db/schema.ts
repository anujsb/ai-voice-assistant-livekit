// FILE: src/lib/db/schema.ts
import {
  pgTable, text, integer, real, boolean,
  timestamp, jsonb, pgEnum, uuid,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ───────────────────────────────────────────────────────────────────
export const agentStatusEnum   = pgEnum('agent_status',   ['active', 'inactive', 'draft'])
export const callStatusEnum    = pgEnum('call_status',    ['ringing', 'active', 'completed', 'missed', 'failed'])
export const callDirectionEnum = pgEnum('call_direction', ['inbound', 'outbound'])
export const sentimentEnum     = pgEnum('sentiment',      ['positive', 'neutral', 'negative'])

// ─── Workspaces ───────────────────────────────────────────────────────────────
export const workspaces = pgTable('workspaces', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      text('name').notNull(),
  slug:      text('slug').notNull().unique(),
  plan:      text('plan').notNull().default('starter'),
  phone:     text('phone'),
  logoUrl:   text('logo_url'),
  callLimit: integer('call_limit').notNull().default(500),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── Agents ───────────────────────────────────────────────────────────────────
export const agents = pgTable('agents', {
  id:               uuid('id').primaryKey().defaultRandom(),
  workspaceId:      uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name:             text('name').notNull(),
  businessName:     text('business_name').notNull(),
  greeting:         text('greeting').notNull(),
  systemPrompt:     text('system_prompt').notNull(),
  language:         text('language').notNull().default('en-US'),
  timezone:         text('timezone').notNull().default('America/New_York'),
  escalationEmail:  text('escalation_email').notNull(),
  escalationPhone:  text('escalation_phone'),
  webhookUrl:       text('webhook_url'),
  status:           agentStatusEnum('status').notNull().default('draft'),
  voiceConfig:      jsonb('voice_config').notNull().default({
    provider: 'groq-playai', voiceId: 'Celeste-PlayAI', speed: 1.0, pitch: 1.0, stability: 0.75,
  }),
  workingHours: jsonb('working_hours').notNull().default({
    enabled: true, timezone: 'America/New_York',
    schedule: {
      monday:    { open: '09:00', close: '17:00', enabled: true  },
      tuesday:   { open: '09:00', close: '17:00', enabled: true  },
      wednesday: { open: '09:00', close: '17:00', enabled: true  },
      thursday:  { open: '09:00', close: '17:00', enabled: true  },
      friday:    { open: '09:00', close: '17:00', enabled: true  },
      saturday:  { open: '10:00', close: '14:00', enabled: false },
      sunday:    { open: '10:00', close: '14:00', enabled: false },
    },
  }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── Knowledge Base ───────────────────────────────────────────────────────────
export const knowledgeEntries = pgTable('knowledge_entries', {
  id:        uuid('id').primaryKey().defaultRandom(),
  agentId:   uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  question:  text('question').notNull(),
  answer:    text('answer').notNull(),
  category:  text('category').notNull().default('General'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Calls ────────────────────────────────────────────────────────────────────
export const calls = pgTable('calls', {
  id:                        uuid('id').primaryKey().defaultRandom(),
  workspaceId:               uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  agentId:                   uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  agentName:                 text('agent_name').notNull(),
  roomName:                  text('room_name').notNull().unique(),
  callerName:                text('caller_name'),
  callerPhone:               text('caller_phone'),
  direction:                 callDirectionEnum('direction').notNull().default('inbound'),
  status:                    callStatusEnum('status').notNull().default('ringing'),
  startTime:                 timestamp('start_time').notNull().defaultNow(),
  endTime:                   timestamp('end_time'),
  durationSeconds:           integer('duration_seconds'),
  transcript:                jsonb('transcript').notNull().default([]),
  summary:                   text('summary'),
  sentiment:                 sentimentEnum('sentiment'),
  resolvedWithoutEscalation: boolean('resolved_without_escalation').notNull().default(false),
  recordingUrl:              text('recording_url'),
  tags:                      jsonb('tags').notNull().default([]),
  metadata:                  jsonb('metadata').notNull().default({}),
  createdAt:                 timestamp('created_at').notNull().defaultNow(),
})

// ─── Webhook Deliveries ───────────────────────────────────────────────────────
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id:         uuid('id').primaryKey().defaultRandom(),
  agentId:    uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  callId:     uuid('call_id').references(() => calls.id, { onDelete: 'set null' }),
  event:      text('event').notNull(),
  url:        text('url').notNull(),
  payload:    jsonb('payload').notNull(),
  statusCode: integer('status_code'),
  response:   text('response'),
  success:    boolean('success').notNull().default(false),
  attempts:   integer('attempts').notNull().default(0),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
})

// ─── Relations ────────────────────────────────────────────────────────────────
export const workspaceRelations = relations(workspaces, ({ many }) => ({
  agents: many(agents),
  calls:  many(calls),
}))

export const agentRelations = relations(agents, ({ one, many }) => ({
  workspace:         one(workspaces, { fields: [agents.workspaceId], references: [workspaces.id] }),
  knowledgeEntries:  many(knowledgeEntries),
  calls:             many(calls),
  webhookDeliveries: many(webhookDeliveries),
}))

export const callRelations = relations(calls, ({ one }) => ({
  workspace: one(workspaces, { fields: [calls.workspaceId], references: [workspaces.id] }),
  agent:     one(agents,     { fields: [calls.agentId],     references: [agents.id]     }),
}))

export const knowledgeRelations = relations(knowledgeEntries, ({ one }) => ({
  agent: one(agents, { fields: [knowledgeEntries.agentId], references: [agents.id] }),
}))

// ─── Types ────────────────────────────────────────────────────────────────────
export type Workspace         = typeof workspaces.$inferSelect
export type NewWorkspace      = typeof workspaces.$inferInsert
export type Agent             = typeof agents.$inferSelect
export type NewAgent          = typeof agents.$inferInsert
export type KnowledgeEntry    = typeof knowledgeEntries.$inferSelect
export type NewKnowledgeEntry = typeof knowledgeEntries.$inferInsert
export type Call              = typeof calls.$inferSelect
export type NewCall           = typeof calls.$inferInsert
export type WebhookDelivery   = typeof webhookDeliveries.$inferSelect