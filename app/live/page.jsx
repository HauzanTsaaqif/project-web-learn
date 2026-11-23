import { redirect } from "next/navigation";
import { getToken } from "@/lib/be";
import LivePage from "@/components/LivePage";

export default async function Page() {
  if (!(await getToken())) redirect("/login");
  return <LivePage />;
}
