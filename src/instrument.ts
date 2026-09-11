import * as Sentry from '@sentry/node'

const dsn = process.env.SENTRY_DSN?.trim()
const release = process.env.RENDER_GIT_COMMIT?.trim() || process.env.GIT_COMMIT_SHA?.trim() || 'development'

export function scrubSentryEvent<T extends Sentry.Event>(event: T): T {
  delete event.user
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    delete event.request.query_string
    event.request.url = event.request.url?.split('?')[0]
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (/^(authorization|cookie|x-forwarded-for|x-real-ip)$/i.test(key)) delete event.request.headers[key]
      }
    }
  }
  delete event.contexts?.gameplay
  return event
}

function scrubSpan<T extends { description?: string; data: Record<string, unknown> }>(span: T): T {
  if (span.description?.includes('?')) span.description = span.description.split('?')[0]
  for (const key of Object.keys(span.data)) {
    if (/(query|body|cookie|authorization|user|client\.address|request\.header)/i.test(key)) delete span.data[key]
    else if (/url/i.test(key) && typeof span.data[key] === 'string') span.data[key] = span.data[key].split('?')[0]
  }
  return span
}

if (dsn) {
  Sentry.init({
    dsn,
    enabled: true,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release,
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    beforeSend: scrubSentryEvent,
    beforeSendSpan: scrubSpan,
  })
  Sentry.setTag('runtime', 'server')
}

export { release }
