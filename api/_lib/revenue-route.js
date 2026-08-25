import { waitUntil } from '@vercel/functions';
import { isAdmin, isSameOrigin } from './auth.js';
import { database, ensureSchema } from './db.js';
import { json, method, parseJson } from './http.js';
import { analyzeLeadWithAgent, needsRevenueAnalysis, recommendationFingerprint } from './revenue-agent.js';
import { z } from 'zod';

const actionSchema = z.object({ id: z.string().uuid(), action: z.enum(['reviewed', 'dismissed']) }).strict();

async function refreshRecommendations(sql, candidates) {
  for (const lead of candidates.filter(needsRevenueAnalysis).slice(0, 5)) {
    try {
      const recommendation = await analyzeLeadWithAgent(lead);
      const fingerprint = recommendationFingerprint(lead);
      await sql`UPDATE leads SET ai_recommendation=${JSON.stringify(recommendation)}, ai_recommendation_fingerprint=${fingerprint},
        ai_recommended_at=NOW(), ai_reviewed_at=NULL, ai_dismissed_at=NULL
        WHERE id=${lead.id} AND updated_at=${lead.updated_at} AND is_test=FALSE AND status NOT IN ('booked','lost')`;
    } catch {
      // Keep the CRM healthy and retry stale recommendations later; never log customer data.
    }
  }
}

export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'PATCH'])) return;
  if (!isAdmin(req)) return json(res, 401, { error: 'Authentication required.' });
  if (req.method === 'PATCH' && !isSameOrigin(req)) return json(res, 403, { error: 'Same-origin request required.' });
  try {
    await ensureSchema();
    const sql = database();
    if (req.method === 'PATCH') {
      const parsed = actionSchema.safeParse(parseJson(req));
      if (!parsed.success) return json(res, 400, { error: 'Invalid recommendation update.' });
      const { id, action } = parsed.data;
      const rows = action === 'reviewed'
        ? await sql`UPDATE leads SET ai_reviewed_at=NOW() WHERE id=${id} AND ai_recommendation IS NOT NULL RETURNING id,ai_reviewed_at,ai_dismissed_at`
        : await sql`UPDATE leads SET ai_dismissed_at=NOW() WHERE id=${id} AND ai_recommendation IS NOT NULL RETURNING id,ai_reviewed_at,ai_dismissed_at`;
      return rows[0] ? json(res, 200, { lead: rows[0] }) : json(res, 404, { error: 'Recommendation not found.' });
    }
    const candidates = await sql`SELECT * FROM leads WHERE is_test=FALSE AND consent=TRUE AND status NOT IN ('booked','lost') ORDER BY updated_at DESC LIMIT 100`;
    const stale = candidates.filter(needsRevenueAnalysis);
    if (stale.length) waitUntil(refreshRecommendations(sql, stale));
    const queue = candidates.filter(lead => lead.ai_recommendation && !lead.ai_dismissed_at)
      .map(lead => ({ id: lead.id, name: lead.name, phone: lead.phone, status: lead.status, assigned_to: lead.assigned_to,
        next_follow_up_at: lead.next_follow_up_at, last_contacted_at: lead.last_contacted_at, ai_recommendation: lead.ai_recommendation,
        ai_recommended_at: lead.ai_recommended_at, ai_reviewed_at: lead.ai_reviewed_at }))
      .sort((a, b) => b.ai_recommendation.score - a.ai_recommendation.score);
    return json(res, 200, { queue, refreshing: Math.min(stale.length, 5), advisory_only: true });
  } catch {
    return json(res, 500, { error: 'Could not load the AI Action Queue.' });
  }
}
