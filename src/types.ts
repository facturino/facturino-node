// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface FacturinoConfig {
  /** API base URL. Defaults to https://facturino.com/api */
  baseUrl?: string
  /** Max retries on 429/5xx (default: 3). */
  maxRetries?: number
  /** Timeout in ms (default: 30000). */
  timeout?: number
  /** API version header (default: "2026-02-01"). */
  apiVersion?: string
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

export interface RequestOptions {
  idempotencyKey?: string
}

export interface PaginationParams {
  limit?: number
  starting_after?: string
  ending_before?: string
}

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  object: 'list'
  url: string
  data: T[]
  has_more: boolean
  next_cursor: string | null
}

export interface ApiErrorBody {
  error: {
    type: string
    code: string
    message: string
    param?: string
    doc_url?: string
    request_id: string
    hint?: string
  }
}

// ---------------------------------------------------------------------------
// Shared value objects
// ---------------------------------------------------------------------------

export interface Address {
  line1: string
  line2?: string
  postalCode: string
  city: string
  country: string
}

export interface Contact {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  role?: string
}

export interface LineItem {
  id: string
  description: string
  quantity: string
  unit: Unit
  unitPrice: string
  discountPercent: string
  lineAmount: string
  vatRate: string
  vatCode: VatCode
  vatAmount: string
  lineTotal: string
  product: string | null
}

export interface VatBreakdown {
  rate: string
  code: VatCode
  base: string
  amount: string
}

export interface Totals {
  totalHT: string
  discountAmount: string
  vatBreakdown: VatBreakdown[]
  totalVAT: string
  totalTTC: string
  amountDue: string
  amountPaid: string
}

export interface CustomerRef {
  ref: string
  snapshot: CustomerSnapshot
}

export interface CustomerSnapshot {
  name: string
  siret?: string
  vatNumber?: string
  address: Address
}

export interface LifecycleEntry {
  status: string
  timestamp: string
  source: 'user' | 'system' | 'pa'
  details: string | null
}

export type Currency = 'eur'

export type Unit =
  | 'piece'
  | 'heure'
  | 'jour'
  | 'mois'
  | 'forfait'
  | 'kg'
  | 'm'
  | 'm2'
  | 'm3'
  | 'l'

export type VatCode =
  | 'S'
  | 'Z'
  | 'E'
  | 'AE'
  | 'G'
  | 'IC'
  | 'K'
  | 'O'
  | 'VATEX-FR-FRANCHISE'

export type PaymentMethod =
  | 'transfer'
  | 'card'
  | 'check'
  | 'cash'
  | 'direct_debit'
  | 'sepa'

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------

export type InvoiceType =
  | 'standard'
  | 'deposit'
  | 'credit_note'
  | 'corrective'
  | 'self_billing'

export type InvoiceStatus =
  | 'draft'
  | 'finalized'
  | 'sending'
  | 'deposited'
  | 'transmitted'
  | 'rejected'
  | 'available'
  | 'received'
  | 'approved'
  | 'refused'
  | 'suspended'
  | 'partially_paid'
  | 'paid'
  | 'overdue'

export interface InvoiceDates {
  issued: string
  due: string
  serviceStart: string | null
  serviceEnd: string | null
  finalizedAt: string | null
  sentAt: string | null
}

export interface InvoicePaymentTerms {
  terms: string
  termsDays: number
  method: PaymentMethod
  iban?: string
  bic?: string
  earlyPaymentDiscount?: string
  latePaymentRate: string
  collectionFee: string
}

export interface InvoiceEinvoicing {
  paId: string | null
  paStatus: string | null
  paTransactionId: string | null
  paErrorCode: string | null
  paIdempotencyKey: string | null
  peppolDeliveryId: string | null
  ereportingId: string | null
  sentAt: string | null
  trackingId: string | null
}

export interface InvoicePortal {
  token: string
  expiresAt: string
  firstViewedAt: string | null
}

export interface InvoiceArchive {
  hash: string | null
  previousHash: string | null
  archivedAt: string | null
  archivedFilePath?: string
}

export interface InvoiceFiles {
  pdfPath?: string
  facturxPath?: string
  xmlPath?: string
}

export interface Invoice {
  id: string
  object: 'invoice'
  type: InvoiceType
  status: InvoiceStatus
  number: string | null
  currency: Currency
  customer: CustomerRef
  items: LineItem[]
  totals: Totals
  dates: InvoiceDates
  paymentInfo: InvoicePaymentTerms
  einvoicing: InvoiceEinvoicing
  archive: InvoiceArchive | null
  files: InvoiceFiles
  portal: InvoicePortal | null
  notes: string | null
  legalMentions: string | null
  lifecycle: LifecycleEntry[]
  metadata: Record<string, unknown>
  livemode: boolean
  created: string
  updated: string
}

