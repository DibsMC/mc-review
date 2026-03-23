# Review Budz v2.0 Roadmap

## Product Goal

Make Review Budz easier to contribute to, more shareable, and more trustworthy to return to.

The core `v2.0` theme should be:

**Better reviews, less friction, more reasons to come back.**

## What v2.0 Should Optimize For

- Increase reviews per member
- Increase the percentage of members who post a second review
- Make the review UI feel polished and lightweight
- Turn sharing into a growth loop
- Replace placeholder content with real product and review activity
- Add analytics that are free, readable, and useful for product decisions

## Current Product Read

### What is already working

- The product detail screen already has the strongest product surface in the app:
  - structured review scoring
  - aggregate product score
  - effect summaries
  - product metadata and terpene display
- The Firestore-backed catalog is a strong foundation for live updates without app releases
- The product identity and visual direction are already strong on the flower detail experience

### What is weak right now

- The review composer feels visually too large and clunky compared to the product page
- The home screen is still placeholder-driven rather than activity-driven
- Auth is still too early in the funnel for discovery growth
- There is no analytics layer for product decisions yet
- Sharing is not yet part of the growth loop

## v2.0 Must-Ship Scope

## 1. Review Composer Makeover

This is the highest-priority UI job in `v2.0`.

### Direction

- Make the review UI visually match the polish of the flower detail page
- Reduce text size and visual bulk
- Use icons and smaller chips instead of large blocks where possible
- Make the review experience feel guided, not form-heavy

### UX changes

- Split the review flow into two layers:
  - `Quick review`: overall score + core effect scores + optional short note
  - `Add detail`: optional chips and context such as use case, onset, duration, downsides, and whether they would order again
- Add compact helper text under each score so people know what they are judging
- Add a better explanation for ambiguous metrics, especially anything like `racing thoughts` or similar cognitive/mind-state ratings
- Show an example review or mini examples inline so users understand what “helpful” looks like

### Product decision

The rule for `v2.0` should be:

**More detail should be optional, not required.**

That keeps the review flow fast while making the data richer over time.

## 2. Sharing as a Growth Loop

This should be part of `v2.0`.

### What to ship

- Add native sharing from:
  - a review card
  - a flower/product card
- Shared content should feel branded and polished
- Default share output should include:
  - a slick share card image
  - product name
  - headline score
  - short quote or summary
  - call to action back to Review Budz

### Important product note

For `v2.0`, the safe version is:

- share image
- share text
- share a simple app/open/install link

The more ambitious version is public landing pages for shared products and reviews.

### Important technical note

Do **not** build new sharing around Firebase Dynamic Links.

Firebase says Dynamic Links are deprecated and shut down on **August 25, 2025**. If we want proper open/install behavior, we should use normal `https` pages plus iOS Universal Links and Android App Links when we have a public domain and landing pages.

## 3. Real Home Screen

The home screen should stop feeling mocked and start feeling alive.

### Must-ship home sections

- `Recently added`
- `Needs first review`
- `New reviews since your last visit`
- `Top reviewed this week`

### Nice addition

- Add a `New` filter in the browse view so recently imported flowers are easy to find

This ties product imports directly into product discovery.

## 4. Free Analytics You Can Actually Use

This should ship in `v2.0`, but it is not the headline feature. It is the decision-making layer underneath the release.

### Recommended stack

- Use Firebase Analytics first
- View results in the Firebase console and linked Google Analytics reports
- Keep Mixpanel out for now unless Firebase becomes too limiting later

### Why

- free
- already aligned with the current Firebase stack
- easy to inspect in the Firebase console
- enough for events, funnels, audience creation, and notification targeting later

### Must-track events

- `app_open`
- `session_start`
- `sign_up_complete`
- `sign_in_complete`
- `home_card_opened`
- `recently_added_opened`
- `product_view`
- `review_start`
- `review_submit`
- `review_edit`
- `review_share`
- `product_share`
- `filter_used`
- `search_used`

### Must-track properties and derived metrics

