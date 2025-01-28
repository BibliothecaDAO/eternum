import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/realms/claim')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/realms/claim"!</div>
}
