// Typed API client.
//
// Content resources (projects, properties, gallery, testimonials, faqs,
// leadership, achievements, services, land, company, contact) are still
// backed by Sanity — unchanged.
//
// CRM resources (clients, subscriptions, payments, enquiries, users,
// auditLog, documents, projectUpdates) now hit the NestJS REST API at
// VITE_API_BASE_URL (default: http://localhost:4000/api).
//
// The method signatures are identical to the old mock client so no
// component code needs to change.

import { makeSanityCrud, makeSingletonAccess } from "../sanity/crud";
import { RESOURCES, SINGLETONS } from "../sanity/resources";
import type {
  Achievement,
  AuditLog,
  Client,
  CompanyInfo,
  ContactInfo,
  Enquiry,
  FAQ,
  GalleryItem,
  HomepageSection,
  Land,
  LeadershipEntry,
  Project,
  ProjectUpdate,
  Property,
  SEOMetadata,
  Service,
  Subscription,
  SubscriberDocument,
  Testimonial,
  User,
  SanityJournalEntry,
} from "./types";

// ── HTTP helper ──────────────────────────────────────────────────────────────

const BASE = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:4000/api";

// Token is no longer stored at module level.
// Each auth context (AdminAuthProvider / PortalAuthProvider) holds its own
// token in a ref inside the React tree. The req() function accepts the token
// directly, and callers that don't supply it fall back to a context lookup.
//
// For backwards compatibility, components that call api.* directly (outside
// of a mutation) still work because the token is threaded through the context.
// The 401 handler reads the current URL to decide where to redirect.

/** Determine the correct login redirect path based on the current URL. */
function loginRedirectPath(): string {
  if (typeof window === "undefined") return "/admin/login";
  return window.location.pathname.startsWith("/portal") ? "/portal/login" : "/admin/login";
}

/** Determine the correct silent-refresh URL based on the current URL. */
function refreshEndpoint(): string {
  if (typeof window === "undefined") return "/auth/refresh";
  return window.location.pathname.startsWith("/portal") ? "/auth/portal/refresh" : "/auth/refresh";
}

// The active access token is injected by each auth context via this setter.
// Admin context sets adminToken; portal context sets portalToken.
// req() picks the right one based on the current URL.
let _adminToken: string | null = null;
let _portalToken: string | null = null;

export function setAdminToken(t: string | null) {
  _adminToken = t;
}
export function setPortalToken(t: string | null) {
  _portalToken = t;
}

/** @deprecated Use setAdminToken / setPortalToken — kept for compatibility. */
export function setAccessToken(t: string | null) {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/portal")) {
    _portalToken = t;
  } else {
    _adminToken = t;
  }
}
export function getAccessToken() {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/portal")) {
    return _portalToken;
  }
  return _adminToken;
}

function activeToken(): string | null {
  if (typeof window === "undefined") return _adminToken;
  return window.location.pathname.startsWith("/portal") ? _portalToken : _adminToken;
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  options: { formData?: FormData; noAuth?: boolean } = {},
): Promise<T> {
  const headers: HeadersInit = {};
  const token = activeToken();

  if (!options.noAuth && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (body && !options.formData) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers,
    body: options.formData ? options.formData : body ? JSON.stringify(body) : undefined,
  });

  // 401 — attempt one silent refresh using the context-appropriate endpoint,
  // then retry. If that also fails, send the user to the correct login page.
  if (res.status === 401 && !options.noAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return req<T>(method, path, body, { ...options, noAuth: false });
    }
    if (typeof window !== "undefined") {
      window.location.href = loginRedirectPath();
    }
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  try {
    const endpoint = refreshEndpoint();
    const res = await fetch(`${BASE}${endpoint}`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    // Store in the correct slot
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/portal")) {
      _portalToken = data.accessToken;
    } else {
      _adminToken = data.accessToken;
    }
    return true;
  } catch {
    return false;
  }
}

// ── Generic REST CRUD factory (mirrors makeMockCrud shape) ──────────────────

