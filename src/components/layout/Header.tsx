"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";

interface HeaderProps {
  session: any;
}

export default function Header({ session }: HeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <svg
            className="h-8 w-8 text-indigo-600"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="32" height="32" rx="8" fill="currentColor" />
            <path
              d="M8 12L16 8L24 12V20L16 24L8 20V12Z"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <path d="M16 8V24" stroke="white" strokeWidth="2" />
            <path d="M8 12L24 20" stroke="white" strokeWidth="1.5" />
            <path d="M24 12L8 20" stroke="white" strokeWidth="1.5" />
          </svg>
          <span className="text-xl font-bold text-gray-900">DesignForge</span>
        </Link>

        <nav className="flex items-center gap-4">
          {session ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">
                {session.user?.name || session.user?.email}
              </span>
              <button
                onClick={() => signOut()}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Register
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
