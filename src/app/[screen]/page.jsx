import { ScreenRouter } from '../../ScreenRouter.jsx';

export default async function ScreenPage({ params }) {
  const { screen } = await params;
  return <ScreenRouter screen={screen} />;
}
