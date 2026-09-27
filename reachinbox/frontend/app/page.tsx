"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  function handleLogin() {
    signIn("google");
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-[310px] border border-gray-200 rounded-[6px] bg-white px-[35px] py-[32px]">
        
        {/* Login heading */}
        <h1 className="text-[25px] leading-none font-semibold text-gray-900 text-center mb-6">
          Login
        </h1>

        {/* Google Login */}
        <button
          type="button"
          onClick={() => signIn("google")}
          className="w-full h-[30px] bg-[#e8f8ef] rounded-[6px] flex items-center justify-center gap-2 text-[11px] text-gray-800 font-medium hover:bg-[#dcf4e6] transition"
        >
          <span className="font-bold text-[13px]">
            G
          </span>
          <span>Login with Google</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-2 my-[17px]">
          <div className="flex-1 h-px bg-gray-200" />

          <span className="text-[8px] text-gray-400 whitespace-nowrap">
            or sign up through email
          </span>

          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Email */}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email ID"
          className="w-full h-[35px] bg-[#f3f6f4] border border-transparent rounded-[6px] px-3 text-[10px] text-gray-700 placeholder:text-gray-400 outline-none focus:bg-white focus:border-gray-300 transition mb-[8px]"
        />

        {/* Password */}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full h-[35px] bg-[#f3f6f4] border border-transparent rounded-[6px] px-3 text-[10px] text-gray-700 placeholder:text-gray-400 outline-none focus:bg-white focus:border-gray-300 transition mb-[17px]"
        />

        {/* Login button */}
        <button
          type="button"
          onClick={handleLogin}
          className="w-full h-[30px] bg-[#00a63c] hover:bg-[#008f34] text-white rounded-[6px] text-[10px] font-medium transition"
        >
          Login
        </button>

      </div>
    </div>
  );
}