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
