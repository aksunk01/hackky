import Image from "next/image";
import { Button, SiteHeader } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";

type Founder = {
  name: string;
  role: string;
  linkedin: string;
  photo: string;
};

/** Bios are still placeholders — only the names, links, and photos are real. */
const FOUNDERS: Founder[] = [
  {
    name: "Abhiram Sunkara",
    role: "Co-Founder & Developer",
    linkedin: "https://www.linkedin.com/in/abhiram-sunkara-7021211a7/",
    photo: "/team/abhiram.jpeg",
  },
  {
    name: "Dallin Liu",
    role: "Co-Founder & Developer",
    linkedin: "https://www.linkedin.com/in/dallin-liu/",
    photo: "/team/dallin.jpeg",
  },
  {
    name: "Ethan Tantasook",
    role: "Co-Founder & Developer",
    linkedin: "https://www.linkedin.com/in/ethan-tantasook-14218033a/",
    photo: "/team/ethan.jpeg",
  },
  {
    name: "Satvik Adlakha",
    role: "Co-Founder & Developer",
    linkedin: "https://www.linkedin.com/in/satvik-adlakha-80a389268/",
    photo: "/team/satvik.png",
  },
];

export default function AboutPage() {
  return (
    <main className="flex-1 flex flex-col">
      <SiteHeader active="about" />

      <section className="px-6 py-16 sm:py-20 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Built by people who&rsquo;ve sat on both sides of the table
        </h1>
        <p className="text-muted max-w-xl mx-auto">
          InterviewAI is a small team trying to make interview prep feel like the real thing —
          voice, pressure, and all.
        </p>
      </section>

      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-6">
          {FOUNDERS.map((f) => (
            <Card key={f.name} className="p-6">
              <CardContent className="p-0 flex items-center gap-4">
                <Image
                  src={f.photo}
                  alt={f.name}
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0 rounded-full object-cover"
                />
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-semibold truncate">{f.name}</span>
                  <span className="text-sm text-muted">{f.role}</span>
                  <Button variant="link" size="sm" className="h-auto p-0 justify-start" asChild>
                    <a href={f.linkedin} target="_blank" rel="noopener noreferrer">
                      LinkedIn &rarr;
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
