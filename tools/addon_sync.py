"""Refresh five public addon indexes into .local/addon-catalog (bounded downloads)."""
from pathlib import Path
from urllib.request import Request, urlopen
import json
import time

from addon_catalog import MAX_BYTES, parse_catalog
from addon_channels import CHANNELS_URL, fetch_channels

SEEDS = {
    'movies': 'https://gist.githubusercontent.com/skyrisk/5b87797329c7b46422565ffbaab3be7e/raw/page.xml',
    'series': 'https://gist.githubusercontent.com/skyrisk/16070347f20c87c72540f9f805b57a66/raw/SeriesBase',
    'novelas': 'https://gist.githubusercontent.com/skyrisk/07f1f4cd1b203cbf2efec959c4e8645a/raw/novelas.xml',
    'animes': 'https://gist.githubusercontent.com/skyrisk/16070347f20c87c72540f9f805b57a66/raw/AnimesBase',
    'doramas': 'https://gist.githubusercontent.com/skyrisk/16070347f20c87c72540f9f805b57a66/raw/DoramasBase',
}


def main():
    destination = Path(__file__).resolve().parents[1] / '.local' / 'addon-catalog'
    destination.mkdir(parents=True, exist_ok=True)
    for category, url in SEEDS.items():
        try:
            with urlopen(Request(url, headers={'User-Agent': 'MOX-local-catalog-test/1.0'}), timeout=30) as response:
                data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise ValueError('catalog exceeds 32 MB limit')
            parsed = parse_catalog(data.decode('utf-8-sig'))
            parsed['category'] = category
            parsed['source_url'] = url
            parsed['fetched_at'] = int(time.time())
            path = destination / f'{category}.json'
            temporary = path.with_suffix('.tmp')
            temporary.write_text(json.dumps(parsed, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            temporary.replace(path)
            print(f'{category}: {parsed["summary"]["entries"]} entries')
        except Exception as exc:
            print(f'{category}: unavailable ({type(exc).__name__}: {exc})')
    try:
        channels = {'entries': fetch_channels(), 'source_url': CHANNELS_URL,
                    'fetched_at': int(time.time())}
        path = destination / 'channels.json'
        temporary = path.with_suffix('.tmp')
        temporary.write_text(json.dumps(channels, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        temporary.replace(path)
        print(f'channels: {len(channels["entries"])} unique entries')
    except Exception as exc:
        print(f'channels: unavailable ({type(exc).__name__}: {exc})')


if __name__ == '__main__':
    main()
