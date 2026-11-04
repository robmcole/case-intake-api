import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();
const unassigned = () => signToken("examiner-b");

afterAll(async () => {
  await prisma.$disconnect();
});

describe("AC-3 case read denial", () => {
  it("denies GET /cases/1042 to a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("id");
    expect(response.body).not.toHaveProperty("title");
    expect(response.body).not.toHaveProperty("status");
    expect(JSON.stringify(response.body)).not.toContain("Northwind Capital Periodic Exam");

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

  it("denies GET /cases/1042/export to a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("case");
    expect(response.body).not.toHaveProperty("filings");
    expect(response.body).not.toHaveProperty("id");
    expect(response.body).not.toHaveProperty("title");
    expect(response.body).not.toHaveProperty("status");

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

  it("omits unassigned cases from GET /cases list and search", async () => {
    const list = await request(app).get("/cases").set("Authorization", `Bearer ${unassigned()}`);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain("Northwind Capital Periodic Exam");
    expect(list.body.cases.map((item: { id: number }) => item.id)).not.toContain(1042);

    const byStatus = await request(app)
      .get("/cases")
      .query({ status: "open" })
      .set("Authorization", `Bearer ${unassigned()}`);
    expect(byStatus.status).toBe(200);
    expect(JSON.stringify(byStatus.body)).not.toContain("Northwind Capital Periodic Exam");
    expect(byStatus.body.cases.map((item: { id: number }) => item.id)).not.toContain(1042);

    const byNorthwind = await request(app)
      .get("/cases")
      .query({ title: "Northwind" })
      .set("Authorization", `Bearer ${unassigned()}`);
    expect(byNorthwind.status).toBe(200);
    expect(JSON.stringify(byNorthwind.body)).not.toContain("Northwind Capital Periodic Exam");
    expect(byNorthwind.body.cases.map((item: { id: number }) => item.id)).not.toContain(1042);

    const byHarborline = await request(app)
      .get("/cases")
      .query({ title: "Harborline" })
      .set("Authorization", `Bearer ${unassigned()}`);
    expect(byHarborline.status).toBe(200);
    expect(JSON.stringify(byHarborline.body)).not.toContain("Harborline Broker-Dealer Review");
    expect(byHarborline.body.cases.map((item: { id: number }) => item.id)).not.toContain(1043);
  });
});
