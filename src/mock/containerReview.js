// In-memory mock for per-container document review.
//
// There is no backend for this flow yet. This module stands in for it so the
// UI can be built and reviewed first; containerReviewApi.js is the only file
// that calls it, and it documents the proposed HTTP contract this mock follows.
// Swapping to the real API should only touch that file.

import { DOC_STATUS, JOB_REVIEW_STATUS, countDocuments, reviewStatusFor, docDescription, docLabel } from '../domain/containerReview.js';

const ADMIN = 'Dee Caulcrick';

// ---------------------------------------------------------------------------
// Placeholder document scans (SVG), so the preview has something realistic to
// compare against: the unit number and date are printed on every page.
// ---------------------------------------------------------------------------
function esc(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}

function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function scan({ type, unitLabel, unitKind, date, job, forwarder, serial, blurry = false, accent = '#0b2a6f' }) {
  const title = docDescription(type).toUpperCase();
  const unitField = unitKind === 'rack' ? 'Rack / Lot No.' : 'Container No.';
  const rows = [
    [unitField, unitLabel],
    ['Document date', prettyDate(date)],
    ['Reference', serial],
    ['Job reference', job],
    ['Consignee / Agent', forwarder],
    ['Port of discharge', 'Apapa Terminal, Lagos'],
  ];
  const rowSvg = rows.map(([k, v], i) => {
    const y = 236 + i * 58;
    return `<text x="56" y="${y}" font-size="15" fill="#6b7280">${esc(k)}</text>`
      + `<text x="56" y="${y + 24}" font-size="20" font-weight="700" fill="#111827" font-family="ui-monospace,Menlo,monospace">${esc(v)}</text>`
      + `<line x1="56" y1="${y + 38}" x2="544" y2="${y + 38}" stroke="#e5e7eb"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800" font-family="Helvetica,Arial,sans-serif">`
    + `<defs><filter id="b"><feGaussianBlur stdDeviation="${blurry ? 2.6 : 0}"/></filter></defs>`
    + `<rect width="600" height="800" fill="#fdfdfb"/>`
    + `<g filter="url(#b)">`
    + `<rect x="32" y="32" width="536" height="736" fill="none" stroke="#d1d5db"/>`
    + `<rect x="32" y="32" width="536" height="96" fill="${accent}"/>`
    + `<text x="56" y="76" font-size="13" fill="#c7d2fe" letter-spacing="2">APAPA TERMINAL SERVICES</text>`
    + `<text x="56" y="106" font-size="24" font-weight="700" fill="#fff">${esc(title)}</text>`
    + `<text x="56" y="176" font-size="13" fill="#6b7280">Serial</text>`
    + `<text x="120" y="176" font-size="13" font-weight="700" fill="#111827">${esc(serial)}</text>`
    + rowSvg
    + `<circle cx="452" cy="652" r="56" fill="none" stroke="#1d4ed8" stroke-width="3" opacity="0.55"/>`
    + `<text x="452" y="648" font-size="12" text-anchor="middle" fill="#1d4ed8" opacity="0.7" font-weight="700">RELEASED</text>`
    + `<text x="452" y="666" font-size="10" text-anchor="middle" fill="#1d4ed8" opacity="0.7">${esc(prettyDate(date))}</text>`
    + `<path d="M64 690 C 110 650, 140 712, 190 668 S 250 690, 270 662" stroke="#111827" stroke-width="2" fill="none"/>`
    + `<text x="64" y="720" font-size="12" fill="#6b7280">Authorised signatory</text>`
    + `</g></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
let seq = 0;
const nextId = (prefix) => `${prefix}_${(++seq).toString(36).padStart(4, '0')}`;
const FILE_PREFIX = { TDO: 'tdo', CUSTOMS_GATE_PASS: 'gate-pass', EXIT_NOTE: 'exit-note' };
const TYPES = ['TDO', 'CUSTOMS_GATE_PASS', 'EXIT_NOTE'];

function at(day, time = '09:00') { return `2026-11-${String(day).padStart(2, '0')}T${time}:00+01:00`; }

/**
 * spec per document: 'P' pending, 'A' approved, 'R' rejected,
 * 'P2' pending resubmission (v1 was rejected), 'A2' approved resubmission.
 * Optional flaws: { [type]: 'date' | 'blurry' | 'number' } apply to the current (or rejected v1) file.
 */
function buildUnit(job, label, specs, flaws = {}, reasons = {}) {
  const unitId = nextId('unit');
  const documents = TYPES.map((type, index) => {
    const spec = specs[index];
    const resubmitted = spec.endsWith('2');
    const status = spec[0] === 'A' ? DOC_STATUS.APPROVED : spec[0] === 'R' ? DOC_STATUS.REJECTED : DOC_STATUS.PENDING;
    const flaw = flaws[type];
    const serial = `${FILE_PREFIX[type].toUpperCase().replace('-', '')}-${label.slice(-5)}-${index + 1}`;
    const base = { type, unitLabel: label, unitKind: job.unitKind, job: job.jobNumber, forwarder: job.forwarder, serial };
    const wrongDate = '2026-11-' + String(Number(job.tdoDate.slice(8)) - 3).padStart(2, '0');
    const fileFor = (version, withFlaw) => ({
      fileName: `${FILE_PREFIX[type]}-${label.toLowerCase()}${version > 1 ? '-v' + version : ''}.${withFlaw === 'blurry' ? 'jpg' : 'pdf'}`,
      mimeType: 'image/svg+xml',
      sizeBytes: 180000 + ((label.charCodeAt(5) * 977 + index * 3313 + version * 7919) % 900000),
      url: scan({
        ...base,
        date: withFlaw === 'date' ? wrongDate : job.tdoDate,
        unitLabel: withFlaw === 'number' ? label.slice(0, 4) + String(Number(label.slice(4)) + 1).padStart(7, '0') : label,
        blurry: withFlaw === 'blurry',
      }),
    });
    const history = resubmitted ? [{
      version: 1,
      ...fileFor(1, flaw),
      status: DOC_STATUS.REJECTED,
      uploadedBy: job.contact,
      uploadedAt: at(job.submittedDay, '10:12'),
      reviewedBy: ADMIN,
      reviewedAt: at(job.submittedDay + 1, '11:40'),
      rejectionReason: reasons[type] || `${label} · ${docLabel(type)}: Date doesn’t match the TDO date`,
    }] : [];
    const version = resubmitted ? 2 : 1;
    const current = fileFor(version, resubmitted ? null : (status === DOC_STATUS.REJECTED ? flaw : null));
    return {
      id: nextId('doc'),
      type,
      status,
      version,
      ...current,
      uploadedBy: job.contact,
      uploadedAt: resubmitted ? at(job.submittedDay + 2, '08:25') : at(job.submittedDay, '10:12'),
      reviewedBy: status === DOC_STATUS.PENDING ? null : ADMIN,
      reviewedAt: status === DOC_STATUS.PENDING ? null : at(job.submittedDay + (resubmitted ? 2 : 1), '14:05'),
      rejectionReason: status === DOC_STATUS.REJECTED ? (reasons[type] || `${label} · ${docLabel(type)}: Date doesn’t match the TDO date`) : null,
      history,
    };
  });
  return { id: unitId, label, kind: job.unitKind, documents };
}

function job(base, units) {
  const record = { validatedAt: null, validatedBy: null, ...base };
  record.units = units.map(([label, specs, flaws, reasons]) => buildUnit(record, label, specs, flaws, reasons));
  const counts = countDocuments(record.units);
  if (reviewStatusFor(counts) === JOB_REVIEW_STATUS.VALIDATED) {
    record.validatedAt = record.validatedAt || at(record.submittedDay + 1, '16:20');
    record.validatedBy = record.validatedBy || ADMIN;
  }
  record.submittedAt = at(record.submittedDay, '10:12');
  return record;
}

function seedJobs() {
  return [
    job({ id: 'job_cr_2041', jobNumber: 'TRK-2041', forwarder: 'Bluewave Logistics', contact: 'Amaka Eze', jobType: 'Import', unitKind: 'container', route: { pickup: 'Apapa Port, Lagos', delivery: 'Sharada Industrial Estate, Kano' }, tdoDate: '2026-11-28', submittedDay: 23, updatedAt: at(23, '08:42') }, [
      ['MSCU4821937', ['P', 'P', 'P']],
      ['TGHU7654321', ['P', 'P', 'P'], { TDO: 'date' }],
      ['MSKU9988776', ['P', 'P', 'P']],
      ['CMAU3302148', ['P', 'P', 'P'], { EXIT_NOTE: 'blurry' }],
    ]),
    job({ id: 'job_cr_2038', jobNumber: 'TRK-2038', forwarder: 'Harbourline Forwarding', contact: 'Tunde Bakare', jobType: 'Import', unitKind: 'container', route: { pickup: 'Tin Can Island Port, Lagos', delivery: 'Agbara Industrial Estate, Ogun' }, tdoDate: '2026-11-26', submittedDay: 20, updatedAt: at(23, '07:58') }, [
      ['HLXU2210457', ['A', 'A', 'A']],
      ['OOLU8812034', ['P2', 'A', 'A'], { TDO: 'date' }, { TDO: 'OOLU8812034 · TDO: Date doesn’t match the TDO date (shows 23 Nov)' }],
      ['MSCU1190346', ['A', 'P', 'A']],
    ]),
    job({ id: 'job_cr_2035', jobNumber: 'TRK-2035', forwarder: 'Kestrel Freight', contact: 'Ngozi Okafor', jobType: 'Import', unitKind: 'container', route: { pickup: 'Apapa Port, Lagos', delivery: 'Trans-Amadi, Port Harcourt' }, tdoDate: '2026-11-27', submittedDay: 19, updatedAt: at(21, '15:10') }, [
      ['TCLU5567012', ['A', 'A', 'A']],
      ['MRKU6639021', ['A', 'R', 'A'], { CUSTOMS_GATE_PASS: 'number' }, { CUSTOMS_GATE_PASS: 'MRKU6639021 · Gate Pass: Wrong container number (shows MRKU6639022)' }],
    ]),
    job({ id: 'job_cr_2030', jobNumber: 'TRK-2030', forwarder: 'Oduduwa Cargo Services', contact: 'Segun Adeyemi', jobType: 'Bulk break', unitKind: 'rack', route: { pickup: 'Lekki Deep Sea Port, Lagos', delivery: 'Ota Steel Works, Ogun' }, tdoDate: '2026-11-25', submittedDay: 21, updatedAt: at(22, '17:30') }, [
      ['RACK-01', ['A', 'A', 'P']],
      ['RACK-02', ['P', 'R', 'P'], { CUSTOMS_GATE_PASS: 'blurry' }, { CUSTOMS_GATE_PASS: 'RACK-02 · Gate Pass: Illegible or blurry scan' }],
      ['RACK-03', ['P', 'P', 'P']],
    ]),
    job({ id: 'job_cr_2044', jobNumber: 'TRK-2044', forwarder: 'Bluewave Logistics', contact: 'Amaka Eze', jobType: 'Import', unitKind: 'container', route: { pickup: 'Onne Port, Rivers', delivery: 'Aba Industrial Layout, Abia' }, tdoDate: '2026-11-30', submittedDay: 23, updatedAt: at(23, '09:05') }, [
      ['SEGU4410093', ['P', 'P', 'P']],
    ]),
    job({ id: 'job_cr_2022', jobNumber: 'TRK-2022', forwarder: 'Harbourline Forwarding', contact: 'Tunde Bakare', jobType: 'Import', unitKind: 'container', route: { pickup: 'Apapa Port, Lagos', delivery: 'Idu Industrial Area, Abuja' }, tdoDate: '2026-11-24', submittedDay: 18, updatedAt: at(22, '12:15'), validatedAt: at(22, '12:15') }, [
      ['MSCU7781204', ['A', 'A', 'A']],
      ['TGHU1129847', ['A2', 'A', 'A'], { TDO: 'date' }],
    ]),
    job({ id: 'job_cr_2019', jobNumber: 'TRK-2019', forwarder: 'Kestrel Freight', contact: 'Ngozi Okafor', jobType: 'Import', unitKind: 'container', route: { pickup: 'Tin Can Island Port, Lagos', delivery: 'Ikeja Industrial Estate, Lagos' }, tdoDate: '2026-11-23', submittedDay: 16, updatedAt: at(18, '10:44'), validatedAt: at(18, '10:44') }, [
      ['CMAU1022394', ['A', 'A', 'A']],
      ['CMAU1022410', ['A', 'A', 'A']],
      ['CMAU1022437', ['A', 'A', 'A']],
      ['CMAU1022455', ['A', 'A', 'A']],
    ]),
  ];
}

let jobs = seedJobs();

// Jobs opened from Job Details that aren't in the seed get a stable set so
// the tab and workspace can be exercised on any job: all pending while the
// job is in document review, all approved (locked) once it's past it.
const PREFIXES = ['MSCU', 'TGHU', 'MSKU', 'CMAU', 'HLXU', 'OOLU'];
function hash(text) { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function generatedJob(jobId, hint = {}) {
  const h = hash(jobId);
  const count = 2 + (h % 3);
  const tdo = hint.tdoDate && /^\d{4}-\d{2}-\d{2}/.test(hint.tdoDate) ? hint.tdoDate.slice(0, 10) : '2026-11-' + String(24 + (h % 6)).padStart(2, '0');
  return job({
    id: jobId,
    jobNumber: hint.jobNumber || jobId,
    forwarder: hint.forwarder || 'Forwarder',
    contact: hint.forwarder || 'Forwarder',
    jobType: 'Import',
    unitKind: 'container',
    route: { pickup: hint.origin || '—', delivery: hint.destination || '—' },
    tdoDate: tdo,
    submittedDay: 22,
    updatedAt: at(22, '10:12'),
  }, Array.from({ length: count }, (_, i) => [PREFIXES[(h + i) % PREFIXES.length] + String((h % 9000000) + 1000000 + i * 17).slice(0, 7), hint.stage === 'past' ? ['A', 'A', 'A'] : ['P', 'P', 'P']]));
}

// ---------------------------------------------------------------------------
// Read models (match the proposed API responses)
// ---------------------------------------------------------------------------
const clone = (value) => JSON.parse(JSON.stringify(value));

function summaryOf(record) {
  const counts = countDocuments(record.units);
  const pendingDocs = record.units.flatMap((u) => u.documents).filter((d) => d.status === DOC_STATUS.PENDING);
  return {
    id: record.id,
    jobNumber: record.jobNumber,
    forwarder: record.forwarder,
    jobType: record.jobType,
    unitKind: record.unitKind,
    unitCount: record.units.length,
    route: record.route,
    tdoDate: record.tdoDate,
    reviewStatus: reviewStatusFor(counts),
    counts,
    oldestPendingAt: pendingDocs.map((d) => d.uploadedAt).sort()[0] || null,
    submittedAt: record.submittedAt,
    updatedAt: record.updatedAt,
    validatedAt: record.validatedAt,
  };
}

function detailOf(record) {
  const summary = summaryOf(record);
  return { ...summary, contact: record.contact, validatedBy: record.validatedBy, locked: summary.reviewStatus === JOB_REVIEW_STATUS.VALIDATED, units: clone(record.units) };
}

const wait = (ms = 320) => new Promise((resolve) => setTimeout(resolve, ms));
const notFound = () => Object.assign(new Error('Job not found.'), { status: 404 });

export async function listReviewJobs() {
  await wait(260);
  return jobs.map(summaryOf);
}

export async function getReviewJob(jobId, hint) {
  await wait(220);
  let record = jobs.find((j) => j.id === jobId || j.jobNumber === jobId);
  if (!record && hint) { record = generatedJob(jobId, hint); jobs = [...jobs, record]; }
  if (!record) throw notFound();
  return detailOf(record);
}

function locate(jobId, documentId) {
  const record = jobs.find((j) => j.id === jobId);
  if (!record) throw notFound();
  const doc = record.units.flatMap((u) => u.documents).find((d) => d.id === documentId);
  if (!doc) throw Object.assign(new Error('Document not found.'), { status: 404 });
  if (reviewStatusFor(countDocuments(record.units)) === JOB_REVIEW_STATUS.VALIDATED) {
    throw Object.assign(new Error('These documents are locked because the job is validated.'), { status: 409, code: 'DOCUMENTS_LOCKED' });
  }
  if (doc.status !== DOC_STATUS.PENDING) throw Object.assign(new Error('This document was already reviewed. Refresh to see its latest status.'), { status: 409 });
  return { record, doc };
}

function settle(record) {
  const now = new Date().toISOString();
  record.updatedAt = now;
  if (reviewStatusFor(countDocuments(record.units)) === JOB_REVIEW_STATUS.VALIDATED) {
    record.validatedAt = now;
    record.validatedBy = ADMIN;
  }
}

export async function approveReviewDocument(jobId, documentId) {
  await wait();
  const { record, doc } = locate(jobId, documentId);
  Object.assign(doc, { status: DOC_STATUS.APPROVED, reviewedBy: ADMIN, reviewedAt: new Date().toISOString(), rejectionReason: null });
  settle(record);
  return { document: clone(doc), job: summaryOf(record) };
}

export async function rejectReviewDocument(jobId, documentId, reason) {
  await wait();
  if (!String(reason || '').trim()) throw Object.assign(new Error('Enter a reason for the forwarder.'), { status: 400 });
  const { record, doc } = locate(jobId, documentId);
  Object.assign(doc, { status: DOC_STATUS.REJECTED, reviewedBy: ADMIN, reviewedAt: new Date().toISOString(), rejectionReason: reason.trim() });
  settle(record);
  return { document: clone(doc), job: summaryOf(record) };
}

/**
 * Prototype-only: stands in for the forwarder replacing a rejected file in the
 * mobile app, so the "comes back to the queue" loop can be demoed end to end.
 */
export async function simulateForwarderReplacement(jobId, documentId) {
  await wait(400);
  const record = jobs.find((j) => j.id === jobId);
  const unit = record?.units.find((u) => u.documents.some((d) => d.id === documentId));
  const doc = unit?.documents.find((d) => d.id === documentId);
  if (!doc || doc.status !== DOC_STATUS.REJECTED) throw Object.assign(new Error('Only a rejected document can be replaced.'), { status: 409 });
  doc.history = [...doc.history, { version: doc.version, fileName: doc.fileName, mimeType: doc.mimeType, sizeBytes: doc.sizeBytes, url: doc.url, status: DOC_STATUS.REJECTED, uploadedBy: doc.uploadedBy, uploadedAt: doc.uploadedAt, reviewedBy: doc.reviewedBy, reviewedAt: doc.reviewedAt, rejectionReason: doc.rejectionReason }];
  const version = doc.version + 1;
  Object.assign(doc, {
    version,
    status: DOC_STATUS.PENDING,
    fileName: doc.fileName.replace(/(-v\d+)?\.(pdf|jpg)$/, `-v${version}.pdf`),
    url: scan({ type: doc.type, unitLabel: unit.label, unitKind: unit.kind, date: record.tdoDate, job: record.jobNumber, forwarder: record.forwarder, serial: `${doc.type.slice(0, 3)}-${unit.label.slice(-5)}-R${version}` }),
    uploadedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
  });
  record.updatedAt = doc.uploadedAt;
  return { document: clone(doc), job: summaryOf(record) };
}
