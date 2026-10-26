import type { Metadata } from "next";
import { ProsePage } from "@/components/common/prose";

export const metadata: Metadata = { title: "eSIM device compatibility", description: "Check whether your phone supports eSIM before buying a travel eSIM.", alternates: { canonical: "/device-compatibility" } };

export default function DeviceCompatibilityPage() {
  return (
    <ProsePage
      eyebrow="Before you buy"
      title="Does my phone support eSIM?"
      intro="Your phone must support eSIM and be unlocked by your carrier. Support depends on the exact model and the country it was sold in, so always check your own device."
    >
      <section>
        <h2>The quickest check</h2>
        <ol>
          <li>Dial <strong>*#06#</strong>. If an <strong>EID</strong> number is shown, your phone has eSIM hardware.</li>
          <li><strong>iPhone:</strong> Settings → General → About. An “Available SIM” or “Digital SIM” entry indicates eSIM support.</li>
          <li><strong>Android:</strong> Settings → Network &amp; internet → SIMs. An option to “Add eSIM” or “Download a SIM” indicates support.</li>
        </ol>
      </section>
      <section>
        <h2>Phone families that usually support eSIM</h2>
        <p>These families generally include eSIM, but regional variants and models sold by carriers can differ:</p>
        <ul>
          <li>Apple iPhone XS, XR and later (models sold in mainland China, Hong Kong and Macau may lack eSIM).</li>
          <li>Google Pixel 3 and later (some regional and carrier variants excluded).</li>
          <li>Samsung Galaxy S20 and later, Z Fold and Z Flip series, and selected A series models.</li>
          <li>Selected recent models from Motorola, OnePlus, Oppo, Xiaomi, Huawei and Sony.</li>
          <li>Many recent iPads (cellular models) and some laptops with mobile broadband.</li>
        </ul>
      </section>
      <section>
        <h2>Carrier lock</h2>
        <p>
          A phone locked to one network may refuse a travel eSIM even if the hardware supports eSIM. Ask your carrier to unlock the device
          before you travel.
        </p>
      </section>
      <section>
        <h2>Not sure?</h2>
        <p>Open a support ticket from your dashboard with your exact phone model and the country where you bought it before purchasing.</p>
      </section>
    </ProsePage>
  );
}
