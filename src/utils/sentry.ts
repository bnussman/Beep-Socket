import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";

export function initializeSentry(): void {
    Sentry.init({
        dsn: process.env.SENTRY_URL || "http://a0553a7fab6040b193c574c246f8eafc@192.168.1.124:9000/3",
        environment: process.env.GITLAB_ENVIRONMENT_NAME || "development",
        tracesSampleRate: 1.0
    });
}

