import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();
const token = () => signToken("examiner-b");

afterAll(async () => {
  await prisma.$disconnect();
});

describe("AC-3 case read denial", () => {
  it("denies an unassigned examiner on GET /cases/1042", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expect(response.status).not.toBe(403);
    expect(response.body.id).toBeUndefined();
    expect(response.body.title).toBeUndefined();
    expect(response.body.status).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("Northwind Capital Periodic Exam");
  });

  it("omits unassigned cases from GET /cases title search", async () => {
    const response = await request(app)
      .get("/cases")
      .query({ title: "Northwind" })
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as { id: number; title: string }[];
    expect(cases.some((item) => item.id === 1042)).toBe(false);
    expect(cases.some((item) => item.title === "Northwind Capital Periodic Exam")).toBe(false);
  });

  it("denies an unassigned examiner on GET /cases/1042/export", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expect(response.status).not.toBe(403);
    expect(response.body.case).toBeUndefined();
    expect(response.body.filings).toBeUndefined();
    expect(response.body.id).toBeUndefined();
    expect(response.body.title).toBeUndefined();
    const body = JSON.stringify(response.body);
    expect(body).not.toContain("Northwind Capital Periodic Exam");
    expect(body).not.toContain("5001");
    expect(body).not.toContain("5002");
    expect(body).not.toContain("5003");
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

    expect(event).not.toBeNull();
    expect(event?.examinerId).toBe("examiner-b");
    expect(event?.caseId).toBe(1042);
    expect(event?.action).toBe("access-denied GET /cases/1042");
    expect(event?.createdAt).toBeInstanceOf(Date);
  });
});
