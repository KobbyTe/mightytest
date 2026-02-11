import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Language mapping for Piston API
const LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  python: { language: "python", version: "3.10.0" },
  javascript: { language: "javascript", version: "18.15.0" },
  cpp: { language: "c++", version: "10.2.0" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code, language, test_cases = [], time_limit_seconds = 10 } = await req.json();

    if (!code || !language) {
      return new Response(
        JSON.stringify({ error: "code and language are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For HTML, just return the code as-is (rendered client-side)
    if (language === "html") {
      return new Response(
        JSON.stringify({
          stdout: "",
          stderr: "",
          test_results: [],
          all_passed: true,
          execution_time_ms: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const langConfig = LANGUAGE_MAP[language];
    if (!langConfig) {
      return new Response(
        JSON.stringify({ error: `Unsupported language: ${language}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const timeLimit = Math.min(time_limit_seconds, 30);

    // If no test cases, just run the code once
    if (test_cases.length === 0) {
      const result = await runCode(langConfig, code, "", timeLimit);
      return new Response(
        JSON.stringify({
          stdout: result.stdout,
          stderr: result.stderr,
          test_results: [],
          all_passed: !result.stderr,
          execution_time_ms: result.execution_time_ms,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Run each test case
    const test_results = [];
    let allPassed = true;
    let totalStdout = "";
    let totalStderr = "";
    let totalTime = 0;

    for (const tc of test_cases) {
      const result = await runCode(langConfig, code, tc.input || "", timeLimit);
      const actualOutput = (result.stdout || "").trim();
      const expectedOutput = (tc.expected_output || "").trim();
      const passed = actualOutput === expectedOutput;

      if (!passed) allPassed = false;
      totalStdout += result.stdout || "";
      totalStderr += result.stderr || "";
      totalTime += result.execution_time_ms || 0;

      test_results.push({
        label: tc.label || `Test ${test_results.length + 1}`,
        passed,
        expected: expectedOutput,
        actual: actualOutput,
      });
    }

    return new Response(
      JSON.stringify({
        stdout: totalStdout,
        stderr: totalStderr,
        test_results,
        all_passed: allPassed,
        execution_time_ms: totalTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Execute code error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function runCode(
  langConfig: { language: string; version: string },
  code: string,
  stdin: string,
  timeLimit: number
): Promise<{ stdout: string; stderr: string; execution_time_ms: number }> {
  const startTime = Date.now();

  try {
    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [{ name: "main", content: code }],
        stdin: stdin,
        run_timeout: timeLimit * 1000,
        compile_timeout: 10000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        stdout: "",
        stderr: `Execution service error: ${response.status} ${errorText}`,
        execution_time_ms: Date.now() - startTime,
      };
    }

    const data = await response.json();
    const run = data.run || {};

    return {
      stdout: run.stdout || "",
      stderr: run.stderr || (run.signal ? `Process killed: ${run.signal}` : ""),
      execution_time_ms: Date.now() - startTime,
    };
  } catch (err) {
    return {
      stdout: "",
      stderr: `Failed to execute code: ${err.message}`,
      execution_time_ms: Date.now() - startTime,
    };
  }
}
