import unittest
from addon_catalog import classify, parse_catalog


class CatalogTests(unittest.TestCase):
    def test_signed_url_preserved(self):
        url = 'https://media.example/video.mp4?sig=a%252Fb%3D&expires=123'
        result = parse_catalog(f'<item><title>[B]Film[/B]</title><link><![CDATA[{url}]]></link></item>')
        source = result['entries'][0]['sources'][0]
        self.assertEqual(source['reference'], url)
        self.assertEqual(source['kind'], 'media_candidate')
        self.assertFalse(source['playback_validated'])

    def test_nonportable_sources(self):
        self.assertEqual(classify('resolver3_tvshows=title'), 'resolver_required')
        self.assertEqual(classify('plugin://video.example/play'), 'kodi_plugin')
        self.assertEqual(classify('http://127.0.0.1:55333/a.m3u8'), 'local_service_required')
        self.assertEqual(classify('https://example.com/a.m3u8|Referer=https%3A%2F%2Fexample.com'), 'headers_required')

    def test_navigation_dedup_and_entities(self):
        item = '<item><title>Film &amp; friends</title><content_id>same</content_id><link>https://example.com/watch?id=2&amp;x=3</link></item>'
        nav = '<item><title>Next</title><link>here</link><externallink>#movies_pages=https://example.com/page.xml#2</externallink></item>'
        result = parse_catalog(nav + item + item)
        self.assertEqual(result['summary']['entries'], 1)
        entry = result['entries'][0]
        self.assertEqual(entry['title'], 'Film & friends')
        self.assertEqual(entry['sources'][0]['reference'], 'https://example.com/watch?id=2&x=3')
        self.assertEqual(entry['sources'][0]['kind'], 'page_or_unresolved_url')

    def test_external_catalog_not_media(self):
        self.assertEqual(classify('https://example.com/catalog', True), 'catalog_reference')


if __name__ == '__main__':
    unittest.main()
