import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();
const token = () => signToken("examiner-b");
const northwind = "Northwind Capital Periodic Exam";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("AC-3 case reads", () => {
  it("denies case 1042 to a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expect(response.body.id).toBeUndefined();
    expect(response.body.title).toBeUndefined();
    expect(response.body.status).toBeUndefined();
    expect(response.body.filings).toBeUndefined();
  });

  it("omits case 1042 from another examiner's list", async () => {
    const response = await request(app).get("/cases").set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as { id: number; title: string }[];
    expect(cases.some((item) => item.id === 1042)).toBe(false);
    expect(cases.some((item) => item.title === northwind)).toBe(false);
  });

  it("omits case 1042 from another examiner's status filter", async () => {
    const response = await request(app)
      .get("/cases")
      .query({ status: "open" })
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as { id: number }[];
    expect(cases.some((item) => item.id === 1042)).toBe(false);
  });

  it("omits case 1042 from another examiner's title search", async () => {
    const response = await request(app)
      .get("/cases")
      .query({ title: "Northwind" })
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as { id: number; title: string }[];
    expect(cases.some((item) => item.id === 1042)).toBe(false);
    expect(cases.some((item) => item.title === northwind)).toBe(false);
  });

  it("denies export of case 1042 to a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expect(response.body.case).toBeUndefined();
    expect(response.body.filings).toBeUndefined();
    expect(response.body.id).toBeUndefined();
    expect(response.body.title).toBeUndefined();
  });

  it("records an access-denied audit event for the detail denial", async () => {
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
    expect(event?.createdAt).toEqual(expect.any(Date));
  });

  it("records an access-denied audit event for the export denial", async () => {
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
    expect(event?.createdAt).toEqual(expect.any(Date));
  });
});
