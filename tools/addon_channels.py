"""Read public BrazucaPlay channel metadata; never decode embedded accounts."""
import re
import xml.etree.ElementTree as ET
from urllib.request import Request, urlopen

CHANNELS_URL = 'https://gist.githubusercontent.com/skyrisk/16070347f20c87c72540f9f805b57a66/raw/channels.xml'
MAX_CHANNEL_BYTES = 1024 * 1024
KODI_TAG = re.compile(r'\[[^]]+\]')
QUALITY = re.compile(r'\b(FHD|1080P|HD|720P|SD|480P|LOW)\b', re.I)
REGIONAL = re.compile(r'\b(?:BAHIA|BRASILIA|CAMPINAS|CASCAVEL|CEARA|FORTALEZA|GOIAS|MANAUS|MINAS|MG|PARANA|PERNAMBUCO|RECIFE|RIO|SALVADOR|SAO PAULO)\b', re.I)
NATIONAL_OPEN = {'CANAL DO BOI', 'FUTURA', 'REDE BRASIL', 'REDE TV', 'SBT NEWS',
                 'TV APARECIDA', 'TV BRASIL', 'TV CULTURA', 'TV NOVO TEMPO'}


def clean(value):
    return ' '.join(KODI_TAG.sub('', value or '').replace('|', ' ').split())


def quality_of(title):
    match = QUALITY.search(title)
    if not match:
        return 'low'
    return {'FHD': '1080', '1080P': '1080', 'HD': '720', '720P': '720'}.get(match.group(1).upper(), 'low')


def parse_channels(data):
    root = ET.fromstring(data)
    section = root.find('channel_1')
    if section is None:
        raise ValueError('channel_1 missing')
    channels = {}
    category = 'Canais'
    for item in section.findall('item'):
        raw_title = clean(item.findtext('title'))
        reference = (item.findtext('link') or '').strip()
        if reference == 'here':
            category = raw_title.title()
            continue
        if not reference.startswith('chresolver1='):
            continue
        quality = quality_of(raw_title)
        title = re.sub(r'\bH265\b', '', QUALITY.sub('', raw_title)).strip(' -')
        title = ' '.join(title.split())
        if category.casefold() == 'canais abertos':
            if 'FORTALEZA' not in title.upper() and title.upper() not in NATIONAL_OPEN:
                continue
        elif REGIONAL.search(title) and not re.search(r'\bFORTALEZA\b', title, re.I):
            continue
        key = (category.casefold(), title.casefold())
        entry = channels.setdefault(key, {'id': str(len(channels) + 1), 'title': title.title(),
                                          'category': category, 'logo': item.findtext('thumbnail') or '',
                                          'qualities': {}, 'playback_validated': False})
        # The source reference identifies a protected resolver, not a video URL.
        if quality not in entry['qualities'] or 'H265' not in raw_title.upper():
            entry['qualities'][quality] = {'label': {'low': 'Baixa', '720': '720p', '1080': '1080p'}[quality],
                                           'reference': reference, 'playback_url': None}
    return list(channels.values())


def fetch_channels():
    with urlopen(Request(CHANNELS_URL, headers={'User-Agent': 'MOX-local-catalog-test/1.0'}), timeout=20) as response:
        data = response.read(MAX_CHANNEL_BYTES + 1)
    if len(data) > MAX_CHANNEL_BYTES:
        raise ValueError('channel index too large')
    return parse_channels(data)
