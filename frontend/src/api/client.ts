// Single API client for KARM. One function per endpoint in backend-architecture.md §4.
// If VITE_API_BASE_URL is set, calls the real backend; otherwise uses the in-browser
// mock (illustrative sample data only). Swapping to the real backend = set the env var.
import { ApiError, mock } from "./mock";
import type {
  Analytics,
  Application,
  ApplicationDocument,
  ApprovalItem,
  ApprovalType,
  BusinessProfile,
  Decision,
  Notification,
  PreValidationStatus,
  RiskBrief,
  User,
  Department,
} from "./types";

export { ApiError };

const BASE = (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(/\/$/, "");
export const USING_MOCK = !BASE;
const ASSET_BASE = BASE ?? "http://localhost:4000";
export const assetUrl = (fileUrl: string) =>
  fileUrl.startsWith("http://") ||
  fileUrl.startsWith("https://") ||
  fileUrl.startsWith("blob:") ||
  fileUrl.startsWith("data:")
    ? fileUrl
    : `${ASSET_BASE}${fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`}`;
const TOKEN_KEY = "karm_token";

export const tokenStore = {
  get: () => (typeof localStorage === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function http<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !isForm) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers,
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : null,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.message ?? res.statusText, data.errors ?? []);
  return data as T;
}

const form = (file: File, docType?: string) => {
  const f = new FormData();
  f.append("file", file);
  if (docType) f.append("docType", docType);
  return f;
};
const qs = (q: Record<string, string | undefined>) => {
  const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]);
  const s = p.toString();
  return s ? `?${s}` : "";
};
const t = () => tokenStore.get();

export const api = {
  auth: {
    register: (b: { name: string; email: string; password: string }): Promise<{ user: User }> =>
      USING_MOCK ? mock.register(b) : http("POST", "/auth/register", b),
    login: (b: { email: string; password: string }): Promise<{ token: string; user: User }> =>
      USING_MOCK ? mock.login(b) : http("POST", "/auth/login", b),
    me: (): Promise<{ user: User }> => (USING_MOCK ? mock.me(t()) : http("GET", "/auth/me")),
  },
  profile: {
    get: (): Promise<{ profile: BusinessProfile }> =>
      USING_MOCK ? mock.getProfile(t()) : http("GET", "/profile"),
    create: (b: Partial<BusinessProfile>): Promise<{ profile: BusinessProfile }> =>
      USING_MOCK ? mock.createProfile(t(), b) : http("POST", "/profile", b),
    update: (b: Partial<BusinessProfile>): Promise<{ profile: BusinessProfile }> =>
      USING_MOCK ? mock.updateProfile(t(), b) : http("PATCH", "/profile", b),
  },
  checklist: {
    get: (): Promise<{ items: ApprovalType[] }> =>
      USING_MOCK ? mock.getChecklist(t()) : http("GET", "/checklist"),
  },
  departments: {
    list: (): Promise<{ departments: Department[] }> =>
      USING_MOCK ? Promise.resolve({ departments: [] }) : http("GET", "/departments"),
    services: (departmentId: string): Promise<{ department: Department; services: ApprovalType[] }> =>
      USING_MOCK
        ? Promise.resolve({ department: {} as Department, services: [] })
        : http("GET", `/departments/${encodeURIComponent(departmentId)}/services`),
  },
  applications: {
    create: (b: {
      businessProfileId: string;
      approvalTypeIds: string[];
    }): Promise<{ application: Application }> =>
      USING_MOCK ? mock.createApplication(t(), b) : http("POST", "/applications", b),
    list: (): Promise<{ applications: Application[] }> =>
      USING_MOCK ? mock.listApplications(t()) : http("GET", "/applications"),
    get: (id: string): Promise<{ application: Application }> =>
      USING_MOCK ? mock.getApplication(t(), id) : http("GET", `/applications/${id}`),
    uploadDocument: (
      id: string,
      itemId: string,
      file: File,
      docType: string,
    ): Promise<{
      document: ApplicationDocument;
      preValidationResult: { status: PreValidationStatus; notes: string[] };
    }> =>
      USING_MOCK
        ? mock.uploadDocument(t(), id, itemId, file, docType)
        : http("POST", `/applications/${id}/items/${itemId}/documents`, form(file, docType), true),
    submit: (id: string): Promise<{ application: Application }> =>
      USING_MOCK ? mock.submitApplication(t(), id) : http("POST", `/applications/${id}/submit`),
    withdraw: (id: string): Promise<void> =>
      USING_MOCK ? mock.withdrawApplication(t(), id) : http("DELETE", `/applications/${id}`),
    // Contract lists body as "multipart file"; docType is sent too so the backend knows which slot is replaced.
    reupload: (
      id: string,
      itemId: string,
      file: File,
      docType: string,
    ): Promise<{ document: ApplicationDocument }> =>
      USING_MOCK
        ? mock.reupload(t(), id, itemId, file, docType)
        : http("POST", `/applications/${id}/items/${itemId}/reupload`, form(file, docType), true),
  },
  authority: {
    list: (
      q: { department?: string; status?: string; slaRisk?: string } = {},
    ): Promise<{ applications: Application[] }> =>
      USING_MOCK ? mock.authorityList(t(), q) : http("GET", `/authority/applications${qs(q)}`),
    get: (id: string): Promise<{ application: Application }> =>
      USING_MOCK ? mock.authorityGet(t(), id) : http("GET", `/authority/applications/${id}`),
    riskBrief: (id: string, itemId: string): Promise<{ riskBrief: RiskBrief }> =>
      USING_MOCK
        ? mock.riskBrief(t(), id, itemId)
        : http("GET", `/authority/applications/${id}/items/${itemId}/risk-brief`),
    decide: (
      id: string,
      itemId: string,
      b: { decision: Decision; reason: string },
    ): Promise<{ applicationItem: ApprovalItem }> =>
      USING_MOCK
        ? mock.decide(t(), id, itemId, b)
        : http("POST", `/authority/applications/${id}/items/${itemId}/decision`, b),
    verifyDocument: (
      id: string,
      itemId: string,
      docType: string,
      b: { status: "verified" | "invalid"; notes?: string },
    ): Promise<{ document: ApplicationDocument }> =>
      USING_MOCK
        ? Promise.reject(new ApiError(501, "Document verification requires the backend"))
        : http(
            "POST",
            `/authority/applications/${id}/items/${itemId}/documents/${encodeURIComponent(docType)}/verification`,
            b,
          ),
  },
  admin: {
    departments: (): Promise<{ departments: Department[] }> =>
      USING_MOCK ? Promise.resolve({ departments: [] }) : http("GET", "/admin/departments"),
    authorities: (): Promise<{ authorities: unknown[] }> =>
      USING_MOCK ? Promise.resolve({ authorities: [] }) : http("GET", "/admin/authorities"),
    listApprovalTypes: (): Promise<ApprovalType[]> =>
      USING_MOCK ? mock.adminListTypes(t()) : http("GET", "/admin/approval-types"),
    createApprovalType: (b: Partial<ApprovalType>): Promise<ApprovalType> =>
      USING_MOCK ? mock.adminCreateType(t(), b) : http("POST", "/admin/approval-types", b),
    updateApprovalType: (id: string, b: Partial<ApprovalType>): Promise<ApprovalType> =>
      USING_MOCK
        ? mock.adminUpdateType(t(), id, b)
        : http("PATCH", `/admin/approval-types/${id}`, b),
    deleteApprovalType: (id: string): Promise<void> =>
      USING_MOCK ? mock.adminDeleteType(t(), id) : http("DELETE", `/admin/approval-types/${id}`),
    users: (): Promise<{ users: User[] }> =>
      USING_MOCK ? mock.adminUsers(t()) : http("GET", "/admin/users"),
    // NEEDS DECISION: not in contract yet — proposed PATCH /admin/users/:id for role/department edits.
    updateUser: (
      id: string,
      b: Partial<Pick<User, "role" | "department">>,
    ): Promise<{ user: User }> =>
      USING_MOCK ? mock.adminUpdateUser(t(), id, b) : http("PATCH", `/admin/users/${id}`, b),
    analytics: (): Promise<Analytics> =>
      USING_MOCK ? mock.analytics(t()) : http("GET", "/admin/analytics"),
  },
  // NEEDS DECISION: notification endpoints are not in the contract yet. Proposed:
  // GET /notifications → {notifications}, PATCH /notifications/:id/read → {notification}
  notifications: {
    list: (): Promise<{ notifications: Notification[] }> =>
      USING_MOCK ? mock.notifications(t()) : http("GET", "/notifications"),
    markRead: (id: string): Promise<{ notification: Notification }> =>
      USING_MOCK ? mock.markRead(t(), id) : http("PATCH", `/notifications/${id}/read`),
  },
};

export function errorMessage(e: unknown) {
  if (e instanceof ApiError)
    return e.errors.length ? e.errors.map((x) => x.message).join(" · ") : e.message;
  return e instanceof Error ? e.message : "Something went wrong";
}
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError)) return {};
  return Object.fromEntries(e.errors.map((x) => [x.field, x.message]));
}
