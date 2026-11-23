export type AppointmentEmail = {
  id: number;
  service_type: string;
  target: string;
  client_name: string;
  client_phone: string;
  preferred_date: string;
  preferred_time: string;
  location: string;
  notes: string;
  created_at: string;
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
      error: "Set RESEND_API_KEY, RESEND_FROM_EMAIL and INQUIRIES_EMAIL to send appointment emails.",
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
      subject: `New appointment request: ${appointment.target.replace(/[\r\n]/g, " ")}`,
      text: [
        `Service: ${appointment.service_type}`,
        `For: ${appointment.target}`,
        `Client: ${appointment.client_name}`,
        `Phone: ${appointment.client_phone}`,
        `Preferred date: ${appointment.preferred_date}`,
        `Preferred time: ${appointment.preferred_time}`,
        `Location: ${appointment.location || "Not provided"}`,
        `Notes: ${appointment.notes || "None"}`,
        `Received: ${appointment.created_at}`,
        `Appointment ID: ${appointment.id}`,
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
