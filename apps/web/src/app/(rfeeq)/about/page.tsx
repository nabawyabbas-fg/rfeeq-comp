import type { Metadata } from "next";
import { AboutPage } from "@/components/rfeeq/settings/about-page";
import { RfeeqShell } from "@/components/rfeeq/shell/shell";

export const metadata: Metadata = { title: "عن رفيق" };

export default function About() {
  return (
    <RfeeqShell>
      <AboutPage version="1.0.0" />
    </RfeeqShell>
  );
}
