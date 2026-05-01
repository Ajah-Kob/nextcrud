'use client'

import { APP_NAME } from '@/config/constants'

export default function Footer() {
  return (
    <footer className="bg-secondary">
      <div className="container">
        <p className="font-normal text-center">
          {APP_NAME} &copy; {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  )
}
