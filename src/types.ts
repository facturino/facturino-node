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
  /** API version header (default: "2026-03-01"). */
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

/** A contact attached to a customer. */
export interface Contact {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  /**
   * Role of the contact for this customer. The `billing` contact receives
   * invoices by email by default.
   */
  role?: ContactRole
}

export type ContactRole = 'billing' | 'technical' | 'main'

// Monetary amounts are integer centimes and VAT/discount rates are centièmes de
// pourcent (e.g. 15000 = 150,00 EUR, 2000 = 20,00 %) — same unit as on input.
// `quantity` is a decimal-string count, not an amount.
export interface LineItem {
  id: string
  description: string
  quantity: string
  unit: Unit
  unitPrice: number
  discountPercent: number
  lineAmount: number
  vatRate: number
  vatCode: VatCode
  vatexCode?: VatexCode
  vatAmount: number
  lineTotal: number
  product: string | null
}

export interface VatBreakdown {
  rate: number
  code: VatCode
  vatexCode?: VatexCode
  base: number
  amount: number
}

export interface Totals {
  totalHT: number
  discountAmount: number
  vatBreakdown: VatBreakdown[]
  totalVAT: number
  totalTTC: number
  amountDue: number
  amountPaid: number
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
  | 'unit'
  | 'hour'
  | 'day'
  | 'month'
  | 'flat_rate'
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

/**
 * Specific VATEX exemption code (BT-121). Set it on a line when the exemption
 * basis differs from the category default (e.g. Qualiopi training, margin
 * scheme, Corsica/DOM, BTP reverse charge) — otherwise the category default
 * applies (category E defaults to the 293 B franchise mention).
 */
export type VatexCode =
  | 'VATEX-EU-AE'
  | 'VATEX-EU-D'
  | 'VATEX-EU-F'
  | 'VATEX-EU-G'
  | 'VATEX-EU-IC'
  | 'VATEX-EU-O'
  | 'VATEX-FR-FRANCHISE'
  | 'VATEX-FR-CNWVAT'
  | 'VATEX-FR-AUTOLIQ'
  | 'VATEX-FR-261'

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
  /** Populated only when requested via the `expand` retrieve parameter. */
  expanded?: InvoiceExpanded
  livemode: boolean
  created: string
  updated: string
}

/** Fields that can be inlined via the `expand` retrieve parameter. */
export type InvoiceExpandField = 'customer' | 'items.product' | 'credit_notes'

/** Expanded objects inlined on an invoice when requested via `expand`. */
export interface InvoiceExpanded {
  customer?: Customer
  /** Credit notes issued against this invoice (with `expand=credit_notes`). */
  credit_notes?: CreditNote[]
  /** TTC total minus credited amounts, in integer cents (with `expand=credit_notes`). */
  net_balance?: number
}

/** Query parameters for {@link Invoices.get}. */
export interface InvoiceRetrieveParams {
  /** Objects to inline in the response (e.g. `['customer', 'credit_notes']`). */
  expand?: InvoiceExpandField[]
}

export interface InvoiceBuyerParam {
  companyName: string
  siret?: string
  vatNumber?: string
  address: Address
  deliveryAddress?: Address
}

export interface InvoiceCreateDates {
  issued: string
  due: string
  serviceStart?: string
  serviceEnd?: string
}

/** A deposit invoice (386) linked to this balance invoice; its TTC is deducted (BT-113). */
export interface InvoiceDepositParam {
  invoiceId: string
}

/** A payment-schedule instalment. `amount` in integer centimes; last instalment on the due date. */
export interface InvoiceScheduleParam {
  amount: number
  dueDate: string
  label?: string
}

export interface InvoiceCreateParams {
  customerId: string
  type?: InvoiceType
  lines: InvoiceLineItemParam[]
  buyer: InvoiceBuyerParam
  dates: InvoiceCreateDates
  payment: InvoicePaymentTerms
  notes?: string
  purchaseOrderNumber?: string
  /** Deposit invoices to deduct from the amount due (CGI art. 289). Max 20. */
  deposits?: InvoiceDepositParam[]
  /** Payment schedule (2 to 12 instalments) summing to the total. */
  schedule?: InvoiceScheduleParam[]
  metadata?: Record<string, unknown>
  /** Finalize the invoice in the same call (assigns its number). */
  autoFinalize?: boolean
  /**
   * Finalize then send in the same call: by email to the customer
   * (`email`) and/or by deposit to the connected PA (`pa`).
   */
  autoSend?: { email?: boolean; pa?: boolean }
}

