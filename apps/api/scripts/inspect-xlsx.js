/**
 * Inspecciona un Excel y muestra nombres de hojas, encabezados y primeras filas.
 * Uso: node scripts/inspect-xlsx.js "ruta/al/archivo.xlsx"
 */
const XLSX = require("xlsx");
const path = process.argv[2] || "C:\\Users\\Federico Siri\\Downloads\\Plantilla de control de inventario 🍻.xlsx";

const workbook = XLSX.readFile(path);
console.log("=== HOJAS ===\n", workbook.SheetNames);

workbook.SheetNames.forEach((name) => {
  const sheet = workbook.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const headers = data[0] || [];
  const rows = data.slice(1, 6);
  console.log("\n--- Hoja:", name, "---");
  console.log("Encabezados:", headers);
  console.log("Primeras filas:");
  rows.forEach((row, i) => console.log("  ", i + 1, row));
});
