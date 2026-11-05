import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();
const token = () => signToken("examiner-b");
const northwindTitle = "Northwind Capital Periodic Exam";

function expectNoRecordFields(body: Record<string, unknown>): void {
  expect(body).not.toHaveProperty("id");
  expect(body).not.toHaveProperty("title");
  expect(body).not.toHaveProperty("status");
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("AC-3 case reads", () => {
  it("denies GET /cases/1042 for an unassigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expectNoRecordFields(response.body);

    const event = await prisma.auditEvent.findFirst({
      where: {
        examinerId: "examiner-b",
        caseId: 1042,
        action: "access-denied GET /cases/1042",
      },
    });
    expect(event).not.toBeNull();
    expect(event?.createdAt).toBeInstanceOf(Date);
  });

  it("omits case 1042 from list and search for an unassigned examiner", async () => {
    const list = await request(app).get("/cases").set("Authorization", `Bearer ${token()}`);
    const byTitle = await request(app)
      .get("/cases")
      .query({ title: "Northwind" })
      .set("Authorization", `Bearer ${token()}`);
    const byStatus = await request(app)
      .get("/cases")
      .query({ status: "open" })
      .set("Authorization", `Bearer ${token()}`);

    for (const response of [list, byTitle, byStatus]) {
      expect(response.status).toBe(200);
      const cases = response.body.cases as { id: number; title: string }[];
      expect(cases.some((item) => item.id === 1042)).toBe(false);
      expect(cases.some((item) => item.title === northwindTitle)).toBe(false);
    }
  });

  it("denies GET /cases/1042/export for an unassigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("case");
    expect(response.body).not.toHaveProperty("filings");
    expectNoRecordFields(response.body);

    const event = await prisma.auditEvent.findFirst({
      where: {
        examinerId: "examiner-b",
        caseId: 1042,
        action: "access-denied GET /cases/1042/export",
      },
    });
    expect(event).not.toBeNull();
    expect(event?.createdAt).toBeInstanceOf(Date);
  });
});
