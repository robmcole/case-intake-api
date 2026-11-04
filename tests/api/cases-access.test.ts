import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();

const UNAUTHORIZED_TITLES = [
  "Northwind Capital Periodic Exam",
  "Harborline Broker-Dealer Review",
];

afterAll(async () => {
  await prisma.$disconnect();
});

function expectNoUnauthorizedCase(body: { cases?: { id: number; title: string }[] }): void {
  const cases = body.cases ?? [];
  const ids = cases.map((item) => item.id);
  expect(ids).not.toContain(1042);
  expect(ids).not.toContain(1043);
  const titles = cases.map((item) => item.title);
  for (const title of UNAUTHORIZED_TITLES) {
    expect(titles).not.toContain(title);
  }
}

describe("case access enforcement", () => {
  it("denies examiner-b GET /cases/1042", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${signToken("examiner-b")}`);

    expect(response.status).toBe(404);
    expect(response.body.title).toBeUndefined();
    expect(response.body.status).toBeUndefined();
    expect(response.body.filings).toBeUndefined();
    expect(response.body.case).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("Northwind Capital Periodic Exam");
  });

  it("denies examiner-b GET /cases/1042/export", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${signToken("examiner-b")}`);

    expect(response.status).toBe(404);
    expect(response.body.case).toBeUndefined();
    expect(response.body.filings).toBeUndefined();
    expect(response.body.title).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("Northwind Capital Periodic Exam");

    const audit = await prisma.auditEvent.findFirst({
      where: {
        action: "access-denied GET /cases/1042/export",
        examinerId: "examiner-b",
        caseId: 1042,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.createdAt).toBeInstanceOf(Date);
  });

  it("omits unassigned cases from GET /cases for examiner-b", async () => {
    const token = signToken("examiner-b");

    const list = await request(app).get("/cases").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expectNoUnauthorizedCase(list.body);

    const byStatus = await request(app)
      .get("/cases")
      .query({ status: "open" })
      .set("Authorization", `Bearer ${token}`);
    expect(byStatus.status).toBe(200);
    expectNoUnauthorizedCase(byStatus.body);

    const northwind = await request(app)
      .get("/cases")
      .query({ title: "Northwind" })
      .set("Authorization", `Bearer ${token}`);
    expect(northwind.status).toBe(200);
    expectNoUnauthorizedCase(northwind.body);

    const harborline = await request(app)
      .get("/cases")
      .query({ title: "Harborline" })
      .set("Authorization", `Bearer ${token}`);
    expect(harborline.status).toBe(200);
    expectNoUnauthorizedCase(harborline.body);
  });

  it("records access-denied for GET /cases/1042", async () => {
    await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${signToken("examiner-b")}`);

    const audit = await prisma.auditEvent.findFirst({
      where: {
        action: "access-denied GET /cases/1042",
        examinerId: "examiner-b",
        caseId: 1042,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.examinerId).toBe("examiner-b");
    expect(audit?.caseId).toBe(1042);
    expect(audit?.createdAt).toBeInstanceOf(Date);
  });
});
