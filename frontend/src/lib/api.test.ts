import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the supabase client module BEFORE importing api.ts. The api module
// reads the session at request time, so we control what getSession returns.
const getSession = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession } }),
}));

// Pin API base URL via the api-url module that api.ts imports.
vi.mock("@/lib/api-url", () => ({
  API_BASE_URL: "http://api.test",
}));

import { api } from "@/lib/api";

const originalFetch = global.fetch;

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
  })) as unknown as typeof fetch;
  global.fetch = fetchMock;
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

describe("api client", () => {
  beforeEach(() => {
    getSession.mockReset();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("attaches a Bearer header when a session exists", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tkn-123" } } });
    const fetchMock = mockFetchOnce({ ok: true });
    await api.get("/feed");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/feed",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer tkn-123" }),
      }),
    );
  });

  it("omits the Bearer header when no session is present", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = mockFetchOnce({ ok: true });
    await api.get("/profiles/me");
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("serializes the body on POST and uses method POST", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = mockFetchOnce({ id: "p1" });
    await api.post("/posts", { title: "Hi" });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ title: "Hi" }));
  });

  it("uses method PUT for api.put", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = mockFetchOnce({ ok: true });
    await api.put("/posts/p1", { title: "Renamed" });
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("PUT");
  });

  it("uses method DELETE for api.delete", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = mockFetchOnce({ ok: true });
    await api.delete("/posts/p1");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
  });

  it("throws with the server-provided detail when the response is not ok", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    mockFetchOnce({ detail: "Word count too low" }, false, 400);
    await expect(api.post("/posts/p1/publish")).rejects.toThrow("Word count too low");
  });

  it("falls back to statusText when the error body is not JSON", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => {
        throw new Error("not json");
      },
    })) as unknown as typeof fetch;
    await expect(api.get("/whatever")).rejects.toThrow("Internal Server Error");
  });
});
