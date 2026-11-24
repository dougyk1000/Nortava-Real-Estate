import crypto from 'node:crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export const VERIFICATION_MODEL = 'gemini-4-hydrogen';
export const MAX_KYC_DOC_BYTES = 8 * 1024 * 1024; // 8 MB per uploaded document
export const LANDLORD_DOCS_BUCKET = 'landlord-documents';

export const ALLOWED_OWNERSHIP_CAPACITIES = new Set([
  'owner',
  'cession_holder',
  'authorized_representative',
  'registered_agent'
]);

const MIME_BY_MAGIC = [
  {
    mime: 'application/pdf',
    ext: 'pdf',
    match: (buf) => buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-'
  },
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    match: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  },
  {
    mime: 'image/png',
    ext: 'png',
    match: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    match: (buf) =>
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
  }
];

export function validateZimbabweNationalId(raw) {
  if (typeof raw !== 'string') {
    return { valid: false, normalized: '', error: 'Zimbabwe National ID number is required.' };
  }
  const compact = raw.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = compact.match(/^(\d{2})(\d{6,7})([A-Z])(\d{2})$/);
  if (!match) {
    return {
      valid: false,
      normalized: '',
      error: 'Enter a valid Zimbabwe National ID (e.g., 63-1234567A42).'
    };
  }
  const normalized = `${match[1]}-${match[2]}${match[3]}${match[4]}`;
  return { valid: true, normalized, error: null };
}

export function validateDocumentUpload(docPayload, label = 'Document') {
  if (!docPayload || typeof docPayload !== 'object') {
    return { valid: false, error: `${label} file is required.` };
  }

  const rawData = typeof docPayload.dataBase64 === 'string' ? docPayload.dataBase64.trim() : '';
  if (!rawData) {
    return { valid: false, error: `${label} file data is missing.` };
  }

  const maxEncodedChars = Math.ceil((MAX_KYC_DOC_BYTES * 4) / 3) + 256;
  if (rawData.length > maxEncodedChars) {
    return { valid: false, error: `${label} exceeds the 8MB maximum file size.` };
  }

  let base64Part = rawData;
  if (rawData.slice(0, 5).toLowerCase() === 'data:') {
    const markerIdx = rawData.indexOf(';base64,', 5);
    if (markerIdx > 5 && markerIdx < 128) {
      base64Part = rawData.slice(markerIdx + 8);
    }
  }

  // Quick size pre-check before Buffer allocation (~4/3 expansion)
  if (base64Part.length > Math.ceil((MAX_KYC_DOC_BYTES * 4) / 3) + 64) {
    return { valid: false, error: `${label} exceeds the 8MB maximum file size.` };
  }

  let buffer;
  try {
    buffer = Buffer.from(base64Part, 'base64');
  } catch {
    return { valid: false, error: `${label} contains invalid encoded data.` };
  }

  if (!buffer || buffer.length < 16) {
    return { valid: false, error: `${label} file is empty or unreadable.` };
  }
  if (buffer.length > MAX_KYC_DOC_BYTES) {
    return { valid: false, error: `${label} exceeds the 8MB maximum file size.` };
  }

  const detected = MIME_BY_MAGIC.find((entry) => entry.match(buffer));
  if (!detected) {
    return {
      valid: false,
      error: `${label} must be a genuine PDF, JPG, PNG, or WebP document.`
    };
  }

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const safeBaseName = String(docPayload.fileName || 'document')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 64);

  return {
    valid: true,
    buffer,
    mimeType: detected.mime,
    ext: detected.ext,
    sha256,
    sizeBytes: buffer.length,
    fileName: safeBaseName
  };
}

