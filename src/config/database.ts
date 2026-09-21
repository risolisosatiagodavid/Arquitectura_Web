import fs from 'node:fs';
import path from 'node:path';

import 'dotenv/config';
import DatabaseDriver from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';

import type { Database } from '../models/store.model.js';

const databasePath = process.env.DB_PATH ?? 'data/arqweb.sqlite';
const databaseDirectory = path.dirname(databasePath);
fs.mkdirSync(databaseDirectory, { recursive: true });

export const db = new Kysely<Database>({
  dialect: new SqliteDialect({
    database: new DatabaseDriver(databasePath),
  }),
});

export const initializeDatabase = async () => {
  await db.schema
    .createTable('users')
    .ifNotExists()
    .addColumn('id', 'integer', (column) => column.primaryKey().autoIncrement())
    .addColumn('nombre', 'text', (column) => column.notNull())
    .addColumn('email', 'text', (column) => column.notNull().unique())
    .addColumn('password_hash', 'text', (column) => column.notNull())
    .addColumn('domicilio', 'text', (column) => column.notNull())
    .addColumn('username', 'text')
    .addColumn('telefono', 'text')
    .addColumn('created_at', 'text', (column) => column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createTable('stores')
    .ifNotExists()
    .addColumn('id', 'integer', (column) => column.primaryKey().autoIncrement())
    .addColumn('store_name', 'text', (column) => column.notNull().unique())
    .addColumn('descripcion', 'text', (column) => column.notNull())
    .addColumn('owner_id', 'integer', (column) => column.notNull().references('users.id'))
    .addColumn('visibilidad', 'text', (column) => column.notNull())
    .addColumn('zona', 'text')
    .addColumn('categoria', 'text')
    .addColumn('telefono', 'text')
    .addColumn('created_at', 'text', (column) => column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
};