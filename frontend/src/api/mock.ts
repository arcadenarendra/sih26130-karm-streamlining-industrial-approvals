// In-browser mock of the backend described in backend-architecture.md §4.
// Persisted to localStorage so demo state survives reloads. Illustrative only.
import { seed, type MockDb } from "./fixtures";
import type {
  Analytics,
  Application,
  ApplicationDocument,
  ApprovalItem,
  ApprovalType,
  BusinessProfile,
  Decision,
  FieldError,
  ItemStatus,
  Notification,
  OverallStatus,
  RiskBrief,
  User,
} from "./types";
import { DAY, isPending, slaRisk } from "./utils";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: FieldError[] = [],
  ) {
    super(message);
  }
}

const KEY = "karm_mock_db_v1";
let db: MockDb | null = null;
function load(): MockDb {
  if (db) return db;
  try {
    const raw = localStorage.getItem(KEY);
    db = raw ? JSON.parse(raw) : seed();
  } catch {
    db = seed();
  }
  return db!;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}
export function resetMockDb() {
  db = seed();
  save();
}

const now = () => new Date().toISOString();
const id = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const strip = (u: MockDb["users"][number]): User => {
  const { password: _p, ...rest } = u;
  return rest;
};

function authUser(token: string | null) {
  if (!token?.startsWith("mock.")) throw new ApiError(401, "Missing or invalid token");
  const u = load().users.find((x) => x._id === token.slice(5));
  if (!u) throw new ApiError(401, "Missing or invalid token");
  return u;
}
function requireRole(u: User, ...roles: User["role"][]) {
  if (!roles.includes(u.role)) throw new ApiError(403, "Forbidden");
}

function populate(app: Application): Application {
  const d = load();
  return {
    ...app,
    applicantId: (() => {
      const u = d.users.find((x) => x._id === app.applicantId);
      return u ? { _id: u._id, name: u.name, email: u.email } : app.applicantId;
    })(),
    approvalItems: app.approvalItems.map((it) => ({
      ...it,
      approvalTypeId: d.approvalTypes.find((t) => t._id === it.approvalTypeId) ?? it.approvalTypeId,
      assignedOfficerId: (() => {
        const u = d.users.find((x) => x._id === it.assignedOfficerId);
        return u ? { _id: u._id, name: u.name, email: u.email } : it.assignedOfficerId;
      })(),
    })),
  };
}

function deriveOverall(items: ApprovalItem[]): OverallStatus {
  const s = items.map((i) => i.status);
  if (s.every((x) => x === "draft")) return "draft";
  if (s.every((x) => x === "approved")) return "approved";
  if (s.includes("query_raised")) return "action_required";
  if (s.every((x) => x === "approved" || x === "rejected")) return "rejected";
  if (s.includes("rejected")) return "action_required";
  return "in_progress";
}

function typeFor(it: ApprovalItem) {
  return load().approvalTypes.find((t) => t._id === it.approvalTypeId);
}

function notify(userId: string, type: string, message: string) {
  load().notifications.unshift({
    _id: id("n"),
    userId,
    type,
    message,
    read: false,
    createdAt: now(),
  });
}

function findOwnApp(u: User, appId: string) {
  const app = load().applications.find((a) => a._id === appId);
  if (!app) throw new ApiError(404, "Application not found");
  if (u.role === "applicant" && app.applicantId !== u._id) throw new ApiError(403, "Forbidden");
  return app;
}
function findItem(app: Application, itemId: string) {
  const it = app.approvalItems.find((i) => i._id === itemId);
  if (!it) throw new ApiError(404, "Item not found");
  return it;
}

/* ---------- pre-validation (§5): type, size, expiry heuristic, required field ---------- */
export const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_BYTES = 5 * 1024 * 1024;

function preValidate(
  file: File,
  docType: string,
): Pick<ApplicationDocument, "preValidationStatus" | "preValidationNotes"> {
  const notes: string[] = [];
  if (!docType) notes.push("Document type is required.");
  if (!ALLOWED_TYPES.includes(file.type)) notes.push("Only PDF, JPG or PNG files are accepted.");
  if (file.size > MAX_BYTES) notes.push("File exceeds the 5 MB limit.");
  if (file.size === 0) notes.push("File is empty.");
  if (/expired|old/i.test(file.name))
    notes.push("Document appears to be expired (sample heuristic: filename).");
  return { preValidationStatus: notes.length ? "failed" : "passed", preValidationNotes: notes };
}

