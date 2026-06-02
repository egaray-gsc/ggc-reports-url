/**
 * Milestones API — Google Apps Script
 *
 * Setup:
 *  1. Crea una hoja de cálculo con dos pestañas: "milestones-lv" y "milestones-md"
 *  2. Fila 1 (cabeceras): date | label | color
 *  3. Formatea la columna "date" como Texto plano (Formato > Número > Texto sin formato)
 *     para que las fechas no se conviertan automáticamente
 *  4. Pega este script en Extensiones > Apps Script
 *  5. Despliega: Implementar > Nueva implementación > Aplicación web
 *     - Ejecutar como: Yo
 *     - Quién tiene acceso: Cualquiera
 *  6. Copia la URL y pégala en VITE_MILESTONES_URL del dashboard
 *
 * Uso: GET {url}?site=lv  o  GET {url}?site=md
 */
function doGet(e) {
  const site = ((e && e.parameter && e.parameter.site) || 'lv').toLowerCase();
  const sheetName = 'milestones-' + site;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  const empty = ContentService
    .createTextOutput('[]')
    .setMimeType(ContentService.MimeType.JSON);

  if (!sheet) return empty;

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return empty;

  const headers = data[0].map(function(h) { return String(h).trim(); });

  const rows = data.slice(1)
    .filter(function(row) { return row[0] !== '' && row[0] !== null; })
    .map(function(row) {
      const obj = {};
      headers.forEach(function(h, i) {
        const val = row[i];
        if (val === '' || val === null || val === undefined) return;
        if (h === 'date' && val instanceof Date) {
          obj[h] = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else {
          obj[h] = String(val);
        }
      });
      return obj;
    });

  return ContentService
    .createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}
