import { Router, type IRouter } from "express";
import { and, desc, eq, sql, lt } from "drizzle-orm";
import { db, projectsTable, projectTasksTable, clientsTable, usersTable, employeesTable } from "@workspace/db";
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

// ── Helper: enrich project with task counts + client name ─────────────────────

async function enrichProject(project: typeof projectsTable.$inferSelect) {
  const tasks = await db
    .select({ status: projectTasksTable.status })
    .from(projectTasksTable)
    .where(eq(projectTasksTable.projectId, project.id));

  let clientName: string | null = null;
  if (project.clientId) {
    const [client] = await db
      .select({ name: clientsTable.name })
      .from(clientsTable)
      .where(eq(clientsTable.id, project.clientId));
    clientName = client?.name ?? null;
  }

  return {
    ...project,
    clientName,
    taskCount: tasks.length,
    completedCount: tasks.filter((t) => t.status === "done").length,
  };
}

// ── Helper: enrich task with projectName ──────────────────────────────────────

async function enrichTask(task: typeof projectTasksTable.$inferSelect) {
  const [project] = await db
    .select({ name: projectsTable.name })
    .from(projectsTable)
    .where(eq(projectsTable.id, task.projectId));

  return { ...task, projectName: project?.name ?? null };
}

// ─── Projects CRUD ────────────────────────────────────────────────────────────

router.get("/projetos/projects", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { status, clientId, search } = req.query as Record<string, string>;

  const filters: any[] = [];
  if (status) filters.push(eq(projectsTable.status, status));
  if (clientId) filters.push(eq(projectsTable.clientId, parseInt(clientId, 10)));
  if (search) {
    const q = "%" + search + "%";
    filters.push(sql`${projectsTable.name} ILIKE ${q}`);
  }

  const projects = await db
    .select()
    .from(projectsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(projectsTable.createdAt));

  const enriched = await Promise.all(projects.map(enrichProject));
  res.json(enriched);
});

router.post("/projetos/projects", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { name, description, clientId, status, startDate, endDate } = req.body;

  if (!name) {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  const [project] = await db
    .insert(projectsTable)
    .values({
      name,
      description: description || null,
      clientId: clientId ? parseInt(String(clientId), 10) : null,
      status: status ?? "planning",
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    })
    .returning();

  res.status(201).json({ ...project, clientName: null, taskCount: 0, completedCount: 0 });
});

router.get("/projetos/projects/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }

  res.json(await enrichProject(project));
});

router.put("/projetos/projects/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }

  const { name, description, clientId, status, startDate, endDate } = req.body;

  const [updated] = await db
    .update(projectsTable)
    .set({
      name,
      description: description || null,
      clientId: clientId ? parseInt(String(clientId), 10) : null,
      status,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    })
    .where(eq(projectsTable.id, id))
    .returning();

  res.json(await enrichProject(updated));
});

router.delete("/projetos/projects/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }

  // Delete tasks first
  await db.delete(projectTasksTable).where(eq(projectTasksTable.projectId, id));
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.json({ ok: true });
});

// ─── Tasks CRUD ───────────────────────────────────────────────────────────────

router.get("/projetos/tasks", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { projectId, status, priority, assigneeId } = req.query as Record<string, string>;

  const filters: any[] = [];
  if (projectId) filters.push(eq(projectTasksTable.projectId, parseInt(projectId, 10)));
  if (status) filters.push(eq(projectTasksTable.status, status));
  if (priority) filters.push(eq(projectTasksTable.priority, priority));
  if (assigneeId) filters.push(eq(projectTasksTable.assigneeId, assigneeId));

  const tasks = await db
    .select()
    .from(projectTasksTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(projectTasksTable.projectId, desc(projectTasksTable.createdAt));

  const enriched = await Promise.all(tasks.map(enrichTask));
  res.json(enriched);
});

router.post("/projetos/tasks", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { projectId, title, description, assigneeId, assigneeName, priority, status, dueDate } =
    req.body;

  if (!projectId || !title) {
    res.status(400).json({ error: "Projeto e título são obrigatórios" });
    return;
  }

  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, parseInt(String(projectId), 10)));

  if (!project) {
    res.status(400).json({ error: "Projeto não encontrado" });
    return;
  }

  const [task] = await db
    .insert(projectTasksTable)
    .values({
      projectId: parseInt(String(projectId), 10),
      title,
      description: description || null,
      assigneeId: assigneeId || null,
      assigneeName: assigneeName || null,
      priority: priority ?? "medium",
      status: status ?? "todo",
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning();

  res.status(201).json(await enrichTask(task));
});

