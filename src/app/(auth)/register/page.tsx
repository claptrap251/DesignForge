"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";

const baseInputStyle = {
  backgroundColor: "var(--bg-page)",
  border: "1px solid var(--border-medium)",
  color: "var(--text-primary)",
  borderRadius: "4px",
};

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [buttonHovered, setButtonHovered] = useState(false);

  const inputStyle = (field: string) => ({
    ...baseInputStyle,
    borderColor:
      focusedField === field ? "var(--accent)" : "var(--border-medium)",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Auto-login after registration
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Registration succeeded but login failed. Please try logging in.");
        setLoading(false);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong");
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
            Create your account
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
              Username{" "}
              <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={39}
              pattern="[a-zA-Z0-9_-]+"
              className="w-full px-3 py-2 focus:outline-none"
              style={inputStyle("username")}
              onFocus={() => setFocusedField("username")}
              onBlur={() => setFocusedField(null)}
              placeholder="your-username"
            />
            <p
              className="mt-1 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              3-39 characters. Letters, numbers, hyphens, underscores only.
            </p>
          </div>

          <div className="mb-4">
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 focus:outline-none"
              style={inputStyle("name")}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
              placeholder="Your name"
            />
          </div>

          <div className="mb-4">
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Email{" "}
              <span style={{ color: "var(--text-secondary)" }}>(optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 focus:outline-none"
              style={inputStyle("email")}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              placeholder="you@example.com"
            />
          </div>

          <div className="mb-6">
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Password{" "}
              <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 focus:outline-none"
              style={inputStyle("password")}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
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
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p
            className="mt-4 text-center text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Already have an account?{" "}
            <Link
              href="/login"
              className="hover:underline"
              style={{ color: "var(--accent)" }}
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