function makeDoc(file: File, docType: string): ApplicationDocument {
  return {
    docType,
    fileUrl: typeof URL !== "undefined" ? URL.createObjectURL(file) : `sample://${file.name}`,
    uploadedAt: now(),
    ...preValidate(file, docType),
    riskBrief: null,
  };
}

function riskFor(it: ApprovalItem): RiskBrief {
  const failed = it.documents.filter((d) => d.preValidationStatus === "failed");
  const t = typeFor(it);
  const missing = (t?.requiredDocuments ?? []).filter(
    (r) => r.required && !it.documents.some((d) => d.docType === r.docType),
  );
  const flags = [
    ...failed.flatMap((d) => d.preValidationNotes.map((n) => `${d.docType}: ${n}`)),
    ...missing.map((m) => `Required document missing: ${m.label}`),
  ];
  if (it.history.some((h) => h.action === "reuploaded"))
    flags.push("Document was re-uploaded after an officer query.");
  const score = Math.min(95, 12 + flags.length * 22);
  const summary = flags.length
    ? `Sample assessment: ${flags.length} potential issue(s) found in submitted documents. Review the flagged items before deciding.`
    : "Sample assessment: submitted documents appear complete and consistent with the requirements for this approval type.";
  return { score, summary, flags, generatedAt: now() };
}

