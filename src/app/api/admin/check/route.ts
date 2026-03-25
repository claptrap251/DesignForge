import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  const session = await auth();
  return NextResponse.json({ isAdmin: isAdmin(session) });
}
