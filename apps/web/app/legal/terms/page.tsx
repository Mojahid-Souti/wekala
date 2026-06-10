// Terms of Use (draft) — acceptable-use + PDPL-aligned obligations. Public page.

export const metadata = { title: "Terms of Use — Wekala" };

function H({ children }: { children: string }) {
  return <h2 className="mt-8 text-lg font-semibold text-neutral-950">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-neutral-600">{children}</p>;
}
function Li({ children }: { children: React.ReactNode }) {
  return <li className="text-sm leading-relaxed text-neutral-600">{children}</li>;
}

export default function TermsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">Terms of Use</h1>
      <P>
        These terms govern your use of the Wekala platform. By accessing Wekala you agree to use it
        lawfully and in line with the Sultanate of Oman's Personal Data Protection Law and the
        national policy for the safe and ethical use of AI systems.
      </P>

      <H>Your account</H>
      <P>
        You are responsible for the activity in your account and for keeping your credentials
        secure. Access is scoped to the workspaces you are a member of; you may not attempt to reach
        another workspace's data.
      </P>

      <H>Acceptable use</H>
      <P>When building, hiring, or running agents and workflows, you must not:</P>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <Li>Process personal data without a lawful basis and the consent the PDPL requires.</Li>
        <Li>
          Handle sensitive categories (health, genetic, biometric, ethnic, religious, criminal,
          sex-life) without the required Ministry permit (PDPL Art. 5).
        </Li>
        <Li>
          Route personal data to AI services or processors outside Oman without authorization (PDPL
          Art. 37–40).
        </Li>
        <Li>
          Send marketing or commercial messages without recorded consent and a free opt-out (PDPL
          Art. 22).
        </Li>
        <Li>Embed credentials in agent or workflow definitions, or attempt to bypass vetting.</Li>
      </ul>

      <H>Security vetting</H>
      <P>
        Every agent and workflow must pass automated security review before it can be published to
        the Bazaar. The security agent checks for the issues above; items it cannot auto-clear are
        escalated to a human reviewer. Publication does not transfer responsibility for lawful use —
        that remains with you as the controller.
      </P>

      <H>Human oversight</H>
      <P>
        Per Oman's AI policy, decisions with significant impact must keep a human in the loop. You
        are responsible for supervising the agents you operate and for the outputs they produce.
      </P>

      <H>Availability &amp; changes</H>
      <P>
        The platform is provided on an as-is basis during this phase. We may update these terms;
        material changes will be surfaced in the app. Continued use after a change constitutes
        acceptance.
      </P>

      <H>Contact</H>
      <P>
        For questions about these terms or to report misuse, contact{" "}
        <span className="font-medium text-neutral-800">support@wekala.example</span>{" "}
        <span className="text-neutral-400">(placeholder)</span>.
      </P>
    </>
  );
}
