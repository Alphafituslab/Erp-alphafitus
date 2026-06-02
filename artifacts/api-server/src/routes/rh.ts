import { Router, type IRouter } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  db,
  departmentsTable,
  employeesTable,
  attendanceLogsTable,
  trainingsTable,
  employeeTrainingsTable,
} from "@workspace/db";
import type { Request, Response } from "express";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  return true;
}

function parseId(param: string | string[], res: Response): number | null {
  const id = parseInt(Array.isArray(param) ? param[0] : param, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return null;
  }
  return id;
}

// ─── Employees ────────────────────────────────────────────────────────────────

router.get("/rh/employees", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { search, status, department } = req.query as {
    search?: string;
    status?: string;
    department?: string;
  };

  const filters: any[] = [];
  if (status) filters.push(eq(employeesTable.status, status));
  if (department) filters.push(eq(employeesTable.department, department));
  if (search) {
    const q = "%" + search + "%";
    filters.push(
      sql`(${employeesTable.name} ILIKE ${q} OR ${employeesTable.cpf} ILIKE ${q} OR ${employeesTable.email} ILIKE ${q} OR ${employeesTable.role} ILIKE ${q})`
    );
  }

  const employees = await db
    .select()
    .from(employeesTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(employeesTable.name);

  res.json(employees);
});

router.post("/rh/employees", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { name, cpf, email, phone, role, department, hireDate, salary, status } = req.body;

  if (!name || !role) {
    res.status(400).json({ error: "Nome e cargo são obrigatórios" });
    return;
  }

  const [emp] = await db
    .insert(employeesTable)
    .values({
      name,
      cpf: cpf || null,
      email: email || null,
      phone: phone || null,
      role,
      department: department || null,
      hireDate: hireDate ? new Date(hireDate) : null,
      salary: salary ? String(salary) : null,
      status: status ?? "active",
    })
    .returning();

  res.status(201).json(emp);
});

router.get("/rh/employees/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!emp) {
    res.status(404).json({ error: "Funcionário não encontrado" });
    return;
  }

  const attendance = await db
    .select()
    .from(attendanceLogsTable)
    .where(eq(attendanceLogsTable.employeeId, String(id)))
    .orderBy(desc(attendanceLogsTable.date))
    .limit(30);

  res.json({ ...emp, attendance });
});

router.put("/rh/employees/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(eq(employeesTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Funcionário não encontrado" });
    return;
  }

  const { name, cpf, email, phone, role, department, hireDate, salary, status } = req.body;

  const [updated] = await db
    .update(employeesTable)
    .set({
      name,
      cpf: cpf || null,
      email: email || null,
      phone: phone || null,
      role,
      department: department || null,
      hireDate: hireDate ? new Date(hireDate) : null,
      salary: salary ? String(salary) : null,
      status,
    })
    .where(eq(employeesTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/rh/employees/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(eq(employeesTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Funcionário não encontrado" });
    return;
  }

  await db.update(employeesTable).set({ status: "inactive" }).where(eq(employeesTable.id, id));
  res.json({ ok: true });
});

// ─── Attendance Summary ───────────────────────────────────────────────────────

router.get("/rh/attendance-summary", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { employeeId, month } = req.query as { employeeId?: string; month?: string };

  if (!employeeId) {
    res.status(400).json({ error: "employeeId é obrigatório" });
    return;
  }

  const filters: any[] = [eq(attendanceLogsTable.employeeId, employeeId)];
  if (month) {
    filters.push(sql`${attendanceLogsTable.date} LIKE ${month + "-%"}`);
  }

  const logs = await db
    .select()
    .from(attendanceLogsTable)
    .where(and(...filters));

  res.json({
    month: month ?? null,
    total: logs.length,
    present: logs.filter((l) => l.status === "present").length,
    absent: logs.filter((l) => l.status === "absent").length,
    late: logs.filter((l) => l.status === "late").length,
  });
});

// ─── Departments ──────────────────────────────────────────────────────────────

