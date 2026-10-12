/** Wanlly's Product Hunt listing badge, as Product Hunt provides it (their image, their link). */
export function ProductHuntBadge({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://www.producthunt.com/products/wanlly?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-wanlly"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="Wanlly - Frontier AI for everyone, funded by sponsor credits | Product Hunt"
        width={250}
        height={54}
        loading="lazy"
        src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1278169&theme=neutral&t=1791831082136"
      />
    </a>
  );
}

/** The Traffiklist "Featured" badge, as Traffiklist provides it. */
export function TraffiklistBadge({ className = "" }: { className?: string }) {
  return (
    <a href="https://www.traffiklist.com/p/wanlly-frontier-ai-for-everyone-with-an-idea" target="_blank" rel="noopener noreferrer" className={`inline-block ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="https://www.traffiklist.com/badge.svg" alt="Featured on Traffiklist" width={220} height={56} loading="lazy" />
    </a>
  );
}

/** Where Wanlly is listed: the launch-site badges, side by side. */
export function LaunchBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <ProductHuntBadge />
      <TraffiklistBadge />
    </div>
  );
}
