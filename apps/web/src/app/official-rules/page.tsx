import Link from "next/link";

export const metadata = {
  title: "Official Rules · trivia.live",
};

/*
 * TODO(legal): DRAFT — must be reviewed by a lawyer before any show with a
 * prize runs. Everything in [BRACKETS] is a placeholder to fill in. Check
 * state-specific rules (e.g. NY/FL registration and bonding for prize
 * promotions over $5,000), tax reporting, and whether a skill-contest
 * framing holds for this format in every state where it's offered.
 */

const OPERATOR = "TiltCheck (Jamie Vargas), Panama City, FL";

function Placeholder({ children }: { children: React.ReactNode }) {
  return <mark className="rules-placeholder">[{children}]</mark>;
}

export default function OfficialRulesPage() {
  return (
    <main className="rules-page">
      <p className="rules-draft">
        DRAFT — pending legal review. Items marked like{" "}
        <Placeholder>this</Placeholder> are placeholders.
      </p>

      <h1 className="title">Official Rules</h1>
      <p className="subtitle">
        trivia.live live trivia shows · Last updated <Placeholder>DATE</Placeholder>
      </p>

      <section>
        <h2>1. No purchase necessary</h2>
        <p>
          NO PURCHASE OR PAYMENT OF ANY KIND IS NECESSARY TO ENTER OR WIN. Every
          show is free to play. Nothing in trivia.live is for sale: extra
          lives are free and can only be earned by inviting a friend or by
          choosing to watch a rewarded ad. A purchase will not improve your
          chances of winning.
        </p>
      </section>

      <section>
        <h2>2. Eligibility</h2>
        <p>
          Open only to legal residents of the 50 United States and the
          District of Columbia who are at least 18 years old (or the age of
          majority in their state, if older) at the time of entry. Employees
          of the Operator and their immediate family and household members
          are not eligible to win prizes. VOID WHERE PROHIBITED OR RESTRICTED
          BY LAW. <Placeholder>List any excluded states, if counsel advises</Placeholder>
        </p>
      </section>

      <section>
        <h2>3. Operator</h2>
        <p>
          The show is operated by <strong>{OPERATOR}</strong>{" "}
          <Placeholder>legal entity name, mailing address, contact email</Placeholder>{" "}
          (&quot;Operator&quot;).
        </p>
      </section>

      <section>
        <h2>4. How to play</h2>
        <p>
          Join a show&apos;s lobby before the first question opens. Each show
          has <Placeholder>12</Placeholder> multiple-choice questions. You have
          10 seconds to answer each one. A wrong answer or no answer knocks you
          out, unless you have an extra life (see section 6). Players who join
          after the first question opens can watch but cannot play or win.
          Answers and answer times are recorded by the Operator&apos;s servers,
          and those records are final.
        </p>
      </section>

      <section>
        <h2>5. Skill-based contest</h2>
        <p>
          This is a game of skill. Winners are decided by correctly answering
          trivia questions within the time limit, not by chance. Points shown in
          the app have no cash value and cannot be exchanged for prizes.
        </p>
      </section>

      <section>
        <h2>6. Free extra lives</h2>
        <p>
          Each player can have at most one extra life per show. An extra life
          can be earned for free by (a) sharing your invite link with a friend
          who signs in and joins that show as a player, or (b) watching a
          rewarded ad when one is offered. An extra life is used automatically
          right after a wrong or missed answer, before the next question. It
          cannot be used on the final question. Extra lives cannot be bought,
          sold, or transferred and expire at the end of the show.
        </p>
      </section>

      <section>
        <h2>7. Prizes and winners</h2>
        <p>
          The prize for each show is announced before the show starts:{" "}
          <Placeholder>prize amount / description, approximate retail value</Placeholder>.
          To win, a player must still be in the game after the final question
          (an extra life can cover one missed question, but never the final
          question). To be eligible to receive a prize you must be signed in
          to an account <Placeholder>confirm requirement</Placeholder>.
        </p>
        <p>
          <strong>Tie-break.</strong> If more than one player makes it through
          the final question, the player with the fastest cumulative answer time (the
          total time taken to answer all questions, as recorded by the
          Operator&apos;s servers) wins. If two or more players are still tied,
          the prize is split equally among them.
        </p>
      </section>

      <section>
        <h2>8. Prize payment and taxes</h2>
        <p>
          Prizes are paid via PayPal within 30 days after the Operator
          verifies the winner&apos;s eligibility. Winners must respond to the
          Operator&apos;s notification within <Placeholder>7</Placeholder> days
          or the prize may be forfeited. Winners who receive $600 or more in
          prizes from the Operator in a calendar year must provide a completed
          IRS Form W-9 before payment, and will receive an IRS Form 1099.
          Winners are responsible for all taxes on prizes.
        </p>
      </section>

      <section>
        <h2>9. Registration of larger promotions</h2>
        <p>
          For any show or promotion offering prizes with a total value over
          $5,000, the Operator will file with the Florida Department of
          Agriculture and Consumer Services (FDACS) as required by Florida law
          before it starts. <Placeholder>Confirm filing/bonding requirements and
          other states, e.g. New York, with counsel</Placeholder>
        </p>
      </section>

      <section>
        <h2>10. Fair play</h2>
        <p>
          Using bots, scripts, multiple accounts, shared answers, or any other
          method to gain an unfair advantage, or creating accounts to earn
          referral extra lives, will result in disqualification and forfeiture
          of prizes. The Operator may verify identity and eligibility before
          awarding any prize.
        </p>
      </section>

      <section>
        <h2>11. General</h2>
        <p>
          The Operator may cancel, suspend, or modify a show if technical
          problems, fraud, or other causes beyond its control affect its
          integrity. By playing you agree to these rules and the
          Operator&apos;s decisions, which are final.{" "}
          <Placeholder>Limitation of liability, governing law (Florida),
          privacy policy link, winners list request address</Placeholder>
        </p>
      </section>

      <Link href="/" className="btn">
        Back to home
      </Link>
    </main>
  );
}
