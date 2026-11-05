import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();
const unassigned = () => signToken("examiner-b");

const CASE_ID = 1042;
const CASE_TITLE = "Northwind Capital Periodic Exam";
const FILING_TITLE = "Q3 capital adequacy";

afterAll(async () => {
  await prisma.$disconnect();
});

function expectNoRecordFields(body: unknown): void {
  const record = body as {
    id?: unknown;
    title?: unknown;
    status?: unknown;
    case?: unknown;
    filings?: unknown;
  };
  expect(record.id).toBeUndefined();
  expect(record.title).toBeUndefined();
  expect(record.status).toBeUndefined();
  expect(record.case).toBeUndefined();
  expect(record.filings).toBeUndefined();
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain(CASE_TITLE);
  expect(serialized).not.toContain(FILING_TITLE);
}

describe("AC-3 case read denial", () => {
  it("denies GET /cases/1042 to a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(404);
    expectNoRecordFields(response.body);

    const event = await prisma.auditEvent.findFirst({
      where: {
        examinerId: "examiner-b",
        caseId: CASE_ID,
        action: "access-denied GET /cases/1042",
      },
    });
    expect(event).not.toBeNull();
    expect(event?.createdAt).toBeInstanceOf(Date);
  });

  it("omits unassigned cases from GET /cases", async () => {
    const queries: Array<Record<string, string>> = [{}, { status: "open" }, { title: "Northwind" }];

    for (const query of queries) {
      const response = await request(app)
        .get("/cases")
        .query(query)
        .set("Authorization", `Bearer ${unassigned()}`);

      expect(response.status).toBe(200);
      const cases = response.body.cases as Array<{ id: number; title: string; status: string }>;
      expect(cases.some((item) => item.id === CASE_ID)).toBe(false);
      expect(cases.some((item) => item.title === CASE_TITLE)).toBe(false);
      expect(JSON.stringify(response.body)).not.toContain(CASE_TITLE);
    }
  });

  it("denies GET /cases/1042/export to a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(404);
    expectNoRecordFields(response.body);

    const event = await prisma.auditEvent.findFirst({
      where: {
        examinerId: "examiner-b",
        caseId: CASE_ID,
        action: "access-denied GET /cases/1042/export",
      },
    });
    expect(event).not.toBeNull();
    expect(event?.createdAt).toBeInstanceOf(Date);
  });
});
