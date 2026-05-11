-- Hotfix: unstick any message currently stuck in "sending" so campaigns can
-- progress. Resets device_id / sim_subscription_id so claim_messages_atomic
-- can pick them up again.
UPDATE messages
   SET status = 'queued',
       device_id = NULL,
       sim_subscription_id = NULL,
       last_error = COALESCE(last_error, '') ||
                    ' | Auto-requeue: hotfix 20260511020000'
 WHERE status = 'sending'
   AND sent_at IS NULL;