function makeRestCrud<T extends { id?: string; _id?: string }>(resource: string) {
  // Normalise _id → id for Mongoose documents
  const norm = (doc: any): T => {
    if (doc && doc._id && !doc.id) doc.id = doc._id;
    return doc as T;
  };
  const normList = (docs: any[]): T[] => docs.map(norm);

  return {
    async list(params?: Record<string, string>): Promise<T[]> {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return req<any[]>("GET", `/${resource}${qs}`).then(normList);
    },
    async get(id: string): Promise<T | undefined> {
      try {
        return req<any>("GET", `/${resource}/${id}`).then(norm);
      } catch {
        return undefined;
      }
    },
    async create(input: Partial<T>): Promise<T> {
      return req<any>("POST", `/${resource}`, input).then(norm);
    },
    async update(id: string, patch: Partial<T>): Promise<T> {
      return req<any>("PATCH", `/${resource}/${id}`, patch).then(norm);
    },
    async remove(id: string): Promise<void> {
      await req<void>("DELETE", `/${resource}/${id}`);
    },
  };
}

// ── Sanity-backed content resources (unchanged) ───────────────────────────────

const companyAccess = makeSingletonAccess<CompanyInfo>(SINGLETONS.company);
const contactAccess = makeSingletonAccess<ContactInfo>(SINGLETONS.contact);

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  // ── Sanity content resources ──────────────────────────────────────────────
  projects: makeSanityCrud<Project>(RESOURCES.projects),
  properties: makeSanityCrud<Property>(RESOURCES.properties),
  gallery: makeSanityCrud<GalleryItem>(RESOURCES.gallery),
  testimonials: makeSanityCrud<Testimonial>(RESOURCES.testimonials),
  faqs: makeSanityCrud<FAQ>(RESOURCES.faqs),
  leadership: makeSanityCrud<LeadershipEntry>(RESOURCES.leadership),
  achievements: makeSanityCrud<Achievement>(RESOURCES.achievements),
  services: makeSanityCrud<Service>(RESOURCES.services),
  land: makeSanityCrud<Land>(RESOURCES.land),
  journal: makeSanityCrud<SanityJournalEntry>(RESOURCES.journal),

  // ── Sanity singletons ─────────────────────────────────────────────────────
  async getCompany(): Promise<CompanyInfo> {
    return companyAccess.get();
  },
  async updateCompany(p: Partial<CompanyInfo>) {
    return companyAccess.update(p);
  },
  async getContact(): Promise<ContactInfo> {
    return contactAccess.get();
  },
  async updateContact(p: Partial<ContactInfo>) {
    return contactAccess.update(p);
  },

  // ── CRM: Users ────────────────────────────────────────────────────────────
  users: {
    ...makeRestCrud<User>("users"),
    async list(): Promise<User[]> {
      // Users endpoint still returns a plain array (no pagination needed — typically small set)
      const res = await req<any>("GET", "/users");
      const arr = Array.isArray(res) ? res : (res?.data ?? []);
      return arr.map((u: any) => {
        if (u._id && !u.id) u.id = u._id;
        return u as User;
      });
    },
  },

  // ── CRM: Clients ──────────────────────────────────────────────────────────
  clients: {
    ...makeRestCrud<Client>("clients"),
    async list(params?: {
      q?: string;
      status?: string;
      page?: number;
      limit?: number;
    }): Promise<{ data: Client[]; total: number; page: number; limit: number }> {
      const qs = params
        ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(params)
              .filter(([, v]) => v != null && v !== "")
              .map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
        : "";
      return req<{ data: any[]; total: number; page: number; limit: number }>(
        "GET",
        `/clients${qs}`,
      );
    },
    // Bulk import — sends parsed rows
    async import(rows: Partial<Client>[]) {
      return req<{ imported: number; errors: { row: number; error: string }[] }>(
        "POST",
        "/clients/import",
        { rows },
      );
    },
    // KYC file upload
    async uploadKyc(
      clientId: string,
      field: "idDocumentUrl" | "utilityBillUrl" | "passportPhotoUrl",
      file: File,
    ) {
      const fd = new FormData();
      fd.append("file", file);
      return req<{ publicId: string; secureUrl: string }>(
        "POST",
        `/clients/${clientId}/kyc/${field}`,
        undefined,
        { formData: fd },
      );
    },
  },

  // ── CRM: Subscriptions ────────────────────────────────────────────────────
  subscriptions: {
    ...makeRestCrud<Subscription>("subscriptions"),
    async list(params?: {
      clientId?: string;
      status?: string;
      projectRef?: string;
      page?: number;
      limit?: number;
    }): Promise<{ data: Subscription[]; total: number; page: number; limit: number }> {
      const qs = params
        ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(params)
              .filter(([, v]) => v != null && v !== "")
              .map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
        : "";
      return req<{ data: any[]; total: number; page: number; limit: number }>(
        "GET",
        `/subscriptions${qs}`,
      );
    },
  },

  subscriptionsForClient: async (clientId: string): Promise<Subscription[]> => {
    const res = await req<{ data: Subscription[]; total: number } | Subscription[]>(
      "GET",
      `/subscriptions?clientId=${clientId}&limit=100`,
    );
    return Array.isArray(res) ? res : res.data;
  },

  // ── CRM: Payments ─────────────────────────────────────────────────────────
  payments: {
    ...makeRestCrud<{
      id: string;
      clientId: string;
      subscriptionId?: string;
      date: string;
      label: string;
      amount: number;
      currency: string;
    }>("payments"),
    async list(params?: { page?: number; limit?: number }) {
      const qs = params
        ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(params)
              .filter(([, v]) => v != null)
              .map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
        : "";
      return req<{ data: any[]; total: number; page: number; limit: number }>(
        "GET",
        `/payments${qs}`,
      );
    },
    async byClient(clientId: string) {
      return req<any[]>("GET", `/payments/by-client/${clientId}`);
    },
    async bySubscription(subscriptionId: string) {
      return req<any[]>("GET", `/payments/by-subscription/${subscriptionId}`);
    },
    async record(input: {
      clientId: string;
      subscriptionId: string;
      date: string;
      label: string;
      amount: number;
      currency: string;
    }) {
      return req<any>("POST", "/payments", input);
    },
    async reverse(paymentId: string) {
      return req<{ ok: boolean }>("POST", `/payments/${paymentId}/reverse`);
    },
  },

  // ── CRM: Receipts ─────────────────────────────────────────────────────────
  receipts: {
    ...makeRestCrud<{
      id: string;
      receiptNumber: string;
      dateIssued: string;
      clientId: string;
      paymentDescription: string;
      amountReceived: number;
      paymentEntries: Array<{
        paymentDate: string;
        paymentMethod: string;
        bankName?: string;
        accountNumber?: string;
        amount: number;
      }>;
      totalPaid: number;
      amountInWords: string;
      qrCodeData?: string;
      pdfUrl?: string;
      status: 'DRAFT' | 'ISSUED' | 'VOIDED';
    }>("receipts"),
    async list(params?: { page?: number; limit?: number; clientId?: string; status?: string; search?: string }) {
      const qs = params
        ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(params)
              .filter(([, v]) => v != null && v !== "")
              .map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
        : "";
      return req<{ data: any[]; total: number; page: number; limit: number }>(
        "GET",
        `/receipts${qs}`,
      );
    },
    async byClient(clientId: string) {
      return req<any[]>("GET", `/receipts/by-client/${clientId}`);
    },
    async verify(receiptNumber: string) {
      return req<{ receipt: any; client: any }>("GET", `/receipts/verify/${receiptNumber}`, undefined, { noAuth: true });
    },
    async getWithClient(id: string) {
      return req<{ receipt: any; client: any }>("GET", `/receipts/${id}/with-client`);
    },
    async generatePDF(id: string) {
      return req<{ url: string; buffer: string }>("POST", `/receipts/${id}/generate-pdf`);
    },
    async downloadPDF(id: string) {
      const token = activeToken();
      const response = await fetch(`${BASE}/receipts/${id}/download-pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    async void(id: string, reason: string) {
      return req<any>("POST", `/receipts/${id}/void`, { reason });
    },
  },

  // ── CRM: Enquiries ────────────────────────────────────────────────────────
  enquiries: {
    ...makeRestCrud<Enquiry>("enquiries"),
    async list(params?: { status?: string; assignedToId?: string; page?: number; limit?: number }) {
      const qs = params
        ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(params)
              .filter(([, v]) => v != null && v !== "")
              .map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
        : "";
      return req<{ data: any[]; total: number; page: number; limit: number }>(
        "GET",
        `/enquiries${qs}`,
      );
    },
    async createPublic(input: {
      name: string;
      email: string;
      phone?: string;
      message: string;
      propertyId?: string;
    }) {
      return req<Enquiry>("POST", "/enquiries/public", input, { noAuth: true });
    },
  },

  // ── CRM: Documents ────────────────────────────────────────────────────────
  documents: {
    ...makeRestCrud<SubscriberDocument>("documents"),
    async list(params?: { subscriptionId?: string; page?: number; limit?: number }) {
      const parts: string[] = [];
      if (params?.subscriptionId) parts.push(`subscriptionId=${params.subscriptionId}`);
      if (params?.page) parts.push(`page=${params.page}`);
      if (params?.limit) parts.push(`limit=${params.limit}`);
      const qs = parts.length ? `?${parts.join("&")}` : "";
      return req<{ data: any[]; total: number; page: number; limit: number }>(
        "GET",
        `/documents${qs}`,
      );
    },
    async listForSubscription(subscriptionId: string) {
      return req<SubscriberDocument[]>("GET", `/documents/for-subscription/${subscriptionId}`);
    },
    async listForClient(clientId: string) {
      return req<SubscriberDocument[]>("GET", `/documents/for-client/${clientId}`);
    },
    // Upload a document file
    async upload(input: {
      subscriptionId: string;
      label: string;
      visibility: string;
      category: string;
      file: File;
    }) {
      const fd = new FormData();
      fd.append("file", input.file);
      fd.append("subscriptionId", input.subscriptionId);
      fd.append("label", input.label);
      fd.append("visibility", input.visibility);
      fd.append("category", input.category);
      return req<SubscriberDocument & { secureUrl: string }>(
        "POST",
        "/documents/upload",
        undefined,
        { formData: fd },
      );
    },
    // Portal: list subscriber's own documents (visibility-filtered)
    async listPortal() {
      return req<(SubscriberDocument & { visible: boolean; url: string | null })[]>(
        "GET",
        "/documents/portal/my-documents",
      );
    },
    // Portal: get a signed download URL
    async getDownloadUrl(docId: string) {
      return req<{ url: string; expiresIn: number }>("GET", `/documents/portal/${docId}/download`);
    },
    // Admin: create with URL string (legacy compat — used by dialog that accepts a URL)
    async create(input: Partial<SubscriberDocument & { fileUrl?: string }>) {
      // If a fileUrl is provided but no file, store it directly as a legacy document
      return req<SubscriberDocument>("POST", "/documents", input);
    },
  },

  // ── CRM: Project Updates ──────────────────────────────────────────────────
  projectUpdates: {
    ...makeRestCrud<ProjectUpdate>("project-updates"),
    async list(params?: { projectRef?: string; page?: number; limit?: number }) {
      const qs = params
        ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(params)
              .filter(([, v]) => v != null && v !== "")
              .map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
        : "";
      return req<{ data: any[]; total: number; page: number; limit: number }>(
        "GET",
        `/project-updates${qs}`,
      );
    },
    async listForProject(projectRef: string): Promise<ProjectUpdate[]> {
      return req<any[]>("GET", `/project-updates/for-project/${encodeURIComponent(projectRef)}`);
    },
    async listForClient(clientId: string): Promise<ProjectUpdate[]> {
      return req<any[]>("GET", "/project-updates/for-client");
    },
    // Create with optional photo files
    async createWithPhotos(input: {
      projectRef: string;
      projectRefType: "project" | "land";
      text: string;
      photos?: File[];
    }) {
      const fd = new FormData();
      fd.append("projectRef", input.projectRef);
      fd.append("projectRefType", input.projectRefType);
      fd.append("text", input.text);
      if (input.photos) {
        input.photos.forEach((f) => fd.append("photos", f));
      }
      return req<ProjectUpdate>("POST", "/project-updates", undefined, { formData: fd });
    },
  },

  // ── Audit log ─────────────────────────────────────────────────────────────
  auditLog: {
    ...makeRestCrud<AuditLog>("audit-log"),
    async list(params?: { entityType?: string; entityId?: string; page?: number; limit?: number }) {
      const qs = params
        ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(params)
              .filter(([, v]) => v != null && v !== "")
              .map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
        : "";
      return req<{ data: any[]; total: number; page: number; limit: number }>(
        "GET",
        `/audit-log${qs}`,
      );
    },
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  async dashboardStats() {
    const crm = await req<any>("GET", "/dashboard/stats");

    // Merge Sanity content counts (best-effort)
    let publishedProjects = 0;
    let draftProjects = 0;
    try {
      const { sanityRead } = await import("../sanity/read-client");
      const counts = await sanityRead.fetch<{ published: number; draft: number }>(
        `{ "published": count(*[_type == "project" && !(_id in path("drafts.**"))]),
           "draft": count(*[_type == "project" && _id in path("drafts.**")]) }`,
      );
      publishedProjects = counts.published ?? 0;
      draftProjects = counts.draft ?? 0;
    } catch {
      /* ignore */
    }

    return {
      ...crm,
      publishedProjects,
      draftProjects,
      publishedProperties: publishedProjects,
      draftProperties: draftProjects,
    };
  },

  // ── Deferred (homepage sections / SEO) — kept as no-ops until backend grows
  homepageSections: makeRestCrud<HomepageSection>("homepage-sections"),
  seo: makeRestCrud<SEOMetadata>("seo"),

  // ── Subscriber portal (role=SUBSCRIBER self-service) ──────────────────────
  // These endpoints live at /api/portal/* and require only a valid JWT —
  // no admin capability needed. Subscribers can only see their own data.
  portal: {
    /** Fetch the caller's Client record. */
    async getProfile(): Promise<Client> {
      return req<any>("GET", "/portal/me").then((d) => {
        if (d && d._id && !d.id) d.id = d._id;
        return d as Client;
      });
    },

    /** Update contact details / notification prefs / contactConfirmedAt. */
    async updateProfile(patch: {
      email?: string;
      phone?: string;
      contactConfirmedAt?: string;
      notificationPrefs?: { email: boolean; whatsapp: boolean };
    }): Promise<Client> {
      return req<any>("PATCH", "/portal/me", patch).then((d) => {
        if (d && d._id && !d.id) d.id = d._id;
        return d as Client;
      });
    },

    /** All subscriptions belonging to the logged-in subscriber. */
    async listSubscriptions(): Promise<Subscription[]> {
      const list = await req<any[]>("GET", "/portal/subscriptions");
      return list.map((d) => {
        if (d._id && !d.id) d.id = d._id;
        return d as Subscription;
      });
    },

    /** A single subscription (ownership-checked server-side). */
    async getSubscription(id: string): Promise<Subscription> {
      return req<any>("GET", `/portal/subscriptions/${id}`).then((d) => {
        if (d && d._id && !d.id) d.id = d._id;
        return d as Subscription;
      });
    },

    /** All receipts belonging to the logged-in subscriber. */
    async listReceipts() {
      const list = await req<any[]>("GET", "/portal/receipts");
      return list.map((d) => {
        if (d._id && !d.id) d.id = d._id;
        return d;
      });
    },

    /** A single receipt (ownership-checked server-side). */
    async getReceipt(id: string) {
      return req<any>("GET", `/portal/receipts/${id}`).then((d) => {
        if (d && d._id && !d.id) d.id = d._id;
        return d;
      });
    },
  },
};

// ── Re-export types for callers ───────────────────────────────────────────────
export type {
  Achievement,
  AuditLog,
  Client,
  CompanyInfo,
  ContactInfo,
  Enquiry,
  FAQ,
  GalleryItem,
  HomepageSection,
  Land,
  LeadershipEntry,
  Project,
  ProjectUpdate,
  Property,
  SEOMetadata,
  Service,
  SubscriberDocument,
  Subscription,
  Testimonial,
  User,
  SanityJournalEntry,
};
