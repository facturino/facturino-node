import type { HttpClient } from '../client.js'
import type {
  AccountingSettings,
  AccountingSettingsUpdate,
  ReminderSettings,
  ReminderSettingsUpdate,
} from '../types.js'

/**
 * Settings — company-level configuration that does NOT belong to a
 * single resource: accounting accounts (FEC mapping), automatic
 * reminder schedule, etc.
 *
 * All settings live under the active company; switch keys to act on a
 * different company.
 */
export class Settings {
  constructor(private readonly client: HttpClient) {}

  /** Accounting configuration (FEC accounts, journal codes, VAT regime). */
  async retrieveAccounting(): Promise<AccountingSettings> {
    return this.client.get<AccountingSettings>('/v1/settings/accounting')
  }

  async updateAccounting(params: AccountingSettingsUpdate): Promise<AccountingSettings> {
    return this.client.patch<AccountingSettings>('/v1/settings/accounting', params)
  }

  /** Automatic dunning reminder schedule (J+7 / J+15 / J+30 by default). */
  async retrieveReminders(): Promise<ReminderSettings> {
    return this.client.get<ReminderSettings>('/v1/settings/reminders')
  }

  async updateReminders(params: ReminderSettingsUpdate): Promise<ReminderSettings> {
    return this.client.patch<ReminderSettings>('/v1/settings/reminders', params)
  }
}
