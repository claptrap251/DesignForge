import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, description: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}
