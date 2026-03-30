"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { navUrl } from "@/lib/basePath";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameInputStyle, setUsernameInputStyle] = useState({
    backgroundColor: "var(--bg-page)",
    border: "1px solid var(--border-medium)",
    color: "var(--text-primary)",
    borderRadius: "4px",
  });
  const [passwordInputStyle, setPasswordInputStyle] = useState({
    backgroundColor: "var(--bg-page)",
    border: "1px solid var(--border-medium)",
    color: "var(--text-primary)",
    borderRadius: "4px",
  });
  const [buttonHovered, setButtonHovered] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid username or password");
        setLoading(false);
      } else {
        // Full navigation so the session cookie is picked up
        window.location.href = navUrl("/dashboard");
      }
    } catch {
      setError("Login failed — please try again");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--bg-sidebar)" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="text-2xl font-bold"
            style={{ color: "var(--accent)" }}
          >
            DesignForge
          </Link>
          <h2
            className="mt-4 text-xl font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Sign in to your account
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-8"
          style={{
            backgroundColor: "var(--bg-page)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "4px",
            boxShadow: "0 1px 3px rgba(15,15,15,0.04)",
          }}
        >
          {error && (
            <div
              className="mb-4 p-3 rounded text-sm"
              style={{
                backgroundColor: "var(--danger-bg)",
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          )}

          <div className="mb-4">
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 focus:outline-none"
              style={usernameInputStyle}
              onFocus={() =>
                setUsernameInputStyle((s) => ({
                  ...s,
                  borderColor: "var(--accent)",
                }))
              }
              onBlur={() =>
                setUsernameInputStyle((s) => ({
                  ...s,
                  borderColor: "var(--border-medium)",
                }))
              }
              placeholder="your-username"
            />
          </div>

          <div className="mb-6">
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 focus:outline-none"
              style={passwordInputStyle}
              onFocus={() =>
                setPasswordInputStyle((s) => ({
                  ...s,
                  borderColor: "var(--accent)",
                }))
              }
              onBlur={() =>
                setPasswordInputStyle((s) => ({
                  ...s,
                  borderColor: "var(--border-medium)",
                }))
              }
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white py-2 font-medium transition disabled:opacity-50"
            style={{
              backgroundColor: buttonHovered
                ? "var(--accent-hover)"
                : "var(--accent)",
              borderRadius: "4px",
            }}
            onMouseEnter={() => setButtonHovered(true)}
            onMouseLeave={() => setButtonHovered(false)}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p
            className="mt-4 text-center text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="hover:underline"
              style={{ color: "var(--accent)" }}
            >
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
