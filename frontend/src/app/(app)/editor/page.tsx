export default function EditorPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-[64px] font-normal leading-tight">This week&apos;s edition</h1>
      <p className="text-sm text-gray-500">
        Start writing to create your weekly post.
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="col-span-2 row-span-2 aspect-square rounded-[15px] bg-[#d9d9d9]" />
        <div className="aspect-square rounded-[15px] bg-[#d9d9d9]" />
        <div className="aspect-square rounded-[15px] bg-[#d9d9d9]" />
      </div>
    </div>
  );
}
