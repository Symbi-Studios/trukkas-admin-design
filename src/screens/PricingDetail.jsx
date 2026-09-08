'use client';

import { useState } from 'react';
import { useNavigate, useParams } from '../router.js';
import {
  PageHeader, Button, Badge, Card, SectionCard, LabelValue, DropdownMenu, Icon,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { setServicePricingStatus } from '../mock/api.js';
import { formatNaira } from '../mock/format.js';

function Fact({ icon, iconTint = 'blue', label, value }) {
  const TINT = {
    blue: ['var(--tk-blue-soft)', 'var(--tk-blue)'],
    green: ['var(--tk-success-soft)', 'var(--tk-success)'],
    amber: ['var(--tk-warning-soft)', 'var(--tk-warning)'],
    purple: ['var(--tk-purple-soft)', 'var(--tk-purple)'],
  };
  const [bg, fg] = TINT[iconTint] || TINT.blue;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <span style={{ width: 34, height: 34, borderRadius: 'var(--tk-r-sm)', background: bg, color: fg,
                     display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
        <Icon name={icon} size={17} />
      </span>
      <span style={{ flex: 1, font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-400)' }}>{label}</span>
      <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function PricingDetail() {
  const { priceId } = useParams();
  const navigate = useNavigate();
  const rows = useCollection('servicePricing') || [];
  const r = rows.find((x) => x.id === priceId);
  const [menu, setMenu] = useState(false);

  if (!r) {
    return (
      <Card>
        <span className="tk-body">No pricing entry found with ID {priceId}.</span>
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/pricing')}>Back to Pricing Management</Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <PageHeader crumbs={['Business & Finance', 'Pricing Management', 'Service Pricing', r.id]} title={r.service}
        description="Detailed view of this service pricing entry."
        actions={<>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/pricing')}>Back</Button>
          <Button variant="outline" icon="pencil">Edit Pricing</Button>
          <span style={{ position: 'relative' }}>
            <Button variant="secondary" iconRight="ellipsis-vertical" onClick={() => setMenu((m) => !m)}>More Actions</Button>
            {menu && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setMenu(false)}>
                <DropdownMenu width={220} items={[
                  { label: 'Duplicate Pricing', icon: 'copy' },
                  { label: r.status === 'Active' ? 'Deactivate' : 'Activate', icon: 'circle-slash',
                    onClick: () => { setServicePricingStatus(r.id, r.status === 'Active' ? 'Inactive' : 'Active'); setMenu(false); } },
                  { divider: true },
                  { label: 'Export Details', icon: 'file-text' },
                ]} />
              </span>
            )}
          </span>
        </>} />

      <Card style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ width: 56, height: 56, borderRadius: 'var(--tk-r-lg)', background: 'var(--tk-blue-soft)',
                         color: 'var(--tk-blue)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
            <Icon name="tag" size={26} />
          </span>
          <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 className="tk-title" style={{ fontSize: 22 }}>{r.service}</h2>
              <Badge>{r.status}</Badge>
            </div>
            <span className="tk-meta">{r.route} · {r.coverage}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="tk-meta">Total Price</div>
            <div style={{ font: '700 24px/30px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{formatNaira(r.totalPrice)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: '1px solid var(--tk-line)', paddingTop: 16 }}>
          {[
            { label: 'Pricing ID', value: r.id },
            { label: 'Truck Type / Container', value: r.truckType },
            { label: 'Unit', value: r.unit },
            { label: 'Last Updated', value: `${r.updated} ${r.updatedTime}` },
          ].map((f, i) => (
            <div key={f.label} style={{ flex: '1 1 150px', padding: '0 18px', borderLeft: i ? '1px solid var(--tk-line)' : 'none' }}>
              <div className="tk-meta" style={{ marginBottom: 4 }}>{f.label}</div>
              <div style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{f.value}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Pricing Details">
          <LabelValue label="Service" value={r.service} />
          <LabelValue label="Route" value={r.route} />
          <LabelValue label="Coverage" value={r.coverage} />
          <LabelValue label="Truck Type / Container" value={r.truckType} />
          <LabelValue label="Unit" value={r.unit} />
          <LabelValue label="Status" value={<Badge>{r.status}</Badge>} />
          <LabelValue label="Currency" value="NGN (₦)" />
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Rate Breakdown" pad="none" style={{ padding: '4px var(--tk-card-pad) 8px' }}>
            <Fact icon="coins" iconTint="blue" label="Base Price" value={formatNaira(r.basePrice)} />
            <Fact icon="badge-percent" iconTint="amber" label="Surcharge" value={`${formatNaira(r.surcharge)} (${r.surchargePct})`} />
            <Fact icon="wallet" iconTint="green" label="Total Price" value={formatNaira(r.totalPrice)} />
          </SectionCard>

          <div style={{ borderRadius: 'var(--tk-r-lg)', border: '1px solid var(--tk-blue-soft)',
                        background: 'var(--tk-blue-soft)', padding: 'var(--tk-card-pad)', display: 'grid', gap: 10 }}>
            <span style={{ font: '600 16px/22px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>Calculation</span>
            <span style={{ font: '700 16px/22px var(--tk-font-mono)', color: 'var(--tk-ink-900)' }}>
              {formatNaira(r.basePrice)} + {formatNaira(r.surcharge)} = {formatNaira(r.totalPrice)}
            </span>
            <span className="tk-meta">Charged {r.unit.toLowerCase()}, in {r.route}{r.coverage ? ` (${r.coverage})` : ''}.</span>
          </div>
        </div>
      </div>
    </>
  );
}
