import { redirect } from "next/navigation";
import { getToken } from "@/lib/be";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Daftar - DataQuest Lab" };
export default async function Page() {
  if (await getToken()) redirect("/dashboard");
  return <AuthForm mode="register" />;
}
