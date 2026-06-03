import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc, sql, asc, isNull, or } from "drizzle-orm";
import {
  db,
  workCentersTable,
  productionShiftsTable,
  apsScheduleTable,
  productionOrdersTable,
} from "@workspace/db";
import type { Request, Response } from "express";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.session.userId) { res.status(401).json({ error: "Não autenticado" }); return false; }
  return true;
}

function parseId(rawId: string | string[], res: Response): number | null {
  const raw = Array.isArray(rawId) ? rawId[0] : rawId;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return null; }
  return id;
}

// ─── Work Centers ─────────────────────────────────────────────────────────────

router.get("/aps/work-centers", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { active } = req.query;
  const rows = await db
    .select()
    .from(workCentersTable)
    .where(active !== undefined ? eq(workCentersTable.isActive, active === "true") : undefined)
    .orderBy(workCentersTable.name);
  res.json(rows);
});

router.post("/aps/work-centers", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { name, description, type, capacityHoursPerShift, setupTimeMinutes, notes } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Nome é obrigatório" }); return; }
  const [row] = await db.insert(workCentersTable).values({
    name: name.trim(),
    description: description || null,
    type: type || "machine",
    capacityHoursPerShift: capacityHoursPerShift ?? "8",
    setupTimeMinutes: setupTimeMinutes ?? 30,
    notes: notes || null,
  }).returning();
  res.status(201).json(row);
});

router.put("/aps/work-centers/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const { name, description, type, capacityHoursPerShift, setupTimeMinutes, isActive, notes } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Nome é obrigatório" }); return; }
  const [row] = await db.update(workCentersTable).set({
    name: name.trim(),
    description: description || null,
    type: type || "machine",
    capacityHoursPerShift: capacityHoursPerShift ?? "8",
    setupTimeMinutes: setupTimeMinutes ?? 30,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    notes: notes || null,
  }).where(eq(workCentersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Centro de trabalho não encontrado" }); return; }
  res.json(row);
});

router.delete("/aps/work-centers/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [row] = await db.update(workCentersTable).set({ isActive: false }).where(eq(workCentersTable.id, id)).returning({ id: workCentersTable.id });
  if (!row) { res.status(404).json({ error: "Centro de trabalho não encontrado" }); return; }
  res.json({ ok: true });
});

// ─── Production Shifts ────────────────────────────────────────────────────────

router.get("/aps/shifts", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { workCenterId, startDate, endDate } = req.query;
  const filters = [];
  if (workCenterId) filters.push(eq(productionShiftsTable.workCenterId, parseInt(workCenterId as string, 10)));
  if (startDate) filters.push(gte(productionShiftsTable.date, startDate as string));
  if (endDate) filters.push(lte(productionShiftsTable.date, endDate as string));
  const rows = await db.select().from(productionShiftsTable).where(filters.length ? and(...filters) : undefined).orderBy(productionShiftsTable.date, productionShiftsTable.startTime);
  res.json(rows);
});

router.post("/aps/shifts", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { workCenterId, date, shiftName, startTime, endTime, availableHours, isBlocked, blockReason } = req.body;
  if (!workCenterId || !date) { res.status(400).json({ error: "workCenterId e date são obrigatórios" }); return; }
  const [row] = await db.insert(productionShiftsTable).values({
    workCenterId: parseInt(workCenterId, 10),
    date,
    shiftName: shiftName || "Manhã",
    startTime: startTime || "07:00",
    endTime: endTime || "15:00",
    availableHours: availableHours ?? "8",
    isBlocked: isBlocked ?? false,
    blockReason: blockReason || null,
  }).returning();
  res.status(201).json(row);
});

router.put("/aps/shifts/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const { date, shiftName, startTime, endTime, availableHours, isBlocked, blockReason } = req.body;
  const [row] = await db.update(productionShiftsTable).set({
    date,
    shiftName,
    startTime,
    endTime,
    availableHours,
    isBlocked: isBlocked ?? false,
    blockReason: isBlocked ? (blockReason || null) : null,
  }).where(eq(productionShiftsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Turno não encontrado" }); return; }
  res.json(row);
});

router.delete("/aps/shifts/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [row] = await db.delete(productionShiftsTable).where(eq(productionShiftsTable.id, id)).returning({ id: productionShiftsTable.id });
  if (!row) { res.status(404).json({ error: "Turno não encontrado" }); return; }
  res.json({ ok: true });
});

