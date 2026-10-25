"""Parse public Overflix episode lists referenced by serie3 catalog entries."""
import json
import html
import re
import unicodedata
from urllib.parse import quote, urlencode, urlsplit

from addon_movie2 import INDEX_HOST, fetch


def normalized_title(value):
    plain = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().casefold()
    return ''.join(character for character in plain if character.isalnum())


def parse_search_results(page, host, title, year=''):
    """Accept only an exact title/year from the public series search results."""
    if not isinstance(page, str) or len(page) > 300_000:
        return []
    wanted = normalized_title(title)
    if not wanted:
        return []
    matches = []
    for href, body in re.findall(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', page, re.I | re.S):
        url = html.unescape(href)
        parsed = urlsplit(url)
        slug_match = re.fullmatch(r'/series/online/([a-z0-9-]+-\d{2,12})/', parsed.path)
        if parsed.scheme != 'https' or parsed.hostname != host or not slug_match or parsed.query or parsed.fragment:
            continue
        heading = re.search(r'<h3\b[^>]*>(.*?)</h3>', body, re.I | re.S)
        if not heading or normalized_title(html.unescape(re.sub(r'<[^>]+>', '', heading.group(1)))) != wanted:
            continue
        result_year = re.search(r'<p\b[^>]*>\s*((?:19|20)\d{2})\s*</p>', body, re.I | re.S)
        if year and (not result_year or result_year.group(1) != year):
            continue
        matches.append('serie3=' + slug_match.group(1))
    return list(dict.fromkeys(matches))


def find_series_reference(title, year=''):
    if not isinstance(title, str) or not 2 <= len(title.strip()) <= 160 or year and not re.fullmatch(r'(?:19|20)\d{2}', year):
        raise ValueError('invalid search metadata')
    landing, _, _, _ = fetch(f'https://{INDEX_HOST}/')
    host = urlsplit(landing).hostname or ''
    if not host.startswith('www.overflix.'):
        raise ValueError('unexpected series host')
    search_url = f'https://{host}/index.php?' + urlencode({
        'app': 'videobox', 'module': 'video', 'controller': 'index',
        'do': 'buscarContent', 'q': title.strip()})
    final, _, _, data = fetch(search_url, referer=f'https://{host}/buscar/', requested_with=True)
    if urlsplit(final).hostname != host:
        raise ValueError('series search left the expected host')
    results = parse_search_results(json.loads(data).get('html', ''), host, title, year)
    dubbed = [item for item in results if '-dublado-' in item]
    return dubbed[0] if len(dubbed) == 1 else results[0] if len(results) == 1 else None


def parse_series_page(page):
    section = re.search(r'<section\b[^>]*class="[^"]*vbEpisodes[^"]*".*?</section>', page, re.I | re.S)
    if not section:
        raise ValueError('episode section unavailable')
    text = section.group()
    video_id = re.search(r'data-video-id="(\d+)"', text)
    seasons = sorted({int(number) for number in re.findall(r'data-season="(\d+)"', text) if int(number) > 0})
    audio_options = re.findall(r'data-audio="([^"]+)"', page, re.I)
    current_audio = re.search(r'data-current-audio="([^"]+)"', text)
    audio = 'Dublado' if 'Dublado' in audio_options else current_audio.group(1) if current_audio else None
    if not video_id or not seasons or audio not in ('Dublado', 'Legendado'):
        raise ValueError('incomplete episode metadata')
    return int(video_id.group(1)), seasons, audio


def get_series_episodes(reference):
    if not reference.startswith('serie3='):
        raise ValueError('expected serie3 reference')
    slug = reference.partition('=')[2]
    if not re.fullmatch(r'[a-z0-9-]+-\d{2,12}', slug):
        raise ValueError('invalid series reference')
    landing, _, _, _ = fetch(f'https://{INDEX_HOST}/')
    host = urlsplit(landing).hostname or ''
    if not host.startswith('www.overflix.'):
        raise ValueError('unexpected series host')
    series_page = f'https://{host}/series/online/{slug}/'
    _, _, _, body = fetch(series_page)
    video_id, seasons, audio = parse_series_page(body.decode('utf-8', 'replace'))
    episodes = []
    for season in seasons:
        url = (f'https://{host}/index.php?app=videobox&module=video&controller=view'
               f'&do=episodesList&id={video_id}&season={season}&audio={quote(audio)}')
        _, _, _, data = fetch(url, referer=series_page, requested_with=True)
        payload = json.loads(data)
        for entry in payload.get('episodes') or []:
            episode_url = entry.get('url') or ''
            parsed = urlsplit(episode_url)
            if parsed.scheme != 'https' or parsed.hostname != host or not parsed.path.startswith('/episodios/online/'):
                continue
            episode_slug = parsed.path.rstrip('/').rsplit('/', 1)[-1]
            if not re.fullmatch(r'[a-z0-9-]+-\d{2,12}', episode_slug):
                continue
            try:
                number = int(entry['number'])
            except (ValueError, TypeError, KeyError):
                continue
            if number > 0:
                episodes.append({'season': season, 'episode': number,
                                 'language': 'pt' if audio == 'Dublado' else 'en',
                                 'name': entry.get('title') or f'Episódio {number}',
                                 'page_url': episode_url,
                                 'reference': f'episode3={episode_slug}'})
    return episodes