- total visit count per user
- days since last visit
- platform
- signed-in vs browsing
- review count bucket
- filter name used

### Product metrics to watch

- review start -> review submit conversion
- reviews per member
- percentage of members with 2+ reviews
- percentage of viewed products that get a review
- percentage of products with 1+ reviews
- percentage of products with 3+ effect-rated reviews

## 5. Reduce Friction Before Posting

This should be in `v2.0`.

### Change

- let people browse the app without signing in
- only require auth when they try to:
  - post a review
  - save profile changes
  - upload media

This makes sharing much more useful because someone clicking into shared content should be able to see value before being forced to create an account.

## Stretch Scope for v2.0

These are good ideas, but only if the must-ship scope is stable.

## A. Recently Added Carousel

- A horizontally scrolling `Recently added` lane on the home screen
- A dedicated route or filter entry point into all newly added products

## B. Share Card Generator

- Generate more polished share images instead of relying only on plain share text
- Good if it fits cleanly after core share actions work

## C. Notification Groundwork

- event definitions ready
- audience definitions ready
- notification strategy written down

Actual notification campaigns do not need to be fully live on day one of `v2.0`.

## Deliberately Not in v2.0

These are good ideas, but they should not sit inside the main `v2.0` launch scope.

## 1. Full Community Section

Not yet.

### Why

- Too much scope
- Too much moderation surface
- Risks making the app noisy before the core review loop is strong

### Better first step

- public reviewer profiles
- recent activity
- helpful votes

Avoid chat and open posting for now.

## 2. Standalone Note Board

Not recommended for `v2.0`.

### Why

- Splits content between reviews and notes
- Makes the product harder to understand
- Lowers the signal quality of the review dataset

### Better alternative

Add a compact optional note inside the review flow instead of creating a separate community wall.

## 3. Image Upload as a Core v2.0 Requirement

High-potential feature, but better as `v2.1` or a controlled beta unless the rest of `v2.0` lands quickly.

### Why it is exciting

- Strong trust signal
- Makes products more tangible
- Very shareable
- Builds a real visual database over time

### Why it is risky

- upload UX
- moderation
- storage rules
- abuse risk
- added release scope

### Recommended model

If we do images, the cleanest first version is:

- attach images to reviews
- store upload date automatically
- show them in product context

This is better than allowing standalone image posts first.

## 4. Subscriptions

Do not put this in `v2.0`.

The app needs a stronger repeat-use loop first.

## 5. AI Features

Do not put this in `v2.0`.

Richer structure and more contribution density will create more value than AI at the current stage.

## Suggested Release Order

## v2.0

- review composer redesign
- guided review flow
- guest browse
- real home content
- sharing
- Firebase Analytics
- legacy route cleanup

## v2.1

- contextual notifications
- image upload attached to reviews
- lightweight community surfaces
- public landing pages for shared products and reviews

## v2.2+

- richer personalization
- premium features if habit and value are proven
- AI summaries only when there is enough data density to make them genuinely useful

## Decisions To Treat As Defaults Unless Changed

- Sharing belongs in `v2.0`
- Notifications are important, but come right after the analytics foundation
- Community should start lightweight, not chat-first
- Images should attach to reviews first, not exist as a separate standalone feed
- Notes should live inside reviews first, not as a separate note board
- Firebase Analytics is the right first analytics stack

## Implementation Notes

- Use the flower detail review flow as the canonical review path
- Clean up or redirect legacy review routes before instrumenting analytics
- Replace home placeholders with live Firestore-backed sections
- Add a `recentlyAddedAt` or equivalent product field if the import flow needs a reliable sort/filter for newly added flowers

## External Notes

- Firebase Analytics overview: https://firebase.google.com/docs/analytics
- Firebase Analytics reports: https://firebase.google.com/docs/analytics/reports
- Firebase Dynamic Links deprecation FAQ: https://firebase.google.com/support/dynamic-links-faq
- Expo linking overview: https://docs.expo.dev/linking/overview/
- Apple universal links overview: https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content
