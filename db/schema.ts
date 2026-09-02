import {
  index,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text().primaryKey(),
  email: text().notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
});

export const sessions = sqliteTable(
  'sessions',
  {
    id: text().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('idx_sessions_token_hash').on(table.tokenHash)],
);

export const experiments = sqliteTable('experiments', {
  id: text().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  question: text().notNull(),
  metric: text().notNull(),
  unit: text().notNull(),
  calculation: text().notNull(),
  missingRule: text('missing_rule').notNull(),
  duplicateRule: text('duplicate_rule').notNull(),
  outlierRule: text('outlier_rule').notNull(),
  roundingRule: text('rounding_rule').notNull(),
  weekStart: text('week_start').notNull(),
  planBefore: text('plan_before').notNull(),
  planAfter: text('plan_after'),
  changedAt: text('changed_at'),
  changedReason: text('changed_reason'),
  createdAt: text('created_at').notNull(),
});

export const records = sqliteTable(
  'records',
  {
    id: text().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recordDate: text('record_date').notNull(),
    value: real().notNull(),
    note: text().notNull().default(''),
    phase: text().notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_records_user_date').on(table.userId, table.recordDate),
    index('idx_records_user_date').on(table.userId, table.recordDate),
  ],
);

export const legacyRecords = sqliteTable(
  'legacy_records',
  {
    id: text().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    legacyId: text('legacy_id').notNull(),
    recordDate: text('record_date').notNull(),
    value: real().notNull(),
    unit: text().notNull(),
    memo: text().notNull(),
    tag: text().notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_legacy_records_user_id').on(table.userId, table.legacyId),
    index('idx_legacy_records_user_date').on(table.userId, table.recordDate),
  ],
);
