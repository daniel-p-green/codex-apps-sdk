import type { JsonObject } from "../../protocol/src/index.js";

export interface TelemetryEvent {
  event: string;
  timestamp: string;
  attrs?: JsonObject;
}

export interface TelemetrySink {
  emit: (event: TelemetryEvent) => void;
}

export const createConsoleTelemetrySink = (
  namespace = "companion-host"
): TelemetrySink => ({
  emit(event) {
    console.log(`[${namespace}][telemetry]`, JSON.stringify(event));
  }
});

export const emitTelemetry = (
  sink: TelemetrySink,
  event: string,
  attrs?: JsonObject
): void => {
  sink.emit({
    event,
    timestamp: new Date().toISOString(),
    ...(attrs ? { attrs } : {})
  });
};
