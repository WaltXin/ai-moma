import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">404</p>
      <h1 className="mt-2 text-4xl font-black">This room is closed.</h1>
      <p className="mt-4 text-muted">
        <Link href="/" className="font-medium text-ink underline">
          Back to the lobby
        </Link>
      </p>
    </div>
  );
}
