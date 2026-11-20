import { notFound, redirect } from "next/navigation";
import { getToken } from "@/lib/be";
import { liveCaseById } from "@/lib/live-cases";
import LiveCase from "@/components/LiveCase";

export default async function Page({ params }) {
  const { n } = await params;
  if (!(await getToken())) redirect("/login");
  if (!liveCaseById(n)) notFound();
  return <LiveCase id={Number(n)} />;
}
