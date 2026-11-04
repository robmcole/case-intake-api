import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();
const tokenB = () => signToken("examiner-b");

afterAll(async () => {
  await prisma.$disconnect();
});

describe("AC-3 case-read denials", () => {
  it("denies GET /cases/:id for a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${tokenB()}`);

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("id");
    expect(response.body).not.toHaveProperty("title");
    expect(response.body).not.toHaveProperty("status");
  });

  it("omits unassigned cases from GET /cases", async () => {
    const response = await request(app)
      .get("/cases")
      .set("Authorization", `Bearer ${tokenB()}`);

    expect(response.status).toBe(200);
    const ids = response.body.cases.map((item: { id: number }) => item.id);
    expect(ids).not.toContain(1042);
    expect(ids).not.toContain(1043);
  });

  it("omits unassigned cases from GET /cases?status=open", async () => {
    const response = await request(app)
      .get("/cases")
      .query({ status: "open" })
      .set("Authorization", `Bearer ${tokenB()}`);

    expect(response.status).toBe(200);
    const ids = response.body.cases.map((item: { id: number }) => item.id);
    expect(ids).not.toContain(1042);
    expect(ids).not.toContain(1043);
  });

  it("omits unassigned cases from GET /cases?title=Harborline", async () => {
    const response = await request(app)
      .get("/cases")
      .query({ title: "Harborline" })
      .set("Authorization", `Bearer ${tokenB()}`);

    expect(response.status).toBe(200);
    expect(response.body.cases).toEqual([]);
  });

  it("denies GET /cases/:id/export for a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${tokenB()}`);

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("case");
    expect(response.body).not.toHaveProperty("filings");
  });

  it("records an access-denied audit event on detail denial", async () => {
    await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${tokenB()}`);

    const event = await prisma.auditEvent.findFirst({
      where: {
        examinerId: "examiner-b",
        caseId: 1042,
        action: "access-denied GET /cases/1042",
      },
      orderBy: { id: "desc" },
    });

    expect(event).not.toBeNull();
    expect(event?.createdAt).toBeInstanceOf(Date);
  });
});
