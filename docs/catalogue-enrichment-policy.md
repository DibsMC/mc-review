# Review Budz Catalogue Enrichment Policy

## Purpose

Review Budz keeps factual catalogue data separate from community experience.
This policy covers how product facts are sourced, reviewed, and refreshed.

## Allowed source types

- Official manufacturer or grower product pages
- Official producer datasheets or specification pages
- Public pharmacy product pages where factual fields are openly shown

## Disallowed source types

- Patient-only portals
- Scraped third-party searchable databases
- Editorial pages copied for prose, marketing copy, or images
- Sources whose terms prohibit scraping, automated extraction, or database reuse

## Allowed factual fields

- product name
- manufacturer / grower
- variant / cultivar
- product type
- strain type where officially stated
- THC / CBD
- terpenes
- genetics where officially stated
- country of origin
- irradiation status
- producer use cases or producer notes, but only when clearly presented as producer guidance and never as Review Budz medical advice
- availability status and supporting signals from approved public sources

## Review Budz original fields

The following should remain original or user-generated inside Review Budz:

- reviews
- ratings and scores
- notes
- tags and smart badges
- effect summaries
- community insights

## Availability status model

Availability should be treated as a factual review layer, not a guarantee of
prescribing access. Approved statuses are:

- `available`
- `possibly_unavailable`
- `discontinued`
- `unknown`

Use these rules:

- Mark `discontinued` only when a producer or approved public seller says so clearly.
- Mark `possibly_unavailable` when a product disappears from approved public listings
  or is repeatedly shown as out of stock.
- Mark `available` when a current approved public source clearly lists it.
- Mark `unknown` when a safe public source cannot confirm either way.

## Provenance requirements

Where possible, each imported or enriched factual field should carry:

- source name
- source URL
- source type
- source checked date
- source notes or caveats

## Refresh cadence

- Preferred cadence: twice weekly
- Refreshes should produce a review queue, not blind auto-publishing
- Material factual changes should be reviewed before import
- Availability checks should prefer official producer/grower pages first, then
  approved public pharmacy pages as a fallback

## Product guidance card rules

If producer guidance is shown in-app:

- label it clearly as producer guidance or product facts
- keep it separate from community reviews
- avoid presenting it as guaranteed patient outcome or medical advice
