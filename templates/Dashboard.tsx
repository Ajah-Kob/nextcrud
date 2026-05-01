import HeaderDashboard from '@/components/globals/HeaderDashboard'
import FooterDashboard from '@/components/globals/FooterDashboard'
import Aside from '@/components/globals/Aside'
import Drawer from '@/components/globals/Drawer'

export default async function TemplateDashboard({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <section className="flex h-dvh">
        <Aside />
        <main className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
          <HeaderDashboard />
          <section className="flex-1">{children}</section>
          <FooterDashboard />
        </main>
      </section>
      <Drawer />
    </>
  )
}
