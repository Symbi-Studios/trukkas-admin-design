import { ScreenRouter } from '../../ScreenRouter.jsx';
import { staticParamsFor } from '../../staticParams.js';

export function generateStaticParams() { return staticParamsFor('screen'); }

export default async function ScreenPage({ params }) {
  const { screen } = await params;
  return <ScreenRouter screen={screen} />;
}
