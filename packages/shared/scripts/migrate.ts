import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../src/db';
import { logger } from '../src/logger';

const run = async (): Promise<void> => {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');
  await pool.query(sql);
  logger.info({ schemaPath }, 'Migration completed');
};

run()
  .catch((error) => {
    logger.error({ err: error }, 'Migration failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
