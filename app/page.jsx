import { redirect } from "next/navigation";
import { getToken } from "@/lib/be";

export default async function Home() {
  redirect((await getToken()) ? "/dashboard" : "/login");
}
