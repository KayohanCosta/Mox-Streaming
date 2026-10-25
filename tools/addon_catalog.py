"""Import XML-like Kodi catalogs as data, without executing addon code.

Usage: python3 tools/addon_catalog.py INPUT --output /path/catalog.json
Only local files are read. No resolver, credential or network request is executed.
"""
import argparse
from collections import Counter
import hashlib
import html
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

MAX_BYTES = 32_000_000


def values(block, tag):
    result = []
    for value in re.findall(rf'<{tag}\b[^>]*>(.*?)</{tag}>', block, re.I | re.S):
        value = value.strip()
        if value.startswith('<![CDATA[') and value.endswith(']]>'):
            value = value[9:-3]
        else:
            value = html.unescape(value)
        result.append(value.strip())
    return result


def first(block, tag):
    return next(iter(values(block, tag)), '')


def clean(value):
    value = re.sub(r'\[CR\]', '\n', value, flags=re.I)
    return re.sub(r'\[/?(?:B|I|COLOR(?:\s+[^]]+)?|UPPERCASE|LOWERCASE)\]', '', value, flags=re.I).strip()


def classify(reference, external=False):
    # Preserve the original byte spelling of percent-encoded signed parameters.
    base, separator, headers = reference.partition('|')
    try:
        parsed = urlsplit(base)
        host = parsed.hostname
    except ValueError:
        return 'unsupported'
    if parsed.scheme == 'plugin':
        return 'kodi_plugin'
    if parsed.scheme not in ('http', 'https') or not host:
        if reference == 'here' or reference.startswith('#movies_pages='):
            return 'navigation'
        return 'resolver_required' if '=' in reference else 'unsupported'
    if host in ('localhost', '127.0.0.1', '::1'):
        return 'local_service_required'
    if re.search(r'\.(mp4|m3u8|mpd|webm|m4v|mov|ts)$', parsed.path, re.I):
        return 'headers_required' if separator else 'media_candidate'
    if external or re.search(r'\.(xml|m3u)$', parsed.path, re.I):
        return 'catalog_reference'
    return 'page_or_unresolved_url'


def parse_catalog(text):
    entries = []
    seen = set()
    for match in re.finditer(r'<(item|channel)\b[^>]*>(.*?)</\1>', text, re.I | re.S):
        block = match.group(2)
        title = clean(first(block, 'title') or first(block, 'name'))
        external = values(block, 'externallink')
        references = external or values(block, 'link')
        sources = [{'reference': ref, 'kind': classify(ref, bool(external)),
                    'playback_validated': False} for ref in references if ref]
        if not title or not sources or all(s['kind'] == 'navigation' for s in sources):
            continue
        identity = first(block, 'content_id') or hashlib.sha256(
            json.dumps([title, references], ensure_ascii=False).encode()).hexdigest()[:24]
        if identity in seen:
            continue
        seen.add(identity)
        entries.append({'id': identity, 'title': title,
                        'type': first(block, 'content_type') or ('series' if match.group(1).lower() == 'channel' else 'unknown'),
                        'tmdb_id': first(block, 'tmdb_id') or None,
                        'poster': first(block, 'thumbnail'), 'backdrop': first(block, 'fanart'),
                        'overview': clean(first(block, 'info')), 'sources': sources})
    return {'schema_version': 1, 'playback_validated': False,
            'summary': {'entries': len(entries), 'source_kinds': dict(Counter(
                s['kind'] for entry in entries for s in entry['sources']))}, 'entries': entries}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    with args.input.open('rb') as stream:
        data = stream.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        parser.error('Catalog exceeds 32 MB limit')
    result = parse_catalog(data.decode('utf-8-sig'))
    result['input_sha256'] = hashlib.sha256(data).hexdigest()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result['summary'], ensure_ascii=False))


if __name__ == '__main__':
    main()
