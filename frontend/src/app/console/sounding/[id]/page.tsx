import { SimulationViewClient } from "./client";

// Pre-render demo route for static export.
// Other simulation IDs work in dev/SPA via client-side routing
// (CloudFront 404 -> index.html SPA fallback in production).
export function generateStaticParams() {
  return [{ id: "demo" }, { id: "running" }];
}

export const dynamicParams = true;

export default async function SimulationViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const { print } = await searchParams;
  return <SimulationViewClient id={id} autoPrint={print === "1"} />;
}
