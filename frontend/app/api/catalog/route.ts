import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { parseJsonValue, queryRows } from "@backend/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [jobs, products, settings] = await Promise.all([
      queryRows<RowDataPacket>(
        `SELECT id, slug, title, destination_country, destination_city, role_category,
                employer_name, openings_total, openings_filled, salary_amount, salary_currency,
                compensation_display, contract_months, requirements, benefits, deadline, status, featured
         FROM jobs
         WHERE status = 'Published'
         ORDER BY featured DESC, deadline ASC, id ASC`,
      ),
      queryRows<RowDataPacket>(
        `SELECT id, slug, title, division, listing_kind, description, location, specs,
                image_urls, amount_kes, price_unit, deposit_percent, stock_quantity,
                status, purchasable, featured, booking_kind
         FROM products
         WHERE status NOT IN ('draft', 'archived')
         ORDER BY featured DESC, created_at DESC`,
      ),
      queryRows<RowDataPacket>(`SELECT setting_key, setting_value FROM site_settings`),
    ]);

    const formattedJobs = jobs.map((job) => ({
      id: Number(job.id),
      slug: job.slug,
      title: job.title,
      destination_country: job.destination_country,
      destination_city: job.destination_city,
      destination: `${job.destination_country} · ${job.destination_city}`,
      role_category: job.role_category,
      employer_name: job.employer_name,
      openings_total: Number(job.openings_total),
      openings_filled: Number(job.openings_filled),
      openings_remaining: Math.max(0, Number(job.openings_total) - Number(job.openings_filled)),
      compensation_display: job.compensation_display,
      contract_months: Number(job.contract_months),
      requirements: job.requirements,
      benefits: job.benefits,
      deadline: String(job.deadline).slice(0, 10),
      status: job.status,
    }));

    const formattedProducts = products.map((product) => ({
      id: product.id,
      slug: product.slug,
      title: product.title,
      division: product.division,
      listing_kind: product.listing_kind,
      description: product.description,
      location: product.location,
      specs: parseJsonValue<Record<string, unknown>>(product.specs, {}),
      image_urls: parseJsonValue<string[]>(product.image_urls, []),
      amount_kes: Number(product.amount_kes),
      price_unit: product.price_unit,
      deposit_percent: Number(product.deposit_percent),
      stock_quantity: Number(product.stock_quantity),
      status: product.status,
      purchasable: Boolean(product.purchasable),
      featured: Boolean(product.featured),
      booking_kind: product.booking_kind,
    }));

    const settingsMap: Record<string, unknown> = {};
    for (const row of settings) {
      settingsMap[row.setting_key] = parseJsonValue(row.setting_value, {});
    }

    const totalOpenSlots = formattedJobs.reduce((sum, job) => sum + job.openings_remaining, 0);
    const vehicleCount = formattedProducts.filter((p) => p.division === "Vehicles").length;
    const propertyCount = formattedProducts.filter((p) => p.division === "Real Estate").length;
    const sanitationCount = formattedProducts.filter((p) => p.division === "Sanitation").length;

    return NextResponse.json({
      jobs: formattedJobs,
      products: formattedProducts,
      settings: settingsMap,
      counts: {
        jobs: formattedJobs.length,
        openSlots: totalOpenSlots,
        vehicles: vehicleCount,
        properties: propertyCount,
        sanitation: sanitationCount,
      },
    });
  } catch (error) {
    console.error("Failed to load public catalog:", error);
    return NextResponse.json({ error: "Could not load catalog." }, { status: 500 });
  }
}
