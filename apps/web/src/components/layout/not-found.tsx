import { Link } from "@tanstack/react-router";

export function NotFound({ children }: { children?: any }) {
  return (
    <div className="space-y-2 p-2">
      <div className="text-muted-foreground">{children || <p>The page you are looking for does not exist.</p>}</div>
      <p className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => window.history.back()}
          className="rounded bg-primary px-2 py-1 text-sm font-black uppercase text-primary-foreground"
        >
          Go back
        </button>
        <Link to="/" className="rounded bg-secondary px-2 py-1 text-sm font-black uppercase text-secondary-foreground">
          Start Over
        </Link>
      </p>
    </div>
  );
}