// ─── APS Schedule ─────────────────────────────────────────────────────────────

router.get("/aps/schedule", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { workCenterId, startDate, endDate, status } = req.query;
  const filters = [];
  if (workCenterId) filters.push(eq(apsScheduleTable.workCenterId, parseInt(workCenterId as string, 10)));
  if (status) filters.push(eq(apsScheduleTable.status, status as string));
  if (startDate) filters.push(gte(apsScheduleTable.scheduledStart, startDate as string));
  if (endDate) filters.push(lte(apsScheduleTable.scheduledEnd, endDate as string));
  const rows = await db
    .select({
      id: apsScheduleTable.id,
      productionOrderId: apsScheduleTable.productionOrderId,
      workCenterId: apsScheduleTable.workCenterId,
      workCenterName: workCentersTable.name,
      orderNumber: apsScheduleTable.orderNumber,
      productName: apsScheduleTable.productName,
      plannedQty: apsScheduleTable.plannedQty,
      unit: apsScheduleTable.unit,
      scheduledStart: apsScheduleTable.scheduledStart,
      scheduledEnd: apsScheduleTable.scheduledEnd,
      estimatedHours: apsScheduleTable.estimatedHours,
      status: apsScheduleTable.status,
      priority: apsScheduleTable.priority,
      sequenceNumber: apsScheduleTable.sequenceNumber,
      notes: apsScheduleTable.notes,
      rescheduledAt: apsScheduleTable.rescheduledAt,
      rescheduledBy: apsScheduleTable.rescheduledBy,
      rescheduledReason: apsScheduleTable.rescheduledReason,
    })
    .from(apsScheduleTable)
    .leftJoin(workCentersTable, eq(apsScheduleTable.workCenterId, workCentersTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(apsScheduleTable.scheduledStart, apsScheduleTable.priority);
  res.json(rows);
});

router.post("/aps/schedule", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { productionOrderId, workCenterId, orderNumber, productName, plannedQty, unit, scheduledStart, scheduledEnd, estimatedHours, priority, sequenceNumber, notes } = req.body;
  if (!workCenterId || !scheduledStart || !scheduledEnd) {
    res.status(400).json({ error: "workCenterId, scheduledStart e scheduledEnd são obrigatórios" }); return;
  }
  // Check for time conflict
  const conflict = await db.select({ id: apsScheduleTable.id }).from(apsScheduleTable)
    .where(and(
      eq(apsScheduleTable.workCenterId, parseInt(workCenterId, 10)),
      sql`${apsScheduleTable.status} NOT IN ('done','cancelled')`,
      sql`${apsScheduleTable.scheduledStart} < ${scheduledEnd} AND ${apsScheduleTable.scheduledEnd} > ${scheduledStart}`,
    )).limit(1);
  if (conflict.length > 0) {
    res.status(409).json({ error: `Conflito de capacidade: o centro de trabalho já tem uma OP programada neste período (ID ${conflict[0].id}).` }); return;
  }
  const [row] = await db.insert(apsScheduleTable).values({
    productionOrderId: productionOrderId ? parseInt(productionOrderId, 10) : null,
    workCenterId: parseInt(workCenterId, 10),
    orderNumber: orderNumber || null,
    productName: productName || null,
    plannedQty: plannedQty || null,
    unit: unit || "kg",
    scheduledStart,
    scheduledEnd,
    estimatedHours: estimatedHours || null,
    priority: priority ?? 5,
    sequenceNumber: sequenceNumber || null,
    notes: notes || null,
  }).returning();
  res.status(201).json(row);
});

