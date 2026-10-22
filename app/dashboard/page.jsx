import { redirect } from "next/navigation";
import { getToken } from "@/lib/be";
import Dashboard from "@/components/Dashboard";

export const metadata = { title: "Dashboard - DataQuest Lab" };
export default async function Page() {
  if (!(await getToken())) redirect("/login");
  return <Dashboard />;
}
