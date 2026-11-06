import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();
const unassigned = () => signToken("examiner-b");

afterAll(async () => {
  await prisma.$disconnect();
});

describe("AC-3 case reads", () => {
  it("denies case 1042 to an examiner who is not assigned", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(404);
    expect(response.body.id).toBeUndefined();
    expect(response.body.title).toBeUndefined();
    expect(response.body.status).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("Northwind Capital Periodic Exam");
    expect(JSON.stringify(response.body)).not.toContain("1042");
  });

  it("records an access-denied audit event for GET /cases/1042", async () => {
    await request(app).get("/cases/1042").set("Authorization", `Bearer ${unassigned()}`);

    const denial = await prisma.auditEvent.findFirst({
      where: {
        examinerId: "examiner-b",
        caseId: 1042,
        action: "access-denied GET /cases/1042",
      },
    });

    expect(denial).not.toBeNull();
    expect(denial?.createdAt).toBeInstanceOf(Date);
  });

  it("omits case 1042 from the list for an examiner who is not assigned", async () => {
    const response = await request(app)
      .get("/cases")
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as { id: number; title: string }[];
    expect(cases.some((item) => item.id === 1042)).toBe(false);
    expect(cases.some((item) => item.title === "Northwind Capital Periodic Exam")).toBe(false);
  });

  it("omits Harborline from title search for an examiner who is not assigned", async () => {
    const response = await request(app)
      .get("/cases")
      .query({ title: "Harborline" })
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as { id: number; title: string }[];
    expect(cases.some((item) => item.id === 1043)).toBe(false);
    expect(cases.some((item) => item.title === "Harborline Broker-Dealer Review")).toBe(false);
  });

  it("denies export of case 1042 to an examiner who is not assigned", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(404);
    expect(response.body.case).toBeUndefined();
    expect(response.body.filings).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("Northwind Capital Periodic Exam");
    expect(JSON.stringify(response.body)).not.toContain("5001");
    expect(JSON.stringify(response.body)).not.toContain("5002");
    expect(JSON.stringify(response.body)).not.toContain("5003");
  });

  it("records an access-denied audit event for GET /cases/1042/export", async () => {
    await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${unassigned()}`);

    const denial = await prisma.auditEvent.findFirst({
      where: {
        examinerId: "examiner-b",
        caseId: 1042,
        action: "access-denied GET /cases/1042/export",
      },
    });

    expect(denial).not.toBeNull();
    expect(denial?.createdAt).toBeInstanceOf(Date);
  });
});
