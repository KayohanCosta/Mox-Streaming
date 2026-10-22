# MOX on Supabase

Public API: https://bqkthfboqvlboglodiyz.supabase.co/functions/v1/mox-api

The catalog function serves the imported index. The experimental raw source catalog is withdrawn from the product. /catalog redirects to the established movies browser. Existing /source links open the standard details page only when title, media type and year identify one TMDB result. Origin cover images are not rendered in the product. It is not a claim of complete upstream coverage or validated playback.

The mox-catalog-sync Edge Function maintains a durable queue, observes the same HTTPS origin, never executes source JavaScript and pauses on 401/403/429 or access verification. It accepts only fixed-scope work, at most three pages per globally leased minute; callers cannot choose an upstream URL. GET reports state, POST performs a bounded batch. The initial cloud test received HTTP 403 from the source and paused with the queue preserved. No automatic schedule was enabled against the refused origin.

Video acquisition and renewal still require the existing runtime. Production does not target localhost: it returns the explicit cloud playback dependency until a compatible resolver is validated. No VPS was provisioned. Browser-local profiles are not yet synchronized with account profiles.

Never commit browser profiles, cookies, media tokens or service-role keys. Backend keys are read from function environment variables.
