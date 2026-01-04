-- Vérifier si des utilisateurs existent dans auth.users
SELECT 
  id,
  email,
  created_at,
  confirmed_at,
  email_confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Vérifier les organisations créées
SELECT * FROM organizations ORDER BY created_at DESC LIMIT 5;

-- Vérifier les membres d'organisations
SELECT 
  om.*,
  o.name as org_name,
  u.email as user_email
FROM org_members om
LEFT JOIN organizations o ON om.org_id = o.id
LEFT JOIN auth.users u ON om.user_id = u.id
ORDER BY om.created_at DESC
LIMIT 5;







