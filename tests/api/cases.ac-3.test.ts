import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();
const token = () => signToken("examiner-b");

afterAll(async () => {
  await prisma.$disconnect();
});

describe("AC-3 case reads", () => {
  it("denies case 1042 to a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("id");
    expect(response.body).not.toHaveProperty("title");
    expect(response.body).not.toHaveProperty("status");

    const events = await prisma.auditEvent.findMany({
      where: {
        examinerId: "examiner-b",
        caseId: 1042,
        action: "access-denied GET /cases/1042",
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0].createdAt).toBeInstanceOf(Date);
  });

  it("omits unassigned cases from the list", async () => {
    const response = await request(app).get("/cases").set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as { id: number; title: string }[];
    expect(cases.some((item) => item.id === 1042)).toBe(false);
    expect(cases.some((item) => item.title === "Northwind Capital Periodic Exam")).toBe(false);
  });

  it("omits an unassigned case from title search", async () => {
    const response = await request(app)
      .get("/cases")
      .query({ title: "Northwind" })
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as { id: number; title: string }[];
    expect(cases.some((item) => item.id === 1042)).toBe(false);
    expect(cases.some((item) => item.title === "Northwind Capital Periodic Exam")).toBe(false);
  });

  it("denies export of case 1042 to a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("filings");
    expect(response.body.case).toBeUndefined();
    expect(response.body.id).toBeUndefined();
    expect(response.body.title).toBeUndefined();
    expect(response.body.status).toBeUndefined();

    const events = await prisma.auditEvent.findMany({
      where: {
        examinerId: "examiner-b",
        caseId: 1042,
        action: "access-denied GET /cases/1042/export",
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0].createdAt).toBeInstanceOf(Date);
  });
});
