import { HttpClient } from './client.js'
import { Webhooks } from './webhooks.js'
import { Invoices } from './resources/invoices.js'
import { Payments } from './resources/payments.js'
import { Customers } from './resources/customers.js'
import { Products } from './resources/products.js'
import { Quotes } from './resources/quotes.js'
import { CreditNotes } from './resources/creditNotes.js'
import { Events } from './resources/events.js'
import { WebhookEndpoints } from './resources/webhookEndpoints.js'
import { RecurringInvoices } from './resources/recurringInvoices.js'
import { Companies } from './resources/companies.js'
import { Exports } from './resources/exports.js'
import { EReportingResource } from './resources/ereporting.js'
import { Jobs } from './resources/jobs.js'
import { Sandbox } from './resources/sandbox.js'
import { ReceivedInvoices } from './resources/received-invoices.js'
import { Reporting } from './resources/reporting.js'
import { AccountResource } from './resources/account.js'
import { Billing } from './resources/billing.js'
import { Usage } from './resources/usage.js'
import { Validate } from './resources/validate.js'
import { Reference } from './resources/reference.js'
import { Archives } from './resources/archives.js'
import { Health } from './resources/health.js'
import type { FacturinoConfig } from './types.js'

/** Facturino API client for French e-invoicing — initialize with your API key to access all resources. */
class Facturino {
  readonly account: AccountResource
  readonly billing: Billing
  readonly invoices: Invoices
  readonly payments: Payments
  readonly customers: Customers
  readonly products: Products
  readonly quotes: Quotes
  readonly creditNotes: CreditNotes
  readonly events: Events
  readonly webhookEndpoints: WebhookEndpoints
  readonly recurringInvoices: RecurringInvoices
  readonly companies: Companies
  readonly exports: Exports
  readonly ereporting: EReportingResource
  readonly jobs: Jobs
  readonly reference: Reference
  readonly sandbox: Sandbox
  readonly usage: Usage
  readonly validate: Validate
  readonly webhooks: Webhooks
  readonly receivedInvoices: ReceivedInvoices
  readonly reporting: Reporting
  readonly archives: Archives
  readonly health: Health

  constructor(apiKey: string, config?: FacturinoConfig) {
    const client = new HttpClient(apiKey, config)

    this.account = new AccountResource(client)
    this.billing = new Billing(client)
    this.invoices = new Invoices(client)
    this.payments = new Payments(client)
    this.customers = new Customers(client)
    this.products = new Products(client)
    this.quotes = new Quotes(client)
    this.creditNotes = new CreditNotes(client)
    this.events = new Events(client)
    this.webhookEndpoints = new WebhookEndpoints(client)
    this.recurringInvoices = new RecurringInvoices(client)
    this.companies = new Companies(client)
    this.exports = new Exports(client)
    this.ereporting = new EReportingResource(client)
    this.jobs = new Jobs(client)
    this.reference = new Reference(client)
    this.sandbox = new Sandbox(client)
    this.usage = new Usage(client)
    this.validate = new Validate(client)
    this.webhooks = new Webhooks()
    this.receivedInvoices = new ReceivedInvoices(client)
    this.reporting = new Reporting(client)
    this.archives = new Archives(client)
    this.health = new Health(client)
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
  ContactRole,
  LineItem,
  VatBreakdown,
  Totals,
  CustomerRef,
  CustomerSnapshot,
  LifecycleEntry,
  Currency,
  Unit,
  VatCode,
  VatexCode,
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
  InvoiceExpandField,
  InvoiceExpanded,
  InvoiceRetrieveParams,
  InvoiceBuyerParam,
  InvoiceCreateDates,
  InvoiceCreateParams,
  InvoiceLineItemParam,
  InvoiceUpdateParams,
  InvoiceListParams,
  IncomingInvoiceCreateParams,
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
  SireneCompany,
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
  CreditNoteSettings,
  CreditNoteNumberingMode,
  Company,
  CompanyUpdateParams,
  CgvResponse,
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
  ReceivedInvoiceStatus,
  ReceivedInvoice,
  ReceivedInvoiceListParams,
  ReceivedInvoiceRefuseParams,
  ReceivedInvoiceRecordPaymentParams,
  ReceivedInvoiceActionResponse,
  VatReportParams,
  VatReportBreakdown,
  VatReport,
  RevenueReportParams,
  RevenueReportBreakdownItem,
  RevenueReport,
  AccountPlan,
  Account,
  // Billing
  BillingCycle,
  BillingSubscription,
  PlatformInvoice,
  // Usage
  UsageMeter,
  UsageSummary,
  // Validate
  ValidateParams,
  ValidateResponse,
  // Reference
  LegalForm,
  NafCode,
  LegalFormInput,
  NafCodeInput,
  PaProvider,
  HealthStatus,
} from './types.js'

export {
  FacturinoError,
  ApiError,
  InvalidRequestError,
  ValidationError,
  AuthenticationError,
  PermissionError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  PlanLimitError,
  ApiInternalError,
  ConnectionError,
} from './errors.js'

export { Webhooks } from './webhooks.js'
export { AutoPaginatingList } from './pagination.js'
