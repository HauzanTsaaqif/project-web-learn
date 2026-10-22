import { notFound, redirect } from "next/navigation";
import { getToken } from "@/lib/be";
import { caseById } from "@/lib/cases";
import CaseClient from "@/components/CaseClient";

export default async function Page({ params }) {
  const { id } = await params;
  if (!(await getToken())) redirect("/login");
  if (!caseById(id)) notFound();
  return <CaseClient id={Number(id)} />;
}
