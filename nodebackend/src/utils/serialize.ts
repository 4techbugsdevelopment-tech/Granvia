// Prisma returns camelCase keys, Prisma.Decimal instances, and Date objects.
// The React frontend expects snake_case with decimals-as-strings and ISO
// timestamps. These helpers convert Prisma records back into that wire shape.

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
}

function isDecimal(value: unknown): value is { toString(): string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toNumber?: unknown }).toNumber === 'function'
  );
}

/** Deep-converts an object's keys to snake_case and normalises scalar types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function snakeKeys(value: any): any {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return Number(value);
  if (isDecimal(value)) return value.toString(); // Keep decimals as strings on the wire.
  if (Array.isArray(value)) return value.map(snakeKeys);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[toSnake(k)] = snakeKeys(v);
    }
    return out;
  }
  return value;
}

/** Safely parse a stored JSON-string column back into an array/object. */
export function parseJsonField(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * snake_cases a Prisma row/array for output AND parses the named JSON-string
 * columns back into arrays/objects. Use for models with `json()` columns:
 * job_posts, company_sites, agreements, etc.
 */
export function serializeOut(value: unknown, jsonFields: string[] = []): unknown {
  const snaked = snakeKeys(value);
  const fix = (obj: unknown) => {
    if (obj && typeof obj === 'object') {
      const rec = obj as Record<string, unknown>;
      for (const f of jsonFields) {
        if (typeof rec[f] === 'string') rec[f] = parseJsonField(rec[f]);
      }
    }
    return obj;
  };
  return Array.isArray(snaked) ? snaked.map(fix) : fix(snaked);
}

function toCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Converts a validated snake_case request body into a camelCase object for
 * Prisma writes. Keys listed in `jsonFields` are JSON.stringified (array/object
 * columns stored as NVARCHAR(Max)). `undefined` values are dropped so partial
 * updates only touch provided fields.
 */
export function toPrismaData(
  input: Record<string, unknown>,
  jsonFields: string[] = []
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    out[toCamel(k)] = jsonFields.includes(k) && v !== null ? JSON.stringify(v) : v;
  }
  return out;
}