export interface InvoiceCreateParams {
  customer: string
  type?: InvoiceType
  items: InvoiceLineItemParam[]
  dates?: Partial<InvoiceDates>
  payment?: Partial<InvoicePaymentTerms>
  notes?: string
  metadata?: Record<string, unknown>
}

export interface InvoiceLineItemParam {
  description: string
  quantity: number
  unit?: Unit
  unit_price: number
  vat_rate: number
  vat_code?: VatCode
  discount_percent?: number
  product?: string
}

export interface InvoiceUpdateParams {
  items?: InvoiceLineItemParam[]
  dates?: Partial<InvoiceDates>
  payment?: Partial<InvoicePaymentTerms>
  notes?: string
  metadata?: Record<string, unknown>
}

export interface InvoiceListParams extends PaginationParams {
  status?: InvoiceStatus
}

export interface InvoiceStatusResponse {
  status: InvoiceStatus
  einvoicing: {
    paStatus: string | null
    paId: string | null
  }
  dates: {
    due: string | null
    finalizedAt: string | null
  }
}

export interface InvoiceVerifyResponse {
  id: string
  object: 'invoice'
  verified: boolean
  archive: InvoiceArchive | null
  chain_length: number
  details: string
}

export interface DocumentUrlResponse {
  url: string
  expires_in: number
}

export interface JobResponse {
  id: string
  object: 'job'
  type: string
  status: string
  invoice_id?: string
  company_id?: string
}

export interface PaymentLinkResponse {
  object: 'payment_link'
  url: string
  session_id: string
}

export interface PaymentLinkCreateParams {
  success_url?: string
  cancel_url?: string
}

export interface PaymentTokenResponse {
  object: 'payment_token'
  token: string
  pay_url: string
  expires_at: string
}

// ---------------------------------------------------------------------------
// Payment (sub-resource of Invoice)
// ---------------------------------------------------------------------------

export interface Payment {
  id: string
  object: 'payment'
  amount: string
  method: PaymentMethod | 'other'
  reference: string | null
  paidAt: string
  recorded_by: 'api' | 'ui'
  created: string
}

