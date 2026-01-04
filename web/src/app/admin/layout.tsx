import { ReactNode } from 'react'
import { requireAdmin } from '@/lib/admin/guard'
import AdminLayoutClient from './admin-layout-client'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Vérification côté serveur (bloque si pas admin)
  await requireAdmin()

  return <AdminLayoutClient>{children}</AdminLayoutClient>
}


