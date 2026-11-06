import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { badRequest, notFound } from "../httpError";
import { record } from "./audit";
import { isAssigned } from "./assignments";
import {
  CaseExport,
  CaseJson,
  CaseListQuery,
  FilingJson,
  isCaseStatus,
} from "../types";

function toCaseJson(row: { id: number; title: string; status: string }): CaseJson {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
  };
}

function toFilingJson(row: { id: number; caseId: number; title: string; status: string }): FilingJson {
  return {
    id: row.id,
    caseId: row.caseId,
    title: row.title,
    status: row.status,
  };
}

function listFilters(query: CaseListQuery): Prisma.CaseWhereInput {
  const where: Prisma.CaseWhereInput = {};
  if (query.status) {
    where.status = query.status;
  }
  if (query.title) {
    where.title = { contains: query.title };
  }
  return where;
}

function listWhere(examinerId: string, query: CaseListQuery): Prisma.CaseWhereInput {
  return {
    ...listFilters(query),
    assignments: { some: { examinerId } },
  };
}

export async function findCaseForExaminer(id: number, examinerId: string) {
  return prisma.case.findFirst({
    where: {
      id,
      assignments: { some: { examinerId } },
    },
    include: {
      filings: { orderBy: { id: "asc" } },
    },
  });
}

async function denyCaseRead(examinerId: string, id: number, route: string): Promise<never> {
  await record(examinerId, `access-denied ${route}`, id);
  throw notFound("Case not found");
}

export async function getById(examinerId: string, id: number): Promise<CaseJson> {
  const row = await findCaseForExaminer(id, examinerId);
  if (!row) {
    return denyCaseRead(examinerId, id, `GET /cases/${id}`);
  }
  return toCaseJson(row);
}

export async function list(examinerId: string, query: CaseListQuery): Promise<CaseJson[]> {
  const denied = await prisma.case.findMany({
    where: {
      ...listFilters(query),
      NOT: { assignments: { some: { examinerId } } },
    },
    select: { id: true },
  });
  for (const row of denied) {
    await record(examinerId, "access-denied GET /cases", row.id);
  }

  const rows = await prisma.case.findMany({
    where: listWhere(examinerId, query),
    orderBy: { id: "asc" },
  });
  return rows.map(toCaseJson);
}

export async function exportCase(examinerId: string, id: number): Promise<CaseExport> {
  const row = await findCaseForExaminer(id, examinerId);
  if (!row) {
    return denyCaseRead(examinerId, id, `GET /cases/${id}/export`);
  }

  return {
    case: toCaseJson(row),
    filings: row.filings.map(toFilingJson),
    generatedAt: new Date().toISOString(),
  };
}

export async function updateStatus(
  examinerId: string,
  id: number,
  status: string,
): Promise<CaseJson> {
  if (!isCaseStatus(status)) {
    throw badRequest("Unknown case status");
  }

  const existing = await prisma.case.findUnique({ where: { id } });
  if (!existing) {
    throw notFound("Case not found");
  }

  const assigned = await isAssigned(examinerId, id);
  if (!assigned) {
    throw notFound("Case not found");
  }

  const updated = await prisma.case.update({
    where: { id },
    data: { status },
  });

  // Status changes do not write an audit event. See SEEDED.md.
  return toCaseJson(updated);
}
