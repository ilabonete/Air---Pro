import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const resendFrom = Deno.env.get("RESEND_FROM") ?? "AirPro <onboarding@resend.dev>";
const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const allowedTypes = new Set(["contact", "service"]);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }
  return escapeHtml(String(value));
};

const fetchRecord = async (type: string, id: string) => {
  const table = type === "contact" ? "contact_messages" : "service_requests";
  const url = `${supabaseUrl}/rest/v1/${table}?id=eq.${id}&select=*`;
  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data?.[0] ?? null;
};

const buildEmail = (type: string, record: Record<string, unknown>) => {
  const rows = type === "contact"
    ? [
      ["Name", record.name],
      ["Email", record.email],
      ["Message", record.message],
      ["Submitted", record.created_at]
    ]
    : [
      ["Name", record.name],
      ["Phone", record.phone],
      ["Email", record.email],
      ["Address", record.address],
      ["Aircon type", record.aircon_type],
      ["Issue", record.issue],
      ["Preferred date", record.preferred_date],
      ["Preferred time", record.preferred_time],
      ["Submitted", record.created_at]
    ];

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px;font-weight:600;vertical-align:top;">${escapeHtml(String(label))}</td>` +
        `<td style="padding:6px 12px;">${formatValue(value)}</td></tr>`
    )
    .join("");

  const subject = type === "contact"
    ? "New contact message"
    : "New service request";

  const textLines = rows
    .map(([label, value]) => `${label}: ${formatValue(value)}`)
    .join("\n");

  return {
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;color:#0c1a2b;">
        <h2 style="margin:0 0 12px;">${subject}</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          ${rowsHtml}
        </table>
      </div>
    `,
    text: `${subject}\n\n${textLines}`
  };
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!resendApiKey || !adminEmail || !supabaseUrl || !serviceRoleKey) {
    return new Response("Missing server configuration", { status: 500 });
  }

  let payload: { type?: string; id?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const type = payload.type ?? "";
  const id = payload.id ?? "";

  if (!allowedTypes.has(type) || !id) {
    return new Response("Invalid request", { status: 400 });
  }

  const record = await fetchRecord(type, id);
  if (!record) {
    return new Response("Record not found", { status: 404 });
  }

  const { subject, html, text } = buildEmail(type, record);

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [adminEmail],
      subject,
      html,
      text
    })
  });

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text();
    return new Response(errorText, { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
});