router.put("/aps/schedule/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const { workCenterId, scheduledStart, scheduledEnd, estimatedHours, status, priority, sequenceNumber, notes, rescheduledReason, productionOrderId, orderNumber, productName, plannedQty, unit } = req.body;

  if (!workCenterId || !scheduledStart || !scheduledEnd) {
    res.status(400).json({ error: "workCenterId, scheduledStart e scheduledEnd são obrigatórios" }); return;
  }

  // Check conflict (excluding self)
  const conflict = await db.select({ id: apsScheduleTable.id }).from(apsScheduleTable)
    .where(and(
      eq(apsScheduleTable.workCenterId, parseInt(workCenterId, 10)),
      sql`${apsScheduleTable.id} != ${id}`,
      sql`${apsScheduleTable.status} NOT IN ('done','cancelled')`,
      sql`${apsScheduleTable.scheduledStart} < ${scheduledEnd} AND ${apsScheduleTable.scheduledEnd} > ${scheduledStart}`,
    )).limit(1);
  if (conflict.length > 0) {
    res.status(409).json({ error: `Conflito de capacidade: o centro de trabalho já tem uma OP programada neste período (ID ${conflict[0].id}).` }); return;
  }

  const isReschedule = !!rescheduledReason;
  const [existing] = await db.select().from(apsScheduleTable).where(eq(apsScheduleTable.id, id));
  const wasRescheduled = existing && (existing.scheduledStart !== scheduledStart || existing.scheduledEnd !== scheduledEnd || existing.workCenterId !== parseInt(workCenterId, 10));

  const [row] = await db.update(apsScheduleTable).set({
    workCenterId: parseInt(workCenterId, 10),
    productionOrderId: productionOrderId != null ? parseInt(productionOrderId, 10) : null,
    orderNumber: orderNumber || null,
    productName: productName || null,
    plannedQty: plannedQty || null,
    unit: unit || "kg",
    scheduledStart,
    scheduledEnd,
    estimatedHours: estimatedHours || null,
    status: status || "planned",
    priority: priority ?? 5,
    sequenceNumber: sequenceNumber || null,
    notes: notes || null,
    rescheduledAt: (wasRescheduled || isReschedule) ? new Date() : existing?.rescheduledAt ?? null,
    rescheduledBy: (wasRescheduled || isReschedule) ? (req.session.userName || null) : existing?.rescheduledBy ?? null,
    rescheduledReason: rescheduledReason || existing?.rescheduledReason || null,
  }).where(eq(apsScheduleTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Entrada de programação não encontrada" }); return; }
  res.json(row);
});

router.delete("/aps/schedule/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [row] = await db.delete(apsScheduleTable).where(eq(apsScheduleTable.id, id)).returning({ id: apsScheduleTable.id });
  if (!row) { res.status(404).json({ error: "Entrada de programação não encontrada" }); return; }
  res.json({ ok: true });
});

// ─── Auto-Schedule Algorithm ──────────────────────────────────────────────────

router.post("/aps/schedule/auto", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { workCenterId, startDate, hoursPerEntry } = req.body;
  if (!workCenterId) { res.status(400).json({ error: "workCenterId é obrigatório" }); return; }

  const wcId = parseInt(workCenterId, 10);
  const baseDate = startDate ? new Date(startDate) : new Date();
  const hpe = parseFloat(hoursPerEntry ?? "8");

  // Get open POs not yet scheduled on this work center
  const openOrders = await db.select().from(productionOrdersTable)
    .where(sql`${productionOrdersTable.status} IN ('planned','released')`)
    .orderBy(asc(productionOrdersTable.scheduledEnd), asc(productionOrdersTable.id));

  // Get already-scheduled entries for this WC in the future
  const existing = await db.select({ scheduledStart: apsScheduleTable.scheduledStart, scheduledEnd: apsScheduleTable.scheduledEnd })
    .from(apsScheduleTable)
    .where(and(eq(apsScheduleTable.workCenterId, wcId), sql`${apsScheduleTable.status} NOT IN ('done','cancelled')`))
    .orderBy(apsScheduleTable.scheduledStart);

  // Simple greedy scheduling: find next available slot
  const formatDT = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  let cursor = new Date(baseDate);
  cursor.setHours(7, 0, 0, 0); // Start at 7:00 AM

  const busySlots = existing.map(e => ({ start: new Date(e.scheduledStart), end: new Date(e.scheduledEnd) }));

  const findNextSlot = (from: Date, durationHours: number): { start: Date; end: Date } => {
    let current = new Date(from);
    // Skip weekends
    while (current.getDay() === 0 || current.getDay() === 6) {
      current.setDate(current.getDate() + 1);
      current.setHours(7, 0, 0, 0);
    }
    // Working hours 07:00-23:00 max
    if (current.getHours() < 7) { current.setHours(7, 0, 0, 0); }
    if (current.getHours() >= 19) { current.setDate(current.getDate() + 1); current.setHours(7, 0, 0, 0); }

    const slotEnd = new Date(current.getTime() + durationHours * 3600 * 1000);

    // Check conflicts
    for (const busy of busySlots) {
      if (current < busy.end && slotEnd > busy.start) {
        return findNextSlot(busy.end, durationHours);
      }
    }
    return { start: current, end: slotEnd };
  };

  const created = [];
  let seq = 1;

  for (const op of openOrders) {
    const slot = findNextSlot(cursor, hpe);
    const entry = await db.insert(apsScheduleTable).values({
      productionOrderId: op.id,
      workCenterId: wcId,
      orderNumber: op.number,
      productName: op.productName,
      plannedQty: op.plannedQty,
      unit: op.unit,
      scheduledStart: formatDT(slot.start),
      scheduledEnd: formatDT(slot.end),
      estimatedHours: hpe.toString(),
      status: "planned",
      priority: 5,
      sequenceNumber: seq++,
    }).returning();
    created.push(entry[0]);
    busySlots.push(slot);
    cursor = slot.end;
  }

  res.status(201).json({ scheduled: created.length, entries: created });
});

