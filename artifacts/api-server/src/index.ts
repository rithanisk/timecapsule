import app from "./app";
import { logger } from "./lib/logger";
import { runAuthMigrations } from "./lib/runMigrations";
import { processReadyBoothNotifications } from "./lib/pushNotifications";
import { purgeExpiredBooths } from "./lib/retention";

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

void runAuthMigrations();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

const pushSchedule = setInterval(() => {
  void processReadyBoothNotifications().catch((error) => {
    logger.error({ err: error }, "Scheduled booth-ready notification scan failed");
  });
}, 60_000);
pushSchedule.unref();

const retentionSchedule = setInterval(() => {
  void purgeExpiredBooths().catch((error) => {
    logger.error({ err: error }, "Expired booth cleanup failed");
  });
}, 60 * 60 * 1000);
retentionSchedule.unref();

void processReadyBoothNotifications().catch((error) => {
  logger.error({ err: error }, "Initial booth-ready notification scan failed");
});
void purgeExpiredBooths().catch((error) => {
  logger.error({ err: error }, "Initial expired booth cleanup failed");
});
