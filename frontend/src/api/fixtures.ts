// ILLUSTRATIVE SAMPLE DATA ONLY — not real regulatory content.
// Shapes match backend-architecture.md §3 exactly.
import type { Application, ApprovalType, BusinessProfile, Notification, User } from "./types";
import { DAY } from "./utils";

const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();
const after = (iso: string, d: number) => new Date(+new Date(iso) + d * DAY).toISOString();

// Illustrative, swappable dropdown values (real taxonomy: NEEDS DECISION).
export const SECTORS = [
  "Manufacturing",
  "Food Processing",
  "Textiles",
  "IT/Software Services",
  "Chemicals",
  "Pharmaceuticals",
  "Warehousing/Logistics",
  "Renewable Energy",
];
export const PROJECT_SIZES = ["Micro", "Small", "Medium", "Large"];
export const STAGES = ["new", "expansion"];
export const STATES = ["Maharashtra", "Gujarat", "Karnataka", "Tamil Nadu", "Uttar Pradesh"];

export interface DbUser extends User {
  password: string; // mock only; real backend stores passwordHash
}

export interface MockDb {
  users: DbUser[];
  profiles: BusinessProfile[];
  approvalTypes: ApprovalType[];
  applications: Application[]; // stored with raw id refs
  notifications: Notification[];
  /** mock-only checklist rules (sector → approval type ids). Real rules engine: NEEDS DECISION */
  rules: Record<string, string[]>;
}

const t0 = ago(120);

