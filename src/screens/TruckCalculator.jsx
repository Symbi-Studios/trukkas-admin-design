import { useState } from 'react';
import { PageHeader, SectionCard, Select, TextField, Button, LabelValue, Divider, Banner } from '../ds.js';
import { formatNaira } from '../mock/format.js';

const CARGO_TYPES = ['General Goods', 'Frozen / Chilled', 'Industrial Chemicals', 'Cement / Bulk Solids'];
const ROUTES = {
  'Lagos → Kano': { distance: 820, ratePerKm: 445 },
  'Onne → Abuja': { distance: 610, ratePerKm: 398 },
  'Apapa → Ibadan': { distance: 128, ratePerKm: 512 },
};
const COMMISSION_RATE = 0.04;

function recommendTruck(cargoType, weight) {
  if (cargoType === 'Frozen / Chilled') return 'Reefer Truck';
  if (cargoType === 'Industrial Chemicals') return 'Tanker';
  if (cargoType === 'Cement / Bulk Solids') return '40FT Trailer (Bulk)';
  if (weight > 20) return '40FT High Cube';
  if (weight > 10) return '40FT Trailer';
  return '20FT Container';
}

export function TruckCalculator() {
  const [cargoType, setCargoType] = useState(CARGO_TYPES[0]);
  const [weight, setWeight] = useState('18');
  const [route, setRoute] = useState(Object.keys(ROUTES)[0]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function handleCalculate() {
    const w = Number(weight);
    if (!w || w <= 0) { setError('Enter a cargo weight greater than 0.'); setResult(null); return; }
    setError('');
    const { distance, ratePerKm } = ROUTES[route];
    const baseRate = distance * ratePerKm;
    const commission = Math.round(baseRate * COMMISSION_RATE);
    const total = baseRate + commission;
    const hours = distance / 55;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    setResult({
      truck: recommendTruck(cargoType, w),
      duration: `${h}h ${m}m`,
      ratePerKm,
      baseRate,
      commission,
      total,
    });
  }

  return (
    <>
      <PageHeader crumbs={['Cargo', 'Truck Calculator']} title="Truck Calculator"
        description="Estimate the right truck type and price for a job based on cargo details." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Job Details">
          <div style={{ display: 'grid', gap: 14 }}>
            <Select label="Cargo Type" value={cargoType} options={CARGO_TYPES} onChange={(e) => setCargoType(e.target.value)} />
            <TextField label="Cargo Weight (tonnes)" type="number" min="0" value={weight}
              onChange={(e) => setWeight(e.target.value)} error={error} />
            <Select label="Route" value={route} options={Object.keys(ROUTES)} onChange={(e) => setRoute(e.target.value)} />
            <Button icon="calculator" fullWidth onClick={handleCalculate}>Calculate</Button>
          </div>
        </SectionCard>
        <SectionCard title="Recommended Truck & Estimate">
          {!result ? (
            <Banner tone="info" title="No estimate yet">
              Fill in the job details and press Calculate to see a recommendation.
            </Banner>
          ) : (
            <>
              <LabelValue label="Recommended Truck Type" value={result.truck} />
              <Divider />
              <LabelValue label="Distance" value={`${ROUTES[route].distance} km`} />
              <Divider />
              <LabelValue label="Estimated Trip Duration" value={result.duration} />
              <Divider />
              <LabelValue label="Base Rate" value={`${formatNaira(result.ratePerKm)} / km`} />
              <Divider />
              <LabelValue label={`Platform Commission (${COMMISSION_RATE * 100}%)`} value={formatNaira(result.commission)} />
              <Divider />
              <LabelValue label="Estimated Total Price" value={formatNaira(result.total)} valueTone="var(--tk-blue)" />
            </>
          )}
        </SectionCard>
      </div>
    </>
  );
}
