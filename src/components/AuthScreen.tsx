"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AuthMode = "signin" | "signup" | "forgot" | "reset";

export default function AuthScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";

  const getInitialMode = (): AuthMode => {
    const modeParam = searchParams.get("mode");
    if (modeParam === "signup") return "signup";
    if (modeParam === "forgot") return "forgot";
    if (modeParam === "reset") return "reset";
    return "signin";
  };

  const [mode, setMode] = useState<AuthMode>(getInitialMode());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Detect Supabase recovery tokens or hash links automatically
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setMode("reset");
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        setError("");
        setSuccess("");
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleModeSwitch = (newMode: AuthMode) => {
    setMode(newMode);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (mode === "forgot") {
      if (!email || !email.includes("@")) {
        setError("Please enter a valid email address.");
        return;
      }
      setLoading(true);
      try {
        const redirectTo = `${window.location.origin}/login?mode=reset`;
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (err) throw err;
        setSuccess("Password reset instructions have been sent to your email.");
      } catch (err: any) {
        setError(err.message || "Failed to send password reset email.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === "reset") {
      if (!password || password.length < 6) {
        setError("New password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      setLoading(true);
      try {
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw err;
        setSuccess("Password updated successfully! Redirecting...");
        setTimeout(() => {
          router.push(nextPath);
        }, 1500);
      } catch (err: any) {
        setError(err.message || "Failed to reset password.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || password.length < 6) {
      setError("Please enter valid email and password (min 6 chars).");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      // Clear any guest marker now that the user has a real account.
      try {
        localStorage.removeItem("nuvio_anon");
      } catch {
        /* ignore */
      }
      router.push(nextPath);
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymous = () => {
    localStorage.setItem("nuvio_anon", crypto.randomUUID());
    router.push("/dashboard");
  };

  return (
    <div
      className="h-screen w-screen flex items-center justify-center relative overflow-hidden px-4"
      style={{
        background: `linear-gradient(135deg, #0d0d0d 0%, #1a0a1a 50%, #0a0d1a 100%)`,
      }}
    >
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Top bar */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-end px-6 sm:px-10 py-5 z-20">
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          Home
        </Link>
      </header>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <h1 className="text-5xl font-black tracking-tight text-white mb-2">Nuvio</h1>
          <p className="text-[#888] text-sm">Stream anything. Everywhere.</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1a1a]/90 border border-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-2">
            {mode === "signup" && "Create Account"}
            {mode === "signin" && "Sign In"}
            {mode === "forgot" && "Reset Password"}
            {mode === "reset" && "Set New Password"}
          </h2>
          <p className="text-[#888] text-xs mb-5">
            {mode === "signup" && "Sign up to sync your library, settings, and progress."}
            {mode === "signin" && "Welcome back! Enter your details to continue."}
            {mode === "forgot" && "Enter your email address and we'll send you a password reset link."}
            {mode === "reset" && "Enter a new password for your account below."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field (for signin, signup, forgot) */}
            {mode !== "reset" && (
              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-[#111] border border-white/10 focus:border-white/30 rounded-xl px-4 py-3 text-white placeholder-[#555] outline-none transition-colors text-sm"
                  required
                />
              </div>
            )}

            {/* Password Field (for signin, signup) */}
            {(mode === "signin" || mode === "signup") && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider">
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => handleModeSwitch("forgot")}
                      className="text-xs text-[#aaa] hover:text-white hover:underline cursor-pointer transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#111] border border-white/10 focus:border-white/30 rounded-xl px-4 py-3 text-white placeholder-[#555] outline-none transition-colors text-sm pr-12"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* New Password Fields (for reset) */}
            {mode === "reset" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase tracking-wider">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#111] border border-white/10 focus:border-white/30 rounded-xl px-4 py-3 text-white placeholder-[#555] outline-none transition-colors text-sm pr-12"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-white transition-colors cursor-pointer"
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase tracking-wider">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#111] border border-white/10 focus:border-white/30 rounded-xl px-4 py-3 text-white placeholder-[#555] outline-none transition-colors text-sm pr-12"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-white transition-colors cursor-pointer"
                    >
                      {showConfirmPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Error message */}
            {error && (
              <div className="bg-red-500/15 border border-red-500/30 text-red-400 text-sm px-4 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm px-4 py-2.5 rounded-xl">
                {success}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-gray-100 text-black font-bold py-3 rounded-xl transition-all text-sm mt-1 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : null}
              {loading
                ? "Please wait..."
                : mode === "signup"
                ? "Create Account"
                : mode === "signin"
                ? "Sign In"
                : mode === "forgot"
                ? "Send Reset Link"
                : "Update Password"}
            </button>
          </form>

          {/* Toggle mode links */}
          <div className="text-center text-[#888] text-sm mt-4">
            {mode === "signin" && (
              <p>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleModeSwitch("signup")}
                  className="text-white hover:underline font-semibold cursor-pointer"
                >
                  Sign Up
                </button>
              </p>
            )}

            {mode === "signup" && (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleModeSwitch("signin")}
                  className="text-white hover:underline font-semibold cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            )}

            {(mode === "forgot" || mode === "reset") && (
              <button
                type="button"
                onClick={() => handleModeSwitch("signin")}
                className="text-white hover:underline font-semibold cursor-pointer text-xs uppercase tracking-wider"
              >
                ← Back to Sign In
              </button>
            )}
          </div>

          {/* Divider & Anonymous (only on signin / signup) */}
          {(mode === "signin" || mode === "signup") && (
            <>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[#555] text-xs uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button
                type="button"
                onClick={handleAnonymous}
                className="w-full bg-transparent hover:bg-white/5 border border-white/10 hover:border-white/20 text-[#aaa] hover:text-white font-medium py-3 rounded-xl transition-all text-sm cursor-pointer"
              >
                Continue without account
              </button>
            </>
          )}
        </div>

        <p className="text-center text-[#555] text-xs mt-4">
          Powered by Nuvio · Tapframe & friends
        </p>
      </div>
    </div>
  );
}
