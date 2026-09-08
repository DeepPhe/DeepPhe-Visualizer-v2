import {
  fetchStaticEventRelationTimeline,
  resetStaticEventRelationTimelineCacheForTests,
} from "../eventRelationTimeline";

const originalFetch = global.fetch;
const TSV = "PatientID\tConceptID\tRelation1\tDate1\tRelation2\tDate2";

describe("event relation timeline client", () => {
  afterEach(() => {
    resetStaticEventRelationTimelineCacheForTests();
    jest.clearAllMocks();
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
  });

  it("loads the asset for the canonical fake patient only", async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => TSV }));

    await expect(fetchStaticEventRelationTimeline("fake_patient1")).resolves.toBe(TSV);
    expect(global.fetch).toHaveBeenCalledWith("/data/event-timelines/fake_patient1.tsv");

    await expect(fetchStaticEventRelationTimeline("patient-2")).resolves.toBe("");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("fetches once and reuses the result", async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => TSV }));

    await fetchStaticEventRelationTimeline("fake_patient1");
    await fetchStaticEventRelationTimeline("fake_patient1");

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failure and retries on the next call", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => TSV });

    await expect(fetchStaticEventRelationTimeline("fake_patient1")).rejects.toThrow(
      "Unable to load event relation timeline data (503)."
    );

    // A cached rejection would leave the panel permanently broken.
    await expect(fetchStaticEventRelationTimeline("fake_patient1")).resolves.toBe(TSV);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("retries after a network error too", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => TSV });

    await expect(fetchStaticEventRelationTimeline("fake_patient1")).rejects.toThrow("offline");
    await expect(fetchStaticEventRelationTimeline("fake_patient1")).resolves.toBe(TSV);
  });
});