export interface PaymentCreateParams {
  amount: number
  method: PaymentMethod | 'other'
  reference?: string
  paidAt: string
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

export interface Customer {
  id: string
  object: 'customer'
  name: string
  siret?: string
  siren?: string
  vatNumber?: string
  legalForm?: string
  nafCode?: string
  address: Address
  deliveryAddress?: Address
  type: 'company' | 'individual'
  contacts?: Contact[]
  paymentTerms?: number
  tags?: string[]
  notes?: string
  balance: string
  currency: Currency
  siretVerified: boolean
  vatVerified: boolean
  paIdentifier?: string
  preferredFormat?: 'facturx' | 'ubl' | 'cii'
  receivingPaId?: string
  recipientServiceCode?: string
  active: boolean
  livemode: boolean
  created: string
  updated: string
}

export interface CustomerCreateParams {
  name: string
  type: 'company' | 'individual'
  address: Address
  email?: string
  siret?: string
  siren?: string
  vatNumber?: string
  legalForm?: string
  nafCode?: string
  deliveryAddress?: Address
  contacts?: Contact[]
  paymentTerms?: number
  tags?: string[]
  notes?: string
  paIdentifier?: string
  preferredFormat?: 'facturx' | 'ubl' | 'cii'
  receivingPaId?: string
}

export interface CustomerUpdateParams {
  name?: string
  type?: 'company' | 'individual'
  address?: Address
  email?: string
  siret?: string
  vatNumber?: string
  legalForm?: string
  deliveryAddress?: Address
  contacts?: Contact[]
  paymentTerms?: number
  tags?: string[]
  notes?: string
  paIdentifier?: string
  preferredFormat?: 'facturx' | 'ubl' | 'cii'
}

export interface CustomerListParams extends PaginationParams {
  status?: 'active' | 'inactive'
}

export interface CustomerLookupParams {
  siret?: string
  query?: string
}

export interface SireneLookupResponse {
  object: 'sirene_lookup'
  found: boolean
  data: {
    name: string
    siret: string
    siren: string
    vatNumber: string
    legalForm: string
    nafCode: string
    address: Address
    active: boolean
  } | null
  warning?: string
}

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export interface Product {
  id: string
  object: 'product'
  name: string
  description?: string
  reference?: string
  category?: string
  unitPrice: string
  vatRate: string
  vatCode: VatCode
  unit: Unit
  tags: string[]
  priceHistory: PriceHistoryEntry[]
  active: boolean
  livemode: boolean
  created: string
  updated: string
}

export interface PriceHistoryEntry {
  price: string
  vatRate: string
  changedAt: string
  changedBy: string
}

export interface ProductCreateParams {
  name: string
  unit_price: number
  vat_rate: number
  vat_code?: VatCode
  unit?: Unit
  description?: string
  reference?: string
  category?: string
  tags?: string[]
}

export interface ProductUpdateParams {
  name?: string
  unit_price?: number
  vat_rate?: number
  vat_code?: VatCode
  unit?: Unit
  description?: string
  reference?: string
  category?: string
  tags?: string[]
  active?: boolean
}

export interface ProductListParams extends PaginationParams {
  status?: 'active' | 'inactive'
}

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'refused'
  | 'expired'
  | 'converted'
  | 'deleted'

export interface QuoteDates {
  issued: string
  sent?: string
  validUntil: string
}

export interface QuoteSignature {
  signedAt?: string
  signerEmail?: string
  signerIp?: string
  documentHash?: string
}

export interface Quote {
  id: string
  object: 'quote'
  customer: CustomerRef
  status: QuoteStatus
  number: string | null
  currency: Currency
  versionNumber: number
  parentQuoteId?: string
  isLatestVersion: boolean
  items: LineItem[]
  totals: Totals
  dates: QuoteDates
  notes?: string
  viewedAt?: string
  viewCount: number
  acceptedAt?: string
  signature?: QuoteSignature
  convertedInvoiceId?: string
  files?: { pdfPath?: string }
  livemode: boolean
  created: string
  updated: string
}

export interface QuoteCreateParams {
  customer: string
  items: InvoiceLineItemParam[]
  dates?: Partial<QuoteDates>
  notes?: string
}

export interface QuoteUpdateParams {
  items?: InvoiceLineItemParam[]
  dates?: Partial<QuoteDates>
  notes?: string
}

export interface QuoteListParams extends PaginationParams {
  status?: QuoteStatus
}

// ---------------------------------------------------------------------------
// Credit Note
// ---------------------------------------------------------------------------

export type CreditNoteType = 'total' | 'partial' | 'commercial' | 'financial'

export type CreditNoteStatus =
  | 'draft'
  | 'finalized'
  | 'credit_deposited'
  | 'credit_transmitted'
  | 'credit_approved'
  | 'credit_refused'

export type CreditNoteReasonCode =
  | 'defective_goods'
  | 'duplicate'
  | 'quality'
  | 'other'

export interface CreditNote {
  id: string
  object: 'credit_note'
  customer: CustomerRef
  relatedInvoiceId: string
  status: CreditNoteStatus
  creditNoteType: CreditNoteType
  number: string | null
  currency: Currency
  reasonCode: CreditNoteReasonCode
  reason?: string
  items: LineItem[]
  totals: Totals
  dates: { issued: string; finalizedAt?: string; sentAt?: string }
  einvoicing?: { paId: string | null; paStatus: string | null; depositedAt: string | null }
  files?: { pdfPath?: string; facturxPath?: string }
  notes?: string
  archive: { hash: string | null; previousHash: string | null; archivedAt: string | null } | null
  livemode: boolean
  created: string
  updated: string
}

export interface CreditNoteCreateParams {
  customer: string
  related_invoice_id: string
  credit_note_type: CreditNoteType
  reason_code: CreditNoteReasonCode
  reason?: string
  items: InvoiceLineItemParam[]
  notes?: string
}

export interface CreditNoteUpdateParams {
  items?: InvoiceLineItemParam[]
  reason?: string
  notes?: string
}

export interface CreditNoteListParams extends PaginationParams {
  status?: CreditNoteStatus
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export type WebhookEventType =
  | 'invoice.created'
  | 'invoice.finalized'
  | 'invoice.sending'
  | 'invoice.sent'
  | 'invoice.deposited'
  | 'invoice.transmitted'
  | 'invoice.available'
  | 'invoice.received'
  | 'invoice.approved'
  | 'invoice.refused'
  | 'invoice.rejected'
  | 'invoice.suspended'
  | 'invoice.paid'
  | 'invoice.partially_paid'
  | 'invoice.overdue'
  | 'invoice.payment_recorded'
  | 'invoice.viewed'
  | 'invoice.incoming.received'
  | 'received_invoice.available'
  | 'received_invoice.approved'
  | 'received_invoice.refused'
  | 'received_invoice.suspended'
  | 'quote.created'
  | 'quote.sent'
  | 'quote.viewed'
  | 'quote.accepted'
  | 'quote.refused'
  | 'quote.expired'
  | 'quote.converted'
  | 'credit_note.created'
  | 'credit_note.finalized'
  | 'credit_note.credit_deposited'
  | 'credit_note.credit_transmitted'
  | 'credit_note.credit_approved'
  | 'credit_note.credit_refused'
  | 'credit_note.sent'
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'payment.created'
  | 'payment.updated'
  | 'payment.received'
  | 'payment.reconciled'
  | 'ereporting.submitted'
  | 'ereporting.accepted'
  | 'ereporting.rejected'
  | 'recurring_invoice.generated'
  | 'recurring_invoice.failed'
  | 'export.ready'
  | 'subscription.created'
  | 'subscription.cancelled'
  | 'subscription.renewed'

export interface WebhookEvent {
  id: string
  object: 'event'
  type: WebhookEventType
  apiVersion: string
  data: { id: string; object: string; [key: string]: unknown }
  request?: {
    id?: string
    idempotencyKey?: string
  }
  delivered: boolean
  livemode: boolean
  created: string
  updated: string
}

export interface EventListParams extends PaginationParams {
  type?: WebhookEventType
}

// ---------------------------------------------------------------------------
// Webhook Endpoint
// ---------------------------------------------------------------------------

export interface WebhookEndpoint {
  id: string
  object: 'webhook_endpoint'
  url: string
  secret: string
  events: WebhookEventType[]
  description?: string
  livemode: boolean
  active: boolean
  created: string
  updated: string
}

export interface WebhookEndpointCreateParams {
  url: string
  events: WebhookEventType[]
  description?: string
}

export interface WebhookEndpointUpdateParams {
  url?: string
  events?: WebhookEventType[]
  description?: string
  active?: boolean
}

// ---------------------------------------------------------------------------
// Recurring Invoice
// ---------------------------------------------------------------------------

export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

export interface RecurringInvoice {
  id: string
  object: 'recurring_invoice'
  customerId: string
  currency: Currency
  frequency: RecurringFrequency
  customInterval: number | null
  customUnit: 'days' | 'weeks' | 'months' | null
  startDate: string
  nextGenerationDate: string
  endDate: string | null
  templateInvoice: {
    items: LineItem[]
    notes?: string
    paymentMethod?: PaymentMethod
    paymentTermsDays?: number
    currency: Currency
  }
  autoFinalize: boolean
  autoSend: boolean
  lastGeneratedAt: string | null
  lastGeneratedInvoiceId: string | null
  generationCount: number
  active: boolean
  livemode: boolean
  created: string
  updated: string
}

export interface RecurringInvoiceCreateParams {
  customer_id: string
  frequency: RecurringFrequency
  start_date: string
  end_date?: string
  custom_interval?: number
  custom_unit?: 'days' | 'weeks' | 'months'
  template_invoice: {
    items: InvoiceLineItemParam[]
    notes?: string
    payment_method?: PaymentMethod
    payment_terms_days?: number
  }
  auto_finalize?: boolean
  auto_send?: boolean
}

export interface RecurringInvoiceUpdateParams {
  frequency?: RecurringFrequency
  end_date?: string | null
  custom_interval?: number
  custom_unit?: 'days' | 'weeks' | 'months'
  template_invoice?: {
    items?: InvoiceLineItemParam[]
    notes?: string
    payment_method?: PaymentMethod
    payment_terms_days?: number
  }
  auto_finalize?: boolean
  auto_send?: boolean
}

export interface RecurringInvoiceListParams extends PaginationParams {
  active?: boolean
}

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------

export interface BankDetails {
  iban?: string
  bic?: string
  bankName?: string
}

export interface InvoiceSettings {
  prefix: string
  nextNumber: number
  defaultVatRate: string
  legalMentions?: string
  yearlyReset: boolean
}

export interface Company {
  id: string
  name: string
  siret: string
  siren: string
  vatNumber: string
  legalForm: string
  apeCode?: string
  rcs?: string
  capitalSocial?: string
  tvaIntracom: string
  address: Address
  email?: string
  phone?: string
  website?: string
  logoPath?: string
  vatRegime: 'normal' | 'franchise' | 'simplified' | 'debit'
  billingEmail?: string
  bankDetails: BankDetails
  defaultPaymentTerms: number
  defaultPaymentMethod: PaymentMethod
  invoiceSettings: InvoiceSettings
  active: boolean
  onboardingCompleted: boolean
  created: string
  updated: string
}

export interface CompanyUpdateParams {
  name?: string
  address?: Address
  email?: string
  phone?: string
  website?: string
  vatRegime?: 'normal' | 'franchise' | 'simplified' | 'debit'
  billingEmail?: string
  bankDetails?: BankDetails
  defaultPaymentTerms?: number
  defaultPaymentMethod?: PaymentMethod
  invoiceSettings?: Partial<InvoiceSettings>
}

export interface CgvResponse {
  object: 'cgv'
  url?: string
  updatedAt?: string | null
  deleted?: boolean
}

// ---------------------------------------------------------------------------
// Member
// ---------------------------------------------------------------------------

export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer'
export type MemberStatus = 'pending' | 'active' | 'revoked'

export interface Member {
  id: string
  email: string
  displayName: string
  role: MemberRole
  status: MemberStatus
  invitedBy: string
  invitedAt: string
  acceptedAt: string | null
  revokedAt: string | null
  created: string
  updated: string
}

export interface MemberInviteParams {
  email: string
  role: MemberRole
  displayName?: string
}

export interface MemberUpdateParams {
  role: MemberRole
}

// ---------------------------------------------------------------------------
// API Key
// ---------------------------------------------------------------------------

export type ApiKeyPermission =
  | 'invoices:read'
  | 'invoices:write'
  | 'customers:read'
  | 'customers:write'
  | 'quotes:read'
  | 'quotes:write'
  | 'credit_notes:read'
  | 'credit_notes:write'
  | 'products:read'
  | 'products:write'
  | 'webhooks:read'
  | 'webhooks:write'
  | 'payments:read'
  | 'payments:write'

export interface ApiKey {
  id: string
  name: string
  prefix: string
  livemode: boolean
  permissions: ApiKeyPermission[]
  revoked: boolean
  revokedAt: string | null
  lastUsedAt: string | null
  created: string
  /** Full key, only returned on create/roll. */
  key?: string
}

export interface ApiKeyCreateParams {
  name: string
  permissions?: ApiKeyPermission[]
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export interface FecExportParams {
  period_start?: string
  period_end?: string
  send_to_accountant?: boolean
  accountant_email?: string
}

// ---------------------------------------------------------------------------
// E-reporting
// ---------------------------------------------------------------------------

export type EReportingType = 'b2c' | 'international' | 'intra_eu'
export type EReportingStatus = 'draft' | 'submitted' | 'accepted' | 'rejected'

/** Input line: amounts in centimes, vatRate in centipercent */
export interface EReportingLine {
  category: string
  amount: number
  vatRate: number
  vatAmount: number
}

/** Response line: amounts and rates as Decimal strings */
export interface EReportingLineResponse {
  category: string
  amount: string
  vatRate: string
  vatAmount: string
}

export interface EReporting {
  id: string
  object: 'ereporting'
  status: EReportingStatus
  type: EReportingType
  period: string
  totalHT: string
  totalTVA: string
  totalTTC: string
  lines: EReportingLineResponse[]
  submittedAt?: string
  paResponseId?: string
  livemode: boolean
  created: string
  updated: string
}

export interface EReportingCreateParams {
  type: EReportingType
  period: string
  lines: EReportingLine[]
}

export interface EReportingListParams extends PaginationParams {
  status?: EReportingStatus
}

// ---------------------------------------------------------------------------
// Job
// ---------------------------------------------------------------------------

export type JobType = 'pdf' | 'facturx' | 'fec' | 'export' | 'rgpd_export' | 'audit_trail_pdf'
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Job {
  id: string
  object: 'job'
  type: JobType
  status: JobStatus
  invoiceId: string | null
  progress: number
  result: string | null
  error: string | null
  download_url?: string
  expires_in?: number
  created: string
}

// ---------------------------------------------------------------------------
// Sandbox
// ---------------------------------------------------------------------------

export interface SandboxResetResponse {
  object: 'sandbox_reset'
  deleted_count: number
  fixtures_created: number
}

export interface SimulateStatusParams {
  status: InvoiceStatus
}

export interface SimulateStatusResponse {
  id: string
  object: 'invoice'
  status: InvoiceStatus
  simulated: boolean
}
