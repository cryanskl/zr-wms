import 'dotenv/config';
import { pool } from './database';
import { NotificationsService } from './notifications/notifications.service';

const service = new NotificationsService();

async function runSchedulerOnce() {
  const lowStock = await service.scanLowStock(null);
  const dayReport = await service.generatePeriodReport('day', null);
  const weekReport = await service.generatePeriodReport('week', null);
  const monthReport = await service.generatePeriodReport('month', null);

  return {
    lowStock,
    reports: [dayReport, weekReport, monthReport],
  };
}

async function main() {
  if (process.env.SCHEDULER_ONCE === 'true') {
    const result = await runSchedulerOnce();
    console.log(JSON.stringify(result, null, 2));
    await pool?.end();
    return;
  }

  const intervalMs = Number(process.env.SCHEDULER_INTERVAL_MS ?? 15 * 60 * 1000);
  console.log(`WMS scheduler running every ${intervalMs}ms`);
  await runSchedulerOnce();
  setInterval(() => {
    runSchedulerOnce().catch((error) => {
      console.error('scheduler tick failed', error);
    });
  }, intervalMs);
}

main().catch(async (error) => {
  console.error(error);
  await pool?.end();
  process.exitCode = 1;
});
