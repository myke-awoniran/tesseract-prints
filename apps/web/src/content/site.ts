// Marketing copy and imagery. Edit here; the components render whatever is in this file.

export interface Slide {
  src: string;
  /** Smaller rendition for phones; falls back to `src` */
  srcSm?: string;
  alt: string;
  city: string;
  caption: string;
  /** CSS object-position, so the subject stays in frame on narrow screens */
  focus?: string;
  credit?: { author: string; license: string; url: string };
}
export interface TitledText {
  title: string;
  text: string;
}
export interface FaqTopic {
  topic: string;
  items: { q: string; a: string }[];
}

export const SLIDES: Slide[] = [
  {
    src: '/images/abuja-aso-rock.jpg',
    srcSm: '/images/abuja-aso-rock-sm.jpg',
    alt: 'Aso Rock under a storm sky, with traffic on the road below',
    city: 'Abuja',
    caption: 'Aso Rock',
    focus: '45% 40%',
    // credit: { author: 'Uzoma Ozurumba', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Aso_Rock_view.jpg' }
  },
  {
    src: '/images/lagos-victoria-island.jpg',
    srcSm: '/images/lagos-victoria-island-sm.jpg',
    alt: 'Aerial view of the Victoria Island waterfront and lagoon',
    city: 'Lagos',
    caption: 'Victoria Island',
    focus: '45% 60%',
    // credit: {
    //   author: 'Ayorinde Ogundele',
    //   license: 'CC BY-SA 4.0',
    //   // url: 'https://commons.wikimedia.org/wiki/File:Aerial_view_of_victoria_island_in_Lagos,_Nigeria_with_habours_for_yatches.jpg'
    // }
  },
  {
    src: '/images/abuja-national-mosque.jpg',
    srcSm: '/images/abuja-national-mosque-sm.jpg',
    alt: 'The golden dome and minarets of the Abuja National Mosque',
    city: 'Abuja',
    caption: 'National Mosque',
    focus: '60% 50%',
    // credit: { author: 'Mark Fischer', license: 'CC BY-SA 2.0', url: 'https://commons.wikimedia.org/wiki/File:Abuja_National_Mosque.jpg' }
  },
  {
    src: '/images/lagos-third-mainland.jpg',
    srcSm: '/images/lagos-third-mainland-sm.jpg',
    alt: 'Beneath the Third Mainland Bridge, a canoe on the lagoon',
    city: 'Lagos',
    caption: 'Third Mainland Bridge',
    focus: '35% 60%',
    // credit: { author: 'S. Aderogba', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Third-mainland-bridge-lagos.jpg' }
  },
  {
    src: '/images/lagos-lekki-ikoyi.jpg',
    srcSm: '/images/lagos-lekki-ikoyi-sm.jpg',
    alt: 'The cable-stayed tower of the Lekki–Ikoyi Link Bridge',
    city: 'Lagos',
    caption: 'Lekki–Ikoyi Link Bridge',
    focus: '45% 50%',
    // credit: { author: 'Chippla', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Lekki_Ikoyi_Link_Bridge.jpg' }
  },
  // {
  //   src: '/images/lagos-island.jpg',
  //   srcSm: '/images/lagos-island-sm.jpg',
  //   alt: 'Looking over Lagos Island, the Central Mosque and the business district',
  //   city: 'Lagos',
  //   caption: 'Lagos Island',
  //   focus: '40% 50%',
  //   // credit: { author: 'Sir Demo', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:LAGOS_ISLAND_1.jpg' }
  // },
  // { src: '/images/bridge.jpg', alt: 'A suspension bridge over calm water', city: 'Tesseract', caption: 'From our desk to yours' }
];

export const SERVICES: TitledText[] = [
  {
    title: 'Bid and tender production',
    text: 'Bound, indexed and labelled sets prepared to the tender’s specification and delivered before the submission deadline.'
  },
  {
    title: 'Legal bundles and filings',
    text: 'Court bundles, contracts and briefs for chambers and in-house counsel, paginated and finished to a professional standard.'
  },
  {
    title: 'Board and investor papers',
    text: 'Board packs, investment memoranda and shareholder documents, distributed under seal to named recipients.'
  },
  {
    title: 'Diplomatic documentation',
    text: 'Correspondence and application dossiers for missions, consultancies and their clients, handled in confidence.'
  },
  {
    title: 'Regulatory and annual reports',
    text: 'Printed reports for regulators, members and stakeholders, finished to reflect the standing of your institution.'
  },
  {
    title: 'Express printing',
    text: 'For individuals and teams who need one document printed and delivered today. No account, no paperwork.'
  }
];

