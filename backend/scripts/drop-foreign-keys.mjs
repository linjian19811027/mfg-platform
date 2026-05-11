import mysql from 'mysql2/promise';

function env(name, fallback = undefined) {
  return process.env[name] ?? fallback;
}

async function main() {
  const host = env('DATABASE_HOST', 'localhost');
  const port = Number(env('DATABASE_PORT', '3306'));
  const user = env('DATABASE_USER', 'root');
  const password = env('DATABASE_PASS', '');
  const database = env('DATABASE_NAME', 'mfg_platform');

  const conn = await mysql.createConnection({ host, port, user, password, database, multipleStatements: false });

  const [rows] = await conn.query(
    `SELECT TABLE_NAME, CONSTRAINT_NAME
       FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ?
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [database],
  );

  const constraints = rows;
  if (!Array.isArray(constraints) || constraints.length === 0) {
    console.log(`[drop-fk] no foreign keys found in schema ${database}`);
    await conn.end();
    return;
  }

  for (const row of constraints) {
    const tableName = row.TABLE_NAME;
    const constraintName = row.CONSTRAINT_NAME;
    const sql = `ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraintName}\``;
    await conn.query(sql);
    console.log(`[drop-fk] dropped ${constraintName} on ${tableName}`);
  }

  await conn.end();
  console.log(`[drop-fk] done. dropped ${constraints.length} foreign keys.`);
}

main().catch((err) => {
  console.error('[drop-fk] failed:', err);
  process.exit(1);
});