router.get("/rh/departments", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const departments = await db.select().from(departmentsTable).orderBy(departmentsTable.name);

  const countRows = await db
    .select({
      department: employeesTable.department,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(employeesTable)
    .where(eq(employeesTable.status, "active"))
    .groupBy(employeesTable.department);

  const countMap: Record<string, number> = {};
  for (const c of countRows) {
    if (c.department) countMap[c.department] = c.count;
  }

  res.json(departments.map((d) => ({ ...d, employeeCount: countMap[d.name] ?? 0 })));
});

router.post("/rh/departments", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { name, description } = req.body;
  if (!name) {
    res.status(400).json({ error: "Nome do departamento é obrigatório" });
    return;
  }

  const [dept] = await db
    .insert(departmentsTable)
    .values({ name, description: description || null })
    .returning();

  res.status(201).json({ ...dept, employeeCount: 0 });
});

router.put("/rh/departments/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select()
    .from(departmentsTable)
    .where(eq(departmentsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Departamento não encontrado" });
    return;
  }

  const { name, description } = req.body;
  const [updated] = await db
    .update(departmentsTable)
    .set({ name, description: description || null })
    .where(eq(departmentsTable.id, id))
    .returning();

  // Get employee count
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(employeesTable)
    .where(and(eq(employeesTable.status, "active"), eq(employeesTable.department, updated.name)));

  res.json({ ...updated, employeeCount: countRow?.count ?? 0 });
});

router.delete("/rh/departments/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select()
    .from(departmentsTable)
    .where(eq(departmentsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Departamento não encontrado" });
    return;
  }

  await db.delete(departmentsTable).where(eq(departmentsTable.id, id));
  res.json({ ok: true });
});

// ─── Attendance Logs ──────────────────────────────────────────────────────────

router.get("/rh/attendance", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { employeeId, month } = req.query as { employeeId?: string; month?: string };

  const filters: any[] = [];
  if (employeeId) filters.push(eq(attendanceLogsTable.employeeId, employeeId));
  if (month) filters.push(sql`${attendanceLogsTable.date} LIKE ${month + "-%"}`);

  const logs = await db
    .select()
    .from(attendanceLogsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(attendanceLogsTable.date));

  res.json(logs);
});

router.post("/rh/attendance", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { employeeId, date, checkIn, checkOut, status, notes } = req.body;

  if (!employeeId || !date) {
    res.status(400).json({ error: "Funcionário e data são obrigatórios" });
    return;
  }

  const [log] = await db
    .insert(attendanceLogsTable)
    .values({
      employeeId: String(employeeId),
      date,
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      status: status ?? "present",
      notes: notes || null,
    })
    .returning();

  res.status(201).json(log);
});

router.put("/rh/attendance/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select({ id: attendanceLogsTable.id })
    .from(attendanceLogsTable)
    .where(eq(attendanceLogsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Registro não encontrado" });
    return;
  }

  const { checkIn, checkOut, status, notes } = req.body;
  const [updated] = await db
    .update(attendanceLogsTable)
    .set({ checkIn: checkIn || null, checkOut: checkOut || null, status, notes: notes || null })
    .where(eq(attendanceLogsTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/rh/attendance/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select({ id: attendanceLogsTable.id })
    .from(attendanceLogsTable)
    .where(eq(attendanceLogsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Registro não encontrado" });
    return;
  }

  await db.delete(attendanceLogsTable).where(eq(attendanceLogsTable.id, id));
  res.json({ ok: true });
});

// ─── Trainings CRUD ───────────────────────────────────────────────────────────

router.get("/rh/trainings", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { search, type } = req.query as { search?: string; type?: string };
  const filters: any[] = [];
  if (type) filters.push(eq(trainingsTable.type, type));
  if (search) {
    const q = "%" + search + "%";
    filters.push(sql`(${trainingsTable.name} ILIKE ${q} OR ${trainingsTable.description} ILIKE ${q})`);
  }
  const rows = await db
    .select()
    .from(trainingsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(trainingsTable.name));
  res.json(rows);
});

router.post("/rh/trainings", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { name, description, type, validityMonths, targetRole } = req.body;
  if (!name) { res.status(400).json({ error: "Nome é obrigatório" }); return; }
  const [row] = await db
    .insert(trainingsTable)
    .values({
      name,
      description: description || null,
      type: type ?? "mandatory",
      validityMonths: validityMonths ? Number(validityMonths) : null,
      targetRole: targetRole || null,
    })
    .returning();
  res.status(201).json(row);
});

router.get("/rh/trainings/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [row] = await db.select().from(trainingsTable).where(eq(trainingsTable.id, id));
  if (!row) { res.status(404).json({ error: "Treinamento não encontrado" }); return; }
  res.json(row);
});

