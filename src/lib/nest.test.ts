import { describe, it, expect } from "vitest";
import { parsePubSubEnvelope, sdmDeviceId, buildNestAuthUrl, inActiveWindow } from "./nest";

const envelope = (payload: unknown) => ({
  message: { data: Buffer.from(JSON.stringify(payload)).toString("base64") },
  subscription: "projects/x/subscriptions/y",
});

describe("parsePubSubEnvelope", () => {
  it("parses a person event", () => {
    const p = parsePubSubEnvelope(
      envelope({
        eventId: "ev-1",
        timestamp: "2026-07-17T12:00:00Z",
        resourceUpdate: {
          name: "enterprises/proj/devices/dev-1",
          events: { "sdm.devices.events.CameraPerson.Person": { eventSessionId: "s1" } },
        },
      })
    );
    expect(p).not.toBeNull();
    expect(p!.eventId).toBe("ev-1");
    expect(p!.types).toEqual(["person"]);
    expect(p!.deviceSdmName).toBe("enterprises/proj/devices/dev-1");
  });

  it("extracts clip preview URLs alongside triggers", () => {
    const p = parsePubSubEnvelope(
      envelope({
        eventId: "ev-2",
        resourceUpdate: {
          name: "enterprises/proj/devices/dev-1",
          events: {
            "sdm.devices.events.CameraMotion.Motion": {},
            "sdm.devices.events.CameraClipPreview.ClipPreview": { previewUrl: "https://x/clip" },
          },
        },
      })
    );
    expect(p!.types).toEqual(["motion"]);
    expect(p!.previewUrl).toBe("https://x/clip");
  });

  it("ignores trait refreshes and garbage", () => {
    expect(
      parsePubSubEnvelope(
        envelope({ eventId: "ev-3", resourceUpdate: { name: "d", events: { "sdm.devices.traits.Info": {} } } })
      )
    ).toBeNull();
    expect(parsePubSubEnvelope({ message: { data: "not-base64-json!!" } })).toBeNull();
    expect(parsePubSubEnvelope({})).toBeNull();
    expect(parsePubSubEnvelope(envelope({ relationUpdate: { type: "DELETED" } }))).toBeNull();
  });
});

describe("sdmDeviceId", () => {
  it("takes the last path segment", () => {
    expect(sdmDeviceId("enterprises/p/devices/abc-123")).toBe("abc-123");
  });
});

describe("buildNestAuthUrl", () => {
  it("targets Partner Connections Manager (not accounts.google.com) with offline access", () => {
    const url = buildNestAuthUrl("state-1");
    expect(url).toContain("nestservices.google.com/partnerconnections/");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
    expect(url).toContain("state=state-1");
  });
});

describe("inActiveWindow", () => {
  // Times below are UTC; America/Denver in July is UTC-6.
  const denver = (hhmmUtc: string) => new Date(`2026-07-17T${hhmmUtc}:00Z`);

  it("always fires with no window", () => {
    expect(inActiveWindow(null, null)).toBe(true);
  });

  it("respects a same-day window", () => {
    // 20:00 UTC = 14:00 Denver → inside 09:00–17:00
    expect(inActiveWindow("09:00", "17:00", denver("20:00"))).toBe(true);
    // 03:00 UTC = 21:00 Denver (prev evening) → outside
    expect(inActiveWindow("09:00", "17:00", denver("03:00"))).toBe(false);
  });

  it("handles windows that wrap midnight", () => {
    // 05:00 UTC = 23:00 Denver → inside 20:00–06:00
    expect(inActiveWindow("20:00", "06:00", denver("05:00"))).toBe(true);
    // 18:00 UTC = 12:00 Denver → outside 20:00–06:00
    expect(inActiveWindow("20:00", "06:00", denver("18:00"))).toBe(false);
  });
});
