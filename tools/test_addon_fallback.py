import unittest
from unittest.mock import patch

import addon_local_server as server


class FallbackTests(unittest.TestCase):
    def test_stale_episode_reference_recovers_with_exact_catalog_title(self):
        series_id = '987654321'
        old = server.SERIES_REFERENCES.get(series_id)
        old_meta = server.SERIES_METADATA.get(series_id)
        old_title = server.SERIES_TITLES.get(series_id)
        server.SERIES_REFERENCES[series_id] = 'serie3=stale-123'
        server.SERIES_METADATA[series_id] = {'title': 'Título original', 'year': '2020'}
        server.SERIES_TITLES[series_id] = 'Título traduzido'
        server.series_cache.pop(series_id, None)
        episodes = [{'season': 1, 'episode': 1, 'reference': 'episode3=working-456'}]

        def find(title, year):
            self.assertEqual(year, '2020')
            return 'serie3=working-456' if title == 'Título original' else None

        try:
            with patch.object(server, 'find_series_reference', side_effect=find), patch.object(
                server, 'get_series_episodes', side_effect=lambda ref: episodes if ref == 'serie3=working-456' else (_ for _ in ()).throw(ValueError('stale'))
            ):
                self.assertEqual(server.episodes_for_series(series_id), episodes)
                self.assertEqual(server.SERIES_REFERENCES[series_id], 'serie3=working-456')
        finally:
            server.series_cache.pop(series_id, None)
            for target, value in ((server.SERIES_REFERENCES, old), (server.SERIES_METADATA, old_meta), (server.SERIES_TITLES, old_title)):
                if value is None:
                    target.pop(series_id, None)
                else:
                    target[series_id] = value


if __name__ == '__main__':
    unittest.main()
