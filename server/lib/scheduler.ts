/**
 * Scheduler Service
 * Manages cron jobs for automated product creation
 * Runs daily at 07:00 AM WIB (Asia/Jakarta timezone)
 * Total duration: 365 days (1 year)
 */

import cron from "node-cron";
import { createProductsForAllCategories } from "./createScheduledProduct";
import {
  SCHEDULED_PRODUCT_CONFIG,
  getAllCategoryTemplates,
} from "./scheduledProducts";

interface SchedulerState {
  isRunning: boolean;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  startTime?: Date;
  lastRunTime?: Date;
  nextRunTime?: Date;
  isPaused: boolean;
}

// Global scheduler state
let schedulerState: SchedulerState = {
  isRunning: false,
  totalRuns: SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS,
  completedRuns: 0,
  failedRuns: 0,
  isPaused: false,
};

let cronJob: cron.ScheduledTask | null = null;

/**
 * Initialize and start the scheduler
 * This should be called once when the server starts
 */
export function initializeScheduler(): void {
  if (schedulerState.isRunning) {
    console.log("⚠️  Scheduler is already running");
    return;
  }

  console.log("\n🚀 Initializing Product Creation Scheduler...");
  console.log(`   Cron Time: ${SCHEDULED_PRODUCT_CONFIG.CRON_TIME}`);
  console.log(`   Timezone: ${SCHEDULED_PRODUCT_CONFIG.TIMEZONE}`);
  console.log(
    `   Total Runs: ${SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS} days (1 year)`
  );
  console.log(
    `   Categories: ${getAllCategoryTemplates().length} (1 product per category per day)`
  );
  console.log(
    `   Daily Product Creation: ${SCHEDULED_PRODUCT_CONFIG.CATEGORIES_PER_RUN} products\n`
  );

  // Create cron job that runs at 7:00 AM WIB daily
  // Using UTC cron expression and timezone parameter
  cronJob = cron.schedule(
    SCHEDULED_PRODUCT_CONFIG.CRON_TIME,
    async () => {
      // Check if scheduler is paused
      if (schedulerState.isPaused) {
        console.log("⏸️  Scheduler is paused, skipping this run");
        return;
      }

      // Check if max runs reached
      if (
        schedulerState.completedRuns >= SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS
      ) {
        console.log(
          "✅ Scheduler has completed all 365 runs. Stopping scheduler..."
        );
        stopScheduler();
        return;
      }

      try {
        // Execute daily product creation
        const result = await createProductsForAllCategories();

        schedulerState.completedRuns += 1;
        schedulerState.lastRunTime = new Date();
        schedulerState.nextRunTime = getNextRunTime();

        // Log run completion
        console.log(
          `\n📈 Run ${schedulerState.completedRuns}/${SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS} completed at ${schedulerState.lastRunTime.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`
        );
        console.log(
          `   Next run: ${schedulerState.nextRunTime?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}\n`
        );
      } catch (error) {
        schedulerState.failedRuns += 1;
        console.error(
          "❌ Error during scheduled product creation:",
          error instanceof Error ? error.message : error
        );
      }
    },
    {
      timezone: SCHEDULED_PRODUCT_CONFIG.TIMEZONE,
    }
  );

  schedulerState.isRunning = true;
  schedulerState.startTime = new Date();
  schedulerState.nextRunTime = getNextRunTime();

  console.log(
    `✅ Scheduler started! Next run: ${schedulerState.nextRunTime?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}\n`
  );
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    schedulerState.isRunning = false;
    console.log("⛔ Scheduler stopped");
  }
}

/**
 * Pause the scheduler (cron job continues to run, but won't execute tasks)
 */
export function pauseScheduler(): void {
  schedulerState.isPaused = true;
  console.log("⏸️  Scheduler paused - will not execute tasks");
}

/**
 * Resume the scheduler
 */
export function resumeScheduler(): void {
  if (!schedulerState.isRunning) {
    console.log("⚠️  Scheduler is not running. Call initializeScheduler() first");
    return;
  }
  schedulerState.isPaused = false;
  console.log("▶️  Scheduler resumed");
}

/**
 * Force execute the scheduled task immediately (for testing)
 */
export async function executeScheduledTaskNow(): Promise<void> {
  if (
    schedulerState.completedRuns >= SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS
  ) {
    console.log(
      "⚠️  Max runs (365) already reached. Cannot execute more tasks."
    );
    return;
  }

  console.log("🔄 Executing scheduled task immediately (manual trigger)...");
  try {
    const result = await createProductsForAllCategories();
    schedulerState.completedRuns += 1;
    schedulerState.lastRunTime = new Date();
    schedulerState.nextRunTime = getNextRunTime();

    console.log(
      `✅ Task executed successfully. Run count: ${schedulerState.completedRuns}/${SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS}`
    );
  } catch (error) {
    schedulerState.failedRuns += 1;
    console.error("❌ Error executing scheduled task:", error);
  }
}

/**
 * Get current scheduler state
 */
export function getSchedulerState(): SchedulerState {
  return {
    ...schedulerState,
    nextRunTime: getNextRunTime(),
  };
}

/**
 * Get next scheduled run time
 */
function getNextRunTime(): Date {
  const now = new Date();
  const nextRun = new Date(now);

  // Set time to 7:00 AM WIB
  nextRun.setUTCHours(0, 0, 0, 0); // Reset to midnight UTC

  // Convert to WIB (UTC+7)
  nextRun.setUTCHours(0, 0, 0, 0);
  nextRun.setUTCHours(nextRun.getUTCHours() + 7);

  // Adjust to 7:00 AM WIB
  const wibHour = 7;
  const wibTime = new Date(nextRun);
  wibTime.setUTCHours(wibHour - 7, 0, 0, 0);

  // If the time has already passed today, schedule for tomorrow
  if (wibTime < now) {
    wibTime.setUTCDate(wibTime.getUTCDate() + 1);
  }

  return wibTime;
}

/**
 * Reset scheduler state (admin use only)
 */
export function resetSchedulerState(): void {
  stopScheduler();
  schedulerState = {
    isRunning: false,
    totalRuns: SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS,
    completedRuns: 0,
    failedRuns: 0,
    isPaused: false,
  };
  console.log("🔄 Scheduler state reset");
}

export default {
  initializeScheduler,
  stopScheduler,
  pauseScheduler,
  resumeScheduler,
  executeScheduledTaskNow,
  getSchedulerState,
  resetSchedulerState,
};
