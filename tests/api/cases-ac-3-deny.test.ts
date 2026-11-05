import request from "supertest";
import { prisma } from "../../src/db";
import { createApp } from "../../src/app";
import { signToken } from "../helpers/token";

const app = createApp();
const token = () => signToken("examiner-b");
const deniedTitle = "Northwind Capital Periodic Exam";

afterAll(async () => {
  await prisma.$disconnect();
});

async function accessDenied(action: string) {
  return prisma.auditEvent.findFirst({
    where: {
      examinerId: "examiner-b",
      caseId: 1042,
      action,
    },
    orderBy: { id: "desc" },
  });
}

describe("AC-3 case read denial", () => {
  it("denies GET /cases/1042 to an examiner who is not assigned", async () => {
    const response = await request(app)
      .get("/cases/1042")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("id");
    expect(response.body).not.toHaveProperty("title");
    expect(response.body).not.toHaveProperty("status");
    expect(JSON.stringify(response.body)).not.toContain(deniedTitle);

    const event = await accessDenied("access-denied GET /cases/1042");
    expect(event).not.toBeNull();
    expect(event?.examinerId).toBe("examiner-b");
    expect(event?.caseId).toBe(1042);
    expect(event?.action).toBe("access-denied GET /cases/1042");
    expect(event?.createdAt).toBeInstanceOf(Date);
  });

  it("denies GET /cases/1042/export to an examiner who is not assigned", async () => {
    const response = await request(app)
      .get("/cases/1042/export")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("case");
    expect(response.body).not.toHaveProperty("filings");
    expect(response.body.case).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(deniedTitle);
    expect(JSON.stringify(response.body)).not.toContain("Q3 capital adequacy");

    const event = await accessDenied("access-denied GET /cases/1042/export");
    expect(event).not.toBeNull();
    expect(event?.examinerId).toBe("examiner-b");
    expect(event?.caseId).toBe(1042);
    expect(event?.action).toBe("access-denied GET /cases/1042/export");
    expect(event?.createdAt).toBeInstanceOf(Date);
  });

  it("omits case 1042 from GET /cases for an examiner who is not assigned", async () => {
    const response = await request(app).get("/cases").set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as { id: number; title: string }[];
    expect(cases.some((item) => item.id === 1042)).toBe(false);
    expect(cases.some((item) => item.title === deniedTitle)).toBe(false);
  });

  it("omits case 1042 from GET /cases title search for an examiner who is not assigned", async () => {
    const response = await request(app)
      .get("/cases")
      .query({ title: "Northwind" })
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(200);
    const cases = response.body.cases as { id: number; title: string }[];
    expect(cases.some((item) => item.id === 1042)).toBe(false);
    expect(cases.some((item) => item.title === deniedTitle)).toBe(false);
  });
});
