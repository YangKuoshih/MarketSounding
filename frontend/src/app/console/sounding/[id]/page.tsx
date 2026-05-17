import { SimulationViewClient } from "./client";

// Pre-render demo route for static export.
// Other simulation IDs work in dev/SPA via client-side routing
// (CloudFront 404 -> index.html SPA fallback in production).
export function generateStaticParams() {
  return [{ id: "demo" }, { id: "running" }];
}

export const dynamicParams = false;

export default async function SimulationViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SimulationViewClient id={id} />;
}
