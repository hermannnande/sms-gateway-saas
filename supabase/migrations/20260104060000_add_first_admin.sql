-- Migration: Ajouter le premier admin (hermannnande@gmail.com)

-- Récupérer l'user_id depuis auth.users et l'insérer dans admin_users
INSERT INTO public.admin_users (user_id, role, created_at)
SELECT 
  id,
  'SUPER_ADMIN',
  NOW()
FROM auth.users
WHERE email = 'hermannnande@gmail.com'
ON CONFLICT (user_id) 
DO UPDATE SET 
  role = excluded.role,
  updated_at = NOW();

-- Message de confirmation
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hermannnande@gmail.com';
  
  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE 'Admin ajouté avec succès: hermannnande@gmail.com (user_id: %)', v_user_id;
  ELSE
    RAISE WARNING 'Utilisateur hermannnande@gmail.com non trouvé. Assurez-vous que le compte existe dans auth.users';
  END IF;
END $$;

