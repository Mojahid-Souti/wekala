// Privacy Policy (draft) — grounded in Oman PDPL Art. 21 (published notice) +
// Art. 36 (DPO contact). Public page; pending legal review.

export const metadata = { title: "Privacy Policy — Wekala" };

function H({ children }: { children: string }) {
  return <h2 className="mt-8 text-lg font-semibold text-neutral-950">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-neutral-600">{children}</p>;
}
function Li({ children }: { children: React.ReactNode }) {
  return <li className="text-sm leading-relaxed text-neutral-600">{children}</li>;
}

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">Privacy Policy</h1>
      <P>
        This notice explains what personal data Wekala processes, why, and the rights you have under
        the Sultanate of Oman's Personal Data Protection Law (Royal Decree 6/2022) and its Executive
        Regulations (Ministerial Decision 34/2024). It is published in line with Article 21 of the
        Executive Regulations.
      </P>

      <H>What we process</H>
      <P>
        We process the minimum data needed to operate the platform: your account identity (name,
        email), your workspace membership and role, the agents and workflows you create, audit
        records of state-changing actions, and operational telemetry (request latency, token
        counts). We practice data minimization — we do not collect data that is not required for a
        feature you use.
      </P>

      <H>Lawful basis &amp; purpose</H>
      <P>
        We rely on your explicit, documented consent (PDPL Art. 4) and on the necessity of
        performing the service you request. Data is used only to authenticate you, run and vet your
        agents, enforce workspace isolation, and produce the analytics you see in the Command
        Center. We do not sell personal data.
      </P>

      <H>Data sovereignty</H>
      <P>
        Wekala is built to keep data on local infrastructure. AI inference runs on locally hosted
        models; the security agent blocks workflows that would route personal data to cloud AI
        services or processors outside Oman (PDPL Art. 37–40). Any cross-border transfer would
        require your consent and an equivalent level of protection at the destination.
      </P>

      <H>Sensitive data</H>
      <P>
        Processing of sensitive categories — health, genetic, biometric, ethnic origin, religious
        belief, criminal records, or data concerning sex life — requires a Ministry permit (PDPL
        Art. 5). The platform flags agents and workflows that handle such categories for mandatory
        human review before they go live.
      </P>

      <H>Your rights</H>
      <P>Under the PDPL you may, free of charge and within a 45-day response window:</P>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <Li>Be informed of the purpose of processing and access a readable copy of your data.</Li>
        <Li>Correct, block, or request erasure of your data where the law permits.</Li>
        <Li>Withdraw consent at any time and request data portability to another controller.</Li>
        <Li>Be notified of any breach affecting your data (PDPL Art. 30–32).</Li>
      </ul>

      <H>Retention</H>
      <P>
        We retain personal data only for as long as the purpose requires. Archived agents and
        related records are purged after their retention window; audit logs are kept for the period
        the Ministry specifies, then destroyed so they cannot be recovered.
      </P>

      <H>Breach notification</H>
      <P>
        If a breach threatens your rights, we notify the competent authority within 72 hours and, in
        high-risk cases, notify affected individuals within the same window with the nature of the
        breach and steps to reduce its impact (PDPL Art. 30–33).
      </P>

      <H>Data Protection Officer</H>
      <P>
        Questions about your data, or to exercise any right above, contact our Data Protection
        Officer (PDPL Art. 36):{" "}
        <span className="font-medium text-neutral-800">dpo@wekala.example</span>{" "}
        <span className="text-neutral-400">(placeholder — pending appointment)</span>.
      </P>
    </>
  );
}
