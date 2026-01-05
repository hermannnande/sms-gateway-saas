-- =============================================
-- DIAGNOSTIC: Vérifier pourquoi l'accès admin est refusé
-- Exécute ces requêtes une par une dans Supabase SQL Editor
-- =============================================

-- 1) Vérifier si ton compte existe dans auth.users
SELECT 
  id as user_id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'hermannnande@gmail.com';

-- 2) Vérifier si tu es dans admin_users
SELECT *
FROM public.admin_users
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'hermannnande@gmail.com'
);

-- 3) Compter tous les admins
SELECT COUNT(*) as total_admins
FROM public.admin_users;

-- =============================================
-- SOLUTION: Si rien n'apparaît dans admin_users, force l'ajout
-- =============================================

-- Supprimer d'abord (si existe avec mauvais état)
DELETE FROM public.admin_users
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'hermannnande@gmail.com'
);

-- Puis réinsérer
INSERT INTO public.admin_users (user_id, role, created_at)
SELECT 
  id,
  'SUPER_ADMIN',
  NOW()
FROM auth.users
WHERE email = 'hermannnande@gmail.com';

-- Vérifier que c'est bien là
SELECT 
  au.id,
  au.user_id,
  au.role,
  au.created_at,
  u.email
FROM public.admin_users au
JOIN auth.users u ON u.id = au.user_id
WHERE u.email = 'hermannnande@gmail.com';




