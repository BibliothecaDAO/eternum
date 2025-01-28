import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <div className={`p-2`}>
      <div className={`text-lg`}>Welcome to Realms.World Account Portal</div>
    </div>
  )
}
