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
  it("denies GET /cases/:id for a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("id");
    expect(response.body).not.toHaveProperty("title");
    expect(response.body).not.toHaveProperty("status");
    expect(JSON.stringify(response.body)).not.toContain("Northwind Capital Periodic Exam");
  });

  it("omits unassigned cases from GET /cases", async () => {
    const response = await request(app).get("/cases").set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as { id: number; title: string }[];
    expect(cases).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 1042 })]));
    expect(cases).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Northwind Capital Periodic Exam" }),
      ]),
    );
  });

  it("omits unassigned matches from GET /cases?title=", async () => {
    const response = await request(app)
      .get("/cases")
      .query({ title: "Harborline" })
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as { id: number; title: string }[];
    expect(cases).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 1043 })]));
    expect(cases).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Harborline Broker-Dealer Review" }),
      ]),
    );
  });

  it("denies GET /cases/:id/export for a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("case");
    expect(response.body).not.toHaveProperty("filings");
    expect(response.body).not.toHaveProperty("id");
    expect(response.body).not.toHaveProperty("title");
    expect(JSON.stringify(response.body)).not.toContain("Northwind Capital Periodic Exam");
  });

  it("records access-denied audit events for detail and export", async () => {
    await request(app).get("/cases/1042").set("Authorization", `Bearer ${unassigned()}`);

    const detailEvent = await prisma.auditEvent.findFirst({
      where: {
        examinerId: "examiner-b",
        caseId: 1042,
        action: "access-denied GET /cases/1042",
      },
    });
    expect(detailEvent).toMatchObject({
      examinerId: "examiner-b",
      caseId: 1042,
      action: "access-denied GET /cases/1042",
    });
    expect(detailEvent?.createdAt).toEqual(expect.any(Date));

    await request(app).get("/cases/1042/export").set("Authorization", `Bearer ${unassigned()}`);

    const exportEvent = await prisma.auditEvent.findFirst({
      where: {
        examinerId: "examiner-b",
        caseId: 1042,
        action: "access-denied GET /cases/1042/export",
      },
    });
    expect(exportEvent).toMatchObject({
      examinerId: "examiner-b",
      caseId: 1042,
      action: "access-denied GET /cases/1042/export",
    });
    expect(exportEvent?.createdAt).toEqual(expect.any(Date));
  });
});
