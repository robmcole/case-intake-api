import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();
const token = () => signToken("examiner-b");

const NORTHWIND_TITLE = "Northwind Capital Periodic Exam";
const HARBORLINE_TITLE = "Harborline Broker-Dealer Review";

afterAll(async () => {
  await prisma.$disconnect();
});

function expectNoCaseFields(body: unknown, title: string): void {
  const record = body as Record<string, unknown>;
  expect(record).not.toHaveProperty("id");
  expect(record).not.toHaveProperty("title");
  expect(record).not.toHaveProperty("status");
  expect(record).not.toHaveProperty("filings");
  expect(record).not.toHaveProperty("case");
  expect(JSON.stringify(body)).not.toContain(title);
}

async function expectDenialAudit(action: string, caseId: number): Promise<void> {
  const events = await prisma.auditEvent.findMany({
    where: {
      examinerId: "examiner-b",
      action,
      caseId,
    },
  });
  expect(events).toHaveLength(1);
  expect(events[0].createdAt).toBeInstanceOf(Date);
}

describe("AC-3 case read denial", () => {
  it("denies GET /cases/1042 for an examiner who is not assigned", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expectNoCaseFields(response.body, NORTHWIND_TITLE);
    await expectDenialAudit("access-denied GET /cases/1042", 1042);
  });

  it("denies GET /cases/1042/export for an examiner who is not assigned", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expectNoCaseFields(response.body, NORTHWIND_TITLE);
    await expectDenialAudit("access-denied GET /cases/1042/export", 1042);
  });

  it("omits unassigned cases from GET /cases", async () => {
    const response = await request(app).get("/cases").set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as { id: number; title: string }[];
    expect(cases.some((item) => item.id === 1042 || item.title === NORTHWIND_TITLE)).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain(NORTHWIND_TITLE);
  });

  it("omits an unassigned case from GET /cases title search", async () => {
    const response = await request(app)
      .get("/cases")
      .query({ title: "Harborline" })
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as { id: number; title: string }[];
    expect(cases.some((item) => item.id === 1043 || item.title === HARBORLINE_TITLE)).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain(HARBORLINE_TITLE);
  });
});
