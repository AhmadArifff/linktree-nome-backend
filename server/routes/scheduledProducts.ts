/**
 * Admin Routes for Scheduled Products
 * Endpoints to manage automatic product creation scheduler
 * All endpoints require JWT authentication
 */

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getSchedulerState,
  pauseScheduler,
  resumeScheduler,
  executeScheduledTaskNow,
  resetSchedulerState,
  stopScheduler,
} from "../lib/scheduler";

const router = Router();

/**
 * GET /api/admin/scheduled-products/status
 * Get current scheduler status and statistics
 * Requires: JWT token (admin)
 */
router.get("/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const state = getSchedulerState();

    // Calculate progress
    const progressPercentage =
      (state.completedRuns / state.totalRuns) * 100;
    const daysRemaining = state.totalRuns - state.completedRuns;

    res.status(200).json({
      success: true,
      data: {
        isRunning: state.isRunning,
        isPaused: state.isPaused,
        totalRuns: state.totalRuns,
        completedRuns: state.completedRuns,
        failedRuns: state.failedRuns,
        progressPercentage: progressPercentage.toFixed(2),
        daysRemaining,
        startTime: state.startTime,
        lastRunTime: state.lastRunTime,
        nextRunTime: state.nextRunTime,
      },
    });
  } catch (error) {
    console.error("Error fetching scheduler status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch scheduler status",
    });
  }
});

/**
 * POST /api/admin/scheduled-products/pause
 * Pause the scheduler (will not execute tasks, but cron job continues)
 * Requires: JWT token (admin)
 */
router.post("/pause", requireAuth, async (req: Request, res: Response) => {
  try {
    pauseScheduler();

    res.status(200).json({
      success: true,
      message: "Scheduler paused successfully",
      data: getSchedulerState(),
    });
  } catch (error) {
    console.error("Error pausing scheduler:", error);
    res.status(500).json({
      success: false,
      message: "Failed to pause scheduler",
    });
  }
});

/**
 * POST /api/admin/scheduled-products/resume
 * Resume the paused scheduler
 * Requires: JWT token (admin)
 */
router.post("/resume", requireAuth, async (req: Request, res: Response) => {
  try {
    resumeScheduler();

    res.status(200).json({
      success: true,
      message: "Scheduler resumed successfully",
      data: getSchedulerState(),
    });
  } catch (error) {
    console.error("Error resuming scheduler:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resume scheduler",
    });
  }
});

/**
 * POST /api/admin/scheduled-products/execute-now
 * Execute the scheduled task immediately (for testing/manual trigger)
 * Requires: JWT token (admin)
 * Warning: This counts towards the 365-run limit
 */
router.post(
  "/execute-now",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const state = getSchedulerState();

      // Check if max runs already reached
      if (state.completedRuns >= state.totalRuns) {
        return res.status(400).json({
          success: false,
          message: `Maximum runs (${state.totalRuns}) already reached. Cannot execute more tasks.`,
          data: state,
        });
      }

      // Execute the task
      await executeScheduledTaskNow();

      const updatedState = getSchedulerState();
      res.status(200).json({
        success: true,
        message: "Scheduled task executed successfully",
        data: updatedState,
      });
    } catch (error) {
      console.error("Error executing scheduled task:", error);
      res.status(500).json({
        success: false,
        message: "Failed to execute scheduled task",
      });
    }
  }
);

/**
 * POST /api/admin/scheduled-products/stop
 * Stop the scheduler completely (cannot be resumed)
 * Requires: JWT token (admin)
 */
router.post("/stop", requireAuth, async (req: Request, res: Response) => {
  try {
    stopScheduler();

    res.status(200).json({
      success: true,
      message: "Scheduler stopped successfully",
      data: getSchedulerState(),
    });
  } catch (error) {
    console.error("Error stopping scheduler:", error);
    res.status(500).json({
      success: false,
      message: "Failed to stop scheduler",
    });
  }
});

/**
 * POST /api/admin/scheduled-products/reset
 * Reset scheduler state and restart (admin use only)
 * Requires: JWT token (admin)
 * Warning: This resets the run counter to 0
 */
