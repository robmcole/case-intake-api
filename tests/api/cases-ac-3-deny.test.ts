import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();
const unassigned = () => signToken("examiner-b");

afterAll(async () => {
  await prisma.$disconnect();
});

function expectNoRecordFields(body: unknown): void {
  expect(body).not.toHaveProperty("id");
  expect(body).not.toHaveProperty("title");
  expect(body).not.toHaveProperty("status");
  expect(body).not.toHaveProperty("cases");
  expect(body).not.toHaveProperty("case");
  expect(body).not.toHaveProperty("filings");
  expect(JSON.stringify(body)).not.toContain("Northwind Capital Periodic Exam");
}

async function expectAccessDenied(action: string, caseId?: number): Promise<void> {
  const event = await prisma.auditEvent.findFirst({
    where: {
      examinerId: "examiner-b",
      action,
      ...(caseId === undefined ? {} : { caseId }),
    },
    orderBy: { id: "desc" },
  });

  expect(event).not.toBeNull();
  expect(event?.examinerId).toBe("examiner-b");
  expect(event?.action).toBe(action);
  expect(event?.createdAt).toBeInstanceOf(Date);
  if (caseId !== undefined) {
    expect(event?.caseId).toBe(caseId);
  }
}

describe("AC-3 case read denial", () => {
  it("denies an unassigned examiner on GET /cases/1042", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(404);
    expectNoRecordFields(response.body);
    await expectAccessDenied("access-denied GET /cases/1042", 1042);
  });

  it("denies an unassigned examiner on GET /cases title search", async () => {
    const response = await request(app)
      .get("/cases")
      .query({ title: "Northwind Capital Periodic Exam" })
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(404);
    expectNoRecordFields(response.body);
    await expectAccessDenied("access-denied GET /cases");
  });

  it("denies an unassigned examiner on GET /cases/1042/export", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(404);
    expectNoRecordFields(response.body);
    await expectAccessDenied("access-denied GET /cases/1042/export", 1042);
  });
});
