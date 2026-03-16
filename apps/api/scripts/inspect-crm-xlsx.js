/**
 * Inspecciona el Excel del CRM y muestra nombres de hojas y encabezados.
 * Uso: node scripts/inspect-crm-xlsx.js "ruta/al/CRM _ BierLife.xlsx"
 */
const XLSX = require("xlsx");
const path = process.argv[2] || "C:\\Users\\Federico Siri\\Downloads\\CRM _ BierLife.xlsx";

let workbook;
try {
  workbook = XLSX.readFile(path);
} catch (e) {
  console.error("No se pudo abrir el archivo:", path);
  console.error(e.message);
  process.exit(1);
}

console.log("=== HOJAS ===\n", workbook.SheetNames);

workbook.SheetNames.forEach((name) => {
  const sheet = workbook.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const headers = data[0] || [];
  const rows = data.slice(1, 4);
  console.log("\n--- Hoja:", name, "---");
  console.log("Encabezados:", headers);
  console.log("Primeras filas:");
  rows.forEach((row, i) => console.log("  ", i + 1, row));
});
