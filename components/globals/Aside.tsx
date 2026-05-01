'use client'

import LogoAside from '@/components/globals/LogoAside'
import { useAside } from '@/store/useAside'

export default function Aside() {
  // Store
  const minimize = useAside((state) => state.minimize)

  return (
    <aside
      className={`hidden md:block ${
        minimize ? 'w-20' : 'w-64'
      } animated border-r border-gray-200 bg-gray-100`}
    >
      <LogoAside />
    </aside>
  )
}
