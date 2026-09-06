import Link from 'next/link'
import React from 'react'

export default function HomePage() {
  return (
    <main className="home">
      <div className="card">
        <p className="eyebrow">Payload CMS</p>
        <h1>Your CMS is running.</h1>
        <p className="lede">
          The admin panel is where you sign in and manage content. On a fresh deployment it asks you
          to create the first admin account.
        </p>
        <div className="actions">
          <Link className="button" href="/admin" prefetch={false}>
            Open the admin panel
          </Link>
          <a className="link" href="https://payloadcms.com/docs" rel="noreferrer" target="_blank">
            Payload docs
          </a>
        </div>
        <p className="note">
          This page is <code>src/app/(frontend)/page.tsx</code>. Replace it with your own front end,
          or delete the route group and use Payload purely as an API.
        </p>
      </div>
    </main>
  )
}