router.put("/rh/trainings/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [existing] = await db.select({ id: trainingsTable.id }).from(trainingsTable).where(eq(trainingsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Treinamento não encontrado" }); return; }
  const { name, description, type, validityMonths, targetRole } = req.body;
  const [updated] = await db
    .update(trainingsTable)
    .set({
      name,
      description: description || null,
      type: type ?? "mandatory",
      validityMonths: validityMonths ? Number(validityMonths) : null,
      targetRole: targetRole || null,
    })
    .where(eq(trainingsTable.id, id))
    .returning();
  res.json(updated);
});

router.delete("/rh/trainings/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [existing] = await db.select({ id: trainingsTable.id }).from(trainingsTable).where(eq(trainingsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Treinamento não encontrado" }); return; }
  await db.delete(employeeTrainingsTable).where(eq(employeeTrainingsTable.trainingId, id));
  await db.delete(trainingsTable).where(eq(trainingsTable.id, id));
  res.json({ ok: true });
});

// ─── Employee Training Records ─────────────────────────────────────────────────

function computeTrainingStatus(completedAt: Date | null, validityMonths: number | null): {
  status: string;
  expiresAt: Date | null;
} {
  if (!completedAt) return { status: "not_done", expiresAt: null };
  if (!validityMonths) return { status: "up_to_date", expiresAt: null };
  const expiresAt = new Date(completedAt);
  expiresAt.setMonth(expiresAt.getMonth() + validityMonths);
  const now = new Date();
  const thirtyDays = new Date(now);
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  if (expiresAt < now) return { status: "expired", expiresAt };
  if (expiresAt < thirtyDays) return { status: "expiring_soon", expiresAt };
  return { status: "up_to_date", expiresAt };
}

router.get("/rh/employees/:id/trainings", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const empId = parseId(req.params.id, res);
  if (empId === null) return;
  const rows = await db
    .select({
      id: employeeTrainingsTable.id,
      employeeId: employeeTrainingsTable.employeeId,
      trainingId: employeeTrainingsTable.trainingId,
      trainingName: trainingsTable.name,
      trainingType: trainingsTable.type,
      validityMonths: trainingsTable.validityMonths,
      completedAt: employeeTrainingsTable.completedAt,
      expiresAt: employeeTrainingsTable.expiresAt,
      evidenceUrl: employeeTrainingsTable.evidenceUrl,
      status: employeeTrainingsTable.status,
      notes: employeeTrainingsTable.notes,
      createdAt: employeeTrainingsTable.createdAt,
      updatedAt: employeeTrainingsTable.updatedAt,
    })
    .from(employeeTrainingsTable)
    .innerJoin(trainingsTable, eq(trainingsTable.id, employeeTrainingsTable.trainingId))
    .where(eq(employeeTrainingsTable.employeeId, empId))
    .orderBy(asc(trainingsTable.name));
  res.json(rows);
});

router.post("/rh/employees/:id/trainings", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const empId = parseId(req.params.id, res);
  if (empId === null) return;

  const [emp] = await db.select({ id: employeesTable.id }).from(employeesTable).where(eq(employeesTable.id, empId));
  if (!emp) { res.status(404).json({ error: "Funcionário não encontrado" }); return; }

  const { trainingId, completedAt, evidenceUrl, notes } = req.body;
  if (!trainingId) { res.status(400).json({ error: "trainingId é obrigatório" }); return; }

  const [training] = await db.select().from(trainingsTable).where(eq(trainingsTable.id, Number(trainingId)));
  if (!training) { res.status(404).json({ error: "Treinamento não encontrado" }); return; }

  const completedDate = completedAt ? new Date(completedAt) : null;
  const { status, expiresAt } = computeTrainingStatus(completedDate, training.validityMonths);

  const [existing] = await db
    .select({ id: employeeTrainingsTable.id })
    .from(employeeTrainingsTable)
    .where(and(
      eq(employeeTrainingsTable.employeeId, empId),
      eq(employeeTrainingsTable.trainingId, Number(trainingId))
    ));

  if (existing) {
    const [updated] = await db
      .update(employeeTrainingsTable)
      .set({ completedAt: completedDate, expiresAt, status, evidenceUrl: evidenceUrl || null, notes: notes || null })
      .where(eq(employeeTrainingsTable.id, existing.id))
      .returning();
    res.json(updated);
    return;
  }

  const [row] = await db
    .insert(employeeTrainingsTable)
    .values({
      employeeId: empId,
      trainingId: Number(trainingId),
      completedAt: completedDate,
      expiresAt,
      status,
      evidenceUrl: evidenceUrl || null,
      notes: notes || null,
    })
    .returning();
  res.status(201).json(row);
});

