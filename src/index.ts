import { HttpClient } from './client.js'
import { Webhooks } from './webhooks.js'
import { Invoices } from './resources/invoices.js'
import { Customers } from './resources/customers.js'
import { Products } from './resources/products.js'
import { Quotes } from './resources/quotes.js'
import { CreditNotes } from './resources/creditNotes.js'
import { Events } from './resources/events.js'
import { WebhookEndpoints } from './resources/webhookEndpoints.js'
import { RecurringInvoices } from './resources/recurringInvoices.js'
import { Companies } from './resources/companies.js'
import { Members } from './resources/members.js'
import { ApiKeys } from './resources/apiKeys.js'
import { Exports } from './resources/exports.js'
import { EReportingResource } from './resources/ereporting.js'
import { Jobs } from './resources/jobs.js'
import { Sandbox } from './resources/sandbox.js'
import type { FacturinoConfig } from './types.js'

/** Facturino API client for French e-invoicing — initialize with your API key to access all resources. */
class Facturino {
  readonly invoices: Invoices
  readonly customers: Customers
  readonly products: Products
  readonly quotes: Quotes
  readonly creditNotes: CreditNotes
  readonly events: Events
  readonly webhookEndpoints: WebhookEndpoints
  readonly recurringInvoices: RecurringInvoices
  readonly companies: Companies
  readonly members: Members
  readonly apiKeys: ApiKeys
  readonly exports: Exports
  readonly ereporting: EReportingResource
  readonly jobs: Jobs
  readonly sandbox: Sandbox
  readonly webhooks: Webhooks

  constructor(apiKey: string, config?: FacturinoConfig) {
    const client = new HttpClient(apiKey, config)

    this.invoices = new Invoices(client)
    this.customers = new Customers(client)
    this.products = new Products(client)
    this.quotes = new Quotes(client)
    this.creditNotes = new CreditNotes(client)
    this.events = new Events(client)
    this.webhookEndpoints = new WebhookEndpoints(client)
    this.recurringInvoices = new RecurringInvoices(client)
    this.companies = new Companies(client)
    this.members = new Members(client)
    this.apiKeys = new ApiKeys(client)
    this.exports = new Exports(client)
    this.ereporting = new EReportingResource(client)
    this.jobs = new Jobs(client)
    this.sandbox = new Sandbox(client)
    this.webhooks = new Webhooks()
  }
}

export default Facturino
export { Facturino }

export type {
  FacturinoConfig,
  RequestOptions,
  PaginationParams,
  PaginatedResponse,
  ApiErrorBody,
  Address,
  Contact,
  LineItem,
  VatBreakdown,
  Totals,
  CustomerRef,
  CustomerSnapshot,
  LifecycleEntry,
  Currency,
  Unit,
  VatCode,
  PaymentMethod,
  InvoiceType,
  InvoiceStatus,
  InvoiceDates,
  InvoicePaymentTerms,
  InvoiceEinvoicing,
  InvoicePortal,
  InvoiceArchive,
  InvoiceFiles,
  Invoice,
  InvoiceCreateParams,
  InvoiceLineItemParam,
  InvoiceUpdateParams,
  InvoiceListParams,
  InvoiceStatusResponse,
  InvoiceVerifyResponse,
  DocumentUrlResponse,
  JobResponse,
  PaymentLinkResponse,
  PaymentLinkCreateParams,
  PaymentTokenResponse,
  Payment,
  PaymentCreateParams,
  Customer,
  CustomerCreateParams,
  CustomerUpdateParams,
  CustomerListParams,
  CustomerLookupParams,
  SireneLookupResponse,
  Product,
  PriceHistoryEntry,
  ProductCreateParams,
  ProductUpdateParams,
  ProductListParams,
  QuoteStatus,
  QuoteDates,
  QuoteSignature,
  Quote,
  QuoteCreateParams,
  QuoteUpdateParams,
  QuoteListParams,
  CreditNoteType,
  CreditNoteStatus,
  CreditNoteReasonCode,
  CreditNote,
  CreditNoteCreateParams,
  CreditNoteUpdateParams,
  CreditNoteListParams,
  WebhookEventType,
  WebhookEvent,
  EventListParams,
  WebhookEndpoint,
  WebhookEndpointCreateParams,
  WebhookEndpointUpdateParams,
  RecurringFrequency,
  RecurringInvoice,
  RecurringInvoiceCreateParams,
  RecurringInvoiceUpdateParams,
  RecurringInvoiceListParams,
  BankDetails,
  InvoiceSettings,
  Company,
  CompanyUpdateParams,
  CgvResponse,
  MemberRole,
  MemberStatus,
  Member,
  MemberInviteParams,
  MemberUpdateParams,
  ApiKeyPermission,
  ApiKey,
  ApiKeyCreateParams,
  FecExportParams,
  EReportingType,
  EReportingStatus,
  EReportingLine,
  EReportingLineResponse,
  EReporting,
  EReportingCreateParams,
  EReportingListParams,
  JobType,
  JobStatus,
  Job,
  SandboxResetResponse,
  SimulateStatusParams,
  SimulateStatusResponse,
} from './types.js'

export {
  FacturinoError,
  ApiError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  PlanLimitError,
  ConnectionError,
} from './errors.js'

export { Webhooks } from './webhooks.js'
export { AutoPaginatingList } from './pagination.js'
