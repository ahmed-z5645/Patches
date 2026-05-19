import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import "./landing.css";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/feed");
  }

  return (
    <div className="landing-page">
      {/* NAV */}
      <header className="page">
        <nav className="top">
          <Link href="/" className="brand">
            <span className="mark">P</span>
            <span className="word">Patches</span>
          </Link>
          <div className="nav-links">
            <a href="#toll" className="anchor">how?</a>
            <a href="#use-cases" className="anchor">who?</a>
            <Link href="/login" className="signin">Sign in</Link>
            <Link href="/signup" className="btn btn-primary">Get started</Link>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="page hero">
        <div>
          <div className="eyebrow">a weekly post</div>
          <h1>
            Write your<br />post. Unlock<br />
            your <span className="ink-accent">feed.</span>
          </h1>
          <p className="lede">
            One post a week, about anything. Publish yours and see 
            everyone you follow, in full, in order, chosen by them,
            not an algorithm.
          </p>
          <div className="hero-ctas">
            <Link href="/signup" className="btn btn-primary btn-lg">Create your Patches</Link>
            <a href="#toll" className="btn btn-ghost btn-lg">See how it works</a>
          </div>
        </div>

        <div className="hero-stack">
          <div className="float-pill">3 days until a new week is revealed</div>

          <div className="card card-1">
            <span className="who">@maya</span>
            <div>
              <p className="preview">
                Saturday I made stock for the first time. The kitchen smelled like home.
              </p>
              <h3 className="title">Week of slow cooking and slow walks</h3>
            </div>
          </div>
          <div className="card card-2">
            <span className="who">@priya</span>
            <div>
              <p className="preview">
                Twelve hours, two books, one decent meal. Notes scattered into a bento below.
              </p>
              <h3 className="title">Notes from a long flight</h3>
            </div>
          </div>
          <div className="card card-3">
            <span className="who">
              @dean <span className="late">LATE</span>
            </span>
            <div>
              <p className="preview">
                I missed Sunday. The week was loud. Here&apos;s the bento anyway.
              </p>
              <h3 className="title">A late one</h3>
            </div>
          </div>
        </div>
      </section>

      {/* THE TOLL */}
      <section className="section" style={{ paddingTop: 0, paddingBottom: 120 }}>
        <div className="section toll" id="toll">
          <div>
            <p className="section-eyebrow">create to see</p>
            <h2 className="section-title">
              Post yours. <span className="ink-accent">See theirs.</span>
            </h2>
            <p className="section-sub">
              Patches isn&apos;t a place to lurk. Publish your week and the
              week&apos;s posts from everyone you follow arrive in full and in
              order. There&apos;s no ranking, no algorithm, no infinite scroll. You don&apos;t
              just consume what people make; you join them. <em>Show up first, reap the benefits later.</em>
            </p>
          </div>

          <div className="lockgate-demo">
            <div className="ghost-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} className="ghost" />
              ))}
            </div>
            <div className="lock-icon">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3>Feed is locked</h3>
            <p className="line">Publish this week&apos;s post to see what others shared.</p>
            <p className="meta">4 people have already posted this week.</p>
            <Link href="/signup" className="write">Write your post</Link>
          </div>
        </div>
      </section>

      {/* THE BENTO */}
      <section className="section page" id="bento">
        <div className="section-header">
          <p className="section-eyebrow">post anything</p>
          <h2 className="section-title">A weekly post about anything.</h2>
          <p className="section-sub">
            Not just a journal. Your post could be about a project, a trip, a rant, a recipe, a song you
            played twice, a thing you shipped. You decide what goes in and where
            it sits, and the editor and the reader are the same surface, so what
            you build is exactly what people see.
          </p>
        </div>

        <div className="bento-demo">
          <article
            className="bento-tile markdown"
            style={{ gridColumn: "span 2", gridRow: "span 3" }}
          >
            <h4>Monday morning</h4>
            <p>
              I made stock for the first time. Six hours of simmering chicken bones with
              the carrots I&apos;d been meaning to use. The kitchen smelled the way my
              grandmother&apos;s kitchen smelled in the winter — except it was June and
              I was nowhere near her.
            </p>
            <p style={{ marginTop: 10 }}>
              I strained it twice. I burned myself once. I ladled the result into eight
              little plastic containers and stacked them in the freezer like a small
              library.
            </p>
          </article>

          <article
            className="bento-tile image"
            style={{ gridColumn: "span 2", gridRow: "span 2" }}
          >
            <div
              className="img-inner"
              style={{
                background:
                  "linear-gradient(135deg, #d8b4a0 0%, #c38d9e 60%, #6b5b95 100%)",
              }}
            >
            </div>
          </article>

          <article
            className="bento-tile music"
            style={{ gridColumn: "span 1", gridRow: "span 1" }}
          >
            <div className="play">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <polygon points="4,2 13,8 4,14" />
              </svg>
            </div>
            <div>
              <div className="track-name">Someday</div>
              <div className="artist">The Strokes</div>
              <div className="source">Spotify</div>
            </div>
          </article>

          <article
            className="bento-tile map"
            style={{ gridColumn: "span 1", gridRow: "span 1" }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a8 8 0 0 1 8 8c0 5-8 14-8 14S4 15 4 10a8 8 0 0 1 8-8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="label">Brooklyn</span>
          </article>

          <article
            className="bento-tile run"
            style={{ gridColumn: "span 2", gridRow: "span 1" }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="13" cy="4" r="2" />
              <path d="M4 22l3-7 4-3-2-4 3-3 3 5 4 1" />
              <path d="M9 18l4-2" />
            </svg>
            <div>
              <div className="distance">5.1 km</div>
              <div className="meta">Saturday recovery jog · 28:14</div>
            </div>
          </article>

          <article
            className="bento-tile quote"
            style={{ gridColumn: "span 2", gridRow: "span 1" }}
          >
            <blockquote>
              &ldquo;You are what you do repeatedly. Excellence, then, is not an act but
              a habit.&rdquo;
            </blockquote>
            <cite>— a book I&apos;m reading slowly</cite>
          </article>
        </div>
      </section>

      {/* USE CASES */}
      <section className="section page" id="use-cases">
        <div className="section-header">
          <p className="section-eyebrow">for who</p>
          <h2 className="section-title">See what the people around you make.</h2>
          <p className="section-sub">
            Same product, three rhythms. Pick one, switch later, run more than
            one. Whoever you follow, you see what they chose to create that
            week. Additionally, when you create, you decide the audience, not a feed.
          </p>
        </div>

        <div className="usecases">
          <article className="usecase public">
            <div>
              <span className="uc-tag">publicly</span>
              <h3 className="uc-title">A weekly newsletter that doesn&apos;t feel like work.</h3>
              <p className="uc-body">
                Make your profile public. Pick a username worth sharing. People land on{" "}
                <em>patches.app/yourname</em> and read what you&apos;ve been making. No
                mailing list. No &ldquo;did you see my latest post?&rdquo; — they just
                check at 9:00 AM on Mondays.
              </p>
              <div className="uc-illo">
                <span className="pill">patches.app/maya</span>
                <div className="uc-mini-cards">
                  <span className="mc" /><span className="mc" /><span className="mc" />
                </div>
              </div>
            </div>
            <div className="uc-foot">Best for: writers, makers, people with something to say weekly.</div>
          </article>

          <article className="usecase friends">
            <div>
              <span className="uc-tag">with people</span>
              <h3 className="uc-title">Keep up with the people you actually know.</h3>
              <p className="uc-body">
                Follow close friends. Every Monday at 9:00 AM a small, intentional
                feed arrives: what they cooked, ran, read, fought through. To unlock
                it you have to send one yourself. Group text, but on purpose.
              </p>
              <div className="uc-illo">
                <span className="pill">12 friends · this week</span>
                <div className="uc-stack">
                  <span className="row" style={{ ["--w" as string]: "90%" } as React.CSSProperties} />
                  <span className="row" style={{ ["--w" as string]: "65%" } as React.CSSProperties} />
                  <span className="row" style={{ ["--w" as string]: "80%" } as React.CSSProperties} />
                </div>
              </div>
            </div>
            <div className="uc-foot">Best for: close circles who want to stay in touch without a group chat.</div>
          </article>

          <article className="usecase private">
            <div>
              <span className="uc-tag">for yourself</span>
              <h3 className="uc-title">A private repository of every week of your life.</h3>
              <p className="uc-body">
                Turn social off. Follow no one. You&apos;re left with one weekly ritual
                and an archive that compounds. Year five, you&apos;ll scroll back to
                week one and remember what the kitchen smelled like.
              </p>
              <div className="uc-illo">
                <span className="uc-lock">
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  private archive · 217 weeks
                </span>
              </div>
            </div>
            <div className="uc-foot">Best for: future-you, the journaler, the legacy-keeper.</div>
          </article>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="page final-cta" id="signup">
        <h2>
          One post.<br />Each week.<br />
          <span className="ink-accent">Create.</span>
        </h2>
        <p className="sub">
          Don&apos;t just consume: publish one post a week, about anything,
          and see what the people around you made. In full, in order, no
          algorithm.
        </p>
        <div className="cta-row">
          <Link href="/signup" className="btn btn-accent btn-lg">Create your Patches</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="page bottom">
        <Link href="/" className="brand">
          <span className="mark">P</span>
          <span className="word">Patches</span>
        </Link>
        <div className="links">
          <a href="#bento">The format</a>
          <a href="#toll">The toll</a>
          <a href="#use-cases">Use cases</a>
        </div>
        <span className="copy">© 2026 Patches · Your personal legacy engine.</span>
      </footer>
    </div>
  );
}
