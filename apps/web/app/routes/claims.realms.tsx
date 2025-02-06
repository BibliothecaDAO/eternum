import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/claims/realms')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/claims/realms"!</div>
}