export function seed(): MockDb {
  const users: DbUser[] = [
    {
      _id: "u_app1",
      name: "Priya Sharma",
      email: "applicant@karm.demo",
      password: "demo1234",
      role: "applicant",
      department: null,
      phone: "+91 98200 00001",
      createdAt: t0,
      updatedAt: t0,
    },
    {
      _id: "u_app2",
      name: "Rakesh Patel",
      email: "rakesh@karm.demo",
      password: "demo1234",
      role: "applicant",
      department: null,
      phone: null,
      createdAt: t0,
      updatedAt: t0,
    },
    {
      _id: "u_auth1",
      name: "Officer A. Kulkarni",
      email: "authority@karm.demo",
      password: "demo1234",
      role: "authority",
      department: "State Pollution Control Board",
      phone: null,
      createdAt: t0,
      updatedAt: t0,
    },
    {
      _id: "u_auth2",
      name: "Officer R. Menon",
      email: "fire@karm.demo",
      password: "demo1234",
      role: "authority",
      department: "Fire Services",
      phone: null,
      createdAt: t0,
      updatedAt: t0,
    },
    {
      _id: "u_admin",
      name: "Admin User",
      email: "admin@karm.demo",
      password: "demo1234",
      role: "admin",
      department: "Industries Department",
      phone: null,
      createdAt: t0,
      updatedAt: t0,
    },
  ];

  const approvalTypes: ApprovalType[] = [
    {
      _id: "at_cte",
      name: "Consent to Establish",
      department: "State Pollution Control Board",
      slaDays: 45,
      isActive: true,
      description: "Sample consent required before setting up a unit with emissions or effluents.",
      requiredDocuments: [
        { docType: "project_report", label: "Detailed project report", required: true },
        { docType: "site_plan", label: "Site plan", required: true },
        { docType: "water_source", label: "Water source declaration", required: false },
      ],
      createdAt: t0,
      updatedAt: t0,
    },
    {
      _id: "at_fire",
      name: "Fire NOC",
      department: "Fire Services",
      slaDays: 21,
      isActive: true,
      description: "Sample fire safety no-objection certificate for the premises.",
      requiredDocuments: [
        { docType: "building_plan", label: "Approved building plan", required: true },
        { docType: "fire_safety_plan", label: "Fire safety plan", required: true },
      ],
      createdAt: t0,
      updatedAt: t0,
    },
    {
      _id: "at_factory",
      name: "Factory Licence",
      department: "Labour Department",
      slaDays: 30,
      isActive: true,
      description: "Sample registration and licence under factory rules.",
      requiredDocuments: [
        { docType: "ownership_proof", label: "Proof of premises ownership/lease", required: true },
        { docType: "machinery_list", label: "List of machinery", required: true },
      ],
      createdAt: t0,
      updatedAt: t0,
    },
    {
      _id: "at_gst",
      name: "GST Registration",
      department: "Commercial Taxes",
      slaDays: 7,
      isActive: true,
      description: "Sample tax registration for the business entity.",
      requiredDocuments: [
        { docType: "pan", label: "PAN card", required: true },
        { docType: "address_proof", label: "Address proof", required: true },
      ],
      createdAt: t0,
      updatedAt: t0,
    },
    {
      _id: "at_trade",
      name: "Trade Licence",
      department: "Municipal Corporation",
      slaDays: 15,
      isActive: true,
      description: "Sample local body licence to operate at the premises.",
      requiredDocuments: [
        { docType: "address_proof", label: "Address proof", required: true },
        { docType: "ownership_proof", label: "Proof of premises ownership/lease", required: true },
      ],
      createdAt: t0,
      updatedAt: t0,
    },
    {
      _id: "at_shops",
      name: "Shops & Establishment Registration",
      department: "Labour Department",
      slaDays: 10,
      isActive: true,
      description: "Sample registration for service and retail establishments.",
      requiredDocuments: [{ docType: "address_proof", label: "Address proof", required: true }],
      createdAt: t0,
      updatedAt: t0,
    },
    {
      _id: "at_udyam",
      name: "Business Registration (Udyam)",
      department: "MSME",
      slaDays: 7,
      isActive: true,
      description: "Illustrative example entry — verify real requirements before demo use.",
      requiredDocuments: [
        { docType: "pan_card", label: "PAN Card", required: true },
        { docType: "address_proof", label: "Address Proof", required: true },
      ],
      createdAt: t0,
      updatedAt: t0,
    },
    {
      _id: "at_pollution",
      name: "Pollution Control Consent (Consent to Establish)",
      department: "Maharashtra Pollution Control Board",
      slaDays: 21,
      isActive: true,
      description: "Illustrative example entry — verify real requirements before demo use.",
      requiredDocuments: [
        { docType: "site_plan", label: "Site Layout Plan", required: true },
        { docType: "project_report", label: "Project Report", required: true },
      ],
      createdAt: t0,
      updatedAt: t0,
    },
    {
      _id: "at_domain_fire",
      name: "Fire NOC",
      department: "Fire Department",
      slaDays: 15,
      isActive: true,
      description: "Illustrative example entry — verify real requirements before demo use.",
      requiredDocuments: [
        { docType: "building_plan", label: "Building Plan", required: true },
        { docType: "fire_safety_cert", label: "Fire Safety Equipment Certificate", required: false },
      ],
      createdAt: t0,
      updatedAt: t0,
    },
    {
      _id: "at_domain_factory",
      name: "Factory Licence",
      department: "Directorate of Industrial Safety and Health",
      slaDays: 30,
      isActive: true,
      description: "Illustrative example entry — verify real requirements before demo use.",
      requiredDocuments: [
        { docType: "site_plan", label: "Factory Layout Plan", required: true },
        {
          docType: "proof_of_ownership",
          label: "Proof of Premises Ownership/Lease",
          required: true,
        },
      ],
      createdAt: t0,
      updatedAt: t0,
    },
    {
      _id: "at_power",
      name: "Power Connection Clearance",
      department: "MSEDCL",
      slaDays: 10,
      isActive: true,
      description: "Illustrative example entry — verify real requirements before demo use.",
      requiredDocuments: [
        { docType: "load_requirement", label: "Load Requirement Document", required: true },
      ],
      createdAt: t0,
      updatedAt: t0,
    },
  ];

  const profiles: BusinessProfile[] = [
    {
      _id: "bp_1",
      userId: "u_app1",
      businessName: "Sharma Precision Components",
      sector: "Manufacturing",
      location: { state: "Maharashtra", district: "Pune" },
      projectSize: "small",
      stage: "new",
      createdAt: ago(60),
      updatedAt: ago(60),
    },
    {
      _id: "bp_2",
      userId: "u_app2",
      businessName: "Patel Agro Foods",
      sector: "Food Processing",
      location: { state: "Gujarat", district: "Anand" },
      projectSize: "medium",
      stage: "expansion",
      createdAt: ago(80),
      updatedAt: ago(80),
    },
  ];

  const doc = (
    docType: string,
    d: number,
    status: "passed" | "failed" = "passed",
    notes: string[] = [],
  ) => ({
    docType,
    fileUrl: `sample://${docType}.pdf`,
    uploadedAt: ago(d),
    preValidationStatus: status,
    preValidationNotes: notes,
    riskBrief: null,
  });
  const h = (
    action: string,
    by: string,
    role: string,
    d: number,
    reason: string | null = null,
  ) => ({ action, byUserId: by, byRole: role, reason, timestamp: ago(d) });

  const s1 = ago(36),
    s2 = ago(18),
    s3 = ago(9),
    s4 = ago(52),
    s5 = ago(12);
  const applications: Application[] = [
    {
      _id: "ap_1001",
      applicantId: "u_app1",
      businessProfileId: "bp_1",
      overallStatus: "action_required",
      createdAt: ago(40),
      updatedAt: ago(2),
      approvalItems: [
        {
          _id: "it_1",
          approvalTypeId: "at_cte",
          status: "in_review",
          assignedOfficerId: "u_auth1",
          submittedAt: s1,
          slaDeadline: after(s1, 45),
          documents: [doc("project_report", 37), doc("site_plan", 37)],
          history: [
            h("created", "u_app1", "applicant", 40),
            h("submitted", "u_app1", "applicant", 36),
            h("review_started", "u_auth1", "authority", 30),
          ],
        },
        {
          _id: "it_2",
          approvalTypeId: "at_fire",
          status: "query_raised",
          assignedOfficerId: "u_auth2",
          submittedAt: s2,
          slaDeadline: after(s2, 21),
          documents: [doc("building_plan", 19), doc("fire_safety_plan", 19)],
          history: [
            h("created", "u_app1", "applicant", 40),
            h("submitted", "u_app1", "applicant", 18),
            h(
              "request_reupload",
              "u_auth2",
              "authority",
              2,
              "Fire safety plan is missing the exit-route layout for the second floor.",
            ),
          ],
        },
        {
          _id: "it_3",
          approvalTypeId: "at_gst",
          status: "approved",
          assignedOfficerId: null,
          submittedAt: s3,
          slaDeadline: after(s3, 7),
          documents: [doc("pan", 10), doc("address_proof", 10)],
          history: [
            h("created", "u_app1", "applicant", 40),
            h("submitted", "u_app1", "applicant", 9),
            h("approve", "u_admin", "authority", 5),
          ],
        },
      ],
    },
    {
      _id: "ap_1002",
      applicantId: "u_app2",
      businessProfileId: "bp_2",
      overallStatus: "in_progress",
      createdAt: ago(55),
      updatedAt: ago(10),
      approvalItems: [
        {
          _id: "it_4",
          approvalTypeId: "at_cte",
          status: "in_review",
          assignedOfficerId: "u_auth1",
          submittedAt: s4,
          slaDeadline: after(s4, 45),
          documents: [
            doc("project_report", 53),
            doc("site_plan", 53, "failed", ["Site plan appears to be older than 12 months."]),
            doc("water_source", 53),
          ],
          history: [
            h("created", "u_app2", "applicant", 55),
            h("submitted", "u_app2", "applicant", 52),
            h("review_started", "u_auth1", "authority", 45),
          ],
        },
        {
          _id: "it_5",
          approvalTypeId: "at_factory",
          status: "submitted",
          assignedOfficerId: null,
          submittedAt: s5,
          slaDeadline: after(s5, 30),
          documents: [doc("ownership_proof", 13), doc("machinery_list", 13)],
          history: [
            h("created", "u_app2", "applicant", 55),
            h("submitted", "u_app2", "applicant", 12),
          ],
        },
      ],
    },
    {
      _id: "ap_1003",
      applicantId: "u_app2",
      businessProfileId: "bp_2",
      overallStatus: "rejected",
      createdAt: ago(100),
      updatedAt: ago(70),
      approvalItems: [
        {
          _id: "it_6",
          approvalTypeId: "at_cte",
          status: "rejected",
          assignedOfficerId: "u_auth1",
          submittedAt: ago(98),
          slaDeadline: after(ago(98), 45),
          documents: [doc("project_report", 99)],
          history: [
            h("created", "u_app2", "applicant", 100),
            h("submitted", "u_app2", "applicant", 98),
            h("reject", "u_auth1", "authority", 70, "Effluent treatment capacity not specified"),
          ],
        },
      ],
    },
    {
      _id: "ap_1004",
      applicantId: "u_app2",
      businessProfileId: "bp_2",
      overallStatus: "in_progress",
      createdAt: ago(8),
      updatedAt: ago(6),
      approvalItems: [
        {
          _id: "it_7",
          approvalTypeId: "at_cte",
          status: "submitted",
          assignedOfficerId: null,
          submittedAt: ago(6),
          slaDeadline: after(ago(6), 45),
          documents: [doc("project_report", 7), doc("site_plan", 7)],
          history: [
            h("created", "u_app2", "applicant", 8),
            h("submitted", "u_app2", "applicant", 6),
          ],
        },
      ],
    },
  ];

  const notifications: Notification[] = [
    {
      _id: "n_1",
      userId: "u_app1",
      type: "query_raised",
      message: "Fire NOC: officer requested a re-upload of your fire safety plan.",
      read: false,
      createdAt: ago(2),
    },
    {
      _id: "n_2",
      userId: "u_app1",
      type: "approved",
      message: "GST Registration has been approved.",
      read: true,
      createdAt: ago(5),
    },
    {
      _id: "n_3",
      userId: "u_auth1",
      type: "sla_nearing",
      message: "Application ap_1002 · Consent to Establish is past its SLA deadline.",
      read: false,
      createdAt: ago(1),
    },
  ];

  const rules: Record<string, string[]> = {
    Manufacturing: [
      "at_udyam",
      "at_pollution",
      "at_domain_fire",
      "at_domain_factory",
      "at_power",
    ],
    "Food Processing": ["at_udyam", "at_domain_fire", "at_domain_factory", "at_power"],
    Textiles: ["at_udyam"],
    "IT/Software Services": ["at_udyam"],
    Chemicals: ["at_udyam", "at_pollution", "at_domain_fire", "at_domain_factory", "at_power"],
    Pharmaceuticals: ["at_udyam"],
    "Warehousing/Logistics": ["at_udyam"],
    "Renewable Energy": ["at_udyam"],
  };

  return { users, profiles, approvalTypes, applications, notifications, rules };
}
