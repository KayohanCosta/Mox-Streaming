"""Local proof of concept for public movie2 → MixDrop entries.

Reads one reference; does not execute Kodi code or use addon credentials.
Prints a short validation result by default. --output writes the full URL locally.
"""
import argparse
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

MAX_PAGE = 300_000
USER_AGENT = 'Mozilla/5.0'
INDEX_HOST = 'www.overflix.win'
PLAYER_HOSTS = {'mixdrop.top', 'mxdrop.click'}


def fetch(url, *, referer=None, range_header=None, requested_with=False):
    headers = {'User-Agent': USER_AGENT}
    if referer:
        headers['Referer'] = referer
    if range_header:
        headers['Range'] = range_header
    if requested_with:
        headers['X-Requested-With'] = 'XMLHttpRequest'
    with urlopen(Request(url, headers=headers), timeout=15) as response:
        final = response.url
        if urlsplit(final).scheme != 'https':
            raise ValueError('redirect outside HTTPS')
        data = response.read(1024 if range_header else MAX_PAGE + 1)
        if not range_header and len(data) > MAX_PAGE:
            raise ValueError('page exceeds size limit')
        return final, response.status, response.headers, data


def parse_servers(value):
    result = {}
    for part in html.unescape(value).split('&'):
        name, sep, video_id = part.partition('=')
        if sep and re.fullmatch(r'[A-Za-z0-9_-]{2,80}', video_id):
            result[name.strip().lower()] = video_id
    return result


def unpack_numeric_packer(source):
    """Decode literal numeric-symbol P.A.C.K.E.R. data, never evaluate JavaScript."""
    match = re.search(r"}\('(.*?)',\s*(\d+),\s*(\d+),\s*'(.*?)'\.split\('\|'\)", source, re.S)
    if not match or len(source) > 100_000:
        raise ValueError('unsupported packed player')
    payload, radix, count, symbols = match.groups()
    if int(radix) != 10 or int(count) > 500:
        raise ValueError('unsupported packer radix/count')
    table = symbols.split('|')
    if int(count) != len(table):
        raise ValueError('packer symbol count mismatch')
    return re.sub(r'\b\d+\b', lambda m: table[int(m.group())] if int(m.group()) < len(table) and table[int(m.group())] else m.group(), payload)


def media_from_player(page):
    packed = re.search(r'eval\s*\(function\(p,a,c,k,e,.*?</script>', page, re.I | re.S)
    if not packed:
        raise ValueError('player script not found')
    script = unpack_numeric_packer(packed.group())
    match = re.search(r'(?:MDCore\.)?(?:wurl|surl|vsr)\s*=\s*["\']([^"\']+)', script)
    if not match:
        raise ValueError('media URL not found in player')
    media = match.group(1)
    if media.startswith('//'):
        media = 'https:' + media
    parsed = urlsplit(media)
    if parsed.scheme != 'https' or not (parsed.hostname or '').endswith('.mxcontent.net') or not parsed.path.endswith('.mp4'):
        raise ValueError('unexpected media host or format')
    return media


def resolve(reference):
    if reference.startswith('movie2='):
        page_kind = 'filmes'
    elif reference.startswith('episode3='):
        page_kind = 'episodios'
    else:
        raise ValueError('expected movie2 or episode3 reference')
    slug = reference.partition('=')[2]
    if not re.fullmatch(r'[a-z0-9-]+-(\d{2,12})', slug):
        raise ValueError('invalid movie reference')
    video_id = slug.rsplit('-', 1)[1]
    landing, _, _, _ = fetch(f'https://{INDEX_HOST}/')
    landing_host = urlsplit(landing).hostname or ''
    if not landing_host.startswith('www.overflix.'):
        raise ValueError('index redirected to another service')
    index_url = f'https://{landing_host}/index.php?app=videobox&module=video&controller=view&do=playerData&id={video_id}'
    index_final, status, _, body = fetch(index_url, referer=f'https://{landing_host}/{page_kind}/online/{slug}/', requested_with=True)
    host = urlsplit(index_final).hostname or ''
    if status != 200 or not host.startswith('www.overflix.'):
        raise ValueError('index unavailable or redirected to another service')
    data = json.loads(body)
    servers = parse_servers(data.get('servers_dub') or '') or parse_servers(data.get('servers_leg') or '')
    mixdrop_id = servers.get('mixdrop')
    if not mixdrop_id:
        raise ValueError('no MixDrop source for this title')
    players = data.get('players') or []
    player_base = next((p.get('url') for p in players if (p.get('label') or '').lower() == 'mixdrop'), None)
    if not player_base or urlsplit(player_base).hostname not in PLAYER_HOSTS:
        raise ValueError('unrecognized MixDrop player')
    player_url = urljoin(player_base, mixdrop_id)
    player_final, status, _, body = fetch(player_url)
    if status != 200 or urlsplit(player_final).hostname not in PLAYER_HOSTS:
        raise ValueError('player unavailable or redirected to another service')
    media_url = media_from_player(body.decode('utf-8', 'replace'))
    media_final, status, headers, sample = fetch(media_url, referer=player_final, range_header='bytes=0-1023')
    validated = status == 206 and headers.get_content_type() == 'video/mp4' and b'ftyp' in sample[:32]
    return {'reference': reference, 'index_url': index_final, 'player_url': player_final,
            'media_url': media_url, 'media_final_url': media_final,
            'media_range_validated': validated, 'playback_validated': False,
            'content_range': headers.get('Content-Range'),
            'referer_required_or_used': player_final}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('reference')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        result = resolve(args.reference)
    except Exception as exc:
        print(f'unavailable: {exc}', file=sys.stderr)
        return 1
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'reference': result['reference'], 'media_range_validated': result['media_range_validated'],
                      'playback_validated': False, 'content_range': result['content_range']}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
