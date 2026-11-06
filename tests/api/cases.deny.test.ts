import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();
const token = () => signToken("examiner-b");

const UNASSIGNED_TITLE = "Northwind Capital Periodic Exam";
const UNASSIGNED_FILING_IDS = ["5001", "5002", "5003"];

afterAll(async () => {
  await prisma.$disconnect();
});

function expectNoLeakedRecord(body: unknown, extraKeys: string[] = []): void {
  const record = body as Record<string, unknown>;
  for (const key of ["id", "title", "status", ...extraKeys]) {
    expect(record[key]).toBeUndefined();
  }
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain(UNASSIGNED_TITLE);
  for (const filingId of UNASSIGNED_FILING_IDS) {
    expect(serialized).not.toContain(filingId);
  }
}

async function expectDeniedAudit(action: string): Promise<void> {
  const events = await prisma.auditEvent.findMany({
    where: { action, caseId: 1042, examinerId: "examiner-b" },
  });
  expect(events.length).toBeGreaterThanOrEqual(1);
  expect(events[0].createdAt).toBeInstanceOf(Date);
}

describe("AC-3 case read denial", () => {
  it("denies GET /cases/1042 for a non-assigned examiner and records the denial", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expectNoLeakedRecord(response.body);

    const events = await prisma.auditEvent.findMany({
      where: { action: "access-denied GET /cases/1042" },
    });
    expect(events).toHaveLength(1);
    expect(events[0].examinerId).toBe("examiner-b");
    expect(events[0].caseId).toBe(1042);
    expect(events[0].createdAt).toBeInstanceOf(Date);
  });

  it("omits unassigned cases from GET /cases list and records the denial", async () => {
    const list = await request(app).get("/cases").set("Authorization", `Bearer ${token()}`);

    expect(list.status).toBe(200);
    expect(list.body.cases).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ id: 1042 })]),
    );
    expect(list.body.cases).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ title: UNASSIGNED_TITLE })]),
    );
    expect(JSON.stringify(list.body)).not.toContain(UNASSIGNED_TITLE);
    await expectDeniedAudit("access-denied GET /cases");
  });

  it("omits unassigned cases from GET /cases title search and records the denial", async () => {
    const search = await request(app)
      .get("/cases")
      .query({ title: "Northwind" })
      .set("Authorization", `Bearer ${token()}`);

    expect(search.status).toBe(200);
    expect(search.body.cases).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ id: 1042 })]),
    );
    expect(search.body.cases).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ title: UNASSIGNED_TITLE })]),
    );
    expect(JSON.stringify(search.body)).not.toContain(UNASSIGNED_TITLE);
    await expectDeniedAudit("access-denied GET /cases");
  });

  it("omits unassigned cases from GET /cases status search and records the denial", async () => {
    const search = await request(app)
      .get("/cases")
      .query({ status: "open" })
      .set("Authorization", `Bearer ${token()}`);

    expect(search.status).toBe(200);
    expect(search.body.cases).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ id: 1042 })]),
    );
    expect(search.body.cases).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ title: UNASSIGNED_TITLE })]),
    );
    expect(JSON.stringify(search.body)).not.toContain(UNASSIGNED_TITLE);
    for (const filingId of UNASSIGNED_FILING_IDS) {
      expect(JSON.stringify(search.body)).not.toContain(filingId);
    }
    await expectDeniedAudit("access-denied GET /cases");
  });

  it("denies GET /cases/1042/export for a non-assigned examiner and records the denial", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expectNoLeakedRecord(response.body, ["case", "filings", "generatedAt"]);

    const events = await prisma.auditEvent.findMany({
      where: { action: "access-denied GET /cases/1042/export" },
    });
    expect(events).toHaveLength(1);
    expect(events[0].examinerId).toBe("examiner-b");
    expect(events[0].caseId).toBe(1042);
    expect(events[0].createdAt).toBeInstanceOf(Date);
  });
});
