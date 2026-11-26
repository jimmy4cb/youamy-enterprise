export type AppointmentEmail = {
  id: number;
  tracking_code?: string;
  service_type: string;
  target: string;
  client_name: string;
  client_phone: string;
  preferred_date: string | Date;
  preferred_time: string;
  location: string;
  estimated_kes?: number | null;
  notes: string;
  created_at: string | Date;
};

export type AppointmentEmailResult = {
  status: "sent" | "failed" | "not_configured";
  error?: string;
};

export async function emailAppointmentToTeam(
  appointment: AppointmentEmail,
): Promise<AppointmentEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.INQUIRIES_EMAIL;
  if (!apiKey || !from || !to) {
    return {
      status: "not_configured",
      error: "Email delivery optional; appointment saved in the database.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `New appointment request ${appointment.tracking_code || ""}: ${appointment.target.replace(/[\r\n]/g, " ")}`,
      text: [
        `Tracking code: ${appointment.tracking_code || appointment.id}`,
        `Service: ${appointment.service_type}`,
        `For: ${appointment.target}`,
        `Client: ${appointment.client_name}`,
        `Phone: ${appointment.client_phone}`,
        `Preferred date: ${String(appointment.preferred_date).slice(0, 10)}`,
        `Preferred time: ${appointment.preferred_time}`,
        `Location: ${appointment.location || "Not provided"}`,
        ...(appointment.estimated_kes ? [`Estimated quote: KES ${appointment.estimated_kes.toLocaleString("en-KE")}`] : []),
        `Notes: ${appointment.notes || "None"}`,
        `Received: ${String(appointment.created_at)}`,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 300);
    console.error("Appointment email delivery failed", response.status, details);
    return { status: "failed", error: `Email provider returned status ${response.status}.` };
  }

  return { status: "sent" };
}
