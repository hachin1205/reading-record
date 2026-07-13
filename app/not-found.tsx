import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6 text-ink">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
          Not found
        </p>
        <h1 className="mt-3 font-serif text-5xl font-semibold">This shelf is empty.</h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          The record you are looking for is not available here.
        </p>
        <Link
          className="mt-6 inline-flex rounded-full border border-line bg-panel px-4 py-2 text-sm font-semibold shadow-sm"
          href="/"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