router.post("/reset", requireAuth, async (req: Request, res: Response) => {
  try {
    const confirmed = req.body.confirmed === true;

    if (!confirmed) {
      return res.status(400).json({
        success: false,
        message: "Reset requires confirmation. Send { confirmed: true }",
      });
    }

    resetSchedulerState();

    res.status(200).json({
      success: true,
      message:
        "Scheduler state reset successfully. Run initializeScheduler() to restart.",
      data: getSchedulerState(),
    });
  } catch (error) {
    console.error("Error resetting scheduler:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset scheduler",
    });
  }
});

/**
 * GET /api/admin/scheduled-products/info
 * Get scheduler configuration information
 * Requires: JWT token (admin)
 */
router.get("/info", requireAuth, async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        description:
          "Automatic product creation scheduler for ShopLink platform",
        schedule: {
          time: "06:30 WIB",
          timezone: "Asia/Jakarta (WIB)",
          frequency: "Daily",
          duration: "365 days (1 year)",
        },
        categories: [
          {
            id: "9fcb7e8a-7b72-4afc-bd7c-d2e7ca850c79",
            name: "Pakaian",
            emoji: "👕",
          },
          {
            id: "16de48e8-84f6-4c02-ae3f-dd8d53211b2e",
            name: "Aksesoris",
            emoji: "⌚",
          },
          {
            id: "eed9a3bf-594d-4888-9118-e50f4ead80ee",
            name: "Sepatu",
            emoji: "👟",
          },
          {
            id: "107e377a-c6e9-42b3-aa89-6d5c9885d88f",
            name: "Raket",
            emoji: "🏸",
          },
          {
            id: "45f8ef2c-9f7a-4aa2-8283-2c00a003fa5a",
            name: "Tas",
            emoji: "👜",
          },
        ],
        dailyCreation: {
          productsPerDay: 5,
          categoriesPerDay: 5,
          description: "1 product created per category per day",
        },
        productData: {
          generatedFields: [
            "category_id",
            "name",
            "short_description",
            "description",
            "price",
            "marketplace_url",
            "sort_order",
            "is_active",
          ],
          nameFormat: "Auto-generated based on category templates",
          priceFormat: "Numeric string only (e.g. 89000, without Rp prefix)",
          marketplaceUrl:
            "Random Tokopedia or Shopee search links for category",
          imageUrl: "Not generated (optional field)",
        },
        endpoints: {
          status: {
            method: "GET",
            path: "/api/admin/scheduled-products/status",
            description: "Get scheduler status and statistics",
          },
          execute: {
            method: "POST",
            path: "/api/admin/scheduled-products/execute-now",
            description: "Execute task immediately (manual trigger)",
          },
          pause: {
            method: "POST",
            path: "/api/admin/scheduled-products/pause",
            description: "Pause scheduler",
          },
          resume: {
            method: "POST",
            path: "/api/admin/scheduled-products/resume",
            description: "Resume paused scheduler",
          },
          stop: {
            method: "POST",
            path: "/api/admin/scheduled-products/stop",
            description: "Stop scheduler completely",
          },
          reset: {
            method: "POST",
            path: "/api/admin/scheduled-products/reset",
            body: { confirmed: true },
            description: "Reset scheduler state and run counter",
          },
          info: {
            method: "GET",
            path: "/api/admin/scheduled-products/info",
            description: "Get scheduler configuration info (this endpoint)",
          },
        },
      },
    });
  } catch (error) {
    console.error("Error fetching scheduler info:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch scheduler info",
    });
  }
});

/**
 * POST /api/test/execute-now
 * TEST ENDPOINT: Execute scheduled product creation immediately (NO AUTH)
 * FOR TESTING ONLY - Remove in production
 */
router.post("/execute-now", async (req: Request, res: Response) => {
  try {
    const { createProductsForAllCategories } = await import("../lib/createScheduledProduct");
    
    console.log("🧪 TEST: Executing product creation NOW");
    const result = await createProductsForAllCategories();
    
    res.status(200).json({
      success: true,
      message: "Test execution completed",
      data: result,
    });
  } catch (error) {
    console.error("Test execution error:", error);
    res.status(500).json({
      success: false,
      message: "Test execution failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
