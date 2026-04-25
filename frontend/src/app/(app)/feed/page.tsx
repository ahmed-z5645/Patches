export default function FeedPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-[64px] font-normal leading-tight">Feed</h1>
      <p className="text-sm text-gray-500">
        Publish this week&apos;s post to unlock your feed.
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-[15px] bg-[#d9d9d9]"
          />
        ))}
      </div>
    </div>
  );
}