router.put("/projetos/tasks/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select({ id: projectTasksTable.id })
    .from(projectTasksTable)
    .where(eq(projectTasksTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Tarefa não encontrada" });
    return;
  }

  const { projectId, title, description, assigneeId, assigneeName, priority, status, dueDate } =
    req.body;

  const [updated] = await db
    .update(projectTasksTable)
    .set({
      projectId: projectId ? parseInt(String(projectId), 10) : undefined,
      title,
      description: description || null,
      assigneeId: assigneeId || null,
      assigneeName: assigneeName || null,
      priority,
      status,
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .where(eq(projectTasksTable.id, id))
    .returning();

  res.json(await enrichTask(updated));
});

router.patch("/projetos/tasks/:id/status", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const { status } = req.body;

  if (!status || !["todo", "in_progress", "done"].includes(status)) {
    res.status(400).json({ error: "Status inválido" });
    return;
  }

  const [updated] = await db
    .update(projectTasksTable)
    .set({ status })
    .where(eq(projectTasksTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Tarefa não encontrada" });
    return;
  }

  res.json(await enrichTask(updated));
});

router.delete("/projetos/tasks/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = parseId(req.params.id, res);
  if (id === null) return;

  const [existing] = await db
    .select({ id: projectTasksTable.id })
    .from(projectTasksTable)
    .where(eq(projectTasksTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Tarefa não encontrada" });
    return;
  }

  await db.delete(projectTasksTable).where(eq(projectTasksTable.id, id));
  res.json({ ok: true });
});

// ── Helper: resolve employee ID for the logged-in user (matches by email) ─────
// Tasks store assigneeId as String(employee.id). Users and employees are
// separate tables linked by email address.
async function resolveMyEmployeeId(userId: number): Promise<string | null> {
  const [user] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user) return null;

  const [employee] = await db
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(eq(employeesTable.email, user.email));
  return employee ? String(employee.id) : null;
}

// ─── My Tasks ─────────────────────────────────────────────────────────────────

router.get("/projetos/my-tasks", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const myEmpId = await resolveMyEmployeeId(req.session.userId!);
  if (!myEmpId) {
    // No employee record linked to this user — return empty list
    res.json([]);
    return;
  }

  const tasks = await db
    .select()
    .from(projectTasksTable)
    .where(eq(projectTasksTable.assigneeId, myEmpId))
    .orderBy(projectTasksTable.status, desc(projectTasksTable.createdAt));

  const enriched = await Promise.all(tasks.map(enrichTask));
  res.json(enriched);
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

router.get("/projetos/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const now = new Date();
  const myEmpId = await resolveMyEmployeeId(req.session.userId!);

  const [totalProjects] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(projectsTable);

  const [activeProjects] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(projectsTable)
    .where(eq(projectsTable.status, "active"));

  const [completedProjects] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(projectsTable)
    .where(eq(projectsTable.status, "completed"));

  const [totalTasks] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(projectTasksTable);

  const [myPendingTasks] = myEmpId
    ? await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(projectTasksTable)
        .where(
          and(
            eq(projectTasksTable.assigneeId, myEmpId),
            sql`${projectTasksTable.status} != 'done'`
          )
        )
    : [{ count: 0 }];

  const [overdueTasksCount] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(projectTasksTable)
    .where(
      and(
        lt(projectTasksTable.dueDate, now),
        sql`${projectTasksTable.status} != 'done'`
      )
    );

  const recentProjectRows = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.status, "active"))
    .orderBy(desc(projectsTable.updatedAt))
    .limit(5);

  const recentProjects = await Promise.all(recentProjectRows.map(enrichProject));

  res.json({
    totalProjects: totalProjects?.count ?? 0,
    activeProjects: activeProjects?.count ?? 0,
    completedProjects: completedProjects?.count ?? 0,
    totalTasks: totalTasks?.count ?? 0,
    myPendingTasks: myPendingTasks?.count ?? 0,
    overdueTasksCount: overdueTasksCount?.count ?? 0,
    recentProjects,
  });
});

export default router;
