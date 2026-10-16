import app from "./app";
import { logger } from "./lib/logger";
import { runAuthMigrations } from "./lib/runMigrations";
import { processReadyBoothNotifications } from "./lib/pushNotifications";

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

void runAuthMigrations()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  })
  .catch(() => process.exit(1));

const pushSchedule = setInterval(() => {
  void processReadyBoothNotifications().catch((error) => {
    logger.error({ err: error }, "Scheduled booth-ready notification scan failed");
  });
}, 60_000);
pushSchedule.unref();

void processReadyBoothNotifications().catch((error) => {
  logger.error({ err: error }, "Initial booth-ready notification scan failed");
});
