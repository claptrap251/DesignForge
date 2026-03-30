"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { navUrl } from "@/lib/basePath";

interface HeaderProps {
  session: any;
  isAdmin?: boolean;
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <button
      onClick={cycle}
      className="hover-warm rounded-lg p-2 transition-colors"
      style={{ color: 'var(--text-secondary)' }}
      title={`Theme: ${theme}`}
      aria-label={`Current theme: ${theme}. Click to cycle.`}
    >
      {theme === "light" && (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
      {theme === "dark" && (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
      {theme === "system" && (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

export default function Header({ session, isAdmin: admin }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="border-b"
      style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6C4 4.89543 4.89543 4 6 4H13L16 7H26C27.1046 7 28 7.89543 28 9V26C28 27.1046 27.1046 28 26 28H6C4.89543 28 4 27.1046 4 26V6Z" fill="var(--text-primary)" fillOpacity="0.85"/>
            <path d="M15 14L18.5 17.5M18.5 17.5L22 14M18.5 17.5V23" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="18" r="3" stroke="var(--accent)" strokeWidth="2" fill="none"/>
          </svg>
          <span className="text-xl font-bold hidden sm:inline" style={{ color: 'var(--text-primary)' }}>DesignForge</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-4">
          <ThemeToggle />
          {session ? (
            <div className="flex items-center gap-4">
              {admin && (
                <Link
                  href="/admin"
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
                  style={{ color: 'var(--admin-text)', backgroundColor: 'var(--admin-bg)', border: 'none' }}
                >
                  Admin
                </Link>
              )}
              <a
                href={navUrl("/settings/tokens")}
                className="hover-warm rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                API Tokens
              </a>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {session.user?.name || session.user?.username}
              </span>
              <button
                onClick={() => signOut()}
                className="hover-warm rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none"
                style={{ color: 'var(--text-secondary)' }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hover-warm rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors focus:outline-none"
                style={{ backgroundColor: 'var(--accent)' }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
              >
                Register
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-2 sm:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="hover-warm rounded-lg p-2 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="sm:hidden border-t px-4 py-3 space-y-2"
          style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-subtle)' }}
        >
          {session ? (
            <>
              <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                {session.user?.name || session.user?.username}
              </p>
              {admin && (
                <Link
                  href="/admin"
                  className="block rounded-lg px-3 py-2 text-sm font-semibold text-center transition-colors"
                  style={{ color: 'var(--admin-text)', backgroundColor: 'var(--admin-bg)', border: 'none' }}
                  onClick={() => setMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
              <a
                href={navUrl("/settings/tokens")}
                className="block hover-warm rounded-md px-3 py-2 text-sm transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => setMenuOpen(false)}
              >
                API Tokens
              </a>
              <button
                onClick={() => signOut()}
                className="w-full hover-warm rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="block hover-warm rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => setMenuOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/register"
                className="block rounded-lg px-3 py-2 text-sm font-medium text-white text-center transition-colors"
                style={{ backgroundColor: 'var(--accent)' }}
                onClick={() => setMenuOpen(false)}
              >
                Register
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
