import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@backend/lib/supabase/server";
import { getSessionUser, hasPermission } from "@backend/lib/admin-auth";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "enquiries.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const downloadId = url.searchParams.get("download");
    const supabase = createSupabaseAdminClient();

    if (downloadId) {
      const { data: application, error } = await supabase
        .from("job_applications")
        .select("application_id, cv_name, cv_type, cv_size, cv_data")
        .eq("application_id", downloadId)
        .maybeSingle();
      if (error) throw error;
      if (!application) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
      const cvBytes = Buffer.from(application.cv_data, "base64");
      if (cvBytes.byteLength !== application.cv_size) {
        throw new Error("Stored job application attachment has an invalid size.");
      }
      return new NextResponse(cvBytes, {
        headers: {
          "Content-Type": application.cv_type,
          "Content-Length": String(application.cv_size),
          "Content-Disposition": `attachment; filename="${application.cv_name.replace(/["\r\n]/g, "_")}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const [applicationsResult, analyticsResult] = await Promise.all([
      supabase
        .from("job_applications")
        .select(
          "id, application_id, job_title, destination, full_name, phone, email, experience, notes, cv_name, cv_type, cv_size, status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.rpc("job_application_analytics"),
    ]);
    if (applicationsResult.error) throw applicationsResult.error;
    if (analyticsResult.error) throw analyticsResult.error;

    return NextResponse.json({
      applications: applicationsResult.data,
      analytics: analyticsResult.data,
    });
  } catch (error) {
    console.error("Could not load job applications", error);
    return NextResponse.json({ error: "Could not load job applications." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "enquiries.reply")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { id?: number; status?: string } | null;
  const statuses = new Set(["New", "Reviewed", "Shortlisted", "Rejected"]);
  if (!body || !Number.isSafeInteger(body.id) || !body.status || !statuses.has(body.status)) {
    return NextResponse.json({ error: "Choose a valid application and status." }, { status: 400 });
  }
  try {
    const supabase = createSupabaseAdminClient();
    const { data: application, error } = await supabase
      .from("job_applications")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", body.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    return NextResponse.json({ ok: true, status: body.status });
  } catch (error) {
    console.error("Could not update job application status", error);
    return NextResponse.json({ error: "Could not update application status." }, { status: 500 });
  }
}
