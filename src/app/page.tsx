import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-white" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-page)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: 'var(--accent)' }}>DesignForge</h1>
          <div className="flex items-center gap-4">
            {session?.user ? (
              <Link
                href="/dashboard"
                className="text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            Design Review,{" "}
            <span style={{ color: 'var(--accent)' }}>Simplified</span>
          </h2>
          <p className="text-base sm:text-lg lg:text-xl mb-8 max-w-2xl mx-auto" style={{ color: 'var(--text-tertiary)' }}>
            Upload your designs, share a link, and collect pin-based feedback from
            reviewers. Export everything to PDF, Word, Markdown, or Confluence
            with full comment history.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href={session ? "/dashboard" : "/register"}
              className="text-white px-8 py-3 rounded-lg text-lg font-medium transition shadow-lg"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Start Reviewing
            </Link>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 mt-12 sm:mt-20">
            <div className="rounded-xl p-6 shadow-sm border" style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-subtle)' }}>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 mx-auto" style={{ backgroundColor: 'var(--accent-bg)' }}>
                <svg className="w-6 h-6" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Pin Comments</h3>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Click anywhere on a design to drop a pin and leave contextual feedback.
              </p>
            </div>

            <div className="rounded-xl p-6 shadow-sm border" style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-subtle)' }}>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 mx-auto" style={{ backgroundColor: 'var(--accent-bg)' }}>
                <svg className="w-6 h-6" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Share Links</h3>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Generate unique links to share with reviewers. No account required.
              </p>
            </div>

            <div className="rounded-xl p-6 shadow-sm border" style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-subtle)' }}>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 mx-auto" style={{ backgroundColor: 'var(--accent-bg)' }}>
                <svg className="w-6 h-6" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Export Reports</h3>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Export to PDF, Word, Markdown, or Confluence with embedded comment history.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-page)' }}>
        <div className="max-w-7xl mx-auto px-4 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
          DesignForge — Self-hosted design review platform
        </div>
      </footer>
    </div>
  );
}
