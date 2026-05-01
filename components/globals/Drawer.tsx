'use client'

import { useDrawer } from '@/store/useDrawer'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { SCHOOL_NAME } from '@/config/constants'
import { X, Users } from 'lucide-react'

export default function Drawer() {
  const open = useDrawer((state) => state.show)
  const toggle = useDrawer((state) => state.toggleShow)
  const { data: session } = useSession()
  const pathname = usePathname()

  const isAdmin =
    session?.user?.role === 'SUPERADMIN' || session?.user?.role === 'ADMIN'

  return (
    <div
      className={`${
        open ? 'w-64 z-10 opacity-100' : 'w-0 -z-0 opacity-0'
      } fixed top-0 left-0 h-dvh max-w-64 animated overflow-hidden bg-secondary`}
    >
      {/* Header */}
      <div className="min-w-64 px-5 border-b border-tertiary border-r">
        <div className="flex items-center justify-between gap-3 h-16">
          <h1 className="">
            <Link href="/">{SCHOOL_NAME}</Link>
          </h1>

          <button className="button button--circle">
            <X onClick={toggle} />
          </button>
        </div>
      </div>

      {/* Nav */}
      {isAdmin && (
        <nav className="min-w-64 p-2 flex flex-col gap-1">
          <Link
            href="/dashboard/users"
            onClick={toggle}
            className={`flex items-center gap-3 px-3 py-2 rounded animated hover:bg-tertiary ${
              pathname === '/dashboard/users' ? 'bg-tertiary font-medium' : ''
            }`}
          >
            <Users size={20} />
            <span>Users</span>
          </Link>
        </nav>
      )}
    </div>
  )
}
