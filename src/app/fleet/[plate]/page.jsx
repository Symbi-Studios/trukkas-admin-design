import { FleetTruckDetail } from '../../../screens/FleetTruckDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('plate'); }
export default function FleetTruckDetailPage(){return <FleetTruckDetail/>}