router.put("/rh/employee-trainings/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select({ id: employeeTrainingsTable.id, trainingId: employeeTrainingsTable.trainingId })
    .from(employeeTrainingsTable)
    .where(eq(employeeTrainingsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Registro não encontrado" }); return; }

  const [training] = await db.select().from(trainingsTable).where(eq(trainingsTable.id, existing.trainingId));
  const { completedAt, evidenceUrl, notes } = req.body;
  const completedDate = completedAt ? new Date(completedAt) : null;
  const { status, expiresAt } = computeTrainingStatus(completedDate, training?.validityMonths ?? null);

  const [updated] = await db
    .update(employeeTrainingsTable)
    .set({ completedAt: completedDate, expiresAt, status, evidenceUrl: evidenceUrl || null, notes: notes || null })
    .where(eq(employeeTrainingsTable.id, id))
    .returning();
  res.json(updated);
});

router.delete("/rh/employee-trainings/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [existing] = await db.select({ id: employeeTrainingsTable.id }).from(employeeTrainingsTable).where(eq(employeeTrainingsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Registro não encontrado" }); return; }
  await db.delete(employeeTrainingsTable).where(eq(employeeTrainingsTable.id, id));
  res.json({ ok: true });
});

// ─── Training Matrix ───────────────────────────────────────────────────────────

router.get("/rh/training-matrix", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const { dept } = req.query as { dept?: string };

  const empFilters: any[] = [eq(employeesTable.status, "active")];
  if (dept) empFilters.push(eq(employeesTable.department, dept));

  const [employees, trainings, records] = await Promise.all([
    db.select({ id: employeesTable.id, name: employeesTable.name, role: employeesTable.role, department: employeesTable.department })
      .from(employeesTable)
      .where(and(...empFilters))
      .orderBy(asc(employeesTable.name)),
    db.select().from(trainingsTable).where(eq(trainingsTable.type, "mandatory")).orderBy(asc(trainingsTable.name)),
    db.select({
      employeeId: employeeTrainingsTable.employeeId,
      trainingId: employeeTrainingsTable.trainingId,
      status: employeeTrainingsTable.status,
      completedAt: employeeTrainingsTable.completedAt,
      expiresAt: employeeTrainingsTable.expiresAt,
    }).from(employeeTrainingsTable),
  ]);

  const cellMap: Record<string, { status: string; completedAt: string | null; expiresAt: string | null }> = {};
  for (const r of records) {
    cellMap[`${r.employeeId}:${r.trainingId}`] = {
      status: r.status,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    };
  }

  const cells: Array<{ employeeId: number; trainingId: number; status: string; completedAt: string | null; expiresAt: string | null }> = [];
  for (const emp of employees) {
    for (const tr of trainings) {
      const key = `${emp.id}:${tr.id}`;
      cells.push({
        employeeId: emp.id,
        trainingId: tr.id,
        ...(cellMap[key] ?? { status: "not_done", completedAt: null, expiresAt: null }),
      });
    }
  }

  res.json({ employees, trainings, cells });
});

// ─── Training Compliance ───────────────────────────────────────────────────────

