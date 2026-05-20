import type { HttpClient } from '../client.js'
import type {
  AccountingSettings,
  AccountingSettingsUpdate,
  ReminderSettings,
  ReminderSettingsUpdate,
} from '../types.js'

/**
 * Settings — per-company configuration that does NOT belong to a single
 * resource: accounting accounts (FEC mapping) and the automatic
 * reminder schedule.
 *
 * Settings live under `/v1/companies/{companyId}/settings/...`; every
 * method takes the target `companyId` as its first argument so a single
 * API key can administer settings on each of the companies it is
 * scoped to.
 */
export class Settings {
  constructor(private readonly client: HttpClient) {}

  /** Accounting configuration (FEC accounts, journal codes, VAT regime). */
  async retrieveAccounting(companyId: string): Promise<AccountingSettings> {
    return this.client.get<AccountingSettings>(
      `/v1/companies/${companyId}/settings/accounting`,
    )
  }

  async updateAccounting(
    companyId: string,
    params: AccountingSettingsUpdate,
  ): Promise<AccountingSettings> {
    return this.client.patch<AccountingSettings>(
      `/v1/companies/${companyId}/settings/accounting`,
      params,
    )
  }

  /** Automatic dunning reminder schedule (J+7 / J+15 / J+30 by default). */
  async retrieveReminders(companyId: string): Promise<ReminderSettings> {
    return this.client.get<ReminderSettings>(
      `/v1/companies/${companyId}/settings/reminders`,
    )
  }

  async updateReminders(
    companyId: string,
    params: ReminderSettingsUpdate,
  ): Promise<ReminderSettings> {
    return this.client.patch<ReminderSettings>(
      `/v1/companies/${companyId}/settings/reminders`,
      params,
    )
  }
}
