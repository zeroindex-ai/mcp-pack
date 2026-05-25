// Vendor-type drift guard.
//
// The Turso client hand-types the vendor's JSON shapes (Database, with its
// mixed PascalCase/snake_case keys) in turso.ts. The live API can silently
// add/rename/retype fields, leaving our hand-typed shapes wrong without
// anything failing.
//
// This test parses a committed, fully sanitized fixture (placeholder org/db
// names, fake UUIDs — no real tokens or org data) through a Zod schema that
// mirrors the hand-typed `Database` shape, then runs the same key-remapping
// projection list_databases uses and asserts the mapped keys. If someone
// changes the hand-typed shape incompatibly (e.g. renames `Name` -> `name`),
// the `satisfies z.ZodType<Database>` annotation stops compiling and/or the
// projection assertion below fails.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { Database } from './turso.js';

function loadFixture(name: string): unknown {
  const url = new URL(`./fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
}

const databaseParentSchema = z.object({
  id: z.string(),
  name: z.string(),
  branched_at: z.string(),
});

// Mirror of the hand-typed `Database`. `satisfies z.ZodType<Database>` ties the
// schema to the type at compile time.
const databaseSchema = z.object({
  Name: z.string(),
  DbId: z.string(),
  Hostname: z.string(),
  block_reads: z.boolean(),
  block_writes: z.boolean(),
  regions: z.array(z.string()),
  primaryRegion: z.string(),
  group: z.string(),
  delete_protection: z.boolean(),
  parent: databaseParentSchema.nullable(),
}) satisfies z.ZodType<Database>;

const listDatabasesSchema = z.object({ databases: z.array(databaseSchema) });

describe('turso vendor-type contract', () => {
  it('list-databases fixture parses through the hand-typed Database schema', () => {
    const parsed = listDatabasesSchema.parse(loadFixture('list-databases.json'));
    expect(parsed.databases.length).toBeGreaterThan(0);

    // Reproduce the list_databases projection (PascalCase vendor -> lowercase).
    const projected = parsed.databases.map((d: Database) => ({
      name: d.Name,
      hostname: d.Hostname,
      region: d.primaryRegion,
    }));
    expect(Object.keys(projected[0]!)).toEqual(['name', 'hostname', 'region']);
    expect(projected[0]!.name).toBe('example-db');
    expect(projected[0]!.hostname).toContain('turso.io');
    expect(projected[0]!.region).toBe('ord');
  });

  it('rejects a fixture missing a hand-typed field (proves the guard bites)', () => {
    const broken = loadFixture('list-databases.json') as { databases: Record<string, unknown>[] };
    delete broken.databases[0]!.Hostname;
    expect(() => listDatabasesSchema.parse(broken)).toThrow();
  });
});
