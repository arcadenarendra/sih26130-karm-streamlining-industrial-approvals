import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { env } from "./config/env.js";
import { User } from "./models/User.js";
import { BusinessProfile } from "./models/BusinessProfile.js";
import { ApprovalType } from "./models/ApprovalType.js";
import { Application } from "./models/Application.js";
import { Notification } from "./models/Notification.js";
import { AuditLog } from "./models/AuditLog.js";
import { Department } from "./models/Department.js";
import { DepartmentAuthority } from "./models/DepartmentAuthority.js";
import { authenticate, roles } from "./models/middleware/auth.js";
import { asyncHandler, HttpError, ok } from "./utils/http.js";
import { checkPassword, hashPassword, signToken } from "./utils/auth.js";
import { deadline, overall } from "./services/application.js";
fs.mkdirSync(env.uploadDir, { recursive: true });
const upload = multer({
  dest: env.uploadDir,
  limits: { fileSize: env.maxFileSize },
  fileFilter: (_r, f, cb) =>
    cb(null, ["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(f.mimetype)),
});
const router = Router();
const protect = [authenticate];
const adminRoles = ["admin", "super_admin"];
const clean = (u: any) => {
  const o = u.toObject ? u.toObject() : u;
  delete o.passwordHash;
  delete o.password;
  return o;
};
router.post(
  "/auth/register",
  asyncHandler(async (req, res) => {
    const p = z
      .object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
      })
      .parse(req.body);
    if (await User.exists({ email: p.email })) throw new HttpError(409, "Email already registered");
    const u = await User.create({
      ...p,
      passwordHash: await hashPassword(p.password),
      role: "applicant",
    });
    ok(res, { user: clean(u) }, 201);
  }),
);
router.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const p = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const u = await User.findOne({ email: p.email }).select("+passwordHash");
    if (!u || !(await checkPassword(p.password, u.passwordHash)))
      throw new HttpError(401, "Invalid credentials");
    ok(res, { token: signToken(u.id, u.role), user: clean(u) });
  }),
);
router.get(
  "/auth/me",
  protect,
  asyncHandler(async (req, res) => ok(res, { user: clean(await User.findById(req.user!.id)) })),
);
router.post(
  "/auth/change-password",
  protect,
  asyncHandler(async (req, res) => {
    const body = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12) }).parse(req.body);
    const user: any = await User.findById(req.user!.id).select("+passwordHash");
    if (!user || !(await checkPassword(body.currentPassword, user.passwordHash)))
      throw new HttpError(401, "Current password is invalid");
    user.passwordHash = await hashPassword(body.newPassword);
    user.mustChangePassword = false;
    await user.save();
    ok(res, { user: clean(user) });
  }),
);
router.get(
  "/profile",
  protect,
  roles("applicant"),
  asyncHandler(async (req, res) => {
    const profile = await BusinessProfile.findOne({ userId: req.user!.id });
    if (!profile) throw new HttpError(404, "Profile not found");
    ok(res, { profile });
  }),
);
const profileBody = z.object({
  businessName: z.string().min(1),
  sector: z.string().min(1),
  location: z.object({ state: z.string(), district: z.string() }),
  projectSize: z.string(),
  stage: z.string(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s()-]{7,19}$/, "Enter a valid mobile number")
    .nullable()
    .optional(),
});
router.post(
  "/profile",
  protect,
  roles("applicant"),
  asyncHandler(async (req, res) => {
    if (await BusinessProfile.exists({ userId: req.user!.id }))
      throw new HttpError(409, "Profile already exists");
    const body = profileBody.parse(req.body);
    const profile = await BusinessProfile.create({
      userId: req.user!.id,
      businessName: body.businessName,
      sector: body.sector,
      location: body.location,
      projectSize: body.projectSize,
      stage: body.stage,
    });
    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { phone: body.phone ?? null },
      { new: true, runValidators: true },
    );
    ok(res, { profile, user: clean(user) }, 201);
  }),
);
router.patch(
  "/profile",
  protect,
  roles("applicant"),
  asyncHandler(async (req, res) => {
    const body = profileBody.partial().parse(req.body);
    const { phone, ...profileFields } = body;
    const profile = await BusinessProfile.findOneAndUpdate(
      { userId: req.user!.id },
      profileFields,
      { new: true, runValidators: true },
    );
    const user =
      phone === undefined
        ? await User.findById(req.user!.id)
        : await User.findByIdAndUpdate(
            req.user!.id,
            { phone: phone ?? null },
            { new: true, runValidators: true },
          );
    ok(res, { profile, user: clean(user) });
  }),
);
router.get(
  "/checklist",
  protect,
  roles("applicant"),
  asyncHandler(async (req, res) => {
    const p = await BusinessProfile.findOne({ userId: req.user!.id });
    if (!p) throw new HttpError(404, "Profile not found");
    const location = p.location as { state: string; district: string };
    const items = await ApprovalType.find({
      isActive: true,
      $and: [
        { $or: [{ sectors: { $size: 0 } }, { sectors: p.sector }] },
        { $or: [{ states: { $size: 0 } }, { states: location.state }] },
        {
          $or: [{ projectSizes: { $size: 0 } }, { projectSizes: p.projectSize }],
        },
        { $or: [{ stages: { $size: 0 } }, { stages: p.stage }] },
      ],
    });
    ok(res, { items });
  }),
);
router.get(
  "/departments",
  protect,
  roles("applicant", "authority", "department_admin", "admin", "super_admin"),
  asyncHandler(async (_req, res) => ok(res, { departments: await Department.find({ isActive: true }).sort({ name: 1 }) })),
);
router.get(
  "/departments/:departmentId/services",
  protect,
  roles("applicant", "authority", "department_admin", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const department = await Department.findOne({ departmentId: String(req.params.departmentId).toUpperCase(), isActive: true });
    if (!department) throw new HttpError(404, "Department not found");
    ok(res, { department, services: await ApprovalType.find({ department: department.name, isActive: true }).sort({ name: 1 }) });
  }),
);
router.post(
  "/applications",
  protect,
  roles("applicant"),
  asyncHandler(async (req, res) => {
    const b = z
      .object({
        businessProfileId: z.string(),
        approvalTypeIds: z.array(z.string()).min(1),
      })
      .parse(req.body);
    if (
      !(await BusinessProfile.exists({
        _id: b.businessProfileId,
        userId: req.user!.id,
      }))
    )
      throw new HttpError(403, "Profile access denied");
    if (new Set(b.approvalTypeIds).size !== b.approvalTypeIds.length)
      throw new HttpError(400, "Duplicate approval types");
    const types = await ApprovalType.find({
      _id: { $in: b.approvalTypeIds },
      isActive: true,
    });
    if (types.length !== b.approvalTypeIds.length)
      throw new HttpError(400, "Invalid approval type");
    const departmentNames = new Set(types.map((type) => type.department));
    if (departmentNames.size !== 1)
      throw new HttpError(400, "Select services from one department per application");
    const department = await Department.findOne({ name: types[0].department, isActive: true });
    if (!department) throw new HttpError(400, "Selected department is not available");
    const duplicate = await Application.exists({
      applicantId: req.user!.id,
      "approvalItems.approvalTypeId": { $in: types.map((type) => type._id) },
      overallStatus: { $in: ["draft", "in_progress", "action_required"] },
    });
    if (duplicate)
      throw new HttpError(409, "An active application already exists for a selected service");
    const now = new Date();
    const a = await Application.create({
      referenceNumber: `KRM-${now.getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      applicantId: req.user!.id,
      businessProfileId: b.businessProfileId,
      departmentId: department._id,
      approvalItems: types.map((t) => ({
        approvalTypeId: t.id,
        status: "draft",
        documents: [],
        history: [
          {
            action: "created",
            byUserId: req.user!.id,
            byRole: "applicant",
            timestamp: now,
          },
        ],
      })),
      overallStatus: "draft",
    });
    ok(res, { application: a }, 201);
  }),
);
const own = async (id: string, uid: string) => {
  const a = await Application.findById(id).populate("approvalItems.approvalTypeId");
  if (!a) throw new HttpError(404, "Application not found");
  if (String(a.applicantId) !== uid) throw new HttpError(403, "Application access denied");
  return a;
};
router.get(
  "/applications",
  protect,
  roles("applicant"),
  asyncHandler(async (req, res) =>
    ok(res, {
      applications: await Application.find({
        applicantId: req.user!.id,
      }).populate("approvalItems.approvalTypeId"),
    }),
  ),
);
router.get(
  "/applications/:id",
  protect,
  roles("applicant"),
  asyncHandler(async (req, res) =>
    ok(res, { application: await own(String(req.params.id), req.user!.id) }),
  ),
);
router.post(
  "/applications/:id/submit",
  protect,
  roles("applicant"),
  asyncHandler(async (req, res) => {
    const a = await own(String(req.params.id), req.user!.id);
    if (a.approvalItems.some((i: any) => i.status !== "draft"))
      throw new HttpError(400, "Application has already been submitted");
    const now = new Date();
    for (const i of a.approvalItems) {
      const t: any = i.approvalTypeId;
      if (i.documents.some((d) => d.preValidationStatus === "failed"))
        throw new HttpError(400, "Fix failed documents before submission");
      if (i.documents.some((d: any) => d.verificationStatus === "invalid"))
        throw new HttpError(400, "Replace invalid documents before submission");
      const missing = t.requiredDocuments.some(
        (d: any) =>
          d.required && !i.documents.some((uploaded: any) => uploaded.docType === d.docType),
      );
      if (missing) throw new HttpError(400, `Upload all required documents for ${t.name}`);
      i.status = "submitted";
      i.submittedAt = now;
      i.slaDeadline = deadline(now, t.slaDays);
      i.history.push({
        action: "submitted",
        byUserId: req.user!.id,
        byRole: "applicant",
        timestamp: now,
      });
    }
    a.overallStatus = "in_progress";
    await a.save();
    ok(res, { application: a });
  }),
);
router.delete(
  "/applications/:id",
  protect,
  roles("applicant"),
  asyncHandler(async (req, res) => {
    const a: any = await own(String(req.params.id), req.user!.id);
    if (!a.approvalItems.every((item: any) => item.status === "draft"))
      throw new HttpError(400, "Only draft applications can be withdrawn");
    for (const item of a.approvalItems)
      for (const document of item.documents ?? [])
        if (document.storagePath && fs.existsSync(document.storagePath))
          fs.unlinkSync(document.storagePath);
    await Application.deleteOne({ _id: a._id, applicantId: req.user!.id });
    res.status(204).send();
  }),
);
const findAuthority = async (id: string, req: any) => {
  const a: any = await Application.findById(id)
    .populate("approvalItems.approvalTypeId")
    .populate("applicantId");
  if (!a) throw new HttpError(404, "Application not found");
  if (
    ["authority", "department_admin"].includes(req.user.role) &&
    (!req.user.department ||
      a.approvalItems.every((i: any) => i.approvalTypeId.department !== req.user.department))
  )
    throw new HttpError(403, "Department access denied");
  if (["authority", "department_admin"].includes(req.user.role))
    a.approvalItems = a.approvalItems.filter(
      (item: any) => item.approvalTypeId.department === req.user.department,
    );
  return a;
};
router.get(
  "/authority/applications",
  protect,
  roles("authority", "department_admin", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const all: any[] = await Application.find({
      overallStatus: { $ne: "draft" },
    })
      .populate("approvalItems.approvalTypeId")
      .populate("applicantId");
    const status = String(req.query.status ?? "");
    const applications = all
      .map((a) => {
        const items = a.approvalItems.filter((i: any) => {
          if (
            ["authority", "department_admin"].includes(req.user!.role) &&
            i.approvalTypeId.department !== req.user!.department
          )
            return false;
          return !status || i.status === status;
        });
        return items.length ? { ...a.toObject(), approvalItems: items } : null;
      })
      .filter(Boolean);
    ok(res, { applications });
  }),
);
router.get(
  "/authority/applications/:id",
  protect,
  roles("authority", "department_admin", "admin", "super_admin"),
  asyncHandler(async (req, res) =>
    ok(res, { application: await findAuthority(String(req.params.id), req) }),
  ),
);
router.get(
  "/authority/applications/:id/items/:itemId/risk-brief",
  protect,
  roles("authority", "department_admin", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const a: any = await findAuthority(String(req.params.id), req);
    const i = a.approvalItems.id(String(req.params.itemId));
    if (!i) throw new HttpError(404, "Item not found");
    const d = i.documents[0];
    if (!d) throw new HttpError(400, "Upload a document first");
    if (!d.riskBrief)
      d.riskBrief = {
        score: d.preValidationStatus === "passed" ? 10 : 70,
        summary: "Advisory automated risk brief; human review required.",
        flags: d.preValidationNotes ?? [],
        generatedAt: new Date(),
      };
    await a.save();
    await AuditLog.create({
      actorId: req.user!.id,
      action: "risk_brief_generated",
      entityType: "Application",
      entityId: a.id,
    });
    ok(res, { riskBrief: d.riskBrief });
  }),
);
router.post(
  "/authority/applications/:id/items/:itemId/decision",
  protect,
  roles("authority", "department_admin", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const b = z
      .object({
        decision: z.enum(["approve", "reject", "request_reupload"]),
        reason: z.string().optional(),
      })
      .parse(req.body);
    if (b.decision !== "approve" && !b.reason?.trim())
      throw new HttpError(400, "Reason is required");
    const a: any = await findAuthority(String(req.params.id), req),
      i = a.approvalItems.id(String(req.params.itemId));
    if (!i) throw new HttpError(404, "Item not found");
    i.status =
      b.decision === "approve" ? "approved" : b.decision === "reject" ? "rejected" : "query_raised";
    i.assignedOfficerId = req.user!.id;
    i.history.push({
      action: b.decision,
      byUserId: req.user!.id,
      byRole: req.user!.role,
      reason: b.reason ?? null,
      timestamp: new Date(),
    });
    a.overallStatus = overall(a.approvalItems.map((x: any) => x.status));
    await a.save();
    await Notification.create({
      userId: a.applicantId,
      type: "decision",
      message: `Application item ${b.decision}`,
      read: false,
    });
    await AuditLog.create({
      actorId: req.user!.id,
      action: b.decision,
      entityType: "Application",
      entityId: a.id,
      metadata: { reason: b.reason },
    });
    ok(res, { applicationItem: i });
  }),
);
router.post(
  "/applications/:id/items/:itemId/documents",
  protect,
  roles("applicant"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const a: any = await own(String(req.params.id), req.user!.id),
      i = a.approvalItems.id(String(req.params.itemId));
    if (!i || !req.file) throw new HttpError(400, "File and item are required");
    const t: any = i.approvalTypeId;
    const docType = String(req.body.docType ?? "");
    if (!t.requiredDocuments.some((d: any) => d.docType === docType))
      throw new HttpError(400, "Invalid document type");
    const notes: string[] = [];
    const status =
      req.file.mimetype === "application/pdf" || req.file.mimetype.startsWith("image/")
        ? "passed"
        : "failed";
    if (status === "failed") notes.push("Unsupported file type");
    const d = {
      docType,
      fileUrl: `/applications/${a.id}/items/${i.id}/documents/${encodeURIComponent(docType)}/file`,
      storagePath: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
      preValidationStatus: status,
      preValidationNotes: notes,
      riskBrief: null,
    };
    i.documents = i.documents.filter((x: any) => x.docType !== docType);
    i.documents.push(d);
    await a.save();
    ok(res, { document: d, preValidationResult: { status, notes } }, 201);
  }),
);
router.post(
  "/applications/:id/items/:itemId/reupload",
  protect,
  roles("applicant"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const a: any = await own(String(req.params.id), req.user!.id),
      i = a.approvalItems.id(String(req.params.itemId));
    if (!i || !["query_raised", "rejected"].includes(i.status))
      throw new HttpError(400, "Re-upload is not allowed");
    if (!req.file) throw new HttpError(400, "File is required");
    const t: any = i.approvalTypeId;
    const docType = String(req.body.docType ?? "");
    if (!t.requiredDocuments.some((d: any) => d.docType === docType))
      throw new HttpError(400, "Invalid document type");
    const d = {
      docType,
      fileUrl: `/applications/${a.id}/items/${i.id}/documents/${encodeURIComponent(docType)}/file`,
      storagePath: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
      preValidationStatus: "passed",
      preValidationNotes: [],
      riskBrief: null,
    };
    i.documents = i.documents.filter((x: any) => x.docType !== docType);
    i.documents.push(d);
    i.status = "in_review";
    i.history.push({
      action: "reuploaded",
      byUserId: req.user!.id,
      byRole: "applicant",
      timestamp: new Date(),
    });
    a.overallStatus = overall(a.approvalItems.map((x: any) => x.status));
    await a.save();
    if (i.assignedOfficerId) {
      await Notification.create({
        userId: i.assignedOfficerId,
        type: "reupload",
        message: `Application ${a.id}: applicant re-uploaded ${docType}.`,
        read: false,
      });
    }
    await AuditLog.create({
      actorId: req.user!.id,
      action: "reuploaded",
      entityType: "Application",
      entityId: a.id,
      metadata: { itemId: i.id, docType },
    });
    ok(res, { document: d });
  }),
);
router.get(
  "/applications/:id/items/:itemId/documents/:docType/file",
  protect,
  roles("applicant", "authority", "department_admin", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const a: any =
      req.user!.role === "applicant"
        ? await own(String(req.params.id), req.user!.id)
        : await findAuthority(String(req.params.id), req);
    const i = a.approvalItems.id(String(req.params.itemId));
    const doc = i?.documents.find((d: any) => d.docType === decodeURIComponent(String(req.params.docType)));
    if (!doc?.storagePath || !fs.existsSync(doc.storagePath)) throw new HttpError(404, "Document not found");
    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${String(doc.originalName || "document").replace(/["\r\n]/g, "")}"`);
    fs.createReadStream(doc.storagePath).pipe(res);
  }),
);
router.post(
  "/authority/applications/:id/items/:itemId/documents/:docType/verification",
  protect,
  roles("authority", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const body = z.object({ status: z.enum(["verified", "invalid"]), notes: z.string().max(1000).optional() }).parse(req.body);
    const a: any = await findAuthority(String(req.params.id), req);
    const i = a.approvalItems.id(String(req.params.itemId));
    const doc = i?.documents.find((d: any) => d.docType === decodeURIComponent(String(req.params.docType)));
    if (!doc) throw new HttpError(404, "Document not found");
    doc.verificationStatus = body.status;
    doc.verificationNotes = body.notes ?? null;
    i.history.push({ action: `document_${body.status}`, byUserId: req.user!.id, byRole: req.user!.role, reason: body.notes ?? null, timestamp: new Date() });
    await a.save();
    await AuditLog.create({ actorId: req.user!.id, action: `document_${body.status}`, entityType: "Application", entityId: a.id, metadata: { itemId: i.id, docType: doc.docType, notes: body.notes } });
    ok(res, { document: doc });
  }),
);
router.get(
  "/notifications",
  protect,
  asyncHandler(async (req, res) =>
    ok(res, {
      notifications: await Notification.find({ userId: req.user!.id }).sort({
        createdAt: -1,
      }),
    }),
  ),
);
router.patch(
  "/notifications/:id/read",
  protect,
  asyncHandler(async (req, res) => {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { read: true },
      { new: true },
    );
    if (!n) throw new HttpError(404, "Notification not found");
    ok(res, { notification: n });
  }),
);
router.get(
  "/admin/approval-types",
  protect,
  roles(...adminRoles),
  asyncHandler(async (_req, res) => ok(res, await ApprovalType.find())),
);
router.get(
  "/admin/departments",
  protect,
  roles(...adminRoles),
  asyncHandler(async (_req, res) => ok(res, { departments: await Department.find().sort({ name: 1 }) })),
);
router.post(
  "/admin/departments",
  protect,
  roles(...adminRoles),
  asyncHandler(async (req, res) => {
    const body = z.object({ departmentId: z.string().min(2), name: z.string().min(2), description: z.string().optional() }).parse(req.body);
    ok(res, { department: await Department.create(body) }, 201);
  }),
);
router.patch(
  "/admin/departments/:id",
  protect,
  roles(...adminRoles),
  asyncHandler(async (req, res) =>
    ok(res, { department: await Department.findByIdAndUpdate(String(req.params.id), req.body, { new: true, runValidators: true }) }),
  ),
);
router.get(
  "/admin/authorities",
  protect,
  roles(...adminRoles),
  asyncHandler(async (_req, res) => {
    const authorities = await DepartmentAuthority.find().populate("userId departmentId");
    ok(res, { authorities: authorities.map((authority) => ({ ...authority.toObject(), userId: clean(authority.userId) })) });
  }),
);
router.patch(
  "/admin/authorities/:id",
  protect,
  roles(...adminRoles),
  asyncHandler(async (req, res) => {
    const body = z.object({ enabled: z.boolean().optional(), departmentId: z.string().optional() }).parse(req.body);
    const authority: any = await DepartmentAuthority.findById(String(req.params.id));
    if (!authority) throw new HttpError(404, "Authority not found");
    if (body.departmentId) {
      const department = await Department.findOne({ departmentId: body.departmentId.toUpperCase(), isActive: true });
      if (!department) throw new HttpError(400, "Department not found");
      authority.departmentId = department._id;
      await User.findByIdAndUpdate(authority.userId, { department: department.departmentId });
    }
    if (body.enabled !== undefined) authority.enabled = body.enabled;
    await authority.save();
    ok(res, { authority });
  }),
);
router.post(
  "/admin/approval-types",
  protect,
  roles(...adminRoles),
  asyncHandler(async (req, res) => ok(res, await ApprovalType.create(req.body), 201)),
);
router.patch(
  "/admin/approval-types/:id",
  protect,
  roles(...adminRoles),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await ApprovalType.findByIdAndUpdate(String(req.params.id), req.body, {
        new: true,
        runValidators: true,
      }),
    ),
  ),
);
router.delete(
  "/admin/approval-types/:id",
  protect,
  roles(...adminRoles),
  asyncHandler(async (req, res) => {
    await ApprovalType.findByIdAndUpdate(String(req.params.id), {
      isActive: false,
    });
    res.status(204).send();
  }),
);
router.get(
  "/admin/users",
  protect,
  roles(...adminRoles),
  asyncHandler(async (_req, res) => ok(res, { users: (await User.find()).map(clean) })),
);
router.patch(
  "/admin/users/:id",
  protect,
  roles(...adminRoles),
  asyncHandler(async (req, res) =>
    ok(res, {
      user: clean(
        await User.findByIdAndUpdate(
          String(req.params.id),
          { role: req.body.role, department: req.body.department },
          { new: true },
        ),
      ),
    }),
  ),
);
router.get(
  "/admin/analytics",
  protect,
  roles("admin", "super_admin", "authority"),
  asyncHandler(async (_req, res) => {
    const applications: any[] = await Application.find({}).populate("approvalItems.approvalTypeId");
    const now = Date.now();
    const byType = new Map<string, { name: string; total: number; count: number }>();
    const bottlenecks = new Map<
      string,
      {
        approvalType: string;
        department: string;
        pending: number;
        breached: number;
      }
    >();
    const reasons = new Map<string, number>();
    for (const a of applications)
      for (const i of a.approvalItems) {
        const t: any = i.approvalTypeId;
        const name = t?.name ?? "Unknown";
        if (i.status === "approved" && i.submittedAt) {
          const approved = i.history.find((h: any) => h.action === "approve");
          if (approved) {
            const entry = byType.get(name) ?? { name, total: 0, count: 0 };
            entry.total +=
              (new Date(approved.timestamp).getTime() - new Date(i.submittedAt).getTime()) /
              86400000;
            entry.count++;
            byType.set(name, entry);
          }
        }
        if (["submitted", "in_review"].includes(i.status)) {
          const key = `${name}:${t?.department ?? "Unknown"}`;
          const entry = bottlenecks.get(key) ?? {
            approvalType: name,
            department: t?.department ?? "Unknown",
            pending: 0,
            breached: 0,
          };
          entry.pending++;
          if (i.slaDeadline && new Date(i.slaDeadline).getTime() < now) entry.breached++;
          bottlenecks.set(key, entry);
        }
        for (const h of i.history.filter(
          (x: any) => ["reject", "request_reupload"].includes(x.action) && x.reason,
        ))
          reasons.set(h.reason, (reasons.get(h.reason) ?? 0) + 1);
      }
    ok(res, {
      avgDaysByApprovalType: [...byType.values()].map((x) => ({
        approvalType: x.name,
        avgDays: Number((x.total / x.count).toFixed(1)),
      })),
      bottlenecks: [...bottlenecks.values()],
      rejectionReasons: [...reasons].map(([reason, count]) => ({
        reason,
        count,
      })),
    });
  }),
);
export default router;
