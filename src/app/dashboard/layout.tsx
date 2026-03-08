'use client'
// FILE: src/app/dashboard/layout.tsx
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Bot, Phone, BarChart3, Settings, Zap, Bell, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard',           label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/agents',    label: 'Agents',    icon: Bot },
  { href: '/dashboard/calls',     label: 'Call Log',  icon: Phone },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/settings',  label: 'Settings',  icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const Sidebar = ({ mobile = false }) => (
    <div className={cn(
      'flex flex-col bg-black/60 backdrop-blur-xl border-white/10 border-r h-full',
      mobile ? 'w-64' : 'w-56'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 border-white/10 border-b h-16">
        <div className="flex flex-shrink-0 justify-center items-center bg-green-500 rounded-lg w-8 h-8">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm">VocalHQ</p>
          <p className="text-[10px] text-white/40 uppercase tracking-widest">AI Receptionist</p>
        </div>
        {mobile && (
          <button onClick={() => setOpen(false)} className="ml-auto text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all',
                active
                  ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              )}>
              <Icon className="flex-shrink-0 w-4 h-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-white/10 border-t">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex justify-center items-center bg-green-500/20 rounded-full w-7 h-7">
            <span className="font-bold text-green-400 text-xs">A</span>
          </div>
          <div>
            <p className="font-medium text-white text-xs">Admin</p>
            <p className="text-[10px] text-white/40">admin@vocalhq.io</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex bg-zinc-950 h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0 h-full">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="lg:hidden z-50 fixed inset-0 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative flex-shrink-0">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex flex-shrink-0 items-center gap-3 bg-black/40 backdrop-blur-md px-4 border-white/10 border-b h-16">
          <button onClick={() => setOpen(true)} className="lg:hidden p-2 text-white/50 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 border border-white/10 rounded-lg">
              <div className="bg-green-500 rounded-full w-1.5 h-1.5 animate-pulse" />
              <span className="text-white/50 text-xs">Live</span>
            </div>
            <button className="p-2 text-white/40 hover:text-white transition-colors">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}