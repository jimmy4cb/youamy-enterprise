export const company = {
  name: "Youamy Enterprises Limited",
  tagline: "Recruitment · Auto · Real Estate · Sanitation",
  phone: "0135555550",
  phoneLink: "0135555550",
  whatsapp: "254135555550",
  email: "info@youamyenterprises.com",
  address: "Youamy Plaza, Mombasa / Nairobi Corridor, Kenya",
  website: "youamyenterprises.com",
};

export const officeCoordinates = { latitude: -4.0435, longitude: 39.6682 };

export type JobListing = {
  title: string;
  destination: string;
  openings: string;
  compensation: string;
  requirements: string;
  deadline: string;
  role:
    | "Driver"
    | "Hospitality"
    | "Healthcare"
    | "Construction & Engineering"
    | "Security Services";
};

export type VehicleListing = {
  id: string;
  title: string;
  status: string;
  saleOrHire: "For sale" | "For hire";
  price: string;
  year: string;
  details: string;
  location: string;
  imageUrls: string[];
};

export type PropertyListing = {
  id: string;
  title: string;
  status: string;
  type: "Home" | "Apartment" | "Short stay" | "Commercial";
  location: string;
  price: string;
  imageUrls: string[];
};

export type SanitationListing = {
  id: string;
  title: string;
  service: "Home cleaning" | "Septic cleaning" | "Waste collection";
  area: string;
  price: string;
};

export const divisions = [
  {
    id: "jobs",
    name: "Gulf Recruitment",
    description: "Direct placements to Saudi Arabia, Qatar, UAE, Oman and Kuwait with live visa tracking.",
    color: "red",
    count: "5 Active Jobs",
  },
  {
    id: "vehicles",
    name: "Auto Marketplace",
    description: "Verified local and imported vehicles with transparent mileage, pricing and inspection booking.",
    color: "violet",
    count: "4 Vehicles",
  },
  {
    id: "real-estate",
    name: "Real Estate",
    description: "Residential villas, apartments, commercial warehouses and titled plots for sale or rent.",
    color: "gold",
    count: "4 Listings",
  },
  {
    id: "sanitation",
    name: "Sanitation Services",
    description: "Exhauster septic cleaning, scheduled garbage collection and commercial waste solutions.",
    color: "green",
    count: "24/7 Dispatch",
  },
] as const;

export const jobListings: JobListing[] = [
  {
    title: "Heavy Duty Trailer Drivers (GCC License)",
    destination: "Saudi Arabia · Riyadh",
    openings: "25 Slots",
    compensation: "SAR 2,800 + Trip Allowance",
    requirements: "Valid BCE/CE Driving License, minimum 3 years experience, valid passport, age 24–45.",
    deadline: "2026-12-15",
    role: "Driver",
  },
  {
    title: "Hospitality & Hotel Housekeeping Staff",
    destination: "Qatar · Doha",
    openings: "40 Slots",
    compensation: "QAR 1,800 + Free Meals",
    requirements: "Good spoken English, neat presentation, Certificate of Good Conduct, hospitality experience preferred.",
    deadline: "2026-12-10",
    role: "Hospitality",
  },
  {
    title: "Registered General Nurses (DHA/MOH)",
    destination: "UAE · Dubai",
    openings: "12 Slots",
    compensation: "AED 6,500–8,000",
    requirements: "BSc/Diploma in Nursing, valid nursing council license, 2+ years clinical experience.",
    deadline: "2026-12-20",
    role: "Healthcare",
  },
  {
    title: "Civil & MEP Construction Technicians",
    destination: "Oman · Muscat",
    openings: "30 Openings",
    compensation: "OMR 220 + Overtime",
    requirements: "Trade test certificate in Electrical, Plumbing, or Masonry; physical fitness.",
    deadline: "2026-12-18",
    role: "Construction & Engineering",
  },
  {
    title: "Corporate Security Guards",
    destination: "Kuwait · Kuwait City",
    openings: "20 Openings",
    compensation: "KWD 160 + Accommodation",
    requirements: "Minimum height 5ft 8in, KCSE certificate, fluent English, clean criminal record.",
    deadline: "2026-12-25",
    role: "Security Services",
  },
];