export async function ensurePrivateDocsBucket(adminClient) {
  if (!adminClient) return { ok: false, error: 'Admin storage client unavailable.' };
  try {
    const { data: buckets } = await adminClient.storage.listBuckets();
    const exists = Array.isArray(buckets) && buckets.some((b) => b.name === LANDLORD_DOCS_BUCKET);
    if (!exists) {
      const { error } = await adminClient.storage.createBucket(LANDLORD_DOCS_BUCKET, {
        public: false,
        fileSizeLimit: MAX_KYC_DOC_BYTES,
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
      });
      if (error && !String(error.message || '').toLowerCase().includes('already exists')) {
        return { ok: false, error: error.message };
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'Unable to verify storage bucket.' };
  }
}

export async function uploadVerificationDoc(adminClient, { userId, docKind, validatedDoc }) {
  if (!adminClient || !userId || !validatedDoc?.valid) {
    return { path: null, error: 'Upload prerequisites missing.' };
  }

  await ensurePrivateDocsBucket(adminClient);

  const objectPath = `${userId}/${docKind}-${Date.now()}-${validatedDoc.sha256.slice(0, 10)}.${validatedDoc.ext}`;
  const { error } = await adminClient.storage
    .from(LANDLORD_DOCS_BUCKET)
    .upload(objectPath, validatedDoc.buffer, {
      contentType: validatedDoc.mimeType,
      upsert: true
    });

  if (error) {
    return { path: null, error: error.message || 'Storage upload failed.' };
  }
  return { path: objectPath, error: null };
}

export async function checkDuplicateDocuments(adminClient, { userId, titleDeedSha256, nationalIdNumber }) {
  const warnings = [];
  if (!adminClient) return warnings;

  try {
    if (titleDeedSha256) {
      const { data: deedMatches } = await adminClient
        .from('landlord_verifications')
        .select('user_id')
        .eq('title_deed_sha256', titleDeedSha256)
        .neq('user_id', userId)
        .limit(3);

      if (deedMatches && deedMatches.length > 0) {
        warnings.push('Duplicate title deed/ownership document detected across another account.');
      }
    }

    if (nationalIdNumber) {
      const { data: idMatches } = await adminClient
        .from('landlord_verifications')
        .select('user_id')
        .eq('national_id_number', nationalIdNumber)
        .neq('user_id', userId)
        .limit(3);

      if (idMatches && idMatches.length > 0) {
        warnings.push('This Zimbabwe National ID number is already linked to another landlord account.');
      }
    }
  } catch {
    // Table may not be migrated yet; skip DB duplicate query without crashing registration
  }

  return warnings;
}

function createGeminiClient() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

export async function analyzeLandlordDocumentsWithGemini({
  applicantName,
  nationalIdNumber,
  ownershipCapacity,
  propertyAddress,
  propertyProvince,
  propertyCity,
  propertyArea,
  duplicateWarnings = [],
  titleDeedDoc = null,
  nationalIdDoc = null,
  ratesBillDoc = null
}) {
  const ai = createGeminiClient();
  if (!ai) {
    return {
      ok: false,
      status: 503,
      code: 'GEMINI_API_KEY_MISSING',
      error: 'AI verification requires GEMINI_API_KEY to be configured in Settings > Secrets.'
    };
  }

  const parts = [];
  if (titleDeedDoc?.buffer && titleDeedDoc?.mimeType) {
    parts.push({ text: 'Document 1 — Submitted Property Title Deed / Cession / Council Offer Letter:' });
    parts.push({
      inlineData: {
        mimeType: titleDeedDoc.mimeType,
        data: titleDeedDoc.buffer.toString('base64')
      }
    });
  }
  if (nationalIdDoc?.buffer && nationalIdDoc?.mimeType) {
    parts.push({ text: 'Document 2 — Submitted Zimbabwe National ID Copy:' });
    parts.push({
      inlineData: {
        mimeType: nationalIdDoc.mimeType,
        data: nationalIdDoc.buffer.toString('base64')
      }
    });
  }
  if (ratesBillDoc?.buffer && ratesBillDoc?.mimeType) {
    parts.push({ text: 'Document 3 — Submitted Supporting Rates/Utility/Authority Document:' });
    parts.push({
      inlineData: {
        mimeType: ratesBillDoc.mimeType,
        data: ratesBillDoc.buffer.toString('base64')
      }
    });
  }

  if (parts.length === 0) {
    return {
      ok: false,
      status: 400,
      code: 'NO_DOCUMENTS_PROVIDED',
      error: 'No readable document files were found for AI verification.'
    };
  }

  parts.push({
    text: [
      'Evaluate these landlord KYC & property ownership documents for anti-scam verification in Zimbabwe.',
      `Applicant Name: ${applicantName || 'Unknown'}`,
      `Submitted Zimbabwe National ID: ${nationalIdNumber || 'Unknown'}`,
      `Declared Ownership Capacity: ${ownershipCapacity || 'owner'}`,
      `Declared Property Location: ${[propertyAddress, propertyArea, propertyCity, propertyProvince].filter(Boolean).join(', ')}`,
      duplicateWarnings.length ? `System Duplicate Alerts: ${duplicateWarnings.join('; ')}` : 'System Duplicate Alerts: None',
      'Check: (1) Is Document 1 a legible property ownership document (Title Deed, Deed of Transfer, Council Cession, Offer Letter, Lease Authority)? (2) Is Document 2 a genuine-looking legible ID matching the applicant name and ID number? (3) Are there signs of blank templates, unrelated photos (selfies/memes/houses instead of documents), heavy digital tampering, or mismatched owner names?'
    ].join('\n')
  });

  try {
    const response = await ai.models.generateContent({
      model: VERIFICATION_MODEL,
      contents: { parts },
      config: {
        systemInstruction:
          'You are a strict Zimbabwe property fraud and KYC document analyst for Nortava Real Estate. Inspect the submitted images/PDFs objectively. Flag any unrelated image, illegible document, template placeholder, name mismatch, or ID mismatch. Be conservative: recommend manual review or flagged_suspicious whenever uncertain.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aiStatus: {
              type: Type.STRING,
              description: 'Must be one of: recommended_approve, needs_manual_review, flagged_suspicious'
            },
            confidence: {
              type: Type.INTEGER,
              description: 'Confidence score from 0 to 100'
            },
            documentMatch: {
              type: Type.BOOLEAN,
              description: 'True if applicant name and ID reasonably match the uploaded documents'
            },
            titleDeedDetected: {
              type: Type.BOOLEAN,
              description: 'True if Document 1 appears to be a real property deed/cession/ownership document'
            },
            nationalIdDetected: {
              type: Type.BOOLEAN,
              description: 'True if Document 2 appears to be a real government National ID'
            },
            extractedOwnerName: {
              type: Type.STRING,
              description: 'Owner/holder name extracted from documents, or empty string if unreadable'
            },
            extractedIdNumber: {
              type: Type.STRING,
              description: 'ID number extracted from ID document, or empty string if unreadable'
            },
            extractedPropertyReference: {
              type: Type.STRING,
              description: 'Stand number, deed number, or address visible in deed, or empty string'
            },
            redFlags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of suspicious findings or discrepancies, empty if none'
            },
            summary: {
              type: Type.STRING,
              description: 'Concise 1-3 sentence verification assessment for the admin reviewer'
            }
          },
          required: ['aiStatus', 'confidence', 'documentMatch', 'titleDeedDetected', 'nationalIdDetected', 'redFlags', 'summary']
        }
      }
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    const allowedAiStatuses = new Set(['recommended_approve', 'needs_manual_review', 'flagged_suspicious']);
    const normalizedStatus = allowedAiStatuses.has(parsed.aiStatus) ? parsed.aiStatus : 'needs_manual_review';
    const redFlags = Array.isArray(parsed.redFlags) ? [...parsed.redFlags] : [];
    for (const warn of duplicateWarnings) {
      if (!redFlags.includes(warn)) redFlags.push(warn);
    }

    return {
      ok: true,
      status: 200,
      model: VERIFICATION_MODEL,
      analysis: {
        aiStatus: duplicateWarnings.length > 0 ? 'flagged_suspicious' : normalizedStatus,
        confidence: Math.max(0, Math.min(100, Number(parsed.confidence || 0))),
        documentMatch: Boolean(parsed.documentMatch),
        titleDeedDetected: Boolean(parsed.titleDeedDetected),
        nationalIdDetected: Boolean(parsed.nationalIdDetected),
        extractedOwnerName: String(parsed.extractedOwnerName || ''),
        extractedIdNumber: String(parsed.extractedIdNumber || ''),
        extractedPropertyReference: String(parsed.extractedPropertyReference || ''),
        redFlags,
        summary: String(parsed.summary || 'Automated document inspection completed.')
      }
    };
  } catch (err) {
    const status = Number(err?.status || err?.code || 500);
    const rawMsg = String(err?.message || '').replace(/AIza[0-9A-Za-z_-]{15,}/g, '[REDACTED_KEY]');
    const lower = rawMsg.toLowerCase();
    const isKeyError =
      status === 401 ||
      status === 403 ||
      lower.includes('api key not valid') ||
      lower.includes('api_key_invalid') ||
      lower.includes('permission_denied') ||
      lower.includes('permission denied');

    if (isKeyError) {
      return {
        ok: false,
        status: 502,
        code: 'GEMINI_KEY_INVALID',
        error: `AI document verification key authorization failed (${rawMsg || status}). Check GEMINI_API_KEY in Settings > Secrets.`
      };
    }
    if (status === 429 || lower.includes('quota') || lower.includes('resource_exhausted')) {
      return {
        ok: false,
        status: 429,
        code: 'GEMINI_RATE_LIMITED',
        error: 'AI verification rate limit reached. Retry shortly or complete manual review.'
      };
    }
    return {
      ok: false,
      status: 502,
      code: 'GEMINI_UPSTREAM_ERROR',
      error: `Unable to run AI document verification right now (${rawMsg || `HTTP ${status}`}).`
    };
  }
}

export async function downloadVerificationDocBuffer(adminClient, objectPath) {
  if (!adminClient || !objectPath) return null;
  const { data, error } = await adminClient.storage.from(LANDLORD_DOCS_BUCKET).download(objectPath);
  if (error || !data) return null;
  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const detected = MIME_BY_MAGIC.find((entry) => entry.match(buffer));
  return {
    buffer,
    mimeType: detected?.mime || data.type || 'application/octet-stream'
  };
}
