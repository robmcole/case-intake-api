import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();
const token = () => signToken("examiner-b");

function expectNoCaseFields(body: Record<string, unknown>): void {
  expect(body).not.toHaveProperty("id");
  expect(body).not.toHaveProperty("title");
  expect(body).not.toHaveProperty("status");
  expect(body.case).toBeUndefined();
  expect(body.filings).toBeUndefined();
  expect(JSON.stringify(body)).not.toContain("Northwind Capital Periodic Exam");
  expect(JSON.stringify(body)).not.toContain("Harborline Broker-Dealer Review");
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("AC-3 case access", () => {
  it("denies examiner-b on GET /cases/1042", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expectNoCaseFields(response.body as Record<string, unknown>);
  });

  it("omits unassigned cases from GET /cases list and title search", async () => {
    const list = await request(app).get("/cases").set("Authorization", `Bearer ${token()}`);

    expect(list.status).toBe(200);
    const listed = list.body.cases as { id: number; title: string }[];
    expect(listed.map((item) => item.id)).not.toContain(1042);
    expect(listed.map((item) => item.id)).not.toContain(1043);
    expect(listed.map((item) => item.title)).not.toContain("Northwind Capital Periodic Exam");
    expect(listed.map((item) => item.title)).not.toContain("Harborline Broker-Dealer Review");

    const search = await request(app)
      .get("/cases")
      .query({ title: "Harborline" })
      .set("Authorization", `Bearer ${token()}`);

    expect(search.status).toBe(200);
    const found = search.body.cases as { id: number; title: string }[];
    expect(found.map((item) => item.id)).not.toContain(1043);
    expect(found.map((item) => item.title)).not.toContain("Harborline Broker-Dealer Review");
  });

  it("denies examiner-b on GET /cases/1042/export", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expectNoCaseFields(response.body as Record<string, unknown>);
    expect(JSON.stringify(response.body)).not.toContain("5001");
  });

  it("records an access-denied audit event for GET /cases/1042", async () => {
    await request(app).get("/cases/1042").set("Authorization", `Bearer ${token()}`);

    const event = await prisma.auditEvent.findFirst({
      where: {
        examinerId: "examiner-b",
        caseId: 1042,
        action: "access-denied GET /cases/1042",
      },
    });

    expect(event).toMatchObject({
      examinerId: "examiner-b",
      caseId: 1042,
      action: "access-denied GET /cases/1042",
    });
    expect(event?.createdAt).toBeInstanceOf(Date);
  });

  it("records an access-denied audit event for GET /cases/1042/export", async () => {
    await request(app).get("/cases/1042/export").set("Authorization", `Bearer ${token()}`);

    const event = await prisma.auditEvent.findFirst({
      where: {
        examinerId: "examiner-b",
        caseId: 1042,
        action: "access-denied GET /cases/1042/export",
      },
    });

    expect(event).toMatchObject({
      examinerId: "examiner-b",
      caseId: 1042,
      action: "access-denied GET /cases/1042/export",
    });
    expect(event?.createdAt).toBeInstanceOf(Date);
  });
});
