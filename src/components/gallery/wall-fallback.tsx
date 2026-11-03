/**
 * What a visitor sees for a moment while a painted page arrives on a client
 * navigation: the wall they're already standing at, still empty. <WallRepaint>
 * keeps the previous page's colors until the new page paints, so nothing
 * flashes. Direct visits never show it; those pages are prerendered whole.
 */
export function WallFallback() {
  return (
    <div className="-my-10 mx-[calc(50%-50vw)] min-h-[80svh]" aria-busy="true">
      <p className="sr-only" role="status">
        Loading
      </p>
    </div>
  );
}
