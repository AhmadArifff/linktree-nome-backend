/**
 * Vercel Cron Job Handler
 * This is an API route that Vercel Cron Jobs will call automatically
 * 
 * Setup in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/scheduled-products",
 *     "schedule": "30 23 * * *"
 *   }]
 * }
 * 
 * The schedule "30 23 * * *" means:
 *   - Minute: 30
 *   - Hour: 23 (UTC)
 *   - Day: every day (*)
 * 
 * For Asia/Jakarta (UTC+7), this translates to:
 *   - 23:30 UTC = 06:30 Jakarta time (next day)
 */

import { Request, Response } from 'express';
import { createProductsForAllCategories } from '../../server/lib/createScheduledProduct';

export default async function handler(req: Request, res: Response) {
  // Verify the request method
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret for security
  // Vercel sends it as: Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  const expectedAuth = `Bearer ${cronSecret}`;

  // Debug log (remove in production)
  console.log('[Cron Auth Check]');
  console.log(`  Authorization header: ${authHeader ? 'present' : 'missing'}`);
  console.log(`  CRON_SECRET in env: ${cronSecret ? 'present' : 'missing'}`);

  // Check authorization
  if (!cronSecret) {
    console.error('? CRON_SECRET not set in environment');
    return res.status(500).json({ error: 'Configuration error: CRON_SECRET not set' });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('??  Unauthorized cron request: Invalid Authorization header');
    return res.status(401).json({ error: 'Unauthorized: Invalid Authorization header' });
  }

  if (authHeader !== expectedAuth) {
    console.warn('??  Unauthorized cron request: Invalid CRON_SECRET');
    return res.status(401).json({ error: 'Unauthorized: Invalid CRON_SECRET' });
  }

  try {
    console.log('\n?? Vercel Cron: Starting scheduled product creation...');
    console.log(`   Time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
    
    const result = await createProductsForAllCategories();
    
    console.log('? Vercel Cron: Execution completed successfully');
    
    return res.status(200).json({
      success: true,
      message: 'Scheduled products created successfully',
      result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('? Vercel Cron: Execution failed:', errorMessage);
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
}
