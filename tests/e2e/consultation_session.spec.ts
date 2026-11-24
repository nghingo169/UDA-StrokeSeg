/** Playwright E2E - consultation lifecycle (Lobby → Start → Join → Vote → Finalize). */
import { test, expect } from "@playwright/test";

const API = process.env.UDA_API_BASE || "http://127.0.0.1:8000/api/v1";
const DEMO_PASSWORD = "Pass@123";

async function login(request: any, username: string, role: string) {
  const res = await request.post(`${API}/auth/login`, {
    data: { username, password: DEMO_PASSWORD, role },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.access_token as string;
}

test.describe("consultation_session lifecycle", () => {
  test("API: create → assign → start → join → webhook → sign", async ({ request }) => {
    const clinicianToken = await login(request, "maya.harris", "physician");
    const chairToken = await login(request, "thomas.nguyen", "hod");
    const memberToken = await login(request, "lena.morgan", "radiologist");

    const create = await request.post(`${API}Consultation`, {
      headers: { Authorization: `Bearer ${clinicianToken}` },
      data: {
        study_id: "AIS-240913-058",
        trigger_reason: "E2E clinical-imaging mismatch",
      },
    });
    expect(create.ok()).toBeTruthy();
    const session = await create.json();
    expect(session.status).toBe("PENDING_ASSIGNMENT");
    expect(session.zoom_meeting_number).toBeTruthy();
    if (session.zoom_mock) {
      expect(String(session.zoom_meeting_number).startsWith("900")).toBeTruthy();
    } else {
      expect(String(session.zoom_meeting_number).startsWith("900")).toBeFalsy();
    }
    expect(session.zoom_zak).toBeUndefined();

    const assign = await request.post(`${API}Consultation/${session.id}/assign`, {
      headers: { Authorization: `Bearer ${chairToken}` },
      data: {
        chairman_user_id: "u-hod-003",
        participant_user_ids: ["u-rad-011", "u-phy-024"],
      },
    });
    expect(assign.ok()).toBeTruthy();
    expect((await assign.json()).status).toBe("ASSIGNED");

    const start = await request.post(`${API}Consultation/${session.id}/start`, {
      headers: { Authorization: `Bearer ${chairToken}` },
    });
    expect(start.ok()).toBeTruthy();
    const started = await start.json();
    expect(started.session.status).toBe("LIVE");
    expect(started.zoom.signature).toBeTruthy();
    expect(started.zoom.role).toBe(1);
    expect(started.zoom.zak).toBeTruthy();
    expect(started.zoom.mock).toBe(session.zoom_mock);
    if (started.zoom.mock) {
      expect(String(started.zoom.zak).startsWith("mock-zak-")).toBeTruthy();
    }

    const join = await request.post(`${API}Consultation/${session.id}/join`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(join.ok()).toBeTruthy();
    const joined = await join.json();
    expect(joined.waiting).toBeFalsy();
    expect(joined.zoom.signature).toBeTruthy();
    expect(joined.zoom.role).toBe(0);
    expect(joined.zoom.zak).toBeNull();

    const vote = await request.post(`${API}Consultation/${session.id}/agreement`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { agreement: "Agree", note: "" },
    });
    expect(vote.ok()).toBeTruthy();

    const webhook = await request.post(`${API}Consultation/zoom/webhook`, {
      data: {
        event: "meeting.ended",
        payload: { object: { id: session.zoom_meeting_number } },
      },
    });
    expect(webhook.ok()).toBeTruthy();
    expect((await webhook.json()).consultation.status).toBe("AWAITING_CONCLUSION");

    const finalize = await request.post(`${API}Consultation/${session.id}/conclusion`, {
      headers: { Authorization: `Bearer ${chairToken}` },
      data: {
        conclusion: "E2E panel consensus - proceed thrombolysis pathway.",
        agreement: "Agree",
        agreement_note: "",
        step_up_password: DEMO_PASSWORD,
      },
    });
    expect(finalize.ok()).toBeTruthy();
    const done = await finalize.json();
    expect(done.status).toBe("COMPLETED");
    expect(done.conclusion).toContain("E2E panel consensus");
    expect(done.digital_signature).toContain("sig-v1:");
  });

  test("UI: lobby opens seeded session room", async ({ page }) => {
    await page.goto("/?role=hod");
    // Demo shell may require clicking through login - seed sessionStorage like App expects
    await page.evaluate(() => sessionStorage.setItem("nf_authed", "1"));
    await page.reload();
    await page.getByRole("button", { name: Consultation/i }).first().click();
    await expect(page.getByRole("heading", { name: Consultation lobby/i })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("listitem").filter({ hasText: "CON-0913-012" }).getByRole("button", { name: /Start as Chair/i }).click();
    await expect(page.getByText("CON-0913-012")).toBeVisible();
    await expect(page.getByRole("button", { name: /Start as Chair/i })).toBeVisible();
  });
});
