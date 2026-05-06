/**
 * Create Scheduled Product
 * Handles insertion of auto-generated products into Supabase
 * Uses service role key for admin operations (no auth required)
 */

import { supabase } from "./supabase";
import { generateProductData } from "./scheduledProducts";

export interface ScheduledProductLog {
  id?: string;
  category_id: string;
  product_id?: string;
  status: "success" | "failed";
  error_message?: string;
  executed_at?: string;
  created_at?: string;
}

/**
 * Create a product for a specific category with retry logic
 * @param categoryId The category ID to create product for
 * @param retryCount Current retry attempt (internal use)
 * @returns Success status and product data
 */
export async function createProductForCategory(categoryId: string, retryCount: number = 0): Promise<any> {
  const MAX_RETRIES = 3;
  
  try {
    // Generate product data
    const productData = generateProductData(categoryId);

    if (!productData) {
      console.warn(`⚠️  Category ${categoryId} not found in templates`);
      return {
        success: false,
        error: `Category ${categoryId} not found`,
        categoryId,
      };
    }

    console.log(`   Inserting product: "${productData.name}" to database...`);

    // Insert product into Supabase
    const { data, error } = await supabase
      .from("products")
      .insert([productData])
      .select();

    if (error) {
      // Retry logic for database errors
      if (retryCount < MAX_RETRIES && error.message.includes('connection')) {
        console.warn(
          `⚠️  Retry ${retryCount + 1}/${MAX_RETRIES} for category ${categoryId} (connection error)`
        );
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        return createProductForCategory(categoryId, retryCount + 1);
      }

      console.error(
        `❌ DB Error creating product for category ${categoryId}: ${error.message}`
      );
      
      // Log to database
      await logScheduledProductCreation({
        category_id: categoryId,
        status: "failed",
        error_message: `${error.message} (attempt ${retryCount + 1}/${MAX_RETRIES})`,
      });

      return {
        success: false,
        error: error.message,
        categoryId,
        retryAttempts: retryCount + 1,
      };
    }

    const productName = data?.[0]?.name || "Unknown";
    const productId = data?.[0]?.id;
    
    console.log(
      `   ✅ [${categoryId}] Created: "${productName}"`
    );

    // Log successful creation
    await logScheduledProductCreation({
      category_id: categoryId,
      product_id: productId,
      status: "success",
    });

    return {
      success: true,
      categoryId,
      product: data?.[0],
    };
  } catch (error) {
    // Retry logic for unexpected errors
    if (retryCount < MAX_RETRIES && error instanceof Error && error.message.includes('timeout')) {
      console.warn(
        `⚠️  Retry ${retryCount + 1}/${MAX_RETRIES} for category ${categoryId} (timeout)`
      );
      await new Promise(resolve => setTimeout(resolve, 2000));
      return createProductForCategory(categoryId, retryCount + 1);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `❌ [${categoryId}] Error: ${errorMessage} (attempt ${retryCount + 1}/${MAX_RETRIES})`
    );

    // Log error
    await logScheduledProductCreation({
      category_id: categoryId,
      status: "failed",
      error_message: `${errorMessage} (attempt ${retryCount + 1}/${MAX_RETRIES})`,
    });

    return {
      success: false,
      error: errorMessage,
      categoryId,
      retryAttempts: retryCount + 1,
    };
  }
}

/**
 * Create products for all categories (called daily at 11:55 AM WIB/Jakarta)
 * @returns Array of results for each category
 */
export async function createProductsForAllCategories() {
  const categoryIds = [
    "9fcb7e8a-7b72-4afc-bd7c-d2e7ca850c79", // Pakaian
    "16de48e8-84f6-4c02-ae3f-dd8d53211b2e", // Aksesoris
    "eed9a3bf-594d-4888-9118-e50f4ead80ee", // Sepatu
    "107e377a-c6e9-42b3-aa89-6d5c9885d88f", // Raket
    "45f8ef2c-9f7a-4aa2-8283-2c00a003fa5a", // Tas
  ];

  const executionTime = new Date().toLocaleString("id-ID", { 
    timeZone: "Asia/Jakarta",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📅 DAILY PRODUCT CREATION BATCH`);
  console.log(`⏰ Execution Time: ${executionTime} (Asia/Jakarta)`);
  console.log(`📦 Creating ${categoryIds.length} products (1 per category)...`);
  console.log(`${'='.repeat(60)}\n`);

  const results = await Promise.all(
    categoryIds.map((categoryId) => createProductForCategory(categoryId))
  );

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 BATCH SUMMARY`);
  console.log(`   ✅ Successful: ${successCount}/${categoryIds.length}`);
  console.log(`   ❌ Failed: ${failureCount}/${categoryIds.length}`);
  console.log(`${'='.repeat(60)}\n`);

  return {
    timestamp: new Date().toISOString(),
    totalCategories: categoryIds.length,
    successCount,
    failureCount,
    results,
  };
}

/**
 * Log scheduled product creation to database
 * @param log The log entry to save
 */
export async function logScheduledProductCreation(
  log: ScheduledProductLog
) {
  try {
    const { data, error } = await supabase
      .from("scheduled_products_log")
      .insert([
        {
          category_id: log.category_id,
          product_id: log.product_id,
          status: log.status,
          error_message: log.error_message,
          executed_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error("Error logging scheduled product creation:", error);
      return null;
    }

    return data?.[0];
  } catch (error) {
    console.error("Unexpected error logging scheduled product:", error);
    return null;
  }
}

export default {
  createProductForCategory,
  createProductsForAllCategories,
  logScheduledProductCreation,
};
