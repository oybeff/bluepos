import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import { Platform } from "react-native";
import { apiReq } from "./api";

export const PRINTER_KEY = "printer_settings_v1";

export interface PrinterSettings {
  receiptEnabled: boolean;
  receiptType: "wifi" | "pdf";
  receiptIp: string;
  receiptPort: string;
  receiptPaperMm: "58" | "80";
  barcodeEnabled: boolean;
  barcodeIp: string;
  barcodePort: string;
  barcodeLabelSize: "40x25" | "50x30" | "58x30" | "60x40";
}

export const defaultSettings: PrinterSettings = {
  receiptEnabled: false,
  receiptType: "pdf",
  receiptIp: "192.168.1.100",
  receiptPort: "9100",
  receiptPaperMm: "80",
  barcodeEnabled: false,
  barcodeIp: "192.168.1.101",
  barcodePort: "9100",
  barcodeLabelSize: "40x25",
};

export async function loadPrinterSettings(): Promise<PrinterSettings> {
  try {
    const raw = await AsyncStorage.getItem(PRINTER_KEY);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
}

export async function savePrinterSettings(s: PrinterSettings) {
  await AsyncStorage.setItem(PRINTER_KEY, JSON.stringify(s));
}

function fmtN(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n || 0));
}

/** On web, expo-print ignores custom HTML and just calls window.print().
 *  This helper opens HTML in a hidden iframe and prints from there. */
function printHtmlWeb(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      let done = false;
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) { document.body.removeChild(iframe); reject(new Error("Cannot access iframe")); return; }

      function finish() {
        if (done) return;
        done = true;
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
          resolve();
        }, 500);
      }

      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => setTimeout(finish, 300);
      // If onload already fired (sync content)
      if (doc.readyState === "complete") setTimeout(finish, 300);
    } catch (e: any) {
      reject(e);
    }
  });
}

