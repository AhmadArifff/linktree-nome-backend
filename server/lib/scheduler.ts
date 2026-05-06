/**
 * Scheduler Service
 * Manages internal node-cron job for automated product creation (local/dev runtime).
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

let schedulerState: SchedulerState = {
  isRunning: false,
  totalRuns: SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS,
  completedRuns: 0,
  failedRuns: 0,
  isPaused: false,
};

let cronJob: cron.ScheduledTask | null = null;

function getCronHourMinute(cronExpression: string): {
  minute: number;
  hour: number;
} {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }

  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  if (
    Number.isNaN(minute) ||
    Number.isNaN(hour) ||
    minute < 0 ||
    minute > 59 ||
    hour < 0 ||
    hour > 23
  ) {
    throw new Error(`Invalid cron minute/hour: ${cronExpression}`);
  }
  return { minute, hour };
}

/**
 * Compute next run for Asia/Jakarta.
 * Internal scheduler uses Jakarta local cron (with timezone option).
 */
function getNextRunTime(): Date {
  const now = new Date();
  const { minute: targetMinute, hour: targetHour } = getCronHourMinute(
    SCHEDULED_PRODUCT_CONFIG.CRON_TIME
  );

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULED_PRODUCT_CONFIG.TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const map = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value])
  );

  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour);
  const minute = Number(map.minute);

  // Asia/Jakarta = UTC+7 (no DST)
  const nextRun = new Date(
    Date.UTC(year, month - 1, day, targetHour - 7, targetMinute, 0)
  );

  if (hour > targetHour || (hour === targetHour && minute >= targetMinute)) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }

  return nextRun;
}

export function initializeScheduler(): void {
  if (schedulerState.isRunning) {
    console.log("Scheduler is already running");
    return;
  }

  if (!cron.validate(SCHEDULED_PRODUCT_CONFIG.CRON_TIME)) {
    console.error(
      `Invalid cron expression: ${SCHEDULED_PRODUCT_CONFIG.CRON_TIME}`
    );
    return;
  }

  const { minute, hour } = getCronHourMinute(SCHEDULED_PRODUCT_CONFIG.CRON_TIME);
  const utcHour = (hour - 7 + 24) % 24;

  console.log("\nInitializing Product Creation Scheduler...");
  console.log(`   Cron Time (Jakarta): ${SCHEDULED_PRODUCT_CONFIG.CRON_TIME}`);
  console.log(`   Timezone: ${SCHEDULED_PRODUCT_CONFIG.TIMEZONE}`);
  console.log(
    `   Schedule: Daily at ${String(hour).padStart(2, "0")}:${String(
      minute
    ).padStart(2, "0")} WIB (${String(utcHour).padStart(2, "0")}:${String(
      minute
    ).padStart(2, "0")} UTC)`
  );
  console.log(
    `   Total Runs: ${SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS} days (1 year)`
  );
  console.log(
    `   Categories: ${getAllCategoryTemplates().length} (1 product per category per day)`
  );
  console.log(
    `   Daily Product Creation: ${SCHEDULED_PRODUCT_CONFIG.CATEGORIES_PER_RUN} products\n`
  );

  cronJob = cron.schedule(
    SCHEDULED_PRODUCT_CONFIG.CRON_TIME,
    async () => {
      if (schedulerState.isPaused) {
        console.log("Scheduler is paused, skipping this run");
        return;
      }

      if (
        schedulerState.completedRuns >= SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS
      ) {
        console.log(
          `Scheduler has completed all ${SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS} runs. Stopping scheduler...`
        );
        stopScheduler();
        return;
      }

      try {
        await createProductsForAllCategories();

        schedulerState.completedRuns += 1;
        schedulerState.lastRunTime = new Date();
        schedulerState.nextRunTime = getNextRunTime();

        console.log(
          `\nRun ${schedulerState.completedRuns}/${SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS} completed at ${schedulerState.lastRunTime.toLocaleString(
            "id-ID",
            { timeZone: SCHEDULED_PRODUCT_CONFIG.TIMEZONE }
          )}`
        );
        console.log(
          `   Next run: ${schedulerState.nextRunTime?.toLocaleString("id-ID", {
            timeZone: SCHEDULED_PRODUCT_CONFIG.TIMEZONE,
          })}\n`
        );
      } catch (error) {
        schedulerState.failedRuns += 1;
        console.error(
          "Error during scheduled product creation:",
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
    `Scheduler started. Next run: ${schedulerState.nextRunTime?.toLocaleString(
      "id-ID",
      { timeZone: SCHEDULED_PRODUCT_CONFIG.TIMEZONE }
    )}\n`
  );
}

export function stopScheduler(): void {
  if (!cronJob) return;
  cronJob.stop();
  cronJob = null;
  schedulerState.isRunning = false;
  console.log("Scheduler stopped");
}

export function pauseScheduler(): void {
  schedulerState.isPaused = true;
  console.log("Scheduler paused - will not execute tasks");
}

export function resumeScheduler(): void {
  if (!schedulerState.isRunning) {
    console.log("Scheduler is not running. Call initializeScheduler() first");
    return;
  }
  schedulerState.isPaused = false;
  console.log("Scheduler resumed");
}

export async function executeScheduledTaskNow(): Promise<void> {
  if (
    schedulerState.completedRuns >= SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS
  ) {
    console.log(
      `Max runs (${SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS}) already reached. Cannot execute more tasks.`
    );
    return;
  }

  console.log("Executing scheduled task immediately (manual trigger)...");
  try {
    await createProductsForAllCategories();
    schedulerState.completedRuns += 1;
    schedulerState.lastRunTime = new Date();
    schedulerState.nextRunTime = getNextRunTime();

    console.log(
      `Task executed successfully. Run count: ${schedulerState.completedRuns}/${SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS}`
    );
  } catch (error) {
    schedulerState.failedRuns += 1;
    console.error("Error executing scheduled task:", error);
  }
}

export function getSchedulerState(): SchedulerState {
  return {
    ...schedulerState,
    nextRunTime: getNextRunTime(),
  };
}

export function resetSchedulerState(): void {
  stopScheduler();
  schedulerState = {
    isRunning: false,
    totalRuns: SCHEDULED_PRODUCT_CONFIG.TOTAL_RUNS,
    completedRuns: 0,
    failedRuns: 0,
    isPaused: false,
  };
  console.log("Scheduler state reset");
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
