/**
 * CSV export for the patient grid. Exports the currently filtered + sorted rows
 * (pre-pagination) using each visible column's configured export value.
 */

export function csvEscape(value) {
  const stringValue = String(value ?? "");
  return /[",\n]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
}

export function resolveExportValue(row, column) {
  const exportValueResolver = column.columnDef?.meta?.exportValue;
  if (typeof exportValueResolver === "function") {
    return exportValueResolver(row);
  }
  return row.getValue(column.id);
}

export function exportFilteredSortedRowsToCsv(table, filename = "cohort-patients.csv") {
  const exportableColumns = table
    .getVisibleLeafColumns()
    .filter((column) => column.columnDef?.meta?.exportable !== false);

  if (exportableColumns.length === 0) {
    return;
  }

  const headers = exportableColumns.map((column) => {
    const header = column.columnDef.header;
    return typeof header === "string" ? header : column.id;
  });

  const rows = table.getPrePaginationRowModel().rows.map((row) =>
    exportableColumns.map((column) => csvEscape(resolveExportValue(row, column)))
  );

  const csv = [headers.map(csvEscape).join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
