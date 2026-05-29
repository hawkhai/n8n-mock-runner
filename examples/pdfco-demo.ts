/**
 * pdfco-demo.ts
 *
 * Demo: key operations of n8n-nodes-pdfco exercised through n8n-mock-runner.
 * All PDF.co API calls are intercepted — no real HTTP requests are made.
 *
 * Operations covered:
 *   PDF Information & Form Fields  → /v1/pdf/info
 *   Convert from PDF (to Text)     → /v1/pdf/convert/to/text
 *   Barcode Reader                 → /v1/barcode/read/from/url
 *   Merge PDF                      → /v1/pdf/merge2
 *
 * Run from project root:
 *   npx ts-node examples/pdfco-demo.ts
 */

import { runNodeJson } from '../src';
import type { IDataObject } from '../src';

// ── Load n8n-nodes-pdfco from the sibling project (compiled dist) ─────────────
let PdfCo: any;
try {
  PdfCo = require('../../n8n-nodes-pdfco/dist/nodes/PdfCo/PdfCo.node').PdfCo;
} catch {
  console.error(
    '⚠  Could not load n8n-nodes-pdfco. Build it first:\n' +
      '   cd F:\\source\\workflow\\n8n-nodes-pdfco && pnpm install && pnpm run build',
  );
  process.exit(1);
}

// ── Credentials (mocked — never sent to a real server) ────────────────────────
const credentials = {
  pdfcoApi: { apiKey: 'mock-api-key-for-testing' },
};

// ── HTTP interceptor — short-circuits all API calls with canned responses ─────
function pdfcoInterceptor(options: IDataObject): unknown | undefined {
  const url = (options.url as string) ?? '';

  // PDF Information
  if (url.includes('/v1/pdf/info')) {
    return {
      pageCount: 3,
      author: 'n8n Demo',
      isEncrypted: false,
      isPasswordProtected: false,
      signaturesCount: 0,
      title: 'Invoice #42',
      subject: '',
      keywords: '',
    };
  }

  // Convert PDF → Text (initial API call returns a URL; the action then fetches that URL inline)
  if (url.includes('/v1/pdf/convert/to/text')) {
    return {
      url: 'https://pdf.co/storage/mock/output.txt',
      name: 'output.txt',
    };
  }

  // Inline fetch of the text content (second request made by convertFromPDF when inline=true)
  if (url.includes('/storage/mock/output.txt')) {
    return 'Invoice #42\nDate: 2026-05-29\nTotal: $1,234.56';
  }

  // Barcode Reader
  if (url.includes('/v1/barcode/read/from/url')) {
    return {
      barcodes: [
        { type: 'QRCode', value: 'https://example.com/order/42', rect: '50,50,100,100' },
      ],
    };
  }

  // Merge PDF (autoConvert=false → /v1/pdf/merge, autoConvert=true → /v1/pdf/merge2)
  if (url.includes('/v1/pdf/merge')) {
    return {
      url: 'https://pdf.co/storage/mock/merged.pdf',
      name: 'merged.pdf',
      pageCount: 6,
    };
  }

  // Fallback: generic success (prevents axios from hitting the real internet)
  return { url: 'https://pdf.co/storage/mock/result.pdf', name: 'result.pdf' };
}

// ── Helper: new node instance per call ────────────────────────────────────────
// PdfCo takes a baseDescription; the constructor merges it with its own
// descriptions object, so an empty base is fine for local testing.
const node = () => new PdfCo({});
const TYPE = 'n8n-nodes-pdfco.pdfCoApi';

const SAMPLE_PDF = 'https://pdf.co/samples/invoice.pdf';

async function main() {
  console.log('=== n8n-nodes-pdfco + n8n-mock-runner demo ===\n');

  // ── [PDF Information] ───────────────────────────────────────────────────────
  console.log('── [operation: PDF Information & Form Fields] ──');
  const infoResult = await runNodeJson({
    node: node(),
    nodeType: TYPE,
    parameters: {
      operation: 'PDF Information & Form Fields',
      url: SAMPLE_PDF,
      fields: false,
    },
    credentials,
    httpInterceptor: pdfcoInterceptor,
  });
  console.table(infoResult);

  // ── [Convert from PDF → Text] ──────────────────────────────────────────────
  console.log('── [operation: Convert from PDF → Text] ──');
  const textResult = await runNodeJson({
    node: node(),
    nodeType: TYPE,
    parameters: {
      operation: 'Convert from PDF',
      url: SAMPLE_PDF,
      convertType: 'toText',
    },
    credentials,
    httpInterceptor: pdfcoInterceptor,
  });
  console.table(textResult);

  // ── [Barcode Reader] ───────────────────────────────────────────────────────
  console.log('── [operation: Barcode Reader] ──');
  const barcodeResult = await runNodeJson({
    node: node(),
    nodeType: TYPE,
    parameters: {
      operation: 'Barcode Reader',
      url: 'https://pdf.co/samples/barcode-qr.pdf',
      types: ['QRCode'],
    },
    credentials,
    httpInterceptor: pdfcoInterceptor,
  });
  console.log(JSON.stringify(barcodeResult, null, 2));

  // ── [Merge PDF] ────────────────────────────────────────────────────────────
  console.log('── [operation: Merge PDF] ──');
  const mergeResult = await runNodeJson({
    node: node(),
    nodeType: TYPE,
    parameters: {
      operation: 'Merge PDF',
      // url can be an array or a comma-separated string
      url: ['https://pdf.co/samples/page1.pdf', 'https://pdf.co/samples/page2.pdf'],
      autoConvert: false,
    },
    credentials,
    httpInterceptor: pdfcoInterceptor,
  });
  console.table(mergeResult);

  console.log('\n=== DONE — all operations completed via n8n-nodes-pdfco + n8n-mock-runner ===');
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
