import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  tracesSampleRate: 0.1,

  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 0.0,

  beforeSend(event) {
    if (event.exception) {
      event.exception.values?.forEach(v => {
        if (v.value) {
          v.value = sanitizeErrorMessage(v.value);
        }
      });
    }

    return event;
  },
});

function sanitizeErrorMessage(msg: string): string {
  return msg
    .replace(/[0-9a-f]{64}/gi, '[REDACTED_HEX]')
    .replace(/G[A-Z0-9]{55}/g, '[REDACTED_WALLET]')
    .replace(/S[A-Z0-9]{55}/g, '[REDACTED_SEED]');
}