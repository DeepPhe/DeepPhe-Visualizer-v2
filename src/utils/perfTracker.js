const IS_DEV = process.env.NODE_ENV !== "production";
const PERF_BUFFER_SIZE = 2000;

let startSpan;
let endSpan;
let getEvents;
let clearEvents;
let downloadAsJson;
let getSummaryTable;

if (!IS_DEV) {
  startSpan = () => null;
  endSpan = () => null;
  getEvents = () => null;
  clearEvents = () => undefined;
  downloadAsJson = () => undefined;
  getSummaryTable = () => null;
} else if (process.env.NODE_ENV !== "development") {
  startSpan = () => null;
  endSpan = () => null;
  getEvents = () => null;
  clearEvents = () => undefined;
  downloadAsJson = () => undefined;
  getSummaryTable = () => null;
} else {
  const VALID_TYPES = new Set([
    "api_call",
    "user_interaction",
    "page_load",
    "filter_query",
  ]);
  const VALID_STATUSES = new Set(["ok", "error", "cancelled"]);
  const _buffer = [];
  const _markNames = new Set();
  const _measureNames = new Set();

  function nowMs() {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }
    return Date.now();
  }

  const normalizeMeta = (value) =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

  const roundMs = (value) => Math.round(Number(value || 0) * 100) / 100;

  const addToBuffer = (event) => {
    if (_buffer.length >= PERF_BUFFER_SIZE) {
      _buffer.shift();
    }
    _buffer.push(event);
  };

  const canMark = () => typeof performance !== "undefined" && typeof performance.mark === "function";
  const canMeasure = () =>
    typeof performance !== "undefined" && typeof performance.measure === "function";

  startSpan = (name, type, meta = {}) => {
    const normalizedName = String(name || "").trim();
    const normalizedType = String(type || "").trim();
    if (!normalizedName || !VALID_TYPES.has(normalizedType)) {
      return null;
    }

    const startMark = `deepphe-perf:start:${normalizedType}:${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const startTime = nowMs();

    if (canMark()) {
      try {
        performance.mark(startMark);
        _markNames.add(startMark);
      } catch {
        // Performance marks unavailable in this environment.
      }
    }

    return {
      _startMark: startMark,
      _startTime: startTime,
      name: normalizedName,
      type: normalizedType,
      meta: { ...normalizeMeta(meta) },
    };
  };

  endSpan = (handle, status = "ok", extraMeta = {}) => {
    if (!handle || typeof handle !== "object") {
      return null;
    }

    const normalizedType = String(handle.type || "").trim();
    const normalizedName = String(handle.name || "").trim();
    if (!normalizedName || !VALID_TYPES.has(normalizedType)) {
      return null;
    }

    const startTime = Number(handle._startTime);
    if (!Number.isFinite(startTime)) {
      return null;
    }

    const normalizedStatus = VALID_STATUSES.has(status) ? status : "ok";
    const endTime = nowMs();
    const endMark = `deepphe-perf:end:${normalizedType}:${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const measureName = `deepphe-perf:${normalizedName}`;

    if (canMark()) {
      try {
        performance.mark(endMark);
        _markNames.add(endMark);
      } catch {
        // Performance marks unavailable in this environment.
      }
    }

    if (canMeasure()) {
      try {
        performance.measure(measureName, handle._startMark, endMark);
        _measureNames.add(measureName);
      } catch {
        // Performance measures unavailable in this environment.
      }
    }

    const event = {
      id: `${normalizedType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: normalizedName,
      type: normalizedType,
      startTime,
      duration: roundMs(endTime - startTime),
      status: normalizedStatus,
      meta: {
        ...normalizeMeta(handle.meta),
        ...normalizeMeta(extraMeta),
      },
    };

    addToBuffer(event);
    return event;
  };

  getEvents = () => _buffer.slice();

  clearEvents = () => {
    _buffer.length = 0;

    if (typeof performance === "undefined") {
      return;
    }

    _markNames.forEach((markName) => {
      try {
        performance.clearMarks(markName);
      } catch {
        // No-op if unsupported.
      }
    });
    _measureNames.forEach((measureName) => {
      try {
        performance.clearMeasures(measureName);
      } catch {
        // No-op if unsupported.
      }
    });

    _markNames.clear();
    _measureNames.clear();
  };

  downloadAsJson = () => {
    if (typeof document === "undefined") {
      return;
    }

    const timestamp = new Date().toISOString();
    const filename = `deepphe-perf-${timestamp}.json`;
    const json = JSON.stringify(_buffer, null, 2);
    const anchor = document.createElement("a");

    if (
      typeof Blob !== "undefined" &&
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function"
    ) {
      const blob = new Blob([json], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      anchor.href = href;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(href);
      return;
    }

    anchor.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    anchor.download = filename;
    anchor.click();
  };

  getSummaryTable = (limit = 50) => {
    const numericLimit = Number(limit);
    const resolvedLimit = Number.isFinite(numericLimit) && numericLimit >= 0
      ? Math.floor(numericLimit)
      : 50;
    const limitedEvents = _buffer.slice(-resolvedLimit);
    const firstRowIndex = _buffer.length - limitedEvents.length + 1;

    return limitedEvents.map((event, index) => ({
      "#": firstRowIndex + index,
      type: event.type,
      name: event.name,
      "duration(ms)": event.duration,
      status: event.status,
    }));
  };
}

export { startSpan, endSpan, getEvents, clearEvents, downloadAsJson, getSummaryTable };
