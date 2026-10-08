import fs from "node:fs";
import path from "node:path";
import { connectDb } from "../config/db.js";
import { ApprovalType } from "../models/ApprovalType.js";
import { Application } from "../models/Application.js";
import { AuditLog } from "../models/AuditLog.js";
import { BusinessProfile } from "../models/BusinessProfile.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { hashPassword } from "../utils/auth.js";
import { Department } from "../models/Department.js";
import { DepartmentAuthority } from "../models/DepartmentAuthority.js";
import { env } from "../config/env.js";

const demoPassword = "DemoPassword123!";

await connectDb();

const passwordHash = await hashPassword(demoPassword);
const departments = [
  ["REV001", "Revenue Department", "Land records, income/caste certificates, domicile certificates, and related services."],
  ["EDU001", "Education Department", "Scholarships, student certificates, admissions, and education-related applications."],
  ["HEA001", "Health Department", "Health certificates, medical assistance, health schemes, and related services."],
  ["TRA001", "Transport Department", "Driving licences, vehicle registration, and transport-related services."],
  ["URB001", "Municipal Corporation / Urban Development Department", "Property-related services, building permissions, and local civic services."],
  ["SOC001", "Social Welfare Department", "Welfare schemes, pensions, disability assistance, and social support applications."],
  ["LAB001", "Labour Department", "Labour registrations, worker welfare schemes, and employment-related services."],
  ["AGR001", "Agriculture Department", "Farmer schemes, subsidies, agricultural certificates, and assistance."],
  ["FCS001", "Food & Civil Supplies Department", "Ration cards, food-supply services, and related applications."],
  ["POL001", "Police / Home Department", "Police verification, character certificates, permissions, and other police-related services."],
] as const;
const seededDepartments = await Promise.all(
  departments.map(([departmentId, name, description]) =>
    Department.findOneAndUpdate({ departmentId }, { $set: { name, description, isActive: true } }, { upsert: true, new: true, setDefaultsOnInsert: true }),
  ),
);
const departmentServices = [
  ["Revenue Department", "Domicile Certificate", [{ docType: "identity", label: "Identity Proof", required: true }, { docType: "address_proof", label: "Address Proof", required: true }]],
  ["Education Department", "Student Scholarship", [{ docType: "marksheet", label: "Marksheet", required: true }, { docType: "student_id", label: "Student ID", required: true }]],
  ["Health Department", "Health Assistance", [{ docType: "identity", label: "Identity Proof", required: true }, { docType: "medical_record", label: "Medical Record", required: true }]],
  ["Transport Department", "Vehicle Registration", [{ docType: "identity", label: "Identity Proof", required: true }, { docType: "vehicle_document", label: "Vehicle Document", required: true }]],
  ["Municipal Corporation / Urban Development Department", "Building Permission", [{ docType: "identity", label: "Identity Proof", required: true }, { docType: "building_plan", label: "Building Plan", required: true }]],
  ["Social Welfare Department", "Welfare Assistance", [{ docType: "identity", label: "Identity Proof", required: true }, { docType: "income_certificate", label: "Income Certificate", required: true }]],
  ["Labour Department", "Worker Registration", [{ docType: "identity", label: "Identity Proof", required: true }, { docType: "employment_proof", label: "Employment Proof", required: true }]],
  ["Agriculture Department", "Farmer Support", [{ docType: "land_records", label: "Land Records", required: true }, { docType: "farmer_id", label: "Farmer ID", required: true }, { docType: "bank_details", label: "Bank Details", required: true }]],
  ["Food & Civil Supplies Department", "Ration Card", [{ docType: "identity", label: "Identity Proof", required: true }, { docType: "address_proof", label: "Address Proof", required: true }]],
  ["Police / Home Department", "Police Clearance Certificate", [{ docType: "identity", label: "Identity Proof", required: true }, { docType: "address_proof", label: "Address Proof", required: true }]],
] as const;
await Promise.all(
  departmentServices.map(([department, name, requiredDocuments]) =>
    ApprovalType.findOneAndUpdate(
      { department, name },
      { $set: { requiredDocuments, slaDays: 15, description: `${name} service for ${department}.`, isActive: true, sectors: [], states: [], projectSizes: [], stages: [] } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ),
  ),
);
await Promise.all(
  seededDepartments.map(async (department, index) => {
    const [, name] = departments[index];
    const username = `${department.departmentId.toLowerCase()}.authority`;
    const user = await User.findOneAndUpdate(
      { email: `${username}@karm.local` },
      { $set: { name: `${name} Authority`, passwordHash: await hashPassword(`ChangeMe!${department.departmentId}`), role: "authority", department: name, mustChangePassword: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await DepartmentAuthority.findOneAndUpdate(
      { userId: user._id },
      { $set: { departmentId: department._id, enabled: true, mustChangePassword: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }),
);

const [admin, authority, applicant, secondApplicant] = await Promise.all([
  User.findOneAndUpdate(
    { email: "admin@karm.local" },
    {
      $set: {
        name: "KARM Admin",
        passwordHash,
        role: "admin",
        department: null,
        phone: "+91 90000 00001",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ),
  User.findOneAndUpdate(
    { email: "authority@karm.local" },
    {
      $set: {
        name: "Environment Officer",
        passwordHash,
        role: "authority",
        department: "environment",
        phone: "+91 90000 00002",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ),
  User.findOneAndUpdate(
    { email: "applicant@karm.local" },
    {
      $set: {
        name: "Priya Sharma",
        passwordHash,
        role: "applicant",
        department: null,
        phone: "+91 90000 00003",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ),
  User.findOneAndUpdate(
    { email: "startup@karm.local" },
    {
      $set: {
        name: "Arjun Mehta",
        passwordHash,
        role: "applicant",
        department: null,
        phone: "+91 90000 00004",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ),
]);

if (!admin || !authority || !applicant || !secondApplicant) {
  throw new Error("Unable to create demo users");
}

const [environmentalClearance, factoryRegistration, startupGrant] = await Promise.all([
  ApprovalType.findOneAndUpdate(
    { name: "Environmental Clearance", department: "environment" },
    {
      $set: {
        requiredDocuments: [
          { docType: "identity", label: "Identity proof", required: true },
          { docType: "site_plan", label: "Project site plan", required: true },
        ],
        slaDays: 15,
        description: "Clearance for projects with potential environmental impact.",
        sectors: [],
        states: [],
        projectSizes: [],
        stages: [],
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ),
  ApprovalType.findOneAndUpdate(
    { name: "Factory Registration", department: "industry" },
    {
      $set: {
        requiredDocuments: [
          { docType: "registration", label: "Registration document", required: true },
        ],
        slaDays: 10,
        description: "Registration for industrial and manufacturing businesses.",
        sectors: ["Manufacturing"],
        states: [],
        projectSizes: [],
        stages: [],
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ),
  ApprovalType.findOneAndUpdate(
    { name: "Startup Grant", department: "finance" },
    {
      $set: {
        requiredDocuments: [
          { docType: "business_plan", label: "Business plan", required: true },
          { docType: "identity", label: "Identity proof", required: true },
        ],
        slaDays: 7,
        description: "Demo grant approval for eligible early-stage businesses.",
        sectors: ["Technology", "Manufacturing"],
        states: [],
        projectSizes: ["small", "medium"],
        stages: ["idea", "operating"],
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ),
]);

if (!environmentalClearance || !factoryRegistration || !startupGrant) {
  throw new Error("Unable to create demo approval types");
}

const domainApprovalTypes = [
  {
    name: "Business Registration (Udyam)",
    department: "MSME",
    slaDays: 7,
    requiredDocuments: [
      { docType: "pan_card", label: "PAN Card", required: true },
      { docType: "address_proof", label: "Address Proof", required: true },
    ],
    description: "Illustrative example entry — verify real requirements before demo use.",
    sectors: [],
  },
  {
    name: "Pollution Control Consent (Consent to Establish)",
    department: "Maharashtra Pollution Control Board",
    slaDays: 21,
    requiredDocuments: [
      { docType: "site_plan", label: "Site Layout Plan", required: true },
      { docType: "project_report", label: "Project Report", required: true },
    ],
    description: "Illustrative example entry — verify real requirements before demo use.",
    sectors: ["Food Processing", "Manufacturing", "Chemicals"],
  },
  {
    name: "Fire NOC",
    department: "Fire Department",
    slaDays: 15,
    requiredDocuments: [
      { docType: "building_plan", label: "Building Plan", required: true },
      { docType: "fire_safety_cert", label: "Fire Safety Equipment Certificate", required: false },
    ],
    description: "Illustrative example entry — verify real requirements before demo use.",
    sectors: ["Food Processing", "Manufacturing", "Chemicals"],
  },
  {
    name: "Factory Licence",
    department: "Directorate of Industrial Safety and Health",
    slaDays: 30,
    requiredDocuments: [
      { docType: "site_plan", label: "Factory Layout Plan", required: true },
      { docType: "proof_of_ownership", label: "Proof of Premises Ownership/Lease", required: true },
    ],
    description: "Illustrative example entry — verify real requirements before demo use.",
    sectors: ["Food Processing", "Manufacturing", "Chemicals"],
  },
  {
    name: "Power Connection Clearance",
    department: "MSEDCL",
    slaDays: 10,
    requiredDocuments: [
      { docType: "load_requirement", label: "Load Requirement Document", required: true },
    ],
    description: "Illustrative example entry — verify real requirements before demo use.",
    sectors: ["Food Processing", "Manufacturing", "Chemicals"],
  },
];

await Promise.all(
  domainApprovalTypes.map((approvalType) =>
    ApprovalType.findOneAndUpdate(
      { name: approvalType.name, department: approvalType.department },
      {
        $set: {
          ...approvalType,
          states: [],
          projectSizes: [],
          stages: [],
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ),
  ),
);

const [applicantProfile, secondApplicantProfile] = await Promise.all([
  BusinessProfile.findOneAndUpdate(
    { userId: applicant._id },
    {
      $set: {
        businessName: "GreenGrid Energy",
        sector: "Technology",
        location: { state: "Karnataka", district: "Bengaluru Urban" },
        projectSize: "medium",
        stage: "operating",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ),
  BusinessProfile.findOneAndUpdate(
    { userId: secondApplicant._id },
    {
      $set: {
        businessName: "Makers Works",
        sector: "Manufacturing",
        location: { state: "Maharashtra", district: "Pune" },
        projectSize: "small",
        stage: "idea",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ),
]);

if (!applicantProfile || !secondApplicantProfile) {
  throw new Error("Unable to create demo business profiles");
}

await Application.deleteMany({
  applicantId: { $in: [applicant._id, secondApplicant._id] },
});

const now = new Date();
const submittedAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
const demoFile = (name: string) => {
  const storagePath = path.join(env.uploadDir, name);
  if (!fs.existsSync(storagePath)) {
    const pdf = [
      "%PDF-1.4",
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<<>>>>endobj",
      "4 0 obj<</Length 44>>stream",
      "BT /F1 18 Tf 72 720 Td (KARM demo document) Tj ET",
      "endstream endobj",
      "xref 0 5",
      "0000000000 65535 f ",
      "0000000009 00000 n ",
      "0000000058 00000 n ",
      "0000000115 00000 n ",
      "0000000241 00000 n ",
      "trailer<</Size 5/Root 1 0 R>>",
      "startxref 335",
      "%%EOF",
    ].join("\n");
    fs.mkdirSync(env.uploadDir, { recursive: true });
    fs.writeFileSync(storagePath, pdf);
  }
  return storagePath;
};
const demoDocuments = {
  identity: demoFile("demo-identity.pdf"),
  registration: demoFile("demo-registration.pdf"),
  registrationApproved: demoFile("demo-registration-approved.pdf"),
  businessPlan: demoFile("demo-business-plan.pdf"),
  sitePlan: demoFile("demo-site-plan.pdf"),
};

const draftApplication = await Application.create({
  referenceNumber: "KRM-SEED-DRAFT",
  applicantId: applicant._id,
  businessProfileId: applicantProfile._id,
  approvalItems: [
    {
      approvalTypeId: startupGrant._id,
      status: "draft",
      documents: [],
      history: [
        {
          action: "created",
          byUserId: applicant._id,
          byRole: "applicant",
          timestamp: now,
        },
      ],
    },
  ],
  overallStatus: "draft",
});

const submittedApplication = await Application.create({
  referenceNumber: "KRM-SEED-SUBMITTED",
  applicantId: applicant._id,
  businessProfileId: applicantProfile._id,
  approvalItems: [
    {
      approvalTypeId: environmentalClearance._id,
      status: "submitted",
      submittedAt,
      slaDeadline: new Date(submittedAt.getTime() + 15 * 24 * 60 * 60 * 1000),
      documents: [
        {
          docType: "identity",
          fileUrl: "/uploads/demo-identity.pdf",
          storagePath: demoDocuments.identity,
          originalName: "demo-identity.pdf",
          mimeType: "application/pdf",
          uploadedAt: submittedAt,
          preValidationStatus: "passed",
          preValidationNotes: [],
          riskBrief: null,
        },
      ],
      history: [
        {
          action: "created",
          byUserId: applicant._id,
          byRole: "applicant",
          timestamp: submittedAt,
        },
        {
          action: "submitted",
          byUserId: applicant._id,
          byRole: "applicant",
          timestamp: submittedAt,
        },
      ],
    },
  ],
  overallStatus: "in_progress",
});

const queryRaisedApplication = await Application.create({
  referenceNumber: "KRM-SEED-CORRECTION",
  applicantId: secondApplicant._id,
  businessProfileId: secondApplicantProfile._id,
  approvalItems: [
    {
      approvalTypeId: factoryRegistration._id,
      status: "query_raised",
      assignedOfficerId: authority._id,
      submittedAt,
      slaDeadline: new Date(submittedAt.getTime() + 10 * 24 * 60 * 60 * 1000),
      documents: [
        {
          docType: "registration",
          fileUrl: "/uploads/demo-registration.pdf",
          storagePath: demoDocuments.registration,
          originalName: "demo-registration.pdf",
          mimeType: "application/pdf",
          uploadedAt: submittedAt,
          preValidationStatus: "passed",
          preValidationNotes: [],
          riskBrief: null,
        },
      ],
      history: [
        {
          action: "created",
          byUserId: secondApplicant._id,
          byRole: "applicant",
          timestamp: submittedAt,
        },
        {
          action: "submitted",
          byUserId: secondApplicant._id,
          byRole: "applicant",
          timestamp: submittedAt,
        },
        {
          action: "request_reupload",
          byUserId: authority._id,
          byRole: "authority",
          reason: "Please upload a clearer registration document.",
          timestamp: now,
        },
      ],
    },
  ],
  overallStatus: "action_required",
});

const completedApplication = await Application.create({
  referenceNumber: "KRM-SEED-APPROVED",
  applicantId: secondApplicant._id,
  businessProfileId: secondApplicantProfile._id,
  approvalItems: [
    {
      approvalTypeId: factoryRegistration._id,
      status: "approved",
      assignedOfficerId: authority._id,
      submittedAt,
      slaDeadline: new Date(submittedAt.getTime() + 10 * 24 * 60 * 60 * 1000),
      documents: [
        {
          docType: "registration",
          fileUrl: "/uploads/demo-registration-approved.pdf",
          storagePath: demoDocuments.registrationApproved,
          originalName: "demo-registration-approved.pdf",
          mimeType: "application/pdf",
          uploadedAt: submittedAt,
          preValidationStatus: "passed",
          preValidationNotes: [],
          riskBrief: {
            score: 12,
            summary: "Low advisory risk based on the submitted registration document.",
            flags: [],
            generatedAt: now,
          },
        },
      ],
      history: [
        {
          action: "created",
          byUserId: secondApplicant._id,
          byRole: "applicant",
          timestamp: submittedAt,
        },
        {
          action: "submitted",
          byUserId: secondApplicant._id,
          byRole: "applicant",
          timestamp: submittedAt,
        },
        {
          action: "approve",
          byUserId: authority._id,
          byRole: "authority",
          reason: "Registration details verified.",
          timestamp: now,
        },
      ],
    },
    {
      approvalTypeId: startupGrant._id,
      status: "rejected",
      assignedOfficerId: authority._id,
      submittedAt,
      slaDeadline: new Date(submittedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
      documents: [
        {
          docType: "business_plan",
          fileUrl: "/uploads/demo-business-plan.pdf",
          storagePath: demoDocuments.businessPlan,
          originalName: "demo-business-plan.pdf",
          mimeType: "application/pdf",
          uploadedAt: submittedAt,
          preValidationStatus: "failed",
          preValidationNotes: ["Document is missing projected revenue details."],
          riskBrief: {
            score: 78,
            summary: "Advisory risk is elevated because required financial details are missing.",
            flags: ["incomplete_financials"],
            generatedAt: now,
          },
        },
      ],
      history: [
        {
          action: "created",
          byUserId: secondApplicant._id,
          byRole: "applicant",
          timestamp: submittedAt,
        },
        {
          action: "reject",
          byUserId: authority._id,
          byRole: "authority",
          reason: "Required financial information was not supplied.",
          timestamp: now,
        },
      ],
    },
    {
      approvalTypeId: environmentalClearance._id,
      status: "in_review",
      assignedOfficerId: authority._id,
      submittedAt,
      slaDeadline: new Date(submittedAt.getTime() + 15 * 24 * 60 * 60 * 1000),
      documents: [
        {
          docType: "site_plan",
          fileUrl: "/uploads/demo-site-plan.pdf",
          storagePath: demoDocuments.sitePlan,
          originalName: "demo-site-plan.pdf",
          mimeType: "application/pdf",
          uploadedAt: now,
          preValidationStatus: "pending",
          preValidationNotes: ["Awaiting manual review."],
          riskBrief: null,
        },
      ],
      history: [
        {
          action: "created",
          byUserId: secondApplicant._id,
          byRole: "applicant",
          timestamp: submittedAt,
        },
      ],
    },
  ],
  overallStatus: "rejected",
});

await AuditLog.deleteMany({
  actorId: { $in: [admin._id, authority._id, applicant._id, secondApplicant._id] },
});
await AuditLog.insertMany([
  {
    actorId: applicant._id,
    action: "submitted",
    entityType: "Application",
    entityId: submittedApplication._id,
    metadata: { source: "demo-seed", itemCount: 1 },
    timestamp: submittedAt,
  },
  {
    actorId: authority._id,
    action: "request_reupload",
    entityType: "Application",
    entityId: queryRaisedApplication._id,
    metadata: {
      reason: "Please upload a clearer registration document.",
      department: authority.department,
    },
    timestamp: now,
  },
  {
    actorId: admin._id,
    action: "approval_type_updated",
    entityType: "ApprovalType",
    entityId: environmentalClearance._id,
    metadata: { source: "demo-seed", isActive: true },
    timestamp: now,
  },
]);

await Notification.deleteMany({
  userId: { $in: [applicant._id, secondApplicant._id] },
});
await Notification.insertMany([
  {
    userId: applicant._id,
    type: "application_update",
    message: `Application ${submittedApplication.id} was submitted for review.`,
    read: false,
  },
  {
    userId: secondApplicant._id,
    type: "action_required",
    message: `Application ${queryRaisedApplication.id} requires a document re-upload.`,
    read: false,
  },
  {
    userId: applicant._id,
    type: "draft_reminder",
    message: `Application ${draftApplication.id} is still a draft.`,
    read: true,
  },
  {
    userId: secondApplicant._id,
    type: "decision",
    message: `Application ${completedApplication.id} contains completed review decisions.`,
    read: false,
  },
]);

console.log("Seed complete");
console.log("Demo accounts:");
console.log("  admin@karm.local / DemoPassword123!");
console.log("  authority@karm.local / DemoPassword123!");
console.log("  applicant@karm.local / DemoPassword123!");
console.log("  startup@karm.local / DemoPassword123!");
process.exit(0);
