import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type CleanupError = {
  id: string
  step: "profile_delete" | "auth_delete" | "query"
  message: string
}

type CleanupResult = {
  scanned: number
  deleted: number
  errors: CleanupError[]
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

serve(async () => {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 4)

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_pre_student", true)
    .eq("is_verified_student", false)
    .is("university_email", null)
    .lt("created_at", cutoff.toISOString())

  if (error) {
    const result: CleanupResult = {
      scanned: 0,
      deleted: 0,
      errors: [
        {
          id: "query",
          step: "query",
          message: error.message,
        },
      ],
    }

    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const errors: CleanupError[] = []
  let deleted = 0

  for (const profile of data ?? []) {
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", profile.id)

    if (profileError) {
      errors.push({
        id: profile.id,
        step: "profile_delete",
        message: profileError.message,
      })
      continue
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(
      profile.id,
    )

    if (authError) {
      errors.push({
        id: profile.id,
        step: "auth_delete",
        message: authError.message,
      })
      continue
    }

    deleted += 1
  }

  const result: CleanupResult = {
    scanned: data?.length ?? 0,
    deleted,
    errors,
  }

  return new Response(JSON.stringify(result), {
    status: errors.length > 0 ? 207 : 200,
    headers: { "Content-Type": "application/json" },
  })
})
