export type InquiryEmail = {
  id: number;
  tracking_code?: string;
  listing_title: string;
  division: string;
  inquiry_type: string;
  full_name: string;
  phone: string;
  email?: string;
  message: string;
  created_at: string | Date;
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
      error: "Email delivery optional; inquiry saved in the database.",
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
      subject: `New ${inquiry.division.toLowerCase()} inquiry ${inquiry.tracking_code || ""}: ${inquiry.listing_title || inquiry.inquiry_type}`,
      text: [
        `Reference: ${inquiry.tracking_code || inquiry.id}`,
        `Division: ${inquiry.division}`,
        `Type: ${inquiry.inquiry_type}`,
        `Listing: ${inquiry.listing_title || "General"}`,
        `Client name: ${inquiry.full_name || "Not provided"}`,
        `Phone: ${inquiry.phone || "Not provided"}`,
        `Email: ${inquiry.email || "Not provided"}`,
        `Message: ${inquiry.message || "None"}`,
        `Recorded at: ${String(inquiry.created_at)}`,
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
