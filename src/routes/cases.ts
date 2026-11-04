import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { badRequest, optionalQueryString, parseRouteId } from "../httpError";
import { exportCase, getById, list, updateStatus } from "../services/cases";

export const casesRouter = Router();

casesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const cases = await list(req.examinerId, {
      status: optionalQueryString(req.query.status, "status"),
      title: optionalQueryString(req.query.title, "title"),
    });
    res.json({ cases });
  }),
);

casesRouter.get(
  "/:id/export",
  asyncHandler(async (req, res) => {
    const body = await exportCase(req.examinerId, parseRouteId(req.params.id, "case id"));
    res.json(body);
  }),
);

casesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = await getById(req.examinerId, parseRouteId(req.params.id, "case id"));
    res.json(body);
  }),
);

casesRouter.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const status = readStatus(req.body);
    const updated = await updateStatus(
      req.examinerId,
      parseRouteId(req.params.id, "case id"),
      status,
    );
    res.json(updated);
  }),
);

function readStatus(body: unknown): string {
  if (!body || typeof body !== "object" || !("status" in body)) {
    throw badRequest("status is required");
  }
  const status = (body as { status: unknown }).status;
  if (typeof status !== "string" || status.trim().length === 0) {
    throw badRequest("status is required");
  }
  return status.trim();
}