// ─── APS Dashboard ────────────────────────────────────────────────────────────

router.get("/aps/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const now = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM

  // Total scheduled by status
  const statusCounts = await db
    .select({ status: apsScheduleTable.status, count: sql<number>`COUNT(*)::int` })
    .from(apsScheduleTable)
    .groupBy(apsScheduleTable.status);

  // Overdue: planned/in_progress with scheduledEnd in the past
  const [overdueRow] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(apsScheduleTable)
    .where(and(sql`${apsScheduleTable.status} IN ('planned','in_progress')`, sql`${apsScheduleTable.scheduledEnd} < ${now}`));

  // Conflicts: overlapping schedule entries per work center
  const conflictRows = await db.execute(sql`
    SELECT COUNT(*) as count FROM (
      SELECT a.id FROM aps_schedule a
      JOIN aps_schedule b ON a.work_center_id = b.work_center_id AND a.id < b.id
      WHERE a.status NOT IN ('done','cancelled') AND b.status NOT IN ('done','cancelled')
      AND a.scheduled_start < b.scheduled_end AND a.scheduled_end > b.scheduled_start
    ) x
  `);
  const conflictCount = parseInt((conflictRows.rows[0] as any)?.count ?? "0", 10);

  // Blocked shifts today
  const today = new Date().toISOString().slice(0, 10);
  const [blockedRow] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(productionShiftsTable)
    .where(and(eq(productionShiftsTable.isBlocked, true), eq(productionShiftsTable.date, today)));

  // Capacity utilization per work center (next 7 days)
  const end7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16);
  const utilization = await db.select({
    workCenterId: apsScheduleTable.workCenterId,
    workCenterName: workCentersTable.name,
    scheduledHours: sql<number>`SUM(EXTRACT(EPOCH FROM (${apsScheduleTable.scheduledEnd}::timestamp - ${apsScheduleTable.scheduledStart}::timestamp)) / 3600)::numeric(8,2)`,
    capacityHours: sql<number>`(${workCentersTable.capacityHoursPerShift}::numeric * 5)::numeric(8,2)`, // 5-day week
  })
    .from(apsScheduleTable)
    .leftJoin(workCentersTable, eq(apsScheduleTable.workCenterId, workCentersTable.id))
    .where(and(
      gte(apsScheduleTable.scheduledStart, now),
      lte(apsScheduleTable.scheduledEnd, end7),
      sql`${apsScheduleTable.status} NOT IN ('done','cancelled')`,
    ))
    .groupBy(apsScheduleTable.workCenterId, workCentersTable.name, workCentersTable.capacityHoursPerShift);

  // Next 10 upcoming scheduled entries
  const upcoming = await db
    .select({
      id: apsScheduleTable.id,
      orderNumber: apsScheduleTable.orderNumber,
      productName: apsScheduleTable.productName,
      workCenterName: workCentersTable.name,
      scheduledStart: apsScheduleTable.scheduledStart,
      scheduledEnd: apsScheduleTable.scheduledEnd,
      status: apsScheduleTable.status,
      priority: apsScheduleTable.priority,
    })
    .from(apsScheduleTable)
    .leftJoin(workCentersTable, eq(apsScheduleTable.workCenterId, workCentersTable.id))
    .where(and(gte(apsScheduleTable.scheduledStart, now), sql`${apsScheduleTable.status} NOT IN ('done','cancelled')`))
    .orderBy(apsScheduleTable.scheduledStart)
    .limit(10);

  const byStatus = Object.fromEntries(statusCounts.map(r => [r.status, Number(r.count)]));
  const totalScheduled = statusCounts.reduce((s, r) => s + Number(r.count), 0);
  const totalDone = Number(byStatus["done"] ?? 0);
  const totalActive = Number(byStatus["in_progress"] ?? 0);
  const totalPlanned = Number(byStatus["planned"] ?? 0);

  res.json({
    totalScheduled,
    totalDone,
    totalActive,
    totalPlanned,
    overdueCount: Number(overdueRow?.count ?? 0),
    conflictCount,
    blockedShiftsToday: Number(blockedRow?.count ?? 0),
    byStatus,
    utilizationByWorkCenter: utilization,
    upcoming,
  });
});

