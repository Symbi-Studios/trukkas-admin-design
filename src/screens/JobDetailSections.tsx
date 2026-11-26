'use client';

import type { ReactNode } from 'react';
import { Avatar, SectionCard } from '../ds.js';
import type { ReviewJob } from '@/types/docReview';
import type { DetailAssignment, DetailCancellation, JobDetailExtras } from '@/types/jobDetail';
import './JobDetailExtras.css';

// The extra sections on Job details: cargo, people, schedule, fee breakdown and the cancel reason.
// They take display values from lib/jobs/detail-adapt.ts. A value the backend has not sent yet shows "—".

const DASH = '—';

function show(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return DASH;
  return String(value);
}

function naira(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DASH;
  return '₦' + value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Fact({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={'jd-info-fact' + (wide ? ' wide' : '')}>
      <dt>{label}</dt>
      <dd>{children === null || children === undefined || children === '' ? DASH : children}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

// ---------- cargo ----------

interface CargoItem { id: string; title: string; meta: string; weight: string; docs: string | null; assignedTo: string | null; photoUrl: string | null }

/** What the job carries. The detail's own list wins; if it has none, the documents list names the containers or racks. */
export function buildCargoItems(extras: JobDetailExtras, review: ReviewJob | null): { kind: 'container' | 'rack'; items: CargoItem[] } {
  const docsFor = (label: string): string | null => {
    const unit = review?.units.find((u) => u.label === label || (label !== DASH && u.label.includes(label)));
    if (!unit || !unit.documents.length) return null;
    const approved = unit.documents.filter((d) => d.status === 'APPROVED').length;
    return `${approved} of ${unit.documents.length} documents approved`;
  };
  const carrier = (a: DetailAssignment | null): string => (a ? `${a.driverName} · ${a.plate}` : 'Not assigned');
  if (extras.containers.length) {
    return { kind: 'container', items: extras.containers.map((c) => ({ id: c.id, title: c.number, meta: `${c.size} · ${c.type}`, weight: c.weight, docs: docsFor(c.number), assignedTo: carrier(c.assignment), photoUrl: null })) };
  }
  if (extras.racks.length) {
    return { kind: 'rack', items: extras.racks.map((r) => ({ id: r.id, title: `Rack ${r.number}`, meta: r.truckType, weight: r.weight, docs: docsFor(r.number), assignedTo: carrier(r.assignment), photoUrl: r.photoUrl })) };
  }
  const units = review?.units ?? [];
  return {
    kind: units[0]?.kind ?? 'container',
    items: units.map((u) => ({ id: u.id, title: u.label, meta: u.kind === 'rack' ? 'Rack' : 'Container', weight: DASH, docs: docsFor(u.label), assignedTo: null, photoUrl: null })),
  };
}

interface CargoSectionProps {
  extras: JobDetailExtras;
  description: string;
  review: ReviewJob | null;
  loadingDocs: boolean;
}

export function CargoSection({ extras, description, review, loadingDocs }: CargoSectionProps) {
  const { kind, items } = buildCargoItems(extras, review);
  return (
    <SectionCard title={kind === 'rack' ? 'Cargo · racks' : 'Cargo · containers'} description="Everything this job carries" icon="package">
      <dl className="jd-info-facts">
        <Fact label="Cargo kind">{extras.cargoKind}</Fact>
        <Fact label="Items">{items.length || null}</Fact>
        <Fact label="Total weight">{extras.totalWeight}</Fact>
        <Fact label="Trucks required">{extras.requiredTrucks}</Fact>
        <Fact label="Description" wide>{description}</Fact>
      </dl>
      {items.length ? (
        <ul className="jd-item-list">
          {items.map((item) => (
            <li className="jd-item-row" key={item.id}>
              {item.photoUrl && (
                <a className="jd-item-photo" href={item.photoUrl} target="_blank" rel="noreferrer" aria-label={`Open the photo of ${item.title}`}>
                  <img src={item.photoUrl} alt={`Cargo photo of ${item.title}`} loading="lazy" />
                </a>
              )}
              <div className="jd-item-main"><strong>{item.title}</strong><small>{item.meta}</small>{item.assignedTo && <small>{item.assignedTo}</small>}</div>
              <div className="jd-item-end"><strong>{item.weight}</strong>{item.docs && <small>{item.docs}</small>}</div>
            </li>
          ))}
        </ul>
      ) : <p className="jd-overview-empty">{loadingDocs ? 'Loading…' : DASH}</p>}
      {extras.cargoPhotoUrls.length > 0 && (
        <div className="jd-photo-grid" aria-label="Other cargo photos">
          {extras.cargoPhotoUrls.map((url, index) => (
            <a href={url} target="_blank" rel="noreferrer" key={url} aria-label={`Open cargo photo ${index + 1}`}>
              <img src={url} alt={`Cargo photo ${index + 1}`} loading="lazy" />
            </a>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ---------- people ----------

interface PeopleSectionProps {
  extras: JobDetailExtras;
  forwarderName: string;
  forwarderPhone: string;
  truckingCompany: string | null;
}

export function PeopleSection({ extras, forwarderName, forwarderPhone, truckingCompany }: PeopleSectionProps) {
  const { driver, vehicle } = extras;
  return (
    <SectionCard title="People" description="Who is on this job" icon="truck">
      <span className="jd-field-label jd-subhead">Forwarder</span>
      <dl className="jd-info-facts">
        <Fact label="Name">{forwarderName}</Fact>
        <Fact label="Business">{extras.forwarderBusiness}</Fact>
        <Fact label="Email">{extras.forwarderEmail}</Fact>
        <Fact label="Phone">{forwarderPhone}</Fact>
      </dl>
      <span className="jd-field-label jd-subhead">Trucking company</span>
      {truckingCompany ? (
        <dl className="jd-info-facts">
          <Fact label="Name"><span className="jd-person"><Avatar name={truckingCompany} src={extras.truckerAvatarUrl || undefined} size={26} />{truckingCompany}</span></Fact>
          <Fact label="Type">{extras.truckerType}</Fact>
          <Fact label="Email">{extras.truckerEmail}</Fact>
          <Fact label="Phone">{extras.truckerPhone}</Fact>
        </dl>
      ) : <p className="jd-overview-empty">Not assigned yet.</p>}
      <span className="jd-field-label jd-subhead">Driver and truck</span>
      {extras.truckerIsOwnerDriver ? <p className="jd-overview-empty">The trucker drives their own truck.</p> : null}
      {driver || vehicle ? (
        <dl className="jd-info-facts">
          <Fact label="Driver">{driver ? <span className="jd-person"><Avatar name={driver.name} src={driver.avatarUrl || undefined} size={26} />{driver.name}</span> : null}</Fact>
          <Fact label="Driver phone">{driver?.phone}</Fact>
          <Fact label="Trust score">{driver?.trustScore}</Fact>
          <Fact label="Licence">{driver ? `${driver.licenseNumber} · expires ${driver.licenseExpiry}` : null}</Fact>
          <Fact label="Truck plate">{vehicle?.plate}</Fact>
          <Fact label="Truck">{vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.year} · ${vehicle.color}` : null}</Fact>
        </dl>
      ) : extras.truckerIsOwnerDriver ? null : <p className="jd-overview-empty">No driver or truck assigned yet.</p>}
    </SectionCard>
  );
}

// ---------- schedule ----------

export function ScheduleSection({ extras, createdAt, updatedAt }: { extras: JobDetailExtras; createdAt: string; updatedAt: string }) {
  return (
    <SectionCard title="Schedule" icon="calendar-check">
      <div className="jd-price-breakdown">
        <Row label="TDO date" value={show(extras.tdoDate)} />
        <Row label="Free days" value={show(extras.freeDays)} />
        <Row label="Document deadline" value={show(extras.deadline)} />
        <Row label="Expected delivery" value={show(extras.expectedDelivery)} />
        <Row label="Created" value={show(createdAt)} />
        <Row label="Last updated" value={show(updatedAt)} />
      </div>
    </SectionCard>
  );
}

// ---------- money ----------

interface FeeBreakdownProps {
  extras: JobDetailExtras;
  jobValue: number | null;
  agreedPrice: number | null;
  platformFee: number | null;
  platformFeePct: number | null;
  finalPayoutStatus: string | null;
}

export function FeeBreakdown({ extras, jobValue, agreedPrice, platformFee, platformFeePct, finalPayoutStatus }: FeeBreakdownProps) {
  const mobilization = extras.mobilizationAmount === null
    ? DASH
    : `${naira(extras.mobilizationAmount)}${extras.mobilizationPaid ? ` · ${extras.mobilizationPaid}` : ''}`;
  return (
    <SectionCard title="Fee breakdown">
      <div className="jd-price-breakdown">
        <Row label="Offer" value={naira(extras.baseDelivery)} />
        <Row label="Service fee" value={naira(extras.terminalHandling)} />
        <Row label={`Platform fee${platformFeePct !== null ? ` (${platformFeePct}%)` : ''}`} value={naira(platformFee)} />
        <Row label={extras.vatLabel ?? 'VAT'} value={naira(extras.vat)} />
        <Row label="Job value (offer + fees + VAT)" value={naira(jobValue)} />
        <Row label="Agreed price (paid to the trucker in full)" value={naira(agreedPrice)} />
        <Row label="Paid by the forwarder at acceptance" value={naira(extras.forwarderTotal)} />
        <Row label={`Mobilization${extras.mobilizationPercent !== null ? ` (${extras.mobilizationPercent}%)` : ''}`} value={mobilization} />
        <Row label="Final payout" value={show(finalPayoutStatus)} />
        <Row label="Demurrage" value={naira(extras.demurrage)} />
        <Row label="Escrow" value={show(extras.escrowStatus)} />
        <Row label="Payment reference" value={show(extras.paymentReference)} />
        <Row label="Paid on" value={show(extras.paidAt)} />
      </div>
    </SectionCard>
  );
}

// ---------- cancelled ----------

export function CancellationNote({ cancellation }: { cancellation: DetailCancellation }) {
  return (
    <p className="jd-cancel-note">
      <strong>Reason:</strong> {show(cancellation.reason)}
      <small>Cancelled by {show(cancellation.by)} · {show(cancellation.at)}</small>
    </p>
  );
}
