import { test, expect } from "./fixtures";

/**
 * The Toll: publishing a valid post (title + ≥100 words) unlocks the current
 * week's follower feed. Until then, the feed is locked.
 *
 * Drives the publish through the FastAPI endpoints directly (the editor UI
 * has component-level coverage in vitest). The system-level concern here is
 * the locked → unlocked transition of /api/feed after publish.
 */

const API = "http://localhost:8001";

async function bearerHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

test.beforeEach(async ({ api }) => {
  // Freeze to a Tuesday mid-week so we're well clear of the Monday boundary.
  await api.freezeTime("2025-03-18T13:00:00-04:00");
});

test("feed is locked before publishing and unlocks after", async ({ api, request }) => {
  const alice = await api.seedUser("alice");
  const bob = await api.seedUser("bob");
  await api.seedFollow(alice.id, bob.id); // alice follows bob

  // Bob publishes — bob has no Toll requirement for alice's feed; alice does.
  await api.seedPost({
    user_id: bob.id,
    week_number: 12,
    year: 2025,
    title: "Bob's week",
    body: Array(110).fill("word").join(" "),
    published: true,
  });

  // Alice has not published — her feed of bob's posts is locked.
  const lockedRes = await request.get(`${API}/api/feed`, {
    headers: await bearerHeaders(alice.access_token),
  });
  expect(lockedRes.ok()).toBe(true);
  const locked = await lockedRes.json();
  expect(locked.locked).toBe(true);
  expect(locked.post_count).toBe(1); // bob's post counted but not shown

  // Alice publishes a valid post — this is the Toll.
  const post = await request
    .post(`${API}/api/posts`, {
      headers: await bearerHeaders(alice.access_token),
      data: { week_number: 12, year: 2025 },
    })
    .then((r) => r.json());

  await request.put(`${API}/api/posts/${post.id}`, {
    headers: await bearerHeaders(alice.access_token),
    data: { title: "Alice's week" },
  });

  await request.post(`${API}/api/posts/${post.id}/blocks`, {
    headers: await bearerHeaders(alice.access_token),
    data: {
      type: "markdown",
      content: { markdown: Array(110).fill("word").join(" ") },
      grid_layout_desktop: { colStart: 1, colSpan: 4, rowStart: 1, rowSpan: 4 },
      grid_layout_mobile: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 4 },
    },
  });

  const publishRes = await request.post(`${API}/api/posts/${post.id}/publish`, {
    headers: await bearerHeaders(alice.access_token),
  });
  expect(publishRes.ok()).toBe(true);

  // Alice's feed is now unlocked and shows bob's post.
  const unlockedRes = await request.get(`${API}/api/feed`, {
    headers: await bearerHeaders(alice.access_token),
  });
  const unlocked = await unlockedRes.json();
  expect(unlocked.locked).toBe(false);
  expect(unlocked.posts).toHaveLength(1);
  expect(unlocked.posts[0].user_id).toBe(bob.id);
});

test("publish with under 100 words is rejected and feed stays locked", async ({ api, request }) => {
  const alice = await api.seedUser("alice");
  const bob = await api.seedUser("bob");
  await api.seedFollow(alice.id, bob.id);
  await api.seedPost({
    user_id: bob.id,
    week_number: 12,
    year: 2025,
    title: "B",
    body: Array(110).fill("word").join(" "),
    published: true,
  });

  const post = await request
    .post(`${API}/api/posts`, {
      headers: await bearerHeaders(alice.access_token),
      data: { week_number: 12, year: 2025 },
    })
    .then((r) => r.json());

  await request.put(`${API}/api/posts/${post.id}`, {
    headers: await bearerHeaders(alice.access_token),
    data: { title: "Too short" },
  });
  await request.post(`${API}/api/posts/${post.id}/blocks`, {
    headers: await bearerHeaders(alice.access_token),
    data: {
      type: "markdown",
      content: { markdown: "just a handful of words" },
      grid_layout_desktop: { colStart: 1, colSpan: 4, rowStart: 1, rowSpan: 2 },
      grid_layout_mobile: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 },
    },
  });

  const publishRes = await request.post(`${API}/api/posts/${post.id}/publish`, {
    headers: await bearerHeaders(alice.access_token),
  });
  expect(publishRes.status()).toBe(400);
  expect((await publishRes.json()).detail).toContain("100 words");

  const feed = await request
    .get(`${API}/api/feed`, { headers: await bearerHeaders(alice.access_token) })
    .then((r) => r.json());
  expect(feed.locked).toBe(true);
});
