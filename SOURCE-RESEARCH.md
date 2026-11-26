# Lossless source review — 27 October 2026

This reviews representative active projects and source models, not every repository. Repository claims are distinguished from independently verified playback. No live provider audio was authenticated or decoded during this review.

| Project | How music is obtained | What it means for Oktawka |
| --- | --- | --- |
| [Monochrome](https://github.com/monochrome-music/monochrome#self-hosting) | Its source code includes catalog and streaming adapters. Its README says the hosted API only accepts official Monochrome domains; independent hosted copies need a working HiFi endpoint. | An open-source frontend does not grant access to the operator’s hosted audio. Do not spoof its official origin. |
| [Spotube Lossless Sources plugin](https://github.com/kipavy/spotube-plugin-lossless-sources) | Matches recordings by ISRC and tries Monochrome, HiFi instances, then lossy YouTube. It maintains a source list using stream probes, not search-only availability. | Separate metadata matching, source resolution, codec verification, and availability. Its “working” claims are the maintainer’s observations, not a Oktawka playback test. YouTube fallback is not lossless. |
| [HiFi API](https://github.com/binimum/hifi-api) | Uses authenticated Tidal playback credentials to obtain manifests and signed file URLs; the project documents account blocking and request serialization. | Needs working provider credentials and a playback adapter; catalog search alone is not proof that audio works. |
| [Octo-Fiesta / SquidWTF](https://github.com/V1ck3s/octo-fiesta/wiki/Supported-Music-Providers) | Retrieves audio from configured providers and can cache it behind Subsonic. Current maintainer docs mark SquidWTF deprecated: upstream Qobuz is down and public Tidal instances offer search/previews rather than reliable full playback. | Do not rely on old “no key needed” README claims as a working full-audio source. Older forks still advertise these services. |
| [Music Assistant / Tidal](https://www.music-assistant.io/music-providers/tidal/) | OAuth with the listener’s own subscription; provider returns lossless streams, documented up to 24-bit/192 kHz. | Free server/player software; music subscription is separate. |
| [Streamrip](https://github.com/nathom/streamrip) | Service-specific download adapters for Qobuz, Tidal, Deezer, and SoundCloud. | A download client, not a free universal music-hosting API. |
| [Navidrome](https://www.navidrome.org/about/) | Indexes and streams the server owner’s existing music files. | Does not supply the external music catalog requested here. |
| [Stremio addon protocol](https://stremio.github.io/stremio-addon-sdk/protocol.html) | Addons provide catalogs, metadata, and source URLs/hashes as separate resources. A client resolves or plays sources. | This is the discovery/resolution model requested for Oktawka. Movie/TV addons are not automatically music indexers. |
| [Knaben](https://knaben.org/api/v2/) + [AllDebrid](https://docs.alldebrid.com/) | An indexer finds torrent hashes; the user’s AllDebrid account prepares a selected source, lists files, and unlocks an audio link. | Current Oktawka route. Search does not need or receive the AllDebrid key. AllDebrid is a resolver, not a public searchable music catalog. Cached readiness and file quality are separate checks. |

## Search repair

The previous implementation called Knaben v1 with a cross-origin POST from the browser and replaced every failure with “The addon could not complete the search.” This obscured the distinction between network/CORS failures, upstream errors, invalid JSON, and schema changes.

Oktawka now has a same-origin GET `/api/cloud-search?q=...` Worker route. It calls the documented Knaben v2 GET search endpoint with fixed lossless category 1002000, normalizes hashes, bounds results, and returns specific failure codes. A fixed upstream prevents this route being used as an arbitrary URL proxy. Incoming cookies, identity headers, and AllDebrid keys are not forwarded. Search does not claim the user is connected to the indexer merely because the default provider is selected.

The client offers retry and displays server diagnostics. AllDebrid authorization and audio resolution remain separate and keep credentials in tab memory. No public HiFi service, commercial service account, or origin-restricted Monochrome API has been silently added as a fallback.

## Verification limits

The execution environment’s egress policy returned a proxy CONNECT denial for api.knaben.org, so it cannot establish live indexer readiness. No browser-control connection was available. The earlier browser failure’s precise network cause is therefore unconfirmed. The server route removes browser CORS as a dependency but cannot guarantee the indexer accepts hosting-server traffic. Live AllDebrid playback still requires a real connected account and an available source. Integration tests use simulated upstream responses and exercise the full route and UI contracts.

## Direct source added: Live Music Archive

Oktawka now uses Internet Archive's public [Advanced Search API](https://archive.org/advancedsearch.php) and [metadata endpoint](https://archive.org/metadata/) to search the [Live Music Archive](https://archive.org/details/etree). Search is scoped to `collection:etree`, `mediatype:etree`, and FLAC. On selection, metadata is checked again for collection membership and restrictions; only non-private FLAC files become direct `archive.org/download` audio URLs. Keys, debrid, torrent preparation, and audio proxying are unnecessary for these public files. Recording pages link to the artist's sharing policy. Restricted recordings or unavailable FLAC files are refused. This is live music, not a replacement for the commercial studio catalog, and a FLAC container alone does not establish original mastering provenance.

The managed executor denied archive.org at its egress proxy (CONNECT 403). Therefore mocked route tests passed but live catalog and full audio playback remain unverified. The deployed app reports upstream failure with retry guidance. HiFi API's current README was rechecked: playback still requires valid Tidal credentials. No unofficial public instance was treated as reliable or permission-free.

## Key-free source follow-up

- Radio Paradise publishes direct FLAC stream links for third-party players ([official stream page](https://radioparadise.com/listen/stream-links), [operator forum discussion](https://apps.radioparadise.com/content.php?file=showtopic&name=Forum&topic_id=24857)). Added Main, Mellow, Rock and Eclectic as clearly labeled continuous radio, never as an automatic match for an album song. Fixed-station Worker transport forwards audio without re-encoding and strips visitor credentials. Range/header quality checks stay bounded. No metadata poller or visualizer is used.
- Internet Archive Netlabels adds on-demand open releases. Search and file resolution require the Netlabels collection and an explicit Creative Commons license URL. Restricted/private files are refused. Release listings are not a guarantee that FLAC files are still available.
- [LastWave](https://lastwave.app/) advertises lossless, but its own current guide requires a personal addon URL obtained through Discord/Telegram verification. It is a backend account dependency, not a public anonymous API ready for Oktawka.
- [Mother Earth Radio](https://motherearthradio.de/) reports it has ceased operations; its successor is Germany-only. Not added.
- Monochrome's current README still restricts hosted API use to official instances. No origin spoofing or shared Tidal credentials were added.

Both Archive and Radio Paradise were denied by the managed executor's destination policy. Mock tests verify routing, restrictions, error cases, streaming cancellation and isolation. A live probe from the deployed host is attempted separately; no claim of decoded browser playback is made from a successful HTTP response alone.

## 28 October 2026 — curated app list review

Reviewed [chayotic's list](https://github.com/chayotic/Open-Source-Music-Streaming-Apps), plus the current Monochrome, Nuclear and binimum/hifi-api READMEs. The list distinguishes streaming clients from offline players; it is not a list of public FLAC APIs. Nuclear now describes a plugin-driven source architecture. Monochrome explicitly restricts its hosted API to official instances and directs independent sites to their own working paid HiFi endpoint. HiFi documents authenticated Tidal playback, full-track BTS JSON and DASH manifests, and LOSSLESS/HIGH/LOW quality requests. No working unrestricted commercial FLAC catalog was established by this review.

Oktawka now supports a user-configured HTTPS HiFi endpoint in Settings → Streaming quality, before any debrid resolution. Browser requests omit credentials and referrers; no debrid key or visitor identity is sent. The endpoint must permit CORS and have its own working service account. Exact artist/title/album and duration checks guard track selection. Only full, unencrypted, single-file BTS FLAC/AAC manifests are supported; DASH, previews, encryption and mismatched IDs are refused. No origin spoofing or embedded shared service credentials.

Adaptive selects CD FLAC normally and AAC on explicit save-data/slow-network hints, with AAC fallback; Lossless refuses lossy substitutions; Data Saver requests AAC. This is selection at track start, not continuous adaptive-bitrate switching. Direct radio/Archive/local files remain fixed-format. Reported provider bit depth is not treated as verified; the existing byte probe/decoder determines the player badge. Actual service playback remains unverified without a working endpoint. Existing Radio Paradise and Archive sources remain the no-account offerings.
