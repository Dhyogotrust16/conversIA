import XLSX from "xlsx";

export function rowsToWorkbookBase64(
  rows: Array<Record<string, unknown>>,
  sheetName = "Planilha"
): string {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  return Buffer.from(buffer).toString("base64");
}

export function sheetsToWorkbookBase64(
  sheets: Array<{
    name: string;
    rows: Array<Record<string, unknown>>;
  }>
): string {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet =
      sheet.rows.length > 0
        ? XLSX.utils.json_to_sheet(sheet.rows)
        : XLSX.utils.aoa_to_sheet([["Sem dados"]]);

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  return Buffer.from(buffer).toString("base64");
}

export function parseColumnsFromWorkbookBase64(data: string) {
  const buffer = Buffer.from(data, "base64");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Nenhuma aba encontrada na planilha.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean>>(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false
  });

  if (rows.length === 0) {
    throw new Error("A planilha está vazia.");
  }

  const totalColumns = Math.max(...rows.map((row) => row.length), 0);
  const columns: Record<string, string[]> = {};

  for (let columnIndex = 0; columnIndex < totalColumns; columnIndex += 1) {
    const values = rows.map((row) => String(row[columnIndex] ?? "").trim());

    if (values.some((value) => value !== "")) {
      columns[String(columnIndex)] = values;
    }
  }

  return columns;
}
