export const keys = {
  currentPost: () => ["post", "current-week"] as const,
  post: (id: string) => ["post", id] as const,
  postBlocks: (id: string) => ["post", id, "blocks"] as const,
  feed: () => ["feed"] as const,
  feedOlder: () => ["feed", "older"] as const,
  archive: () => ["feed", "archive"] as const,
  myProfile: () => ["profile", "me"] as const,
  profile: (userId: string) => ["profile", userId] as const,
};
