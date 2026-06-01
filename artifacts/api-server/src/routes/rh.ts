import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  departmentsTable,
  employeesTable,
  attendanceLogsTable,
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
  });
});

export default router;