export interface InvoiceLineItemParam {
  description: string
  quantity: string
  unit: Unit
  unitPrice: number
  vatRate: number
  vatCode: VatCode
  /** Optional specific VATEX exemption code (BT-121) when the basis differs from
   *  the category default. See {@link VatexCode}. */
  vatexCode?: VatexCode
  discountPercent?: number
  product?: string | null
}

export interface InvoiceUpdateParams {
  buyer?: InvoiceBuyerParam
  lines?: InvoiceLineItemParam[]
  dates?: Partial<InvoiceCreateDates>
  payment?: Partial<InvoicePaymentTerms>
  notes?: string
  purchaseOrderNumber?: string
  /** Replace the linked deposit invoices; an empty array unlinks them. */
  deposits?: InvoiceDepositParam[]
  /** Replace the payment schedule. */
  schedule?: InvoiceScheduleParam[]
  metadata?: Record<string, unknown>
}

export interface InvoiceListParams extends PaginationParams {
  status?: InvoiceStatus
  /** Filter to invoices issued from the given quote (id starting with `quo_`). */
  convertedFrom?: string
}

/**
 * Record a supplier invoice received outside the platform (manual entry), so
 * it appears in the inbound register alongside e-invoices delivered via the PA.
 */
export interface IncomingInvoiceCreateParams {
  senderName: string
  senderSiret?: string
  /** Total amount incl. VAT, in integer cents. */
  amount: number
  /** The supplier's invoice number / reference. */
  reference?: string
  notes?: string
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
  invoiceId?: string
  /** Signed download URL — present once the job has a deliverable. */
  download_url?: string
  /** Validity of `download_url`, in seconds. */
  expires_in?: number
  /** Alias of `download_url` (callable response shape). */
  url?: string
  /** ISO 8601 expiry of the signed URL. */
  expiresAt?: string
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
  amount: number // integer centimes
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

/** Result of cancelling a payment — the invoice is re-settled from the reversal. */
export interface PaymentCancelResult {
  id: string
  object: 'payment'
  status: 'cancelled'
  /** Recomputed invoice status after the reversal. */
  invoiceStatus: InvoiceStatus
  /** Recomputed amount due, in integer centimes. */
  amountDue: number
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
  legalForm?: LegalForm | null
  naf?: NafCode | null
  address: Address
  deliveryAddress?: Address
  type: 'company' | 'individual'
  contacts?: Contact[]
  paymentTerms?: number
  tags?: string[]
  notes?: string
  balance: number
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
  legalForm?: LegalFormInput
  naf?: NafCodeInput
  deliveryAddress?: Address
  contacts?: Contact[]
  paymentTerms?: number
  tags?: string[]
  notes?: string
  paIdentifier?: string
  preferredFormat?: 'facturx' | 'ubl' | 'cii'
  receivingPaId?: string
  metadata?: Record<string, unknown>
}

export interface CustomerUpdateParams {
  name?: string
  type?: 'company' | 'individual'
  address?: Address
  email?: string
  siret?: string
  vatNumber?: string
  legalForm?: LegalFormInput
  naf?: NafCodeInput
  deliveryAddress?: Address
  contacts?: Contact[]
  paymentTerms?: number
  tags?: string[]
  notes?: string
  paIdentifier?: string
  preferredFormat?: 'facturx' | 'ubl' | 'cii'
  receivingPaId?: string
}

export interface CustomerListParams extends PaginationParams {
  status?: 'active' | 'inactive'
}

export interface CustomerLookupParams {
  siret?: string
  query?: string
}

/** Company details resolved from the INSEE Sirene registry (not a stored customer). */
export interface SireneCompany {
  name: string
  siret: string
  siren: string
  vatNumber: string
  legalForm: LegalForm | null
  naf: NafCode | null
  address: Address
  active: boolean
}

/**
 * Result of a customer lookup. A SIRET lookup returns object `sirene_lookup`
 * with `found`/`data`; a name query returns object `sirene_search` with
 * `results`/`total` instead.
 */
export interface SireneLookupResponse {
  object: 'sirene_lookup' | 'sirene_search'
  found?: boolean
  data?: SireneCompany | null
  results?: SireneCompany[]
  total?: number
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
  unitPrice: number // integer centimes
  vatRate: number // centièmes de pourcent
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
  price: number // integer centimes
  vatRate: number // centièmes de pourcent
  changedAt: string
  changedBy: string
}

export interface ProductCreateParams {
  name: string
  unitPrice: number
  vatRate: number
  vatCode: VatCode
  unit: Unit
  description?: string
  reference?: string
  category?: string
}

export interface ProductUpdateParams {
  name?: string
  unitPrice?: number
  vatRate?: number
  vatCode?: VatCode
  unit?: Unit
  description?: string
  reference?: string
  category?: string
  active?: boolean
}

export interface ProductListParams extends PaginationParams {
  status?: 'active' | 'inactive'
  /** Prefix search on the product name. */
  q?: string
  /** Filter by product category. */
  category?: string
  /** Filter by active state. */
  active?: boolean
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
  customerId: string
  lines: InvoiceLineItemParam[]
  dates?: Partial<QuoteDates>
  validityDays?: number
  notes?: string
  metadata?: Record<string, unknown>
}

export interface QuoteUpdateParams {
  lines?: InvoiceLineItemParam[]
  dates?: Partial<QuoteDates>
  validityDays?: number
  notes?: string
  metadata?: Record<string, unknown>
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
  customerId: string
  relatedInvoiceId: string
  creditNoteType: CreditNoteType
  reasonCode: CreditNoteReasonCode
  reason?: string
  items: InvoiceLineItemParam[]
  dates?: { issued: string }
  notes?: string
  metadata?: Record<string, unknown>
}

export interface CreditNoteUpdateParams {
  items?: InvoiceLineItemParam[]
  reason?: string
  notes?: string
  metadata?: Record<string, unknown>
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
  customerId: string
  frequency: RecurringFrequency
  startDate: string
  nextGenerationDate: string
  endDate?: string
  customIntervalDays?: number
  templateInvoice: {
    items: InvoiceLineItemParam[]
    notes?: string
    paymentMethod?: PaymentMethod
    paymentTermsDays?: number
  }
  autoFinalize?: boolean
  autoSend?: boolean
}

export interface RecurringInvoiceUpdateParams {
  frequency?: RecurringFrequency
  nextGenerationDate?: string
  endDate?: string
  customIntervalDays?: number
  templateInvoice?: {
    items?: InvoiceLineItemParam[]
    notes?: string
    paymentMethod?: PaymentMethod
    paymentTermsDays?: number
  }
  autoFinalize?: boolean
  autoSend?: boolean
}

export interface RecurringInvoiceListParams extends PaginationParams {
  /** Filter by schedule state. Omit to return both active and paused schedules. */
  status?: 'active' | 'inactive'
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

/** Credit-note numbering configuration for a company. */
export interface CreditNoteSettings {
  /**
   * Numbering strategy for credit notes. `separate` (default) gives credit
   * notes their own number series; `unified` shares the invoice number series.
   */
  numberingMode?: CreditNoteNumberingMode
}

export type CreditNoteNumberingMode = 'separate' | 'unified'

export interface Company {
  id: string
  name: string
  siret: string
  siren: string
  vatNumber: string
  legalForm: LegalForm | null
  naf?: NafCode | null
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
  creditNoteSettings?: CreditNoteSettings
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
  creditNoteSettings?: CreditNoteSettings
}

export interface CgvResponse {
  object: 'cgv'
  url?: string
  updatedAt?: string | null
  deleted?: boolean
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

export interface InvoiceExportParams {
  /** Lower bound on the invoice issue date (inclusive), YYYY-MM-DD. */
  period_start?: string
  /** Upper bound on the invoice issue date (inclusive), YYYY-MM-DD. */
  period_end?: string
  /** Restrict to these lifecycle statuses. Defaults to every non-draft status. */
  statuses?: string[]
}

// ---------------------------------------------------------------------------
// E-reporting
// ---------------------------------------------------------------------------

export type EReportingType = 'b2c' | 'international' | 'intra_eu' | 'payment'
export type EReportingStatus = 'draft' | 'submitted' | 'accepted' | 'rejected'

/** Input line: amounts in centimes, vatRate in centipercent */
export interface EReportingLine {
  category: string
  amount: number
  vatRate: number
  vatAmount: number
}

/** Response line: amounts in integer centimes, rates in centièmes de pourcent */
export interface EReportingLineResponse {
  category: string
  amount: number
  vatRate: number
  vatAmount: number
}

export interface EReporting {
  id: string
  object: 'ereporting'
  status: EReportingStatus
  type: EReportingType
  period: string
  totalHT: number
  totalTVA: number
  totalTTC: number
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
  /** Signed download URL for a completed PDF/Factur-X/export job. */
  url?: string
  /** ISO 8601 expiry of the signed `url`. */
  expiresAt?: string
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

// ---------------------------------------------------------------------------
// Received Invoice
// ---------------------------------------------------------------------------

export type ReceivedInvoiceStatus =
  | 'available'
  | 'received'
  | 'approved'
  | 'refused'
  | 'suspended'

export interface ReceivedInvoice {
  id: string
  object: 'received_invoice'
  livemode: boolean
  paInvoiceId: string
  sourcePA: string
  sourceFormat: string
  status: ReceivedInvoiceStatus
  /** 14-digit SIRET (empty when the seller exposes only a SIREN). */
  senderSiret: string
  /** 9-digit SIREN — the CIUS-FR French seller identifier (BT-30). */
  senderSiren: string
  senderName: string
  number: string
  issuedAt: string
  dueAt: string
  totalHT: number // integer centimes
  totalTVA: number
  totalTTC: number
  xmlPath: string
  pdfPath: string | null
  approvedAt: string | null
  refusedAt: string | null
  refusalReason: string | null
  reconciled: boolean
  reconciledPaymentId: string | null
  lifecycle: LifecycleEntry[]
  metadata: Record<string, unknown>
  created: string
  updated: string
}

export interface ReceivedInvoiceListParams extends PaginationParams {
  status?: ReceivedInvoiceStatus
}

export interface ReceivedInvoiceRefuseParams {
  reason: string
}

export interface ReceivedInvoiceRecordPaymentParams {
  amount: number
  method?: string
  reference?: string
  paidAt?: string
}

export interface ReceivedInvoiceActionResponse {
  id: string
  object: 'received_invoice'
  status?: ReceivedInvoiceStatus
  reconciled?: boolean
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export interface VatReportParams {
  period_start: string
  period_end: string
}

export interface VatReportBreakdown {
  rate: string
  /** Taxable base for this rate, in integer cents. */
  taxableAmount: number
  /** VAT due for this rate, in integer cents. */
  vatAmount: number
}

export interface VatReport {
  object: 'vat_report'
  period: { start: string; end: string }
  vatBreakdown: VatReportBreakdown[]
  /** Totals for the period, in integer cents. */
  totalHT: number
  totalVAT: number
  totalTTC: number
  invoiceCount: number
}

export interface RevenueReportParams {
  period_start: string
  period_end: string
  group_by?: 'month' | 'quarter'
}

export interface RevenueReportBreakdownItem {
  period: string
  revenue: {
    invoiced: number
    credit_notes: number
    net: number
  }
  payments: {
    received: number
    outstanding: number
  }
  invoice_count: number
  credit_note_count: number
}

export interface RevenueReport {
  object: 'revenue_report'
  period: { start: string; end: string }
  revenue: {
    invoiced: number
    credit_notes: number
    net: number
  }
  payments: {
    received: number
    outstanding: number
  }
  invoice_count: number
  credit_note_count: number
  breakdown?: RevenueReportBreakdownItem[]
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

/**
 * Subscription plan attached to the authenticated account. `free` is the
 * default; paid plans unlock e-invoicing, PA connections, FEC export, and
 * more — see the rate-limits and pricing pages for the full matrix.
 */
export type AccountPlan =
  | 'free'
  | 'essential'
  | 'pro'
  | 'cabinet_50'
  | 'cabinet_200'
  | 'cabinet_500'

/**
 * Result of `GET /v1/account`. Returns the authenticated user, the active
 * company, the current plan and the scopes attached to the API key in
 * use. Equivalent to Stripe's "who am I" introspection endpoint — use
 * it on integration startup to display the connected company and the
 * environment (`fac_test_` vs `fac_live_`).
 */
export interface Account {
  object: 'account'
  userId: string
  companyId: string
  plan: AccountPlan
  /** `true` when the key is a `fac_live_…`, `false` for sandbox. */
  livemode: boolean
  /** Echo of the prefix of the key used (`fac_test_` or `fac_live_`). */
  apiKeyPrefix: string
  /** Scopes attached to the key. Empty array on unrestricted keys. */
  permissions: string[]
  /** Snapshot of the active company. `null` when the user has none yet. */
  company:
    | {
        id: string
        name?: string
        siret?: string
        vatRegime?: string
      }
    | null
  user: {
    emailVerified: boolean
  }
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export type BillingCycle = 'monthly' | 'annual'

export interface BillingSubscription {
  object: 'subscription'
  id: string
  plan: AccountPlan
  cycle: BillingCycle
  status: 'active' | 'past_due' | 'paused' | 'canceled' | 'incomplete' | 'trialing'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}

/** Subscription (platform) invoice issued by INTEK CENTER to the Facturino account. */
export interface PlatformInvoice {
  object: 'platform_invoice'
  id: string
  status: string
  number: string
  /** Monetary totals as Decimal strings (HT, VAT, TTC…). */
  totals: Record<string, string>
  /** Document dates (issued, due, period…). */
  dates: Record<string, string>
  items: Array<{ description: string; lineTotal: number }>
  metadata: Record<string, unknown>
  created: string
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

/**
 * A single metered dimension: how much has been consumed in the current period
 * and the plan limit. `limit` is `null` when the dimension is unlimited on the
 * current plan.
 */
export interface UsageMeter {
  used: number
  limit: number | null
}

/**
 * Current-period usage snapshot for the authenticated account, returned by
 * `GET /v1/usage`. Drive in-app quota gauges and upgrade prompts from it,
 * before a limit triggers a `402 quota_exceeded` response.
 */
export interface UsageSummary {
  object: 'usage'
  plan: AccountPlan
  /** ISO 8601 start of the current monthly metering period. */
  periodStart: string
  /** Per-dimension counters. Monthly dimensions reset one month after `periodStart`. */
  counters: {
    apiRequestsMonth: UsageMeter
    invoicesMonth: UsageMeter
    quotesMonth: UsageMeter
    customers: UsageMeter
    products: UsageMeter
    members: UsageMeter
    webhookEndpoints: UsageMeter
    companies: UsageMeter
  }
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

/**
 * Payload accepted by `validate.run`: a full invoice draft, checked against
 * the same rules as `invoices.create` (EN16931 / CIUS-FR) without persisting
 * anything. Validate identifiers (SIRET, VAT) up front with `customers.lookup`.
 */
export type ValidateParams = InvoiceCreateParams

/** Result of a dry-run invoice validation. */
export interface ValidateResponse {
  /** `true` when no conformity warnings were raised. */
  valid: boolean
  /** Human-readable conformity warnings (EN16931 / CIUS-FR), empty when valid. */
  warnings: string[]
  /** Version of the validation ruleset applied. */
  schemaVersion: string
}

// ---------------------------------------------------------------------------
// Reference (INSEE legal forms + NAF codes)
// ---------------------------------------------------------------------------

export interface LegalForm {
  code: string
  sigle: string
  label: string
}

export interface NafCode {
  code: string
  label: string
}

/**
 * Legal-form input for company/customer create/update. Provide either the
 * 4-digit INSEE `code` or the `sigle` (e.g. "SAS"); the API resolves the
 * canonical object. Do not send `label` — the input is strictly validated.
 */
export interface LegalFormInput {
  code?: string
  sigle?: string
}

/**
 * NAF (APE) input for company/customer create/update. Provide the Rev. 2
 * `code` (e.g. "62.01Z" or "6201Z"); the API resolves the canonical object.
 */
export interface NafCodeInput {
  code: string
}

/**
 * A supported Plateforme Agréée (PA), returned by `reference.listPaProviders()`.
 * Public catalogue — use it to render a provider picker and the credential
 * fields each PA requires. Facturino is BYOPA: the customer brings their own
 * PA credentials, so integrations typically surface this list at connect time.
 */
export interface PaProvider {
  slug: string
  name: string
  description: string
  logoUrl: string | null
  websiteUrl: string | null
  documentationUrl: string | null
  signupUrl: string | null
  authType: string
  credentialLabel1: string | null
  credentialLabel2: string | null
  requiresBaseUrl: boolean
  pricingSummary: string | null
}

/** Service health snapshot returned by `health.check()`. */
export interface HealthStatus {
  status: string
  version: string
  region: string
  timestamp: string
}