// ─── APS Alerts ──────────────────────────────────────────────────────────────

router.get("/aps/alerts", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const now = new Date().toISOString().slice(0, 16);
  const alerts: Array<{ type: string; severity: string; message: string; entityId?: number }> = [];

  // 1. Overdue scheduled entries
  const overdue = await db.select({
    id: apsScheduleTable.id,
    orderNumber: apsScheduleTable.orderNumber,
    productName: apsScheduleTable.productName,
    scheduledEnd: apsScheduleTable.scheduledEnd,
    workCenterId: apsScheduleTable.workCenterId,
  }).from(apsScheduleTable)
    .where(and(sql`${apsScheduleTable.status} IN ('planned','in_progress')`, sql`${apsScheduleTable.scheduledEnd} < ${now}`))
    .limit(20);

  for (const e of overdue) {
    alerts.push({ type: "overdue", severity: "critical", message: `OP "${e.orderNumber ?? e.productName}" com prazo encerrado e não concluída (previsto: ${e.scheduledEnd?.slice(0, 10)})`, entityId: e.id });
  }

  // 2. Capacity conflicts
  const conflictPairs = await db.execute(sql`
    SELECT a.id as a_id, b.id as b_id, a.order_number as a_op, b.order_number as b_op, a.work_center_id
    FROM aps_schedule a
    JOIN aps_schedule b ON a.work_center_id = b.work_center_id AND a.id < b.id
    WHERE a.status NOT IN ('done','cancelled') AND b.status NOT IN ('done','cancelled')
    AND a.scheduled_start < b.scheduled_end AND a.scheduled_end > b.scheduled_start
    LIMIT 10
  `);
  for (const row of conflictPairs.rows as any[]) {
    alerts.push({ type: "conflict", severity: "high", message: `Conflito de capacidade: OP ${row.a_op ?? row.a_id} e OP ${row.b_op ?? row.b_id} sobrepostas no mesmo centro de trabalho`, entityId: row.a_id });
  }

  // 3. Blocked shifts affecting scheduled entries
  const today = new Date().toISOString().slice(0, 10);
  const blocked = await db.select({
    id: productionShiftsTable.id,
    workCenterId: productionShiftsTable.workCenterId,
    date: productionShiftsTable.date,
    blockReason: productionShiftsTable.blockReason,
    workCenterName: workCentersTable.name,
  }).from(productionShiftsTable)
    .leftJoin(workCentersTable, eq(productionShiftsTable.workCenterId, workCentersTable.id))
    .where(and(eq(productionShiftsTable.isBlocked, true), gte(productionShiftsTable.date, today)));

  for (const b of blocked) {
    alerts.push({ type: "blocked_shift", severity: "medium", message: `Turno bloqueado em "${b.workCenterName}" em ${b.date}${b.blockReason ? `: ${b.blockReason}` : ""}`, entityId: b.id });
  }

  // 4. Production orders with no schedule
  const [unscheduledRow] = await db.select({ count: sql<number>`COUNT(*)::int` })
    .from(productionOrdersTable)
    .where(and(
      sql`${productionOrdersTable.status} IN ('planned','released')`,
      sql`NOT EXISTS (SELECT 1 FROM aps_schedule s WHERE s.production_order_id = ${productionOrdersTable.id} AND s.status NOT IN ('done','cancelled'))`,
    ));
  const unscheduled = Number(unscheduledRow?.count ?? 0);
  if (unscheduled > 0) {
    alerts.push({ type: "unscheduled", severity: "medium", message: `${unscheduled} ordem(ns) de produção abertas sem programação APS` });
  }

  res.json(alerts);
});

