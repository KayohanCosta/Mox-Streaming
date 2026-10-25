"""Loopback-only catalog service and test relay for supported addon references.

Run: python3 tools/addon_local_server.py
This server is for localhost testing, not deployment or a general URL proxy.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock, Thread
from concurrent.futures import ThreadPoolExecutor
import json
import re
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from urllib.parse import parse_qs, urlsplit

from addon_movie2 import resolve
from addon_series import get_series_episodes, find_series_reference, normalized_title

HOST, PORT = '127.0.0.1', 8791
CATALOG_DIR = Path(__file__).resolve().parents[1] / '.local' / 'addon-catalog'
CATALOGS = {}
for category in ('movies', 'series', 'novelas', 'animes', 'doramas'):
    file = CATALOG_DIR / f'{category}.json'
    if file.exists():
        CATALOGS[category] = json.loads(file.read_text(encoding='utf-8'))['entries']
channel_file = CATALOG_DIR / 'channels.json'
CHANNELS = json.loads(channel_file.read_text(encoding='utf-8'))['entries'] if channel_file.exists() else []
MOVIE_REFERENCES = {}
for item in CATALOGS.get('movies', []):
    tmdb_id = str(item.get('tmdb_id') or '')
    for source in item['sources']:
        match = re.search(r'(?:^|\|)movie2=([a-z0-9-]+)', source['reference'])
        if tmdb_id.isdigit() and match:
            candidate = 'movie2=' + match.group(1)
            if tmdb_id not in MOVIE_REFERENCES or ('dublado' in candidate and 'dublado' not in MOVIE_REFERENCES[tmdb_id]):
                MOVIE_REFERENCES[tmdb_id] = candidate
SERIES_REFERENCES = {}
SERIES_TITLES = {}
SERIES_METADATA = {}
for group in ('series', 'novelas', 'animes', 'doramas'):
    for item in CATALOGS.get(group, []):
        tmdb_id = str(item.get('tmdb_id') or '')
        if not tmdb_id.isdigit():
            continue
        SERIES_METADATA.setdefault(tmdb_id, {'title': item['title'], 'year': ''})
        for source in item['sources']:
            match = re.search(r'(?:^|[=|])serie3=([a-z0-9-]+-\d{2,12})(?:\||$)', source['reference'])
            if match:
                candidate = 'serie3=' + match.group(1)
                if tmdb_id not in SERIES_REFERENCES or ('dublado' in candidate and 'dublado' not in SERIES_REFERENCES[tmdb_id]):
                    SERIES_REFERENCES[tmdb_id] = candidate
                    SERIES_TITLES[tmdb_id] = item['title']
lock = Lock()
cache = {}
series_lock = Lock()
series_cache = {}
discovery_lock = Lock()
discovery_misses = {}
HEAD_BYTES = 8 * 1024 * 1024
TAIL_BYTES = 1024 * 1024


def fetch_window(source, start, end):
    headers = {'User-Agent': 'Mozilla/5.0', 'Referer': source['player_url'],
               'Range': f'bytes={start}-{end}'}
    with urlopen(Request(source['media_url'], headers=headers), timeout=20) as upstream:
        if upstream.status != 206 or upstream.headers.get_content_type() != 'video/mp4':
            raise ValueError('Origin did not return a partial MP4')
        data = upstream.read(end - start + 1)
        if len(data) != end - start + 1:
            raise ValueError('Incomplete startup window')
        return data


def warm_windows(result):
    try:
        size = result['size']
        tail_start = max(0, size - TAIL_BYTES)
        with ThreadPoolExecutor(max_workers=2) as pool:
            head_future = pool.submit(fetch_window, result, 0, min(size, HEAD_BYTES) - 1)
            tail_future = pool.submit(fetch_window, result, tail_start, size - 1)
            head_data = head_future.result()
            tail_data = tail_future.result()
        result.update(head_data=head_data, tail_data=tail_data, tail_start=tail_start)
    except Exception as exc:
        print(f'Warm-up failed: {type(exc).__name__}: {exc}', flush=True)


def episodes_for_series(series_id):
    reference = SERIES_REFERENCES.get(str(series_id))
    if not reference:
        raise ValueError('series has no public episode list')
    with series_lock:
        entry = series_cache.get(str(series_id))
        if entry and entry['until'] >= time.time():
            return entry['episodes']
    try:
        episodes = get_series_episodes(reference)
        if not episodes:
            raise ValueError('empty episode list')
    except Exception:
        # A catalog reference can become stale even though the title still exists.
        # Search the same public index by exact title before declaring it offline.
        metadata = SERIES_METADATA.get(str(series_id), {})
        fallback = search_series_reference([SERIES_TITLES.get(str(series_id)), metadata.get('title')], metadata.get('year', ''), exclude=reference)
        if not fallback:
            raise
        reference, episodes = fallback
        SERIES_REFERENCES[str(series_id)] = reference
    with series_lock:
        series_cache[str(series_id)] = {'episodes': episodes, 'until': time.time() + 1800}
    return episodes


def search_series_reference(titles, year='', exclude=None):
    seen = set()
    for title in titles:
        if not isinstance(title, str) or not 2 <= len(title.strip()) <= 160:
            continue
        key = normalized_title(title)
        if key in seen:
            continue
        seen.add(key)
        try:
            reference = find_series_reference(title, year)
            if not reference or reference == exclude:
                continue
            episodes = get_series_episodes(reference)
            if episodes:
                return reference, episodes
        except (ValueError, HTTPError, TimeoutError, OSError):
            continue
    return None


def discover_series(series_id, title, year='', original_title=''):
    if series_id in SERIES_REFERENCES:
        if title:
            SERIES_TITLES[series_id] = title
            SERIES_METADATA[series_id] = {'title': title, 'year': year}
        return True
    metadata = SERIES_METADATA.get(series_id, {})
    titles = [title, original_title, metadata.get('title')]
    if not any(isinstance(value, str) and 2 <= len(value.strip()) <= 160 for value in titles):
        return False
    key = (series_id, tuple(titles), year)
    with discovery_lock:
        if series_id in SERIES_REFERENCES:
            return True
        if discovery_misses.get(key, 0) > time.time():
            return False
        found = search_series_reference(titles, year)
        if not found:
            discovery_misses[key] = time.time() + 300
            return False
        reference, episodes = found
        SERIES_REFERENCES[series_id] = reference
        SERIES_TITLES[series_id] = title or original_title or metadata.get('title')
        SERIES_METADATA[series_id] = {'title': SERIES_TITLES[series_id], 'year': year}
        with series_lock:
            series_cache[series_id] = {'episodes': episodes, 'until': time.time() + 1800}
        return True


def episode_reference(series_id, season, episode):
    return next((item['reference'] for item in episodes_for_series(series_id)
                 if item['season'] == int(season) and item['episode'] == int(episode)), None)


def current_source(cache_key, reference, force=False):
    if not reference:
        raise ValueError('source unavailable')
    with lock:
        entry = cache.get(cache_key)
        if force or not entry or entry['until'] < time.time():
            result = resolve(reference)
            match = re.fullmatch(r'bytes 0-1023/(\d+)', result.get('content_range') or '')
            if not match:
                raise ValueError('Missing video size')
            size = int(match.group(1))
            result['size'] = size
            expires = parse_qs(urlsplit(result['media_url']).query).get('e', [None])[0]
            ttl = min(180, max(0, int(expires) - int(time.time()) - 60)) if expires and expires.isdigit() else 120
            if len(cache) >= 8:
                cache.pop(next(iter(cache)))
            cache[cache_key] = {'result': result, 'until': time.time() + ttl}
            Thread(target=warm_windows, args=(result,), daemon=True).start()
        return cache[cache_key]['result']


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_request = urlsplit(self.path)
        if parsed_request.path == '/catalog/channels':
            return self.json_response(200, {'channels': CHANNELS,
                                            'categories': list(dict.fromkeys(item['category'] for item in CHANNELS)),
                                            'total': len(CHANNELS), 'playback_validated': 0})
        if parsed_request.path == '/catalog/list':
            params = parse_qs(parsed_request.query)
            category = (params.get('category') or ['movies'])[0]
            if category not in CATALOGS and category != 'all':
                return self.json_response(400, {'error': 'invalid category'})
            query = (params.get('q') or [''])[0].strip().casefold()[:100]
            available_only = (params.get('available') or ['0'])[0] == '1'
            try:
                page = max(1, min(1000, int((params.get('page') or ['1'])[0])))
            except ValueError:
                return self.json_response(400, {'error': 'invalid page'})
            categories = list(CATALOGS) if category == 'all' else [category]
            matches = []
            for group in categories:
                for item in CATALOGS[group]:
                    tmdb_id = str(item.get('tmdb_id') or '')
                    if not tmdb_id.isdigit() or (query and query not in item['title'].casefold()):
                        continue
                    poster = item.get('poster') or ''
                    if urlsplit(poster).hostname != 'image.tmdb.org':
                        poster = ''
                    source = tmdb_id in (MOVIE_REFERENCES if group == 'movies' else SERIES_REFERENCES)
                    if available_only and not source:
                        continue
                    matches.append({'tmdb_id': int(tmdb_id), 'title': item['title'],
                                    'category': group, 'type': 'movie' if group == 'movies' else 'tv',
                                    'poster': poster, 'source_candidate': source})
            per_page = 40
            return self.json_response(200, {'items': matches[(page - 1) * per_page:page * per_page],
                                            'page': page, 'per_page': per_page, 'total': len(matches),
                                            'total_pages': (len(matches) + per_page - 1) // per_page})
        if self.path == '/health':
            entry = cache.get('movie:603')
            return self.json_response(200, {'status': 'ok', 'mode': 'local_test',
                                            'source_warm': bool(entry and entry['until'] > time.time() and entry['result'].get('head_data') and entry['result'].get('tail_data')),
                                            'catalog_counts': {k: len(v) for k, v in CATALOGS.items()},
                                            'movie2_count': len(MOVIE_REFERENCES),
                                            'series3_count': len(SERIES_REFERENCES)})
        catalog_match = re.fullmatch(r'/catalog/movie/(\d{1,12})', self.path)
        if catalog_match:
            movie_id = catalog_match.group(1)
            return self.json_response(200 if movie_id in MOVIE_REFERENCES else 404,
                                      {'tmdb_id': movie_id, 'available': movie_id in MOVIE_REFERENCES})
        series_match = re.fullmatch(r'/catalog/tv/(\d{1,12})', parsed_request.path)
        if series_match:
            series_id = series_match.group(1)
            params = parse_qs(parsed_request.query)
            title = (params.get('title') or [''])[0].strip()
            year = (params.get('year') or [''])[0]
            original_title = (params.get('original_title') or [''])[0].strip()
            try:
                available = discover_series(series_id, title, year, original_title)
                if available:
                    episodes_for_series(series_id)
            except Exception as exc:
                print(f'Series search unavailable for {series_id}: {type(exc).__name__}: {exc}', flush=True)
                available = False
            return self.json_response(200 if available else 404,
                                      {'tmdb_id': series_id, 'available': available})
        episode_list_match = re.fullmatch(r'/episodes/tv/(\d{1,12})', self.path)
        if episode_list_match:
            series_id = episode_list_match.group(1)
            try:
                episodes = episodes_for_series(series_id)
                return self.json_response(200, {'tmdb_id': int(series_id),
                                                'title': SERIES_TITLES[series_id],
                                                'numbering': 'season',
                                                'episodes': [{k: v for k, v in item.items() if k != 'reference'} for item in episodes]})
            except Exception as exc:
                return self.json_response(503, {'error': str(exc)})
        resolve_match = re.fullmatch(r'/resolve/movie/(\d{1,12})', self.path)
        if resolve_match:
            movie_id = resolve_match.group(1)
            try:
                result = current_source(f'movie:{movie_id}', MOVIE_REFERENCES.get(movie_id))
                return self.json_response(200, {'tmdb_id': movie_id, 'status': 'ready',
                                                'stream_url': f'/stream/movie/{movie_id}',
                                                'media_range_validated': result['media_range_validated']})
            except Exception as exc:
                return self.json_response(503, {'error': str(exc)})
        stream_match = re.fullmatch(r'/stream/movie/(\d{1,12})', self.path)
        if stream_match:
            movie_id = stream_match.group(1)
            if movie_id not in MOVIE_REFERENCES:
                return self.send_error(404)
            return self.stream(f'movie:{movie_id}', MOVIE_REFERENCES[movie_id])
        tv_match = re.fullmatch(r'/(resolve|stream)/tv/(\d{1,12})/(\d{1,4})/(\d{1,4})', self.path)
        if tv_match:
            action, series_id, season, episode = tv_match.groups()
            try:
                reference = episode_reference(series_id, season, episode)
                if not reference:
                    return self.json_response(404, {'error': 'episode unavailable'})
                key = f'tv:{series_id}:{season}:{episode}'
                if action == 'stream':
                    return self.stream(key, reference)
                result = current_source(key, reference)
                return self.json_response(200, {'status': 'ready',
                                                'stream_url': f'/stream/tv/{series_id}/{season}/{episode}',
                                                'media_range_validated': result['media_range_validated']})
            except Exception as exc:
                return self.json_response(503, {'error': str(exc)})
        self.send_error(404)

    def json_response(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def stream(self, cache_key, reference):
        for attempt in range(2):
            try:
                source = current_source(cache_key, reference, force=bool(attempt))
                headers = {'User-Agent': 'Mozilla/5.0', 'Referer': source['player_url']}
                requested_range = self.headers.get('Range')
                if requested_range:
                    match = re.fullmatch(r'bytes=(\d+)-(\d*)', requested_range)
                    if not match:
                        return self.send_error(400, 'Invalid range')
                    start = int(match.group(1))
                    end = int(match.group(2)) if match.group(2) else source['size'] - 1
                    if start >= source['size'] or end < start:
                        return self.send_error(416, 'Range not satisfiable')
                    regions = []
                    if source.get('head_data'):
                        regions.append((0, source['head_data']))
                    if source.get('tail_data'):
                        regions.append((source['tail_start'], source['tail_data']))
                    for region_start, region_data in regions:
                        region_end = region_start + len(region_data) - 1
                        if region_start <= start <= region_end:
                            continue_from_origin = region_start == 0 and end > region_end
                            served_end = end if continue_from_origin else min(end, region_end)
                            body = region_data[start - region_start:served_end - region_start + 1]
                            self.send_response(206)
                            self.send_header('Content-Type', 'video/mp4')
                            self.send_header('Content-Range', f'bytes {start}-{served_end}/{source["size"]}')
                            self.send_header('Content-Length', str(served_end - start + 1))
                            self.send_header('Accept-Ranges', 'bytes')
                            self.send_header('Cache-Control', 'no-store')
                            self.end_headers()
                            try:
                                self.wfile.write(body)
                                self.wfile.flush()
                                if continue_from_origin:
                                    headers['Range'] = f'bytes={region_end + 1}-{end}'
                                    with urlopen(Request(source['media_url'], headers=headers), timeout=20) as continuation:
                                        if continuation.status != 206 or continuation.headers.get_content_type() != 'video/mp4':
                                            raise ValueError('Origin continuation failed')
                                        while chunk := continuation.read(256 * 1024):
                                            self.wfile.write(chunk)
                            except (BrokenPipeError, ConnectionResetError):
                                pass
                            except Exception as exc:
                                self.log_message('continuation failed: %s', type(exc).__name__)
                            self.log_message('warm range=%s served=%s-%s continued=%s', requested_range, start, served_end, continue_from_origin)
                            return
                    headers['Range'] = requested_range
                with urlopen(Request(source['media_url'], headers=headers), timeout=20) as upstream:
                    self.log_message('upstream range=%s status=%s', headers.get('Range', 'none'), upstream.status)
                    if upstream.headers.get_content_type() != 'video/mp4':
                        return self.send_error(502, 'Origin did not return video')
                    self.send_response(upstream.status)
                    for name in ('Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges'):
                        value = upstream.headers.get(name)
                        if value:
                            self.send_header(name, value)
                    self.send_header('Cache-Control', 'no-store')
                    self.end_headers()
                    try:
                        while chunk := upstream.read(256 * 1024):
                            self.wfile.write(chunk)
                    except (BrokenPipeError, ConnectionResetError):
                        pass
                    return
            except HTTPError as exc:
                if exc.code in (403, 410) and attempt == 0:
                    continue
                self.send_error(502, 'Origin rejected video request')
                return
            except Exception:
                self.send_error(503, 'Video temporarily unavailable')
                return


if __name__ == '__main__':
    if '603' in MOVIE_REFERENCES:
        Thread(target=lambda: current_source('movie:603', MOVIE_REFERENCES['603']), daemon=True).start()
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
