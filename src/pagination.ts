import type { HttpClient } from './client.js'
import type { PaginatedResponse, PaginationParams } from './types.js'

/**
 * Async-iterable list with auto-pagination.
 *
 * ```ts
 * for await (const inv of facturino.invoices.list()) { ... }
 * // or: const page = await facturino.invoices.list()
 * ```
 */
export class AutoPaginatingList<T extends { id: string }>
  implements AsyncIterable<T>, PromiseLike<PaginatedResponse<T>>
{
  private readonly client: HttpClient
  private readonly path: string
  private readonly params: Record<string, unknown>
  private firstPagePromise: Promise<PaginatedResponse<T>> | null = null

  constructor(
    client: HttpClient,
    path: string,
    params?: PaginationParams,
  ) {
    this.client = client
    this.path = path
    this.params = { ...(params ?? {}) } as Record<string, unknown>
  }

  /** Await resolves to the first page. */
  then<TResult1 = PaginatedResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: PaginatedResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.getFirstPage().then(onfulfilled, onrejected)
  }

  /** Yields items across all pages. */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let cursor: string | undefined = this.params.starting_after as string | undefined
    const limit = (this.params.limit as number | undefined) ?? 25

    for (;;) {
      const queryParams: Record<string, string> = {}
      if (limit) queryParams.limit = String(limit)
      if (cursor) queryParams.starting_after = cursor

      // Forward filter params (status, type, active, etc.)
      for (const [key, value] of Object.entries(this.params)) {
        if (key === 'limit' || key === 'starting_after' || key === 'ending_before') continue
        if (value !== undefined && value !== null) {
          queryParams[key] = String(value)
        }
      }

      const qs = new URLSearchParams(queryParams).toString()
      const url = qs ? `${this.path}?${qs}` : this.path

      const page = await this.client.get<PaginatedResponse<T>>(url)

      for (const item of page.data) {
        yield item
      }

      if (!page.has_more || page.data.length === 0) {
        break
      }

      cursor = page.next_cursor ?? page.data[page.data.length - 1].id
    }
  }

  private getFirstPage(): Promise<PaginatedResponse<T>> {
    if (!this.firstPagePromise) {
      const queryParams: Record<string, string> = {}

      for (const [key, value] of Object.entries(this.params)) {
        if (value !== undefined && value !== null) {
          queryParams[key] = String(value)
        }
      }

      const qs = new URLSearchParams(queryParams).toString()
      const url = qs ? `${this.path}?${qs}` : this.path

      this.firstPagePromise = this.client.get<PaginatedResponse<T>>(url)
    }
    return this.firstPagePromise
  }
}
