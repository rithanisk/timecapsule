import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/runMigrations";
import { migrateCompletedStrips } from './lib/stripImage';

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

void runMigrations()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
      void migrateCompletedStrips((boothId, error) => logger.error({ boothId, err: error }, 'Could not migrate completed photostrip'))
        .catch((error) => logger.error({ err: error }, 'Could not scan completed photostrips'));
    });
  })
  .catch(() => process.exit(1));
