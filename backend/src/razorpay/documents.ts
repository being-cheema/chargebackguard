import fs from 'fs';
import path from 'path';
import { getRazorpayAuthHeader } from './client';
import { RazorpayDocumentResponse } from './types';

export async function uploadDocument(
  filePath: string,
  purpose: string = 'dispute_evidence'
): Promise<RazorpayDocumentResponse> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Evidence file not found: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const fileName = filePath.split('/').pop() || 'evidence.pdf';
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });

  const form = new FormData();
  form.append('purpose', purpose);
  form.append('file', blob, fileName);

  const res = await fetch('https://api.razorpay.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: getRazorpayAuthHeader(),
    },
    body: form,
  });

  const text = await res.text();
  let parsed: RazorpayDocumentResponse | { error?: { description?: string } } = {} as RazorpayDocumentResponse;
  if (text) {
    parsed = JSON.parse(text);
  }

  if (!res.ok) {
    const message =
      'error' in parsed && parsed.error?.description
        ? parsed.error.description
        : `Document upload failed (${res.status})`;
    throw new Error(message);
  }

  return parsed as RazorpayDocumentResponse;
}

export function getDefaultEvidenceSamplePath(): string {
  return path.resolve(__dirname, '../../assets/evidence-samples/generic-proof.pdf');
}
