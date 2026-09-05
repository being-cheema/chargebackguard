import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface IntegrityResult {
  ok: boolean;
  errors: string[];
  manifest: {
    total_records: number;
    held_out_records: number;
    dataset_sha256: string;
  } | null;
  dataset: {
    count: number;
    heldOut: number;
    sha256: string;
  } | null;
}

export function verifyDatasetIntegrity(): IntegrityResult {
  const dataDir = path.resolve(__dirname, '../../../data');
  const manifestPath = path.join(dataDir, 'split_manifest.json');
  const datasetPath = path.join(dataDir, 'synthetic_disputes.json');
  const errors: string[] = [];

  if (!fs.existsSync(datasetPath)) {
    return { ok: false, errors: ['synthetic_disputes.json not found'], manifest: null, dataset: null };
  }

  const raw = fs.readFileSync(datasetPath, 'utf-8');
  const disputes = JSON.parse(raw) as Array<{ split: string }>;
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  const heldOut = disputes.filter((d) => d.split === 'held_out').length;

  let manifest: IntegrityResult['manifest'] = null;

  if (!fs.existsSync(manifestPath)) {
    errors.push('split_manifest.json not found');
  } else {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (manifest!.dataset_sha256 !== sha256) {
      errors.push(`SHA256 mismatch: manifest=${manifest!.dataset_sha256.slice(0, 12)}... actual=${sha256.slice(0, 12)}...`);
    }
    if (manifest!.total_records !== disputes.length) {
      errors.push(`Record count mismatch: manifest=${manifest!.total_records} actual=${disputes.length}`);
    }
    if (manifest!.held_out_records !== heldOut) {
      errors.push(`Held-out count mismatch: manifest=${manifest!.held_out_records} actual=${heldOut}`);
    }
  }

  if (disputes.length < 400) {
    errors.push(`Dataset too small for buildathon evaluation: ${disputes.length} records (expected 450)`);
  }

  return {
    ok: errors.length === 0,
    errors,
    manifest,
    dataset: { count: disputes.length, heldOut, sha256 },
  };
}

if (require.main === module) {
  const result = verifyDatasetIntegrity();
  if (result.ok) {
    console.log('✅ Dataset integrity verified');
    console.log(`   Records: ${result.dataset?.count} (held-out: ${result.dataset?.heldOut})`);
    console.log(`   SHA256: ${result.dataset?.sha256}`);
  } else {
    console.error('❌ Dataset integrity check failed:');
    result.errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }
}