export const INSTITUTIONS: { name: string; work: string }[] = [
  { name: 'Law chambers and legal departments', work: 'Litigation bundles, transactions, filings' },
  { name: 'Contractors and procurement teams', work: 'Bids, tenders, technical proposals' },
  { name: 'Banks and asset managers', work: 'Board packs, client documentation' },
  { name: 'Diplomatic missions', work: 'Correspondence and dossiers' },
  { name: 'Energy and infrastructure firms', work: 'Contracts and regulatory submissions' },
  { name: 'Development organisations', work: 'Programme reports and materials' }
];

export const COMMITMENTS: TitledText[] = [
  {
    title: 'Confidentiality in writing',
    text: 'Every institution signs a confidentiality agreement with us before the first document arrives. We will equally sign yours.'
  },
  {
    title: 'Encrypted from upload to print',
    text: 'Files are encrypted in transit and at rest, and opened only at a secured print station.'
  },
  {
    title: 'One accountable operator',
    text: 'A single named person handles each job, and every time a document is opened it is logged.'
  },
  {
    title: 'Erased within 24 hours',
    text: 'Documents are deleted the moment delivery is confirmed, and automatically after 24 hours regardless.'
  }
];

export const JOURNEY: TitledText[] = [
  { title: 'Consultation', text: 'A private conversation about your documents, volumes, deadlines and internal controls.' },
  { title: 'Proposal', text: 'A written proposal shaped around your institution, alongside our confidentiality agreement.' },
  { title: 'Onboarding', text: 'Your team receives secure console access and a dedicated relationship manager.' },
  { title: 'Ongoing service', text: 'Work handled to agreed standards, with reporting and a single consolidated invoice.' }
];

export const FAQ: FaqTopic[] = [
  {
    topic: 'Confidentiality',
    items: [
      {
        q: 'How is our information protected from upload to delivery?',
        a: 'Documents travel over an encrypted connection and are stored encrypted until the moment of printing. They are opened only at a secured print station, sealed in tamper-evident packaging, and released only against the recipient’s handover code.'
      },
      {
        q: 'Who at Tesseract Prints can see our documents?',
        a: 'One named operator per job. Access is restricted to that person and every download is recorded in an access log, which your institution can request at any time.'
      },
      {
        q: 'What happens to our files after delivery?',
        a: 'They are erased as soon as delivery is confirmed. If anything delays delivery, the database removes the file automatically 24 hours after upload. We keep the order record, never the document.'
      },
      {
        q: 'Will you sign our non-disclosure agreement?',
        a: 'Yes. Every engagement begins under a written confidentiality agreement, and we are comfortable working under your institution’s own terms.'
      }
    ]
  },
  {
    topic: 'Working with us',
    items: [
      {
        q: 'How does an engagement begin?',
        a: 'With a private consultation. We learn about your documents and controls, then provide a written proposal and confidentiality agreement for your review.'
      },
      {
        q: 'Can several people in our organisation place orders?',
        a: 'Yes. Owners and administrators add colleagues to your console, and every order is recorded against the person who placed it.'
      },
      {
        q: 'Will we have a single point of contact?',
        a: 'Every institution has a dedicated relationship manager who knows your standards and can be reached directly.'
      },
      {
        q: 'How is our engagement priced?',
        a: 'Each engagement is scoped to the institution. After the consultation we provide a written proposal reflecting your volumes, service levels and handling requirements, invoiced monthly.'
      }
    ]
  },
  {
    topic: 'Production and delivery',
    items: [
      {
        q: 'Can you meet deadline-driven submissions?',
        a: 'Time-critical work is central to what we do. Share upcoming deadlines with your relationship manager and we reserve capacity in advance.'
      },
      {
        q: 'What finishing do you offer?',
        a: 'Stapling, comb, spiral and hard binding, with indexing, tabbing and labelling to your specification, including formats required by tender documents and court rules.'
      },
      {
        q: 'How are documents handed over?',
        a: 'Sealed packages are released only to the recipient, against a six-digit handover code shown on their tracking page. That gives you a clear record of receipt.'
      },
      {
        q: 'Which areas do you serve?',
        a: 'Institutions across the Federal Capital Territory, from the central districts to the satellite towns. Arrangements beyond the FCT are available on request.'
      }
    ]
  },
  {
    topic: 'Express printing',
    items: [
      {
        q: 'Do I need an account for express printing?',
        a: 'No. Upload your document, choose how it should be printed, add the delivery address and pay. You receive a private tracking link straight away.'
      },
      {
        q: 'How do I pay?',
        a: 'By card, bank transfer or USSD through our secure payment partner. You see the full amount before you pay.'
      },
      {
        q: 'How fast is express delivery?',
        a: 'Same day across the central districts for orders placed in good time, and the next scheduled run for outer areas. Your tracking page shows each step.'
      }
    ]
  }
];

export const CONTACT = {
  email: 'desk@tesseractprints.com',
  phone: '+234 913 686 3427',
  address: 'Maitama, Abuja, Nigeria',
  company: 'Tesseract Prints Limited'
};
