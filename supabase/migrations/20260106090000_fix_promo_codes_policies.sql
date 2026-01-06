-- Fix RLS policies for promo codes:
-- Previous version referenced admin_users directly, but admin_users is protected by RLS.
-- Use SECURITY DEFINER RPC `admin_role()` to check admin status.

-- promo_codes policies
DROP POLICY IF EXISTS "Admins can view all promo codes" ON public.promo_codes;
DROP POLICY IF EXISTS "Admins can create promo codes" ON public.promo_codes;
DROP POLICY IF EXISTS "Admins can update promo codes" ON public.promo_codes;

CREATE POLICY "Admins can view all promo codes"
  ON public.promo_codes
  FOR SELECT
  TO authenticated
  USING (public.admin_role() IS NOT NULL);

CREATE POLICY "Admins can create promo codes"
  ON public.promo_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.admin_role() IS NOT NULL);

CREATE POLICY "Admins can update promo codes"
  ON public.promo_codes
  FOR UPDATE
  TO authenticated
  USING (public.admin_role() IS NOT NULL);

-- promo_code_redemptions admin policy
DROP POLICY IF EXISTS "Admins can view all redemptions" ON public.promo_code_redemptions;

CREATE POLICY "Admins can view all redemptions"
  ON public.promo_code_redemptions
  FOR SELECT
  TO authenticated
  USING (public.admin_role() IS NOT NULL);


