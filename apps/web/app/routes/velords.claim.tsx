import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/velords/claim')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/velords/claim"!</div>
}
