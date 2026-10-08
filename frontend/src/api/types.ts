// Types mirror backend-architecture.md §3 exactly. Ref fields may arrive
// populated (Mongoose .populate()) or as raw id strings.

export type Role = "applicant" | "authority" | "department_admin" | "admin" | "super_admin";

export interface Department {
  _id: string;
  departmentId: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessProfile {
  _id: string;
  userId: string;
  businessName: string;
  sector: string;
  location: { state: string; district: string };
  projectSize: string;
  stage: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequiredDocument {
  docType: string;
  label: string;
  required: boolean;
}

export interface ApprovalType {
  _id: string;
  name: string;
  department: string;
  requiredDocuments: RequiredDocument[];
  slaDays: number;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ItemStatus =
  "draft" | "submitted" | "in_review" | "query_raised" | "approved" | "rejected";
export type OverallStatus = "draft" | "in_progress" | "action_required" | "approved" | "rejected";
export type PreValidationStatus = "pending" | "passed" | "failed";

export interface RiskBrief {
  score: number;
  summary: string;
  flags: string[];
  generatedAt: string;
}

export interface ApplicationDocument {
  docType: string;
  fileUrl: string;
  originalName?: string;
  mimeType?: string;
  verificationStatus?: "pending" | "verified" | "invalid";
  verificationNotes?: string | null;
  uploadedAt: string;
  preValidationStatus: PreValidationStatus;
  preValidationNotes: string[];
  riskBrief: RiskBrief | null;
}

export interface HistoryEntry {
  action: string;
  byUserId: string;
  byRole: string;
  reason: string | null;
  timestamp: string;
}

export type UserRef = string | Pick<User, "_id" | "name" | "email">;
export type ApprovalTypeRef = string | ApprovalType;

export interface ApprovalItem {
  _id: string;
  approvalTypeId: ApprovalTypeRef;
  status: ItemStatus;
  assignedOfficerId: UserRef | null;
  submittedAt: string | null;
  slaDeadline: string | null;
  documents: ApplicationDocument[];
  history: HistoryEntry[];
}

export interface Application {
  _id: string;
  referenceNumber?: string;
  applicantId: UserRef;
  businessProfileId: string;
  departmentId: string;
  approvalItems: ApprovalItem[];
  overallStatus: OverallStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  _id: string;
  userId: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export type Decision = "approve" | "reject" | "request_reupload";
export type SlaRisk = "on_track" | "nearing" | "breached";

export interface Analytics {
  avgDaysByApprovalType: { approvalType: string; avgDays: number }[];
  bottlenecks: { approvalType: string; department: string; pending: number; breached: number }[];
  rejectionReasons: { reason: string; count: number }[];
}

export interface FieldError {
  field: string;
  message: string;
}
