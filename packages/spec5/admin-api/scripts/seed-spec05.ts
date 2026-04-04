import { closePool } from '../src/db';
import { seedSpec05Claims } from '../src/services/seed-spec05';

const run = async (): Promise<void> => {
  await seedSpec05Claims();
  console.log('SPEC-05 seed complete: inserted 20 claims across statuses.');
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });
