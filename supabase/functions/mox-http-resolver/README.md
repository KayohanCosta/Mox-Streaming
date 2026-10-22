# HTTP-only media experiment

The `mox-http-resolver` function is deployed in Supabase with gateway JWT verification enabled. It accepts only indexed content identifiers, never arbitrary target URLs. A database lease permits at most one bounded test every two minutes.

No browser, browser cache, cookies imported from Chrome, external proxy, CAPTCHA execution, token synthesis or JavaScript from the origin is used. Only same-origin HTTPS pages, known player paths and associated MP4 candidates are inspected.

`resolve` attempts fresh HTTP acquisition and validates the prefix and tail byte ranges. `renewal_probe` performs two fresh acquisitions and compares byte fingerprints. This proves immediate reacquisition only when successful; it does not validate expiry-triggered or automatic renewal. Range validation does not prove client playback or portability to a different IP.

**Real cloud result:** movie 969681, Portuguese: upstream HTTP 403 on the first document request; API status 424 `source_access_refused`, `media_url=null`. No media was obtained, and renewal could not be tested. The production player has not been connected to this experimental function.

Run the nine fixture tests with `node --test supabase/tests/http-resolver.test.mjs`. Fixtures validate the implementation, not compatibility with the live origin.

A successful live acquisition and playback test is required before production integration. The source must permit this normal HTTP access.