// ─── APS Simulate ────────────────────────────────────────────────────────────

router.post("/aps/simulate", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { scenario, workCenterId, blockedFrom, blockedTo, extraShiftHours } = req.body;

  if (scenario === "block_period" && workCenterId && blockedFrom && blockedTo) {
    // Count scheduled entries that fall in the blocked period
    const affected = await db.select({ id: apsScheduleTable.id, orderNumber: apsScheduleTable.orderNumber, productName: apsScheduleTable.productName, scheduledStart: apsScheduleTable.scheduledStart, scheduledEnd: apsScheduleTable.scheduledEnd })
      .from(apsScheduleTable)
      .where(and(
        eq(apsScheduleTable.workCenterId, parseInt(workCenterId, 10)),
        sql`${apsScheduleTable.status} NOT IN ('done','cancelled')`,
        sql`${apsScheduleTable.scheduledStart} < ${blockedTo} AND ${apsScheduleTable.scheduledEnd} > ${blockedFrom}`,
      ));

    res.json({
      scenario: "block_period",
      affectedCount: affected.length,
      affected,
      impact: affected.length > 0 ? `${affected.length} OP(s) impactadas pelo bloqueio do período ${blockedFrom} a ${blockedTo}. Reprogramação necessária.` : "Nenhuma OP afetada pelo bloqueio.",
    });
  } else if (scenario === "extra_shift" && workCenterId) {
    const hours = parseFloat(extraShiftHours ?? "8");
    const wcId = parseInt(workCenterId, 10);
    const [wc] = await db.select().from(workCentersTable).where(eq(workCentersTable.id, wcId));
    if (!wc) { res.status(404).json({ error: "Centro de trabalho não encontrado" }); return; }

    const currentCapacity = parseFloat(wc.capacityHoursPerShift) * 5;
    const newCapacity = currentCapacity + hours;
    const now = new Date().toISOString().slice(0, 16);
    const end7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16);

    const [util] = await db.select({
      scheduledHours: sql<number>`COALESCE(SUM(EXTRACT(EPOCH FROM (${apsScheduleTable.scheduledEnd}::timestamp - ${apsScheduleTable.scheduledStart}::timestamp)) / 3600), 0)::numeric(8,2)`,
    }).from(apsScheduleTable)
      .where(and(eq(apsScheduleTable.workCenterId, wcId), gte(apsScheduleTable.scheduledStart, now), lte(apsScheduleTable.scheduledEnd, end7), sql`${apsScheduleTable.status} NOT IN ('done','cancelled')`));

    const scheduled = parseFloat((util?.scheduledHours ?? 0).toString());
    const currentUtilPct = currentCapacity > 0 ? Math.min(100, (scheduled / currentCapacity) * 100) : 0;
    const newUtilPct = newCapacity > 0 ? Math.min(100, (scheduled / newCapacity) * 100) : 0;

    res.json({
      scenario: "extra_shift",
      workCenterName: wc.name,
      extraHours: hours,
      currentCapacityHours: currentCapacity,
      newCapacityHours: newCapacity,
      scheduledHours: scheduled,
      currentUtilizationPct: parseFloat(currentUtilPct.toFixed(1)),
      newUtilizationPct: parseFloat(newUtilPct.toFixed(1)),
      impact: `Com +${hours}h de turno extra, a utilização cai de ${currentUtilPct.toFixed(1)}% para ${newUtilPct.toFixed(1)}%${newUtilPct < 100 ? " — capacidade disponível para novas OPs." : " — ainda há sobrecarga."}`,
    });
  } else {
    res.status(400).json({ error: "Cenário inválido. Cenários disponíveis: block_period, extra_shift" });
  }
});

export default router;