function buildReceiptHtml(data: {
  shopName?: string;
  items: { name: string; qty: number; unit: string; price: number }[];
  discount?: number;
  yakuniy: number;
  tolovTuri?: string;
  paperSize?: ReceiptPaperSize;
}): string {
  const paper = data.paperSize || "80mm";
  const bodyW = paper === "58mm" ? 180 : 260;
  const fontSize = paper === "58mm" ? 10 : 12;
  const h2Size = paper === "58mm" ? 13 : 16;
  const totalSize = paper === "58mm" ? 12 : 14;
  const date = new Date().toLocaleString("uz-UZ", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const tolovLabel =
    data.tolovTuri === "naqd" ? "💵 Naqd pul"
    : data.tolovTuri === "plastik" ? "💳 Plastik karta"
    : "🔀 Aralash";

  const tdMaxW = paper === "58mm" ? 80 : 120;
  const itemsHtml = data.items.map(it => `
    <tr>
      <td style="max-width:${tdMaxW}px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:${fontSize - 1}px;">
        ${it.name}
      </td>
      <td style="text-align:center; white-space:nowrap; font-size:${fontSize - 2}px; color:#555;">
        ×${it.qty} ${it.unit}
      </td>
      <td style="text-align:right; white-space:nowrap; font-size:${fontSize - 1}px; font-weight:bold;">
        ${fmtN(it.qty * it.price)}
      </td>
    </tr>
  `).join("");

  return `<!DOCTYPE html><html>
<head><meta charset="utf-8">
<style>
  @page { size: ${paper} auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body { font-family: "Courier New", monospace; width: ${bodyW}px; margin: 0 auto; padding: ${paper === "58mm" ? 6 : 10}px; font-size: ${fontSize}px; }
  h2 { text-align: center; font-size: ${h2Size}px; margin: 6px 0 2px; letter-spacing: 1px; }
  .sub { text-align: center; color: #666; font-size: ${fontSize - 2}px; margin-bottom: 6px; }
  hr { border: none; border-top: 1px dashed #888; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 2px; vertical-align: top; }
  .total-row { font-size: ${totalSize}px; font-weight: bold; }
  .thanks { text-align: center; color: #666; font-size: ${fontSize - 2}px; margin-top: 10px; }
  .logo { text-align: center; font-size: ${fontSize - 2}px; color: #4F46E5; }
</style>
</head>
<body>
  <h2>${data.shopName || "BluePOS"}</h2>
  <div class="sub">${date}</div>
  <hr>
  <table>
    ${itemsHtml}
  </table>
  <hr>
  ${(data.discount || 0) > 0 ? `
    <table>
      <tr><td>Jami:</td><td style="text-align:right;">${fmtN((data.yakuniy || 0) + (data.discount || 0))} so'm</td></tr>
      <tr><td style="color:#EF4444;">Chegirma:</td><td style="text-align:right; color:#EF4444;">−${fmtN(data.discount || 0)} so'm</td></tr>
    </table>
    <hr>
  ` : ""}
  <table>
    <tr class="total-row">
      <td>TO'LASH KERAK:</td>
      <td style="text-align:right;">${fmtN(data.yakuniy)} so'm</td>
    </tr>
    <tr><td style="color:#555; font-size:10px;">${tolovLabel}</td><td></td></tr>
  </table>
  <hr>
  <div class="thanks">Xarid uchun rahmat!</div>
  <div class="logo">● BluePOS tizimi ●</div>
</body>
</html>`;
}

export type ReceiptPaperSize = "58mm" | "80mm";
export type BarcodePaperSize = "58mm" | "80mm" | "a4";

const BARCODE_PAPER: Record<BarcodePaperSize, { pageW: string; labelW: number; cols: number; fontSize: number; barcodeH: number }> = {
  "58mm": { pageW: "58mm",  labelW: 190, cols: 1, fontSize: 12, barcodeH: 40 },
  "80mm": { pageW: "80mm",  labelW: 130, cols: 2, fontSize: 11, barcodeH: 35 },
  "a4":   { pageW: "210mm", labelW: 130, cols: 4, fontSize: 11, barcodeH: 35 },
};

function buildBarcodeLabelHtml(
  product: { name: string; barcode: string | null; pricePerUnit: number; unit: string },
  count: number,
  paperSize: BarcodePaperSize = "58mm",
): string {
  const cfg = BARCODE_PAPER[paperSize];
  const labelW = cfg.labelW;
  const singleLabel = `
    <div style="width:${labelW}px; border:1px solid #ddd; padding:6px 8px; text-align:center;
                font-family:'Courier New',monospace; display:inline-block; vertical-align:top; margin:4px;
                page-break-inside:avoid;">
      <div style="font-size:${cfg.fontSize}px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:${labelW - 16}px;">
        ${product.name || ""}
      </div>
      <div style="font-size:${cfg.fontSize - 1}px; color:#444; margin:2px 0;">
        ${fmtN(product.pricePerUnit || 0)} so'm / ${product.unit || ""}
      </div>
      <div style="font-size:${cfg.fontSize - 2}px; letter-spacing:3px; font-family:monospace; background:#f5f5f5;
                  padding:3px; border-radius:3px; margin-top:4px; color:#111;">
        ${product.barcode || "—"}
      </div>
      <div style="background:repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px);
                  height:${cfg.barcodeH}px; margin-top:4px; border-radius:2px;"></div>
      <div style="font-size:${cfg.fontSize - 3}px; letter-spacing:2px; margin-top:2px; color:#333;">
        ${product.barcode || ""}
      </div>
    </div>
  `;
  const labels = Array(Math.max(1, Math.min(count, 50))).fill(singleLabel).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { size: ${cfg.pageW} auto; margin: 2mm; }
  body { margin: 0; padding: 4px; display: flex; flex-wrap: wrap; justify-content: center; }
</style></head>
<body>${labels}</body></html>`;
}

export async function printReceiptPdf(saleData: {
  cartSnapshot?: any[];
  items?: any[];
  discount?: number;
  chegirmaVal?: number;
  yakuniy: number;
  tolovTuri?: string;
}, shopName = "BluePOS", paperSize: ReceiptPaperSize = "80mm") {
  const items = (saleData.cartSnapshot || saleData.items || []).map((it: any) => ({
    name: it.product?.name || it.name || "",
    qty: it.qty,
    unit: it.product?.unit || it.unit || "",
    price: it.price || it.pricePerUnit || 0,
  }));
  const html = buildReceiptHtml({
    shopName,
    items,
    discount: saleData.chegirmaVal || saleData.discount || 0,
    yakuniy: saleData.yakuniy,
    tolovTuri: saleData.tolovTuri,
    paperSize,
  });
  const widthPx = paperSize === "58mm" ? 164 : 290;
  if (Platform.OS === "web") {
    await printHtmlWeb(html);
  } else {
    await Print.printAsync({ html, width: widthPx, height: 900 });
  }
}

export async function printReceiptWifi(settings: PrinterSettings, saleData: any, shopName = "BluePOS") {
  const items = (saleData.cartSnapshot || saleData.items || []).map((it: any) => ({
    name: it.product?.name || it.name || "",
    qty: it.qty,
    unit: it.product?.unit || it.unit || "",
    price: it.price || it.pricePerUnit || 0,
  }));
  await apiReq("/print/receipt", {
    method: "POST",
    body: JSON.stringify({
      printerIp: settings.receiptIp,
      printerPort: settings.receiptPort,
      paperMm: settings.receiptPaperMm,
      shopName,
      items,
      discount: saleData.chegirmaVal || saleData.discount || 0,
      yakuniy: saleData.yakuniy,
      tolovTuri: saleData.tolovTuri,
    }),
  });
}

export async function printReceipt(saleData: any, shopName = "BluePOS", paperSize: ReceiptPaperSize = "80mm") {
  const settings = await loadPrinterSettings();
  if (settings.receiptEnabled && settings.receiptType === "wifi") {
    await printReceiptWifi(settings, saleData, shopName);
  } else {
    await printReceiptPdf(saleData, shopName, paperSize);
  }
}

export async function printBarcodeLabel(
  product: { name: string; barcode: string | null; pricePerUnit: number; unit: string },
  count = 1,
  paperSize: BarcodePaperSize = "58mm",
) {
  const settings = await loadPrinterSettings();
  if (settings.barcodeEnabled && product.barcode) {
    await apiReq("/print/barcode", {
      method: "POST",
      body: JSON.stringify({
        printerIp: settings.barcodeIp,
        printerPort: settings.barcodePort,
        name: product.name,
        barcode: product.barcode,
        price: product.pricePerUnit,
        count,
      }),
    });
  } else {
    const html = buildBarcodeLabelHtml(product, count, paperSize);
    if (Platform.OS === "web") {
      await printHtmlWeb(html);
    } else {
      const widthPx = paperSize === "a4" ? 595 : paperSize === "80mm" ? 227 : 164;
      await Print.printAsync({ html, width: widthPx, height: widthPx * 3 });
    }
  }
}