/* ---------- mock endpoint implementations ---------- */
export const mock = {
  async register(body: { name: string; email: string; password: string }) {
    await wait();
    const errors: FieldError[] = [];
    if (!body.name?.trim()) errors.push({ field: "name", message: "Name is required" });
    if (!/^\S+@\S+\.\S+$/.test(body.email ?? ""))
      errors.push({ field: "email", message: "Enter a valid email" });
    if ((body.password ?? "").length < 8)
      errors.push({ field: "password", message: "Password must be at least 8 characters" });
    if (errors.length) throw new ApiError(400, "Validation failed", errors);
    const d = load();
    if (d.users.some((u) => u.email.toLowerCase() === body.email.toLowerCase()))
      throw new ApiError(409, "An account with this email already exists", [
        { field: "email", message: "Email already registered" },
      ]);
    const u = {
      _id: id("u"),
      name: body.name.trim(),
      email: body.email.trim(),
      password: body.password,
      role: "applicant" as const,
      department: null,
      phone: null,
      createdAt: now(),
      updatedAt: now(),
    };
    d.users.push(u);
    save();
    return { user: strip(u) };
  },
  async login(body: { email: string; password: string }) {
    await wait();
    const u = load().users.find(
      (x) =>
        x.email.toLowerCase() === body.email.trim().toLowerCase() && x.password === body.password,
    );
    if (!u) throw new ApiError(401, "Incorrect email or password");
    return { token: `mock.${u._id}`, user: strip(u) };
  },
  async me(token: string | null) {
    await wait(150);
    return { user: strip(authUser(token)) };
  },

  async getProfile(token: string | null) {
    await wait();
    const u = authUser(token);
    requireRole(u, "applicant");
    const p = load().profiles.find((x) => x.userId === u._id);
    if (!p) throw new ApiError(404, "Profile not found");
    return { profile: p };
  },
  async createProfile(token: string | null, body: Partial<BusinessProfile>) {
    await wait();
    const u = authUser(token);
    requireRole(u, "applicant");
    const d = load();
    if (d.profiles.some((x) => x.userId === u._id))
      throw new ApiError(409, "Profile already exists");
    const errors = validateProfile(body);
    if (errors.length) throw new ApiError(400, "Validation failed", errors);
    const p: BusinessProfile = {
      _id: id("bp"),
      userId: u._id,
      businessName: body.businessName!,
      sector: body.sector!,
      location: body.location!,
      projectSize: body.projectSize!,
      stage: body.stage!,
      createdAt: now(),
      updatedAt: now(),
    };
    d.profiles.push(p);
    save();
    return { profile: p };
  },
  async updateProfile(token: string | null, body: Partial<BusinessProfile>) {
    await wait();
    const u = authUser(token);
    requireRole(u, "applicant");
    const p = load().profiles.find((x) => x.userId === u._id);
    if (!p) throw new ApiError(404, "Profile not found");
    const errors = validateProfile({ ...p, ...body });
    if (errors.length) throw new ApiError(400, "Validation failed", errors);
    Object.assign(p, body, { updatedAt: now() });
    save();
    return { profile: p };
  },

  async getChecklist(token: string | null) {
    await wait();
    const u = authUser(token);
    requireRole(u, "applicant");
    const d = load();
    const p = d.profiles.find((x) => x.userId === u._id);
    if (!p) throw new ApiError(404, "Create your business profile first");
    const ids = d.rules[p.sector] ?? ["at_gst", "at_trade"];
    return { items: d.approvalTypes.filter((t) => t.isActive && ids.includes(t._id)) };
  },

  async createApplication(
    token: string | null,
    body: { businessProfileId: string; approvalTypeIds: string[] },
  ) {
    await wait();
    const u = authUser(token);
    requireRole(u, "applicant");
    if (!body.approvalTypeIds?.length)
      throw new ApiError(400, "Validation failed", [
        { field: "approvalTypeIds", message: "Select at least one approval" },
      ]);
    const app: Application = {
      _id: id("ap"),
      applicantId: u._id,
      businessProfileId: body.businessProfileId,
      overallStatus: "draft",
      createdAt: now(),
      updatedAt: now(),
      approvalItems: body.approvalTypeIds.map((t) => ({
        _id: id("it"),
        approvalTypeId: t,
        status: "draft" as ItemStatus,
        assignedOfficerId: null,
        submittedAt: null,
        slaDeadline: null,
        documents: [],
        history: [
          { action: "created", byUserId: u._id, byRole: u.role, reason: null, timestamp: now() },
        ],
      })),
    };
    load().applications.unshift(app);
    save();
    return { application: populate(app) };
  },
  async listApplications(token: string | null) {
    await wait();
    const u = authUser(token);
    requireRole(u, "applicant");
    return {
      applications: load()
        .applications.filter((a) => a.applicantId === u._id)
        .map(populate),
    };
  },
  async getApplication(token: string | null, appId: string) {
    await wait();
    const u = authUser(token);
    requireRole(u, "applicant");
    return { application: populate(findOwnApp(u, appId)) };
  },
  async withdrawApplication(token: string | null, appId: string) {
    await wait();
    const u = authUser(token);
    requireRole(u, "applicant");
    const d = load();
    const app = findOwnApp(u, appId);
    if (!app.approvalItems.every((item) => item.status === "draft"))
      throw new ApiError(400, "Only draft applications can be withdrawn");
    d.applications = d.applications.filter((item) => item._id !== appId);
    save();
  },
  async uploadDocument(
    token: string | null,
    appId: string,
    itemId: string,
    file: File,
    docType: string,
  ) {
    await wait(500);
    const u = authUser(token);
    requireRole(u, "applicant");
    const it = findItem(findOwnApp(u, appId), itemId);
    if (it.status !== "draft")
      throw new ApiError(409, "Documents can only be added to draft items");
    const doc = makeDoc(file, docType);
    it.documents = it.documents.filter((d) => d.docType !== docType).concat(doc);
    save();
    return {
      document: doc,
      preValidationResult: { status: doc.preValidationStatus, notes: doc.preValidationNotes },
    };
  },
  async submitApplication(token: string | null, appId: string) {
    await wait(600);
    const u = authUser(token);
    requireRole(u, "applicant");
    const app = findOwnApp(u, appId);
    const d = load();
    const errors: FieldError[] = [];
    for (const it of app.approvalItems.filter((i) => i.status === "draft")) {
      const t = typeFor(it);
      for (const r of t?.requiredDocuments ?? []) {
        const doc = it.documents.find((x) => x.docType === r.docType);
        if (r.required && !doc)
          errors.push({
            field: `${it._id}.${r.docType}`,
            message: `${t!.name}: ${r.label} is required`,
          });
        if (doc?.preValidationStatus === "failed")
          errors.push({
            field: `${it._id}.${r.docType}`,
            message: `${t!.name}: ${r.label} failed pre-validation`,
          });
      }
    }
    if (errors.length) throw new ApiError(400, "Some documents need attention", errors);
    for (const it of app.approvalItems.filter((i) => i.status === "draft")) {
      const t = typeFor(it)!;
      it.status = "submitted";
      it.submittedAt = now();
      it.slaDeadline = new Date(Date.now() + t.slaDays * DAY).toISOString();
      it.assignedOfficerId =
        d.users.find((x) => x.role === "authority" && x.department === t.department)?._id ?? null;
      it.history.push({
        action: "submitted",
        byUserId: u._id,
        byRole: u.role,
        reason: null,
        timestamp: now(),
      });
    }
    app.overallStatus = deriveOverall(app.approvalItems);
    app.updatedAt = now();
    save();
    return { application: populate(app) };
  },
  async reupload(token: string | null, appId: string, itemId: string, file: File, docType: string) {
    await wait(500);
    const u = authUser(token);
    requireRole(u, "applicant");
    const app = findOwnApp(u, appId);
    const it = findItem(app, itemId);
    if (it.status !== "query_raised" && it.status !== "rejected")
      throw new ApiError(409, "Re-upload is only allowed after a query or rejection");
    const doc = makeDoc(file, docType);
    if (doc.preValidationStatus === "failed")
      throw new ApiError(
        400,
        "Pre-validation failed",
        doc.preValidationNotes.map((m) => ({ field: "file", message: m })),
      );
    it.documents = it.documents.filter((d) => d.docType !== docType).concat(doc);
    it.status = "in_review";
    it.history.push({
      action: "reuploaded",
      byUserId: u._id,
      byRole: u.role,
      reason: null,
      timestamp: now(),
    });
    app.overallStatus = deriveOverall(app.approvalItems);
    app.updatedAt = now();
    if (typeof it.assignedOfficerId === "string")
      notify(
        it.assignedOfficerId,
        "reuploaded",
        `Application ${app._id}: applicant re-uploaded ${docType}.`,
      );
    save();
    return { document: doc };
  },

  async authorityList(token: string | null, q: { status?: string; slaRisk?: string }) {
    await wait();
    const u = authUser(token);
    requireRole(u, "authority");
    const apps = load()
      .applications.map((a) => ({
        ...a,
        approvalItems: a.approvalItems.filter(
          (it) => typeFor(it)?.department === u.department && it.status !== "draft",
        ),
      }))
      .filter((a) => a.approvalItems.length)
      .map((a) => ({
        ...a,
        approvalItems: a.approvalItems.filter((it) => {
          if (q.status && it.status !== q.status) return false;
          if (q.slaRisk) {
            if (!isPending(it.status)) return false;
            const days = Math.floor((Date.now() - +new Date(it.submittedAt!)) / DAY);
            if (slaRisk(days, typeFor(it)!.slaDays) !== q.slaRisk) return false;
          }
          return true;
        }),
      }))
      .filter((a) => a.approvalItems.length);
    return { applications: apps.map(populate) };
  },
  async authorityGet(token: string | null, appId: string) {
    await wait();
    const u = authUser(token);
    requireRole(u, "authority");
    const app = load().applications.find((a) => a._id === appId);
    if (!app) throw new ApiError(404, "Application not found");
    const mine = app.approvalItems.filter(
      (it) => typeFor(it)?.department === u.department && it.status !== "draft",
    );
    if (!mine.length) throw new ApiError(403, "Not assigned to your department");
    let changed = false;
    for (const it of mine)
      if (it.status === "submitted") {
        it.status = "in_review";
        it.assignedOfficerId = u._id;
        changed = true;
        it.history.push({
          action: "review_started",
          byUserId: u._id,
          byRole: u.role,
          reason: null,
          timestamp: now(),
        });
      }
    if (changed) {
      app.overallStatus = deriveOverall(app.approvalItems);
      save();
    }
    return { application: populate({ ...app, approvalItems: mine }) };
  },
  async riskBrief(token: string | null, appId: string, itemId: string) {
    await wait(900);
    const u = authUser(token);
    requireRole(u, "authority");
    const app = load().applications.find((a) => a._id === appId);
    if (!app) throw new ApiError(404, "Application not found");
    const it = findItem(app, itemId);
    if (typeFor(it)?.department !== u.department) throw new ApiError(403, "Forbidden");
    const cached = it.documents[0]?.riskBrief;
    if (cached) return { riskBrief: cached };
    const brief = riskFor(it);
    it.documents.forEach((d) => (d.riskBrief = brief));
    save();
    return { riskBrief: brief };
  },
  async decide(
    token: string | null,
    appId: string,
    itemId: string,
    body: { decision: Decision; reason: string },
  ) {
    await wait(600);
    const u = authUser(token);
    requireRole(u, "authority");
    const app = load().applications.find((a) => a._id === appId);
    if (!app) throw new ApiError(404, "Application not found");
    const it = findItem(app, itemId);
    const t = typeFor(it);
    if (t?.department !== u.department) throw new ApiError(403, "Forbidden");
    if (body.decision !== "approve" && !body.reason?.trim())
      throw new ApiError(400, "Validation failed", [
        { field: "reason", message: "Reason is required" },
      ]);
    if (!isPending(it.status)) throw new ApiError(409, "Item is not awaiting a decision");
    it.status =
      body.decision === "approve"
        ? "approved"
        : body.decision === "reject"
          ? "rejected"
          : "query_raised";
    it.history.push({
      action: body.decision,
      byUserId: u._id,
      byRole: u.role,
      reason: body.reason?.trim() || null,
      timestamp: now(),
    });
    app.overallStatus = deriveOverall(app.approvalItems);
    app.updatedAt = now();
    const msg =
      body.decision === "approve"
        ? `${t.name} has been approved.`
        : body.decision === "reject"
          ? `${t.name} was rejected: ${body.reason}`
          : `${t.name}: officer requested a re-upload — ${body.reason}`;
    notify(
      app.applicantId as string,
      body.decision === "approve"
        ? "approved"
        : body.decision === "reject"
          ? "rejected"
          : "query_raised",
      msg,
    );
    save();
    const populated = populate(app).approvalItems.find((i) => i._id === itemId)!;
    return { applicationItem: populated };
  },

  async adminListTypes(token: string | null) {
    await wait();
    const u = authUser(token);
    requireRole(u, "admin");
    return load().approvalTypes;
  },
  async adminCreateType(token: string | null, body: Partial<ApprovalType>) {
    await wait();
    const u = authUser(token);
    requireRole(u, "admin");
    const errors = validateType(body);
    if (errors.length) throw new ApiError(400, "Validation failed", errors);
    const t: ApprovalType = {
      _id: id("at"),
      name: body.name!,
      department: body.department!,
      requiredDocuments: body.requiredDocuments ?? [],
      slaDays: body.slaDays!,
      description: body.description ?? "",
      isActive: body.isActive ?? true,
      createdAt: now(),
      updatedAt: now(),
    };
    load().approvalTypes.push(t);
    save();
    return t;
  },
  async adminUpdateType(token: string | null, typeId: string, body: Partial<ApprovalType>) {
    await wait();
    const u = authUser(token);
    requireRole(u, "admin");
    const t = load().approvalTypes.find((x) => x._id === typeId);
    if (!t) throw new ApiError(404, "Not found");
    const errors = validateType({ ...t, ...body });
    if (errors.length) throw new ApiError(400, "Validation failed", errors);
    Object.assign(t, body, { updatedAt: now() });
    save();
    return t;
  },
  async adminDeleteType(token: string | null, typeId: string) {
    await wait();
    const u = authUser(token);
    requireRole(u, "admin");
    const d = load();
    d.approvalTypes = d.approvalTypes.filter((x) => x._id !== typeId);
    save();
  },
  async adminUsers(token: string | null) {
    await wait();
    const u = authUser(token);
    requireRole(u, "admin");
    return { users: load().users.map(strip) };
  },
  async adminUpdateUser(
    token: string | null,
    userId: string,
    body: Partial<Pick<User, "role" | "department">>,
  ) {
    await wait();
    const u = authUser(token);
    requireRole(u, "admin");
    const target = load().users.find((x) => x._id === userId);
    if (!target) throw new ApiError(404, "Not found");
    const next = { ...target, ...body };
    if ((next.role === "authority" || next.role === "admin") && !next.department?.trim())
      throw new ApiError(400, "Validation failed", [
        { field: "department", message: "Department is required for this role" },
      ]);
    Object.assign(target, body, {
      department: next.role === "applicant" ? null : next.department,
      updatedAt: now(),
    });
    save();
    return { user: strip(target) };
  },
  async analytics(token: string | null): Promise<Analytics> {
    await wait();
    const u = authUser(token);
    requireRole(u, "admin", "authority");
    const d = load();
    const items = d.applications.flatMap((a) => a.approvalItems);
    const avgDaysByApprovalType = d.approvalTypes
      .map((t) => {
        const done = items.filter((i) => i.approvalTypeId === t._id && i.submittedAt);
        const days = done.map((i) => {
          const end =
            i.status === "approved" || i.status === "rejected"
              ? +new Date(i.history.at(-1)!.timestamp)
              : Date.now();
          return (end - +new Date(i.submittedAt!)) / DAY;
        });
        return {
          approvalType: t.name,
          avgDays: days.length
            ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10
            : 0,
        };
      })
      .filter((x) => x.avgDays > 0);
    const bottlenecks = d.approvalTypes
      .map((t) => {
        const pend = items.filter((i) => i.approvalTypeId === t._id && isPending(i.status));
        const breached = pend.filter((i) => Date.now() > +new Date(i.slaDeadline!)).length;
        return { approvalType: t.name, department: t.department, pending: pend.length, breached };
      })
      .filter((x) => x.pending > 0)
      .sort((a, b) => b.breached - a.breached || b.pending - a.pending);
    const reasons = new Map<string, number>();
    items
      .flatMap((i) => i.history)
      .filter((h) => (h.action === "reject" || h.action === "request_reupload") && h.reason)
      .forEach((h) => reasons.set(h.reason!, (reasons.get(h.reason!) ?? 0) + 1));
    return {
      avgDaysByApprovalType,
      bottlenecks,
      rejectionReasons: [...reasons].map(([reason, count]) => ({ reason, count })),
    };
  },

  async notifications(token: string | null) {
    await wait();
    const u = authUser(token);
    return { notifications: load().notifications.filter((n) => n.userId === u._id) };
  },
  async markRead(token: string | null, nId: string): Promise<{ notification: Notification }> {
    await wait(150);
    const u = authUser(token);
    const n = load().notifications.find((x) => x._id === nId && x.userId === u._id);
    if (!n) throw new ApiError(404, "Not found");
    n.read = true;
    save();
    return { notification: n };
  },
};

function validateProfile(b: Partial<BusinessProfile>): FieldError[] {
  const e: FieldError[] = [];
  if (!b.businessName?.trim())
    e.push({ field: "businessName", message: "Business name is required" });
  if (!b.sector) e.push({ field: "sector", message: "Select a sector" });
  if (!b.location?.state) e.push({ field: "location.state", message: "Select a state" });
  if (!b.location?.district?.trim())
    e.push({ field: "location.district", message: "District is required" });
  if (!b.projectSize) e.push({ field: "projectSize", message: "Select a project size" });
  if (!b.stage) e.push({ field: "stage", message: "Select a stage" });
  return e;
}
function validateType(b: Partial<ApprovalType>): FieldError[] {
  const e: FieldError[] = [];
  if (!b.name?.trim()) e.push({ field: "name", message: "Name is required" });
  if (!b.department?.trim()) e.push({ field: "department", message: "Department is required" });
  if (!b.slaDays || b.slaDays < 1)
    e.push({ field: "slaDays", message: "SLA must be at least 1 day" });
  return e;
}
