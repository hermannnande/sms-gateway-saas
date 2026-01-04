-- Expire any active subscriptions that point to hidden plans (legacy plans).
-- This prevents "free" accounts from inheriting old quotas (e.g., 10000).

UPDATE public.subscriptions s
SET status = 'expired'
FROM public.plans p
WHERE p.id = s.plan_id
  AND p.is_visible = false
  AND s.status = 'active'
  AND (s.current_period_end IS NULL OR now() <= s.current_period_end);


