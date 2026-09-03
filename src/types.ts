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
  /** API version header (default: "2026-09-01"). */
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

/** One detailed reason inside an {@link ApiErrorBody}. */
export interface ApiErrorIssue {
  /** Stable code, safe to branch on. */
  code: string
  /** Field in cause (dotted path), or `null` when the reason names no field. */
  param: string | null
  /** Human-readable reason. */
  message: string
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
    /**
     * Detailed reasons, present only when one refusal carries several.
     *
     * Additive: `code`, `param`, `message` and `hint` are unchanged, and `param`
     * still points at the first field in cause.
     */
    issues?: ApiErrorIssue[]
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
  | 'paypal'

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
  /**
   * One-word SUMMARY derived from the three axes below — never an authority of
   * its own. Prefer the axes when you need to tell transmission from collection.
   */
  status: InvoiceStatus
  /** Documentary axis: is the invoice a draft, finalized, or cancelled? */
  documentStatus?: DocumentStatus
  /** Transmission axis: where the invoice stands with the platform. */
  transmissionStatus?: TransmissionStatus
  /** DGFiP detail inside `transmitted` / `rejected`. */
  transmissionDetail?: TransmissionDetail
  /** Collection axis: what has actually been paid. */
  paymentStatus?: PaymentStatus
  /** Fiscal source of the backing decision; `null` while a commercial draft has none. */
  taxSource?: TaxSource | null
  /** The decision this invoice is backed by, when it has one. */
  taxDecisionId?: string
  /** The frozen fiscal position, copied from the decision. */
  taxSnapshot?: TaxSnapshot
  /**
   * The operation a COMMERCIAL draft states, before any decision — typically a
   * draft produced by `quotes.convert()`. Present only while `taxSource` is
   * `null`; it disappears the moment the invoice is bound to a decision.
   *
   * Read its lines to build the decision that fiscalises this draft: the line
   * references are assigned server-side at conversion, and the decision must
   * state exactly the operation the draft carries.
   */
  commercialDraft?: CommercialDraft | null
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

/** Fields every invoice creation carries alongside its decision. */
export interface InvoiceCreateBaseParams {
  customerId: string
  type?: InvoiceType
  buyer: InvoiceBuyerParam
  dates: InvoiceCreateDates
  payment: InvoicePaymentTerms
  notes?: string
  purchaseOrderNumber?: string
  /**
   * Fully paid deposit invoices to deduct (CGI art. 289). The decided
   * `amountToCharge` is untouched: deposits seed `amountPaid` (BT-113) and
   * lower `amountDue` (BT-115), settled server-side in the creation
   * transaction. Max 20.
   */
  deposits?: InvoiceDepositParam[]
  /**
   * Payment schedule (2 to 12 instalments). It must distribute EXACTLY the
   * decided amount due — it never modifies the total.
   */
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

/**
 * Creating an invoice — ALWAYS backed by a FINAL tax decision, whatever its
 * fiscal source (`facturino` or `integration`). The decided VAT, amounts and
 * legal mentions are copied verbatim and frozen; `decisionLines` carries
 * presentation only (unit, catalogue product), matched by `taxLineRef`. A
 * final decision backs exactly ONE invoice.
 */
export interface InvoiceCreateParams extends InvoiceCreateBaseParams {
  taxDecisionId: string
  decisionLines: DecisionBackedLineParam[]
}

/**
 * Binding a FINAL decision to a commercial draft that already exists — the
 * draft produced by converting a quote.
 *
 * The same two fields the direct creation carries, and only those: the decision
 * states the whole fiscal content, and the draft already states the buyer, the
 * dates and the payment terms.
 */
export interface InvoiceBindTaxDecisionParams {
  taxDecisionId: string
  decisionLines: DecisionBackedLineParam[]
}

/**
 * A COMMERCIAL line with an indicative VAT — used by quotes only. A quote is a
 * commercial document; converting it to an invoice goes through a tax decision,
 * which re-decides (or re-validates) the VAT.
 */
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

/**
 * Patching a draft. The fiscal content (lines, buyer, deposits, schedule) is
 * frozen by the decision: only non-fiscal fields are patchable, and `dates` is
 * restricted to the due date server-side.
 */
export interface InvoiceUpdateParams {
  dates?: Partial<InvoiceCreateDates>
  payment?: Partial<InvoicePaymentTerms>
  notes?: string
  purchaseOrderNumber?: string
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
  /**
   * One-word SUMMARY derived from the three axes below — never an authority of
   * its own. Prefer the axes when you need to tell transmission from collection.
   */
  status: CreditNoteStatus
  /** Documentary axis. */
  documentStatus?: DocumentStatus
  /** Transmission axis. */
  transmissionStatus?: TransmissionStatus
  transmissionDetail?: TransmissionDetail
  /** Collection axis — a credit note follows the refund, not the invoice. */
  paymentStatus?: PaymentStatus
  /** Where this credit note's VAT comes from. */
  taxSource?: TaxSource
  /** The invoice this credit note credits. */
  originalInvoiceId?: string
  /** The decision the credited invoice was backed by; the credit note inherits it. */
  originalTaxDecisionId?: string
  /** The frozen fiscal position, inherited from the credited invoice. */
  taxSnapshot?: TaxSnapshot
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

/**
 * One credited line of a decision-backed invoice.
 *
 * State EITHER a `quantity` or an `amountTTC`, never both: they are two ways of
 * saying how much of the line is credited, and stating both would state two
 * different amounts. Omit both to credit the whole remaining balance of the line.
 */
export interface CreditedLineParam {
  /** Reference of the decided line being credited. */
  taxLineRef: string
  /** Credited quantity, as a decimal string. Mutually exclusive with `amountTTC`. */
  quantity?: string
  /** Credited amount in integer cents. Mutually exclusive with `quantity`. */
  amountTTC?: number
}

/** Fields every credit-note creation carries. */
export interface CreditNoteCreateBaseParams {
  customerId?: string
  relatedInvoiceId: string
  creditNoteType: CreditNoteType
  reasonCode: CreditNoteReasonCode
  reason?: string
  dates?: { issued: string }
  notes?: string
  metadata?: Record<string, unknown>
}

/**
 * Crediting an invoice.
 *
 * A credit note inherits the fiscal position of the invoice it corrects —
 * source, snapshot and lines. The rate, the category, the VATEX code and the
 * legal mention come from the frozen snapshot; `creditedLines` states WHICH
 * original lines are credited and how much of each, nothing more.
 */
export interface CreditNoteCreateParams extends CreditNoteCreateBaseParams {
  creditedLines: CreditedLineParam[]
}

/** Updating a draft credit note. */
export interface CreditNoteUpdateParams {
  creditedLines?: CreditedLineParam[]
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

/**
 * A commercial line of a decision-backed recurrence.
 *
 * It carries its own presentation because a recurrence stores no decision: each
 * occurrence is decided on ITS OWN effective date, so a stored decision would
 * apply last quarter's rules to this quarter's invoice.
 */
export interface RecurringTaxLineParam extends TaxDecisionLineParam {
  unit: Unit
  product?: string | null
}

/** Integration line of a recurrence: supplied VAT, re-validated at EVERY occurrence. */
export interface RecurringIntegrationTaxLineParam extends IntegrationTaxDecisionLineParam {
  unit: Unit
  product?: string | null
}

/**
 * Fiscal inputs of the per-occurrence decisions. The recurrence keeps ONE
 * fiscal source for its whole life; each occurrence takes a NEW decision under
 * it, on its own effective date.
 */
export type RecurringTaxInputsParam =
  | { taxSource: 'facturino'; priceMode: PriceMode; lines: RecurringTaxLineParam[] }
  | { taxSource: 'integration'; priceMode: PriceMode; lines: RecurringIntegrationTaxLineParam[] }

export interface RecurringInvoiceCreateParams {
  customerId: string
  frequency: RecurringFrequency
  startDate: string
  nextGenerationDate: string
  endDate?: string
  customIntervalDays?: number
  /**
   * Commercial inputs of the per-occurrence decisions. Required: an
   * occurrence that cannot be decided generates no invoice.
   */
  taxInputs: RecurringTaxInputsParam
  /** Presentation and terms of the generated invoices — never a line. */
  templateInvoice: {
    notes?: string
    paymentMethod?: PaymentMethod
    paymentTermsDays?: number
  }
  autoFinalize?: boolean
  autoSend?: boolean
}

export interface RecurringInvoiceUpdateParams {
  /** Replaces the fiscal inputs (same fiscal source for the recurrence's life). */
  taxInputs?: RecurringTaxInputsParam
  frequency?: RecurringFrequency
  nextGenerationDate?: string
  endDate?: string
  customIntervalDays?: number
  templateInvoice?: {
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
  vatRegime: 'normal' | 'normal_quarterly' | 'franchise' | 'simplified' | 'debit'
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
  vatRegime?: 'normal' | 'normal_quarterly' | 'franchise' | 'simplified' | 'debit'
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

/** Subscription (platform) invoice issued to this account. */
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

// ---------------------------------------------------------------------------
// Tax decisions
// ---------------------------------------------------------------------------

/**
 * Whether the amounts you send include VAT.
 *
 * `tax_exclusive`: VAT is added to your unit amounts.
 * `tax_inclusive`: VAT is extracted from them.
 */
export type PriceMode = 'tax_exclusive' | 'tax_inclusive'

/**
 * Fiscal nature of a line.
 *
 * `electronically_supplied_services` carries its own place-of-supply rules and
 * is not the same as an ordinary service. `deposit` and `ancillary_costs`
 * follow the principal supply, which they must name via `relatedCategory`.
 */
/**
 * One line of a commercial draft: the operation as stated, with NO VAT.
 *
 * `unitPrice` is in integer cents, in the draft's `priceMode`; `quantity` is a
 * decimal string. `rateCategory` is the band the seller asks for — the decision
 * concludes the actual rate.
 */
export interface CommercialDraftLine {
  /** Stable reference, assigned server-side; the decision reuses it. */
  reference: string
  description: string
  quantity: string
  unit: Unit
  unitPrice: number
  supplyCategory: SupplyCategory
  rateCategory: RateCategory
  discount?: TaxDecisionDiscount
  product?: string | null
}

/**
 * The operation an undecided draft states. Its total is COMMERCIAL: neither a
 * decided net nor a decided gross amount, because nothing has been decided yet.
 */
export interface CommercialDraft {
  priceMode: PriceMode
  lines: CommercialDraftLine[]
  totalCents: number
}

export type SupplyCategory =
  | 'goods'
  | 'services'
  | 'electronically_supplied_services'
  | 'deposit'
  | 'ancillary_costs'

/** Principal supply a deposit or an ancillary cost follows. */
export type PrimarySupplyCategory = 'goods' | 'services' | 'electronically_supplied_services'

/** Rate band requested. The engine decides whether it actually applies. */
export type RateCategory = 'standard' | 'intermediate' | 'reduced' | 'super_reduced' | 'specific'

/** Where the goods physically go. Relevant to cross-border supplies of goods. */
export type GoodsMovement =
  | 'stays_in_seller_territory'
  | 'dispatched_to_buyer_territory'
  | 'unknown'

/**
 * Only `final` carries amounts.
 *
 * On any other status `totals` and `amountToCharge` are `null`, never `0`:
 * absent is not "nothing to charge".
 */
export type TaxDecisionStatus = 'final' | 'pending_verification' | 'unsupported'

/** Explicit discount. `percent` in centi-percent (2500 = 25.00 %), `amount` in integer cents. */
export interface TaxDecisionDiscount {
  type: 'percent' | 'amount'
  value: number
}

export interface TaxDecisionLineParam {
  /** Stable caller-side reference, echoed on the decided line. */
  reference: string
  description: string
  category: SupplyCategory
  /** Required when `category` is `deposit` or `ancillary_costs`. */
  relatedCategory?: PrimarySupplyCategory
  rateCategory: RateCategory
  /** Only `general` is implemented; anything else is reported as unsupported. */
  placeOfSupplyRule?: string
  goodsMovement?: GoodsMovement
  /** Unit amount in integer cents, in the request's `priceMode`. */
  unitAmount: number
  /** Decimal quantity sent as a STRING, never a float. Up to 6 decimals. */
  quantity: string
  discount?: TaxDecisionDiscount
}

/** Kind of location signal (Implementing Regulation (EU) 282/2011). */
export type LocationEvidenceKind =
  | 'billing_address'
  | 'ip_geolocation'
  | 'bank_details'
  | 'sim_mobile_country'
  | 'fixed_line'
  | 'other_commercial'

/** Who supplied the signal. */
export type EvidenceSource = 'psp' | 'network' | 'bank' | 'declared' | 'other'

/**
 * One piece of location evidence.
 *
 * Send the territorial SIGNAL, never the raw one: a country — and a postal code
 * where the territory needs one — not an IP address, a PSP payload or bank
 * account details. `reference` is a bounded opaque identifier (a PSP charge id,
 * a geolocation batch id), not the signal itself.
 */
export interface LocationEvidenceParam {
  kind: LocationEvidenceKind
  /** ISO 3166-1 alpha-2. */
  country: string
  postalCode?: string
  /** Is the evidence from a party independent of both seller and buyer? */
  thirdParty: boolean
  source: EvidenceSource
  /** Civil date `YYYY-MM-DD`. */
  collectedAt: string
  reference?: string
}

/** Non-EU business-status evidence (282/2011 art. 18-3). */
export interface NonEuBusinessEvidenceParam {
  kind: 'tax_authority_certificate' | 'vat_or_similar_number' | 'other_commercial_evidence'
  reference: string
  /** ISO 3166-1 alpha-2. */
  issuedByCountry: string
  issuedByPostalCode?: string
  reasonableVerificationPerformed: boolean
  collectedAt: string
}

interface TaxDecisionCreateBaseParams {
  customerId: string
  /** Civil date `YYYY-MM-DD`. A timestamp is refused: the timezone call is yours. */
  effectiveAt: string
  /** `eur` only in this ruleset. Any other currency is refused, never converted. */
  currency: string
  priceMode: PriceMode
  locationEvidence?: LocationEvidenceParam[]
  nonEuBusinessEvidence?: NonEuBusinessEvidenceParam
  /**
   * Previous decision this one retries after supplying the missing facts. The
   * commercial operation must be identical; only the evidence may change.
   */
  retryOfTaxDecisionId?: string
}

/**
 * `taxSource: 'facturino'` — the VAT is DETERMINED by Facturino. You describe
 * the operation; the rate, the category, the VATEX code, the legal mentions,
 * the amounts and the three reporting axes are decided server-side.
 */
export interface FacturinoTaxDecisionCreateParams extends TaxDecisionCreateBaseParams {
  taxSource: 'facturino'
  lines: TaxDecisionLineParam[]
}

/**
 * Line of an INTEGRATION decision: the same commercial data plus the VAT your
 * own engine concluded. Facturino validates the coherence of rate/category/
 * VATEX and refuses any detectable contradiction (`integration_vat_incoherent`)
 * — it never silently corrects a supplied rate.
 */
export interface IntegrationTaxDecisionLineParam {
  /** Stable caller-side reference, echoed on the decided line. */
  reference: string
  description: string
  category: SupplyCategory
  /** Required when `category` is `deposit` or `ancillary_costs`. */
  relatedCategory?: PrimarySupplyCategory
  /**
   * Physical movement of the goods.
   *
   * Required as soon as the buyer is a consumer established in another member
   * state: that movement decides whether the intra-EU distance-sale rule applies
   * (Directive 2006/112/CE art. 33, a), and it is never assumed. Irrelevant on a
   * service.
   */
  goodsMovement?: GoodsMovement
  /** Unit amount in integer cents, in the request's `priceMode`. */
  unitAmount: number
  /** Decimal quantity sent as a STRING, never a float. Up to 6 decimals. */
  quantity: string
  discount?: TaxDecisionDiscount
  /** Supplied VAT rate in centipercent (2000 = 20.00 %). Never corrected. */
  vatRate: number
  /** Supplied EN 16931 category code (BT-151). */
  vatCode: VatCode
  /** VATEX code (BT-121). Required for E/AE/K/G/O; refused for S/Z. */
  vatexCode?: string
  /**
   * Declared place of supply (canonical territory id, e.g. `FR-MET`, `DE`).
   *
   * Required as soon as the buyer is established in a French overseas
   * collectivity or the TAAF (`PM`, `BL`, `MF`, `PF`, `NC`, `WF`, `TF`): the
   * place is what says whether the local tax of that collectivity is at stake,
   * and it is never assumed. A place located in one of those seven makes the
   * decision non-final, except the sourced New Caledonian B2B case.
   */
  placeOfSupply?: string
}

/**
 * `taxSource: 'integration'` — the VAT is SUPPLIED by the integration and
 * validated for coherence. The amounts, the legal mentions and the three
 * reporting axes are still decided server-side, by the same engines.
 */
export interface IntegrationTaxDecisionCreateParams extends TaxDecisionCreateBaseParams {
  taxSource: 'integration'
  lines: IntegrationTaxDecisionLineParam[]
}

/** The two fiscal journeys of the stable contract — `taxSource` is required. */
export type TaxDecisionCreateParams =
  | FacturinoTaxDecisionCreateParams
  | IntegrationTaxDecisionCreateParams

/** VIES consultation outcome. The status is kept, never the raw response. */
export interface ViesResult {
  status: 'valid' | 'invalid' | 'unavailable' | 'invalid_format'
  checkedAt: string | null
  normalizedVatNumber: string | null
  source: 'vies'
  returnedName: string | null
  consultationNumber: string | null
}

/** Normalized territorial evidence kept with the decision. No raw signal is exposed. */
export interface LocationEvidenceResult {
  kind: LocationEvidenceKind
  /**
   * Canonical territory the evidence points to, or `null` when it resolved at
   * COUNTRY level only: a network kind (`ip_geolocation`, `bank_details`,
   * `sim_mobile_country`, `fixed_line`) supplied without a postal code. The
   * country is then `declaredCountry`.
   */
  territoryId: string | null
  declaredCountry: string
  declaredPostalCode: string | null
  thirdParty: boolean
  source: EvidenceSource
  collectedAt: string
  reference: string | null
}

export interface NonEuBusinessEvidenceResult {
  kind: 'tax_authority_certificate' | 'vat_or_similar_number' | 'other_commercial_evidence'
  reference: string
  issuedByTerritoryId: string
  reasonableVerificationPerformed: boolean
  collectedAt: string
}

/** One decided line. Amounts in integer cents. */
export interface TaxDecisionLine {
  reference: string
  description: string
  category: SupplyCategory
  relatedCategory: PrimarySupplyCategory | null
  effectiveCategory: string | null
  quantity: string
  unitAmount: number
  discount: TaxDecisionDiscount | null
  /** Requested rate band. `null` on an integration line: the exact rate was supplied. */
  rateCategory: RateCategory | null
  placeOfSupplyRule: string | null
  goodsMovement: GoodsMovement | null
  treatment: string | null
  vatCategoryCode: string | null
  vatexCode: string | null
  legalMention: string | null
  rateCentipercent: number | null
  rateBasis: string | null
  placeOfSupply: string | null
  placeOfSupplyReference: string | null
  treatmentReference: string | null
  amountHT: number | null
  amountVAT: number | null
  amountTTC: number | null
  invoiceChannel: InvoiceChannel | null
  transactionReporting: TransactionReporting | null
  paymentReporting: PaymentReporting | null
}

/** How much of the seller's covered activity Facturino actually sees. */
export type EuThresholdCoverageMode = 'facturino_only' | 'mixed_channels'

/**
 * The slice of the ANNUAL LEDGER this decision took, frozen with it.
 *
 * The running total is not a photograph left on the fiscal profile: it is a
 * transactional ledger per company, per mode and per year, and the decision
 * freezes the slice it occupied there — which ledger, at which version, at which
 * position in the total order of movements.
 */
export interface TaxDecisionThresholdTrace {
  /**
   * Which fact settled the question. On `previous_year` the previous calendar
   * year closes it on its own, and the running total is reported without
   * deciding anything.
   */
  decidedOn: 'previous_year' | 'ledger_cumulative'
  /** Cap of art. 59 quater §1, in integer cents. */
  capCents: number
  /** Ledger the figures come from (`2026_live`, `2026_test`). */
  stateId: string
  year: string
  /** Ledger version the slice was taken at. */
  stateVersion: number
  /** Position of the operation in the ledger's total order. */
  sequence: number
  /** Reservation the slice was held under — the decision's idempotency claim. */
  reservationId: string
  coverageMode: EuThresholdCoverageMode
  previousYearAmountCents: number
  currentYearOpeningCents: number
  openingDeclaredAt: string
  /** Day the channels other than Facturino are declared complete through. */
  externalCompleteThroughDate: string
  adjustmentTotalCents: number
  adjustmentCount: number
  /** Total that CERTAINLY precedes the operation: settled movements only. */
  cumulativeBeforeMinCents: number
  /**
   * The same total plus every slice held by an operation being decided at the
   * same moment. The gap between the two bounds IS that concurrency, and a
   * verdict is frozen only when it holds at both — which is what makes it
   * immune to the abandonment of any of those operations.
   */
  cumulativeBeforeMaxCents: number
  /** How many concurrent operations the upper bound accounts for. */
  pendingPredecessorCount: number
  /**
   * Value the operation adds to the running total. Under a tax-inclusive price
   * the VAT-exclusive value depends on the rate the threshold has to decide, so
   * it is an interval; under a tax-exclusive price both bounds coincide.
   */
  operationValueMinCents: number
  operationValueMaxCents: number
  cumulativeAfterMinCents: number
  cumulativeAfterMaxCents: number
}

/** Why an amount already counted is taken back out of the running total. */
export type EuThresholdCorrectionKind = 'credit_note' | 'cancellation' | 'refund'

/** One movement of the ledger. Written once, never rewritten. */
export interface EuThresholdLedgerEntry {
  /**
   * Deterministic, path-safe id derived from the movement. Your own `reference`
   * is DATA, never an identifier.
   */
  id: string
  sequence: number
  kind:
    | 'opening'
    | 'external_adjustment'
    | 'external_correction'
    | 'reservation_consumed'
    | 'reservation_released'
    | 'review_opened'
    | 'review_resolved'
  /** Signed effect on the running total: negative for a qualified correction. */
  amountMin: number
  amountMax: number
  /** The same effect, in the art. 24 ter services perimeter. Independent. */
  evidenceAmountMin: number
  evidenceAmountMax: number
  cumulativeMin: number
  cumulativeMax: number
  evidenceCumulativeMin: number
  evidenceCumulativeMax: number
  taxDecisionId: string | null
  effectiveAt: string | null
  /** Your own reference, kept verbatim. */
  reference: string | null
  correction: {
    kind: EuThresholdCorrectionKind
    correctsEntryId: string
    relatedResourceType: string
    relatedResourceId: string
    evidenceReference: string
  } | null
  reason: string
  recordedAt: string
  /** Did this movement bring turnover in, and therefore have anything to give back? */
  correctable: boolean
  /** What it has ALREADY given back, over every correction that named it. */
  correctedMin: number
  correctedEvidenceMin: number
  correctionCount: number
  /**
   * What is LEFT to give back on it. A movement gives back what it brought in,
   * ONCE, whatever the number of corrections: the balance is kept inside the
   * transaction, and a correction beyond it answers
   * `eu_threshold_correction_exceeds_counted`.
   */
  remainingMin: number
  remainingEvidenceMin: number
}

/** One page of movements, newest first. */
export interface EuThresholdLedgerEntryList {
  object: 'list'
  url: string
  data: EuThresholdLedgerEntry[]
  has_more: boolean
  next_cursor: string | null
}

/**
 * A slice held by a decision in flight.
 *
 * It is NOT acquired: it may still be given back, and it is published apart
 * from the acquired total for exactly that reason.
 */
export interface EuThresholdReservation {
  id: string
  sequence: number
  effectiveAt: string
  contributionMin: number
  contributionMax: number
  evidenceContributionMin: number
  evidenceContributionMax: number
  reservedAt: string
  expiresAt: string
}

/** Why the ledger stopped serving decisions. */
export type EuThresholdReviewCode =
  | 'consumed_slice_missing'
  | 'correction_not_qualifiable'
  | 'declared_by_administrator'

/**
 * The annual ledger of the two EU B2C thresholds.
 *
 * It carries TWO counters, strictly apart: the common EUR 10,000 threshold
 * (art. 59 quater §1 — intra-EU distance sales of goods AND cross-border
 * services to consumers) and the EUR 100,000 location-evidence threshold
 * (Reg. 282/2011 art. 24 ter, 2nd subparagraph — electronically supplied
 * services only). A distance sale of goods raises the first and never the
 * second.
 */
export interface EuThresholdLedger {
  object: 'eu_threshold_ledger'
  id: string
  companyId: string
  livemode: boolean
  year: string
  version: number
  /**
   * `review_required` blocks every new reservation: the running total is known
   * to be wrong, and a decision is frozen on the figures it reads.
   */
  status: 'open' | 'review_required'
  review: { code: EuThresholdReviewCode; detail: string; openedAt: string } | null
  capCents: number
  evidenceCapCents: number
  opening: {
    previousYearAmount: number
    currentYearOpening: number
    previousYearEvidenceAmount: number
    currentYearEvidenceOpening: number
    coverageMode: EuThresholdCoverageMode
    externalCompleteThroughDate: string
    /** ISO instant the opening was actually declared. */
    declaredAt: string
  }
  externalCompleteThroughDate: string
  adjustmentTotal: number
  adjustmentEvidenceTotal: number
  adjustmentCount: number
  /** Total of the qualified corrections, POSITIVE and subtracted. */
  correctionTotal: number
  correctionEvidenceTotal: number
  correctionCount: number
  /** Total already ACQUIRED: opening + adjustments − corrections + final decisions. */
  acquiredMin: number
  acquiredMax: number
  acquiredEvidenceMin: number
  acquiredEvidenceMax: number
  /**
   * Slices held right now by operations being decided. NOT acquired, and never
   * summed with the figures above: they may still disappear.
   */
  reservedMin: number
  reservedMax: number
  reservedEvidenceMin: number
  reservedEvidenceMax: number
  /** What is left before each cap, on the figures already acquired. */
  remainingMin: number
  evidenceRemainingMin: number
  settledCount: number
  lastConsumedEffectiveAt: string | null
  reservations: EuThresholdReservation[]
  /** First page of movements, newest first. */
  entries: EuThresholdLedgerEntry[]
  entriesHasMore: boolean
  entriesNextCursor: string | null
  created: string
  updated: string
}

export interface OpenEuThresholdLedgerParams {
  year: string
  /** Covered supplies of the PREVIOUS calendar year, VAT excluded, in cents. */
  previousYearAmount: number
  /** Covered supplies ALREADY made this year, VAT excluded, in cents. */
  currentYearOpening: number
  /**
   * Electronically supplied services to consumers of the Union over the same
   * period, DOMESTIC ones included — the perimeter of the EUR 100,000 art. 24b
   * location-evidence threshold. INDEPENDENT of `previousYearAmount` in both
   * directions: the common threshold counts only cross-border supplies, so this
   * figure can legitimately be larger.
   */
  previousYearEvidenceAmount: number
  /** Same perimeter for the current year, independent of `currentYearOpening`. */
  currentYearEvidenceOpening: number
  coverageMode: EuThresholdCoverageMode
  /**
   * Day the channels other than Facturino are complete through. It must belong
   * to the ledger's own year and never be in the future.
   */
  externalCompleteThroughDate: string
}

export interface EuThresholdAdjustmentParams {
  /**
   * Your own identifier: it is the entry's identity, so replaying the SAME body
   * adds nothing and reusing it for a different one answers
   * `eu_threshold_entry_conflict`. It never becomes a document id.
   */
  reference: string
  /** VAT-exclusive amount to add, in cents. NEVER negative. */
  amount: number
  /**
   * The art. 24b part of the same movement. INDEPENDENT of `amount`: a domestic
   * electronic service raises this counter and not the other.
   */
  evidenceAmount: number
  externalCompleteThroughDate: string
  reason: string
}

/**
 * Take a qualified amount back out of the running total.
 *
 * This is NOT a negative adjustment. Directive 2006/112/EC art. 90(1) reduces
 * the taxable amount of a supply on cancellation, refusal or a price reduction
 * after the supply, and the thresholds count the VALUE of the supplies — so a
 * correction NAMES the movement it corrects, its qualification, the resource it
 * rests on and its evidence, and never gives back more than that movement
 * brought in.
 */
export interface EuThresholdCorrectionParams {
  reference: string
  /**
   * Movement of THIS ledger whose taxable amount is reduced. Constrained to the
   * ids the ledger mints (`opening`, or `adj_`/`cor_`/`con_`/`rel_`/`rev_`
   * followed by 32 hex characters): it reaches a document path, and free text
   * must not. A movement that brought no turnover in answers
   * `eu_threshold_correction_target_not_correctable`.
   */
  correctsEntryId: string
  kind: EuThresholdCorrectionKind
  /**
   * VAT-exclusive amount given back, in cents. The ledger keeps the BALANCE of
   * each movement inside the transaction: the corrections of one movement never
   * add up to more than it brought in.
   */
  amount: number
  /** Its services part; independent of `amount`. */
  evidenceAmount: number
  relatedResourceType: string
  relatedResourceId: string
  evidenceReference: string
  reason: string
}

/** Put the ledger under review: a declaration, so a stated reason is enough. */
export interface EuThresholdReviewParams {
  reason: string
}

/**
 * Settle a review — by RECONCILIATION, never by comment.
 *
 * A review says the running total is known to be wrong. Reopening the ledger on
 * a free-text note would put that same total back in front of the next verdict
 * with a sentence for only guarantee. So you state the figures you actually
 * verified, and the server compares them to its own: `reconciledVersion` pins
 * the state that was checked (a movement recorded since answers
 * `eu_threshold_reconciliation_stale`), and the two acquired totals must match
 * (`eu_threshold_reconciliation_mismatch`, which returns both figures).
 *
 * What was verified is written into the immutable `review_resolved` movement,
 * with its evidence reference.
 */
export interface EuThresholdReviewResolutionParams {
  /** Ledger version the reconciliation was carried out against. */
  reconciledVersion: number
  /** Acquired total of the common counter, as verified. */
  reconciledAcquiredMin: number
  /** Acquired total of the art. 24b counter, as verified. */
  reconciledAcquiredEvidenceMin: number
  /** Where the reconciliation itself is filed. */
  evidenceReference: string
  reason: string
}

export interface EuThresholdEntryListParams {
  limit?: number
  starting_after?: string
}

/** The rate entry a destination-taxed decision was taken under. */
export interface TaxDecisionDestinationRate {
  registryVersion: string
  memberState: string
  /** Canonical territory rated — a region when the state publishes one. */
  territoryId: string
  regionId: string | null
  centipercent: number
  validFrom: string
  validTo: string | null
  source: string
  verifiedAt: string
}

/**
 * How the tax due at destination is declared. Never a place-of-supply rule.
 *
 * The registration is DATED: a one-stop shop opened in October does not declare
 * a September sale.
 */
export interface TaxDecisionDestinationMechanism {
  kind: 'oss_union' | 'local_registration'
  memberState: string
  reference: string
  /** Member state of identification of the scheme; `null` for a local one. */
  memberStateOfIdentification: string | null
  effectiveFrom: string
  effectiveTo: string | null
}

/**
 * How the art. 24 ter single-evidence relaxation was settled, with the figures
 * it rested on.
 *
 * It is COMPUTED by the engine on the ledger's EUR 100,000 counter — the one
 * that never counts a distance sale of goods — and never declared by the
 * seller. `undeterminable` is a first-class answer: two items of evidence are
 * then required, and the issue says which fact is missing.
 */
export interface TaxDecisionEvidenceRelief {
  status: 'available' | 'unavailable' | 'undeterminable'
  /** Cap of art. 24 ter, 2nd subparagraph, in integer cents (10,000,000). */
  capCents: number
  stateId: string | null
  year: string | null
  previousYearAmountCents: number | null
  cumulativeAfterMinCents: number | null
  cumulativeAfterMaxCents: number | null
  undeterminedCode:
    | 'ledger_not_consulted'
    | 'ledger_unavailable'
    | 'amount_interval_straddles_cap'
    | null
}

/**
 * What the EU B2C destination rule concluded, frozen as data.
 *
 * `null` on every operation the rule does not reach. Present as soon as it
 * covers a line, including on a decision that is NOT final: it then states what
 * was settled and what is missing.
 */
export interface TaxDecisionEuB2cDestination {
  coveredLineIds: string[]
  ruleKinds: Array<'tbe_services' | 'intra_eu_distance_sale'>
  destinationMemberState: string
  destinationTerritoryId: string
  place: 'origin' | 'destination' | null
  /**
   * What settled the place. `oss_union_registration`: the seller holds an ACTIVE
   * Union one-stop-shop registration — for a French seller, registering IS how
   * the option of art. 59c(3) is exercised, so the threshold has nothing left to
   * decide and `threshold` stays `null`, exactly as on an explicit option.
   * Sourced for France only: the way the option is exercised is fixed by the
   * member state where it is exercised.
   */
  basis:
    | 'multi_member_state_establishment'
    | 'destination_option'
    | 'oss_union_registration'
    | 'threshold_exceeded'
    | 'below_threshold'
    | null
  reference: string
  detail: string
  threshold: TaxDecisionThresholdTrace | null
  option: { effectiveFrom: string; effectiveTo: string | null } | null
  mechanism: TaxDecisionDestinationMechanism | null
  rate: TaxDecisionDestinationRate | null
  /** How the art. 24 ter relaxation was settled. `null` when the rule did not apply. */
  evidenceRelief: TaxDecisionEvidenceRelief | null
}

/**
 * The axes French law settles on its own, carried by a decision that is NOT
 * final. An axis is `null` when it depends on the treatment the engines could
 * not conclude; it is never guessed.
 */
export interface TaxDecisionSettledObligations {
  invoiceChannel: InvoiceChannel | null
  transactionReporting: TransactionReporting | null
  paymentReporting: PaymentReporting | null
}

/** Whether the invoice travels the e-invoicing network. */
export type InvoiceChannel = 'einvoicing' | 'none'
/** Whether the transaction itself must be reported. */
export type TransactionReporting = 'ereporting' | 'none' | 'outside_scope'
/** Whether and how the collection must be reported. */
export type PaymentReporting = 'fr212' | 'ereporting' | 'none'

/** Buyer identity and qualification, frozen when the decision was taken. */
export interface TaxDecisionCustomer {
  customerId: string
  name: string
  nature: 'business' | 'consumer'
  natureBasis: string
  territoryId: string
  territoryKind: string
  declaredCountry: string
  declaredPostalCode: string | null
  legalRegistrationId: string | null
  vatNumber: string | null
  crossBorderTaxableStatus: string
  businessStatusBasis: string
}

/** Why an axis carries the obligation it does. */
export interface TaxDecisionObligationReason {
  axis: 'invoiceChannel' | 'transactionReporting' | 'paymentReporting'
  code: string
  reference: string
  message: string
}

/** What is missing, on a decision that is not final. */
export interface TaxDecisionIssue {
  code: string
  message: string
}

export interface TaxDecisionVatBreakdownEntry {
  rateCentipercent: number
  categoryCode: string
  vatexCode: string | null
  base: number
  amount: number
}

/**
 * An immutable fiscal position.
 *
 * It fixes the VAT, the exact amount to charge and the three reporting axes for
 * ONE commercial operation, then never changes. A decision is never modified or
 * deleted — request a new one, optionally with `retryOfTaxDecisionId`.
 */
export interface TaxDecision {
  id: string
  object: 'tax_decision'
  companyId: string
  /** Fiscal source of the decision — `facturino` or `integration`. */
  taxSource: TaxSource
  status: TaxDecisionStatus
  customerId: string
  customer: TaxDecisionCustomer
  sellerProfileId: string
  sellerProfileRevision: number
  sellerProfile: Record<string, unknown>
  currency: string
  priceMode: PriceMode
  effectiveAt: string
  decidedAt: string
  /** Past this instant the decision may no longer open a payment. It stays readable. */
  expiresAt: string
  checkoutValidityPolicy: 'checkout-validity-v1'
  /** Derived from the server clock at read time, never stored. */
  expired: boolean
  rulesVersion: string
  reportingCalendar: string
  roundingPolicy: string
  /** SHA-256 of the canonical request. Never the raw idempotency key. */
  requestFingerprint: string
  /** SHA-256 of the commercial operation, used to control retries. */
  operationFingerprint: string
  lines: TaxDecisionLine[]
  /** `null` on any status other than `final`. */
  totals: { totalHT: number; totalVAT: number; totalTTC: number } | null
  vatBreakdown: TaxDecisionVatBreakdownEntry[]
  /** Exact amount to charge, in integer cents. `null` unless the decision is final. */
  amountToCharge: number | null
  invoiceChannel: InvoiceChannel | null
  transactionReporting: TransactionReporting | null
  paymentReporting: PaymentReporting | null
  /**
   * Obligation axes French law settles DESPITE a non-final decision.
   *
   * `null` on a final decision: the three axes above are the settled ones and
   * nothing duplicates them. On `pending_verification` or `unsupported`, each
   * axis is either the settled value or `null` when it genuinely depends on the
   * treatment that could not be concluded. This object authorises NOTHING: a
   * non-final decision is not invoiceable, never reaches a Plateforme Agréée and
   * never opens a payment.
   */
  settledObligations: TaxDecisionSettledObligations | null
  /**
   * What the EU B2C destination rule concluded — verdict, threshold figures,
   * declarative mechanism and the exact rate entry with its source, its
   * verification date and its period. `null` on every operation the rule does
   * not reach, and on a decision frozen before this field existed.
   */
  euB2cDestination: TaxDecisionEuB2cDestination | null
  /**
   * A foreign tax may apply. Facturino decides French VAT and the matching
   * French obligations; this case must be reviewed outside Facturino.
   */
  foreignTaxReviewRequired: boolean
  vies: ViesResult | null
  locationEvidence: LocationEvidenceResult[]
  nonEuBusinessEvidence: NonEuBusinessEvidenceResult | null
  issues: TaxDecisionIssue[]
  obligationReasons: TaxDecisionObligationReason[]
  retryOfTaxDecisionId: string | null
  livemode: boolean
  created: string
  updated: string
}

// ---------------------------------------------------------------------------
// Documents backed by a decision
// ---------------------------------------------------------------------------

/**
 * Where a document's VAT comes from — the two equal journeys of the stable
 * contract. `facturino`: the VAT was determined by the Facturino engines.
 * `integration`: the VAT was supplied by the integration and validated for
 * coherence — never silently corrected. A commercial draft created from the
 * app reads `taxSource: null` until its decision is taken.
 */
export type TaxSource = 'facturino' | 'integration'

/** Documentary axis. */
export type DocumentStatus = 'draft' | 'finalized' | 'cancelled'
/** Transmission axis. A collection never moves it. */
export type TransmissionStatus =
  | 'not_applicable' | 'pending' | 'sending' | 'deposited'
  | 'transmitted' | 'approved' | 'rejected'
/** DGFiP detail inside `transmitted` / `rejected`. */
export type TransmissionDetail = 'available' | 'received' | 'suspended' | 'refused' | null
/** Collection axis. A refund does not erase the collection that happened. */
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'partially_refunded' | 'refunded'

/**
 * A presentation-only line of a decision-backed document.
 *
 * It carries no VAT: the rate, the category, the VATEX code and the legal
 * mention all come from the decision line it references.
 */
export interface DecisionBackedLineParam {
  /** Reference of the decided line this document line renders. */
  taxLineRef: string
  unit: Unit
  product?: string | null
}

/** The frozen fiscal position copied onto a document. */
export interface TaxSnapshot {
  taxDecisionId: string
  /** Fiscal source of the decision, frozen with it. */
  taxSource?: TaxSource
  priceMode: PriceMode
  currency: string
  rulesVersion?: string
  reportingCalendar?: string
  effectiveAt?: string
  invoiceChannel?: InvoiceChannel | null
  transactionReporting?: TransactionReporting | null
  paymentReporting?: PaymentReporting | null
  amountToChargeCents?: number
  legalMentions?: string[]
  lines?: Array<Record<string, unknown>>
  totals?: Record<string, number>
  vatBreakdown?: Array<Record<string, unknown>>
}