export const vehicleListings: VehicleListing[] = [
  {
    id: "toyota-land-cruiser-prado",
    title: "2019 Toyota Land Cruiser Prado TX-L",
    status: "Available",
    saleOrHire: "For sale",
    price: "Ksh 6,850,000",
    year: "2019",
    details: "54,000 km · Automatic · Diesel",
    location: "Kenya",
    imageUrls: [
      "/vehicles/2019-toyota-land-cruiser-prado-tx-l-1.jpg",
      "/vehicles/2019-toyota-land-cruiser-prado-tx-l-2.jpg",
    ],
  },
  {
    id: "mercedes-benz-c200",
    title: "2020 Mercedes-Benz C200 AMG Line",
    status: "Available",
    saleOrHire: "For sale",
    price: "Ksh 5,200,000",
    year: "2020",
    details: "38,500 km · Automatic · Petrol",
    location: "Kenya",
    imageUrls: [
      "/vehicles/2020-mercedes-benz-c200-amg-line-1.jpg",
      "/vehicles/2020-mercedes-benz-c200-amg-line-2.jpg",
    ],
  },
  {
    id: "isuzu-frr-90",
    title: "2018 Isuzu FRR 90 Commercial Truck",
    status: "Reserved",
    saleOrHire: "For sale",
    price: "Ksh 4,450,000",
    year: "2018",
    details: "112,000 km · Manual · Diesel",
    location: "Kenya",
    imageUrls: [
      "/vehicles/2018-isuzu-frr-90-commercial-truck-1.jpg",
      "/vehicles/2018-isuzu-frr-90-commercial-truck-2.jpg",
    ],
  },
];

export const propertyListings: PropertyListing[] = [
  {
    id: "nyali-villa",
    title: "Modern 4-Bedroom Villa with DSQ",
    status: "For Sale",
    type: "Home",
    location: "Nyali, Mombasa",
    price: "Ksh 32,000,000",
    imageUrls: ["/properties/modern-4-bedroom-villa-dsq.jpg"],
  },
  {
    id: "kilimani-apartment",
    title: "Executive 2-Bedroom Apartment",
    status: "For Rent",
    type: "Apartment",
    location: "Kilimani, Nairobi",
    price: "Ksh 85,000 / mo",
    imageUrls: [
      "/properties/executive-2-bedroom-apartment-1.jpg",
      "/properties/executive-2-bedroom-apartment-2.jpg",
      "/properties/executive-2-bedroom-apartment-3.jpg",
    ],
  },
  {
    id: "mombasa-road-warehouse",
    title: "Prime Commercial Warehouse & Office Block",
    status: "For Rent",
    type: "Commercial",
    location: "Mombasa Road, Nairobi",
    price: "Ksh 450,000 / mo",
    imageUrls: [
      "/properties/warehouse-office-block-1.jpg",
      "/properties/warehouse-office-block-2.jpg",
      "/properties/warehouse-office-block-3.jpg",
    ],
  },
];

export const sanitationListings: SanitationListing[] = [
  {
    id: "septic-exhauster",
    title: "Exhauster septic cleaning",
    service: "Septic cleaning",
    area: "Mombasa / Nairobi Corridor",
    price: "Request a quote",
  },
  {
    id: "scheduled-garbage",
    title: "Scheduled garbage collection",
    service: "Waste collection",
    area: "Mombasa / Nairobi Corridor",
    price: "Request a quote",
  },
  {
    id: "commercial-waste",
    title: "Commercial waste solutions",
    service: "Waste collection",
    area: "Mombasa / Nairobi Corridor",
    price: "Request a quote",
  },
];

export function whatsappLink(message: string): string {
  return `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function emailLink(listingName: string): string {
  const subject = encodeURIComponent(`Enquiry: ${listingName}`);
  const body = encodeURIComponent(
    `Hello Youamy Enterprises, I would like to enquire about ${listingName}.`,
  );
  return `mailto:${company.email}?subject=${subject}&body=${body}`;
}