router.get("/rh/training-compliance", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const [allEmployees, mandatoryTrainings, allRecords] = await Promise.all([
    db.select({ id: employeesTable.id, department: employeesTable.department })
      .from(employeesTable)
      .where(eq(employeesTable.status, "active")),
    db.select({ id: trainingsTable.id }).from(trainingsTable).where(eq(trainingsTable.type, "mandatory")),
    db.select({ employeeId: employeeTrainingsTable.employeeId, trainingId: employeeTrainingsTable.trainingId, status: employeeTrainingsTable.status })
      .from(employeeTrainingsTable),
  ]);

  const mandatoryIds = new Set(mandatoryTrainings.map((t) => t.id));
  const upToDateSet = new Set(
    allRecords
      .filter((r) => mandatoryIds.has(r.trainingId) && r.status === "up_to_date")
      .map((r) => `${r.employeeId}:${r.trainingId}`)
  );

  const deptMap: Record<string, { total: number; compliant: number }> = {};
  for (const emp of allEmployees) {
    const dept = emp.department ?? "Sem departamento";
    if (!deptMap[dept]) deptMap[dept] = { total: 0, compliant: 0 };
    deptMap[dept].total++;
    const isCompliant = mandatoryIds.size === 0 || [...mandatoryIds].every((tid) => upToDateSet.has(`${emp.id}:${tid}`));
    if (isCompliant) deptMap[dept].compliant++;
  }

  const result = Object.entries(deptMap)
    .map(([department, { total, compliant }]) => ({
      department,
      totalEmployees: total,
      compliant,
      complianceRate: total > 0 ? Math.round((compliant / total) * 100) : 100,
    }))
    .sort((a, b) => a.complianceRate - b.complianceRate);

  res.json(result);
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

router.get("/rh/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const month = new Date().toISOString().slice(0, 7); // YYYY-MM

  const [headcount] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      active: sql<number>`COUNT(*) FILTER (WHERE status = 'active')::int`,
      inactive: sql<number>`COUNT(*) FILTER (WHERE status = 'inactive')::int`,
    })
    .from(employeesTable);

  const [deptCount] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(departmentsTable);

  const [attendance] = await db
    .select({
      present: sql<number>`COUNT(*) FILTER (WHERE status = 'present')::int`,
      absent: sql<number>`COUNT(*) FILTER (WHERE status = 'absent')::int`,
      late: sql<number>`COUNT(*) FILTER (WHERE status = 'late')::int`,
    })
    .from(attendanceLogsTable)
    .where(sql`${attendanceLogsTable.date} LIKE ${month + "-%"}`);

  const recentEmployees = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.status, "active"))
    .orderBy(desc(employeesTable.createdAt))
    .limit(5);

  // Training KPIs
  const [mandatoryCount] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(trainingsTable)
    .where(eq(trainingsTable.type, "mandatory"));

  const trainingAlertRows = await db
    .select({
      employeeTrainingId: employeeTrainingsTable.id,
      employeeId: employeeTrainingsTable.employeeId,
      employeeName: employeesTable.name,
      trainingName: trainingsTable.name,
      status: employeeTrainingsTable.status,
      expiresAt: employeeTrainingsTable.expiresAt,
    })
    .from(employeeTrainingsTable)
    .innerJoin(employeesTable, eq(employeesTable.id, employeeTrainingsTable.employeeId))
    .innerJoin(trainingsTable, eq(trainingsTable.id, employeeTrainingsTable.trainingId))
    .where(
      and(
        sql`${employeeTrainingsTable.status} IN ('expiring_soon', 'expired')`,
        eq(employeesTable.status, "active")
      )
    )
    .orderBy(asc(employeeTrainingsTable.expiresAt))
    .limit(10);

  const trainingAlerts = trainingAlertRows.map((r) => ({
    employeeTrainingId: r.employeeTrainingId,
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    trainingName: r.trainingName,
    status: r.status,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
  }));

  // Overall compliance rate
  const [allActiveCount] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(employeesTable)
    .where(eq(employeesTable.status, "active"));

  const [compliantCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${employeeTrainingsTable.employeeId})::int` })
    .from(employeeTrainingsTable)
    .where(eq(employeeTrainingsTable.status, "up_to_date"));

  const totalActive = Number(allActiveCount?.count ?? 0);
  const totalMandatory = Number(mandatoryCount?.count ?? 0);
  const overallComplianceRate = totalActive > 0 && totalMandatory > 0
    ? Math.round((Number(compliantCount?.count ?? 0) / totalActive) * 100)
    : 100;

  res.json({
    totalEmployees: headcount?.total ?? 0,
    activeEmployees: headcount?.active ?? 0,
    inactiveEmployees: headcount?.inactive ?? 0,
    totalDepartments: deptCount?.count ?? 0,
    currentMonth: month,
    attendanceThisMonth: {
      present: attendance?.present ?? 0,
      absent: attendance?.absent ?? 0,
      late: attendance?.late ?? 0,
    },
    recentEmployees,
    totalMandatoryTrainings: totalMandatory,
    overallComplianceRate,
    trainingAlerts,
  });
});

export default router;
