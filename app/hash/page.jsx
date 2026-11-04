import { redirect } from "next/navigation";
import { getToken } from "@/lib/be";
import HashTool from "@/components/HashTool";

export const metadata = { title: "Generator hash - DataQuest Lab" };
export default async function Page() {
  if (!(await getToken())) redirect("/login");
  return <HashTool />;
}
