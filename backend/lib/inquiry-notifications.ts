type InquiryEmail = {
  id: number;
  listing_title: string;
  division: string;
  inquiry_type: string;
  client_name: string;
  client_phone: string;
  questions: string;
  created_by: string;
  created_at: string;
};

export type InquiryEmailResult = {
  status: "sent" | "failed" | "not_configured";
  error?: string;
};

export async function emailInquiryToTeam(inquiry: InquiryEmail): Promise<InquiryEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.INQUIRIES_EMAIL;
  if (!apiKey || !from || !to) {
    return {
      status: "not_configured",
      error: "Set RESEND_API_KEY, RESEND_FROM_EMAIL and INQUIRIES_EMAIL to send inquiry emails.",
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
      subject: `New ${inquiry.division.toLowerCase()} inquiry: ${inquiry.listing_title.replace(/[\r\n]/g, " ")}`,
      text: [
        `Listing: ${inquiry.listing_title}`,
        `Division: ${inquiry.division}`,
        `Inquiry type: ${inquiry.inquiry_type}`,
        `Client name: ${inquiry.client_name || "Not provided"}`,
        `Phone: ${inquiry.client_phone}`,
        `Preferred date or questions: ${inquiry.questions || "Not provided"}`,
        `Recorded by: ${inquiry.created_by}`,
        `Recorded at: ${inquiry.created_at}`,
        `Inquiry ID: ${inquiry.id}`,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 300);
    console.error("Inquiry email delivery failed", response.status, details);
    return { status: "failed", error: `Email provider returned status ${response.status}.` };
  }

  return { status: "sent" };
}
