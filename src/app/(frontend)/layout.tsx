import React from 'react'

import './styles.css'

export const metadata = {
  title: 'Payload CMS',
  description: 'Payload CMS running on Railway.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
