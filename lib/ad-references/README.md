# Ad reference research contract

`schema.ts` validates `docs/meta-ad-research/backend.json` and `docs/meta-ad-research/interface.json` when the page is built. Each contributor owns their named JSON file. Both begin empty; no illustrative ad records are published.

Each record follows the `AdReference` interface in `types.ts`. Times are numeric seconds, ordered scene ranges cannot overlap, and the hook and scenes must fit the observed duration. Scene descriptions are editorial observations, not a claim of frame-perfect coverage. Explain the actual review coverage in `observation.coverage` and any gaps in `observation.limitations`. Only set `audioReviewed` after listening.

Use `sourceType: "direct-meta"` only for an observation made directly through Meta; use `"archive"` for an archive. Include the specific stable source page, the actual Meta Library URL when known, the date observed, and the status exactly as it was observed. An archive's status is not a current Meta delivery status. Use "Not verified" when appropriate. Do not infer effectiveness, spend, conversion rate, or current delivery from the fact an ad exists.

`poster` is optional. Its `src` must be a site-local path under `/ad-references/`, with an accessible description and attribution caption. Publishing any low-resolution storyboard excerpt is a separate editorial decision by the coordinator; do not copy an entire third-party video into public assets. Without a poster the page presents the observed hook as text. Optional `videoUrl` is a link to a stable public host, never embedded playback or a transient CDN URL.

The route renders plain escaped text, source links, and optional approved local images. It does not render contributed HTML, fetch remote posters, embed social trackers, or automatically load third-party video.
