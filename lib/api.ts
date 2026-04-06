import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Base configuration ───────────────────────────────────────────────────────

export function getApiUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) {
    if (__DEV__) console.warn("EXPO_PUBLIC_DOMAIN is not set — API calls will fail");
    return "";
  }
  // Support full URLs (http://...) or plain domains (defaults to https)
  if (domain.startsWith("http://") || domain.startsWith("https://")) {
    return domain.replace(/\/+$/, "");
  }
  return `https://${domain}`;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

/**
 * Makes an authenticated API request.
 * Reads the auth token from AsyncStorage and attaches it as a Bearer header.
 * Throws `ApiError` for non-2xx responses.
 */
export async function apiReq<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await AsyncStorage.getItem("auth_token");
  const base = getApiUrl();

  const res = await fetch(`${base}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(
      res.status,
      (body as any)?.error ?? `HTTP ${res.status}`,
      body
    );
  }

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  branchId: number | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return apiReq<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getMe(): Promise<AuthUser> {
  return apiReq<AuthUser>("/auth/me");
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  activeOrders: number;
  totalClients: number;
  lowStockItems: number;
  monthlyRevenue: number;
  recentOrders: unknown[];
}

export function getDashboardStats(): Promise<DashboardStats> {
  return apiReq<DashboardStats>("/reports/dashboard");
}

export interface DealStats {
  pipeline: Array<{ key: string; label: string; count: number; color: string }>;
  totalNarx: number;
  totalQarz: number;
  totalDeals: number;
  closedThisMonth: number;
}

export function getDealStats(): Promise<DealStats> {
  return apiReq<DealStats>("/stats/deals");
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface NotificationItem {
  id: string;
  type: string;
  priority: "high" | "medium" | "low";
  title: string;
  message: string;
  deal?: Record<string, unknown>;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  overdue: number;
  upcoming: number;
}

export function getNotifications(): Promise<NotificationsResponse> {
  return apiReq<NotificationsResponse>("/notifications");
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export interface Client {
  id: number;
  fullName: string;
  phone: string;
  address: string | null;
  totalDebt: number;
  branchId: number | null;
  createdAt: string;
}

export function getClients(search?: string): Promise<Client[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiReq<Client[]>(`/clients${qs}`);
}

export function getClient(id: number): Promise<Client> {
  return apiReq<Client>(`/clients/${id}`);
}

export interface CreateClientData {
  fullName: string;
  phone: string;
  address?: string;
  branchId?: number;
}

export function createClient(data: CreateClientData): Promise<Client> {
  return apiReq<Client>("/clients", { method: "POST", body: JSON.stringify(data) });
}

// ─── Client Deals (Kanban) ────────────────────────────────────────────────────

export interface ClientDeal {
  id: number;
  mijozIsm: string | null;
  mijozPhone: string | null;
  manzil: string | null;
  status: string;
  totalNarx: number;
  zaklatSumma: number;
  qarzSumma: number;
  tayyorBolishKuni: string | null;
  branchId: number | null;
  tailorWorkerId: number | null;
  installerWorkerId: number | null;
  createdAt: string;
  tailor?: Record<string, unknown> | null;
  installer?: Record<string, unknown> | null;
}

export interface KanbanColumns {
  yangi: ClientDeal[];
  tikuvda: ClientDeal[];
  tayyor: ClientDeal[];
  ornatilmoqda: ClientDeal[];
  yopildi: ClientDeal[];
}

export interface KanbanResponse {
  columns: KanbanColumns;
  total: number;
}

export function getKanban(): Promise<KanbanResponse> {
  return apiReq<KanbanResponse>("/kanban");
}

export function updateDealStatus(id: number, status: string): Promise<ClientDeal> {
  return apiReq<ClientDeal>(`/kanban/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ─── Products ─────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  category: string;
  unit: string;
  barcode: string;
  pricePerUnit: number;
  buyingPrice: number;
  stock: number;
  minStock: number;
  branchId: number | null;
  description: string | null;
  rang: string | null;
  material: string | null;
  createdAt: string;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
}

export function getProducts(params?: {
  category?: string;
  search?: string;
  barcode?: string;
  limit?: number;
}): Promise<ProductsResponse> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set("category", params.category);
  if (params?.search) qs.set("search", params.search);
  if (params?.barcode) qs.set("barcode", params.barcode);
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiReq<ProductsResponse>(`/products${query}`);
}

export function getProductByBarcode(barcode: string): Promise<Product> {
  return apiReq<Product>(`/product/${barcode}`);
}

export interface CreateProductData {
  name: string;
  category: string;
  unit?: string;
  pricePerUnit: number;
  buyingPrice?: number;
  stock?: number;
  minStock?: number;
  branchId?: number;
  description?: string;
  rang?: string;
  material?: string;
}

export function createProduct(data: CreateProductData): Promise<Product> {
  return apiReq<Product>("/products", { method: "POST", body: JSON.stringify(data) });
}

// ─── Categories ───────────────────────────────────────────────────────────────

export interface Category {
  key: string;
  label: string;
  emoji: string;
  isDefault: boolean;
}

export function getCategories(): Promise<Category[]> {
  return apiReq<Category[]>("/categories");
}

// ─── Workers ─────────────────────────────────────────────────────────────────

export interface Worker {
  id: number;
  fullName: string;
  role: string;
  phone: string | null;
  telegramChatId: string | null;
  branchId: number | null;
  isActive: boolean;
}

export function getWorkers(role?: string): Promise<Worker[]> {
  const qs = role ? `?role=${role}` : "";
  return apiReq<Worker[]>(`/workers${qs}`);
}

// ─── Installation Schedule ────────────────────────────────────────────────────

export function getSchedule(params?: { workerId?: number; date?: string }) {
  const qs = new URLSearchParams();
  if (params?.workerId) qs.set("workerId", String(params.workerId));
  if (params?.date) qs.set("date", params.date);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiReq(`/installer/schedule${query}`);
}

// ─── Finance ─────────────────────────────────────────────────────────────────

export interface Transaction {
  id: number;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  branchId: number | null;
  createdAt: string;
}

export function getTransactions(params?: {
  type?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<Transaction[]> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiReq<Transaction[]>(`/finance${query}`);
}
