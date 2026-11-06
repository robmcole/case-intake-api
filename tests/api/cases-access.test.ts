import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();
const unassigned = () => signToken("examiner-b");
const caseTitle = "Northwind Capital Periodic Exam";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("AC-3 case access", () => {
  it("denies case 1042 to a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(404);
    expect(response.body).not.toMatchObject({ id: 1042 });
    expect(response.body.title).toBeUndefined();
    expect(response.body.status).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(caseTitle);
  });

  it("omits case 1042 from the list for a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases")
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as Array<{ id: number; title: string }>;
    expect(cases.some((item) => item.id === 1042)).toBe(false);
    expect(cases.some((item) => item.title === caseTitle)).toBe(false);
  });

  it("omits case 1042 from title search for a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases")
      .query({ title: "Northwind" })
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as Array<{ id: number; title: string }>;
    expect(cases.some((item) => item.id === 1042)).toBe(false);
    expect(cases.some((item) => item.title === caseTitle)).toBe(false);
  });

  it("denies export of case 1042 to a non-assigned examiner", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${unassigned()}`);

    expect(response.status).toBe(404);
    expect(response.body.case).toBeUndefined();
    expect(response.body.filings).toBeUndefined();
    expect(response.body.id).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(caseTitle);
  });

  it("records an access-denied audit event for the detail denial", async () => {
    await request(app).get("/cases/1042").set("Authorization", `Bearer ${unassigned()}`);

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
});
