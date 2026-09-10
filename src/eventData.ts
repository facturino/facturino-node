import type { PaymentCollectionStatus, WebhookEvent } from './types.js'
/** Typed payloads selected by event type. Unknown fields remain available in the raw response. */
export interface InvoiceWebhookData {
  id: string
  object: "invoice"
  status: string
  previous_status?: string
  livemode?: boolean
  number?: string | null
  documentStatus?: "draft" | "finalized" | "cancelled"
  transmissionStatus?: "not_applicable" | "pending" | "sending" | "deposited" | "transmitted" | "approved" | "rejected"
  transmissionDetail?: 'available' | 'received' | 'suspended' | 'refused' | null
  paymentStatus?: "unpaid" | "partially_paid" | "paid" | "partially_refunded" | "refunded"
  paErrorCode?: string | null
  rejectionReason?: string | null
  rejectionCategory?: "buyer_not_in_directory" | "addressing_error" | "other" | "format_invalid" | "semantic_error" | "duplicate" | "platform_auth" | "platform_unavailable" | "refused_by_buyer" | "suspended" | "unknown" | null
  rejectionCode?: string | null
  rejectionSource?: "platform" | "buyer" | "facturino" | null
  metadata?: Record<string, unknown>
}

export interface IncomingInvoiceWebhookData {
  id: string
  object: "received_invoice"
  pa_invoice_id: string
  sender_siret?: string
  sender_name?: string
  number?: string | null
  total_ht?: string
  total_tva?: string
  total_ttc?: string
}

export interface QuoteWebhookData {
  id: string
  object: "quote"
  status: string
  previous_status?: string
  livemode?: boolean
  number?: string | null
  metadata?: Record<string, unknown>
}

export interface CreditNoteWebhookData {
  paStatus?: string
  paInvoiceId?: string | null
  id: string
  object: "credit_note"
  status: string
  previous_status?: string
  livemode?: boolean
  number?: string | null
  documentStatus?: "draft" | "finalized" | "cancelled"
  transmissionStatus?: "not_applicable" | "pending" | "sending" | "deposited" | "transmitted" | "approved" | "rejected"
  transmissionDetail?: 'available' | 'received' | 'suspended' | 'refused' | null
  paymentStatus?: "unpaid" | "partially_paid" | "paid" | "partially_refunded" | "refunded"
  paErrorCode?: string | null
  rejectionReason?: string | null
  rejectionCategory?: "buyer_not_in_directory" | "addressing_error" | "other" | "format_invalid" | "semantic_error" | "duplicate" | "platform_auth" | "platform_unavailable" | "refused_by_buyer" | "suspended" | "unknown" | null
  rejectionCode?: string | null
  rejectionSource?: "platform" | "buyer" | "facturino" | null
  metadata?: Record<string, unknown>
  relatedInvoiceId?: string | null
  relatedInvoiceNumber?: string | null
}

export interface CustomerWebhookData {
  id: string
  object: "customer"
  livemode: boolean
}

export interface PaymentCreatedWebhookData {
  invoiceId: string
  paymentId: string
  amount: string
  method: string
}

export interface PaymentReceivedWebhookData {
  /** Null when an older/aggregated ledger change cannot be attributed. */
  paymentId?: string | null
  /** Collection state at publication; read the payment for its current state. */
  fr212?: PaymentCollectionStatus | null
  id: string
  object: "invoice"
  status?: string
  previous_status?: string
  livemode?: boolean
  number?: string | null
  documentStatus?: "draft" | "finalized" | "cancelled"
  transmissionStatus?: "not_applicable" | "pending" | "sending" | "deposited" | "transmitted" | "approved" | "rejected"
  transmissionDetail?: 'available' | 'received' | 'suspended' | 'refused' | null
  paymentStatus?: "unpaid" | "partially_paid" | "paid" | "partially_refunded" | "refunded"
  paErrorCode?: string | null
  rejectionReason?: string | null
  rejectionCategory?: "buyer_not_in_directory" | "addressing_error" | "other" | "format_invalid" | "semantic_error" | "duplicate" | "platform_auth" | "platform_unavailable" | "refused_by_buyer" | "suspended" | "unknown" | null
  rejectionCode?: string | null
  rejectionSource?: "platform" | "buyer" | "facturino" | null
  metadata?: Record<string, unknown>
  amount: string
  total_paid: string
  total_due: string
  total?: string
  amountDue?: string
}

export interface EreportingWebhookData {
  id: string
  object: "ereporting"
  status: string
  type?: string | null
  period?: string | null
  attempt?: number
}

export interface RecurringGeneratedWebhookData {
  id: string
  object: "invoice"
  recurringInvoiceId: string
  livemode?: boolean
}

export interface RecurringFailedWebhookData {
  id: string
  object: "recurring_invoice"
  error: string
}

export interface ExportWebhookData {
  id: string
  object: "export"
  count: number
}

export interface SubscriptionWebhookData {
  plan?: string
  status: string
  stripeSubscriptionId?: string
  pausedUntil?: string | null
  reason?: string
}

export interface EventDataMap {
  "invoice.created": InvoiceWebhookData
  "invoice.finalized": InvoiceWebhookData
  "invoice.sending": InvoiceWebhookData
  "invoice.sent": InvoiceWebhookData
  "invoice.deposited": InvoiceWebhookData
  "invoice.transmitted": InvoiceWebhookData
  "invoice.available": InvoiceWebhookData
  "invoice.received": InvoiceWebhookData
  "invoice.approved": InvoiceWebhookData
  "invoice.refused": InvoiceWebhookData
  "invoice.rejected": InvoiceWebhookData
  "invoice.suspended": InvoiceWebhookData
  "invoice.paid": InvoiceWebhookData
  "invoice.partially_paid": InvoiceWebhookData
  "invoice.overdue": InvoiceWebhookData
  "invoice.incoming.received": IncomingInvoiceWebhookData
  "quote.created": QuoteWebhookData
  "quote.sent": QuoteWebhookData
  "quote.viewed": QuoteWebhookData
  "quote.accepted": QuoteWebhookData
  "quote.refused": QuoteWebhookData
  "quote.expired": QuoteWebhookData
  "quote.converted": QuoteWebhookData
  "credit_note.created": CreditNoteWebhookData
  "credit_note.finalized": CreditNoteWebhookData
  "credit_note.credit_deposited": CreditNoteWebhookData
  "credit_note.credit_transmitted": CreditNoteWebhookData
  "credit_note.credit_approved": CreditNoteWebhookData
  "credit_note.credit_refused": CreditNoteWebhookData
  "credit_note.sent": CreditNoteWebhookData
  "customer.created": CustomerWebhookData
  "customer.updated": CustomerWebhookData
  "customer.deleted": CustomerWebhookData
  "payment.created": PaymentCreatedWebhookData
  "payment.received": PaymentReceivedWebhookData
  "ereporting.submitted": EreportingWebhookData
  "recurring_invoice.generated": RecurringGeneratedWebhookData
  "recurring_invoice.failed": RecurringFailedWebhookData
  "export.ready": ExportWebhookData
  "subscription.created": SubscriptionWebhookData
  "subscription.cancelled": SubscriptionWebhookData
  "subscription.renewed": SubscriptionWebhookData
  "subscription.paused": SubscriptionWebhookData
}

export type TypedWebhookEvent = { [T in keyof EventDataMap]: Omit<WebhookEvent, 'type' | 'data'> & { type: T; data: EventDataMap[T] } }[keyof EventDataMap]
